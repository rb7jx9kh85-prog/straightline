// =============================================================================
//  /api/coach — le cerveau de SL Copilot (fonction serverless edge)
//
//  Fournisseur : OpenAI (Chat Completions, en streaming, sortie JSON forcée).
//
//  1. Reçoit le transcript roulant (12-20 dernières répliques).
//  2. Appelle OpenAI EN STREAMING : system prompt (méthode Straight Line,
//     ./_systemPrompt.js, mot pour mot) + le transcript comme message user.
//  3. Force `response_format: json_object` → réponse toujours parsable.
//  4. Re-streame le texte JSON au navigateur, qui l'affiche au fil de l'eau.
//
//  Sécurité : OPENAI_API_KEY vit UNIQUEMENT ici. Le navigateur ne parle qu'à
//             ce backend, jamais directement à OpenAI.
//
//  Variables d'environnement :
//    OPENAI_API_KEY   (obligatoire) — ta clé OpenAI (sk-...)
//    COACH_MODEL      (optionnel)   — défaut "gpt-4o-mini" (rapide, < 0,8 s)
//    OPENAI_BASE_URL  (optionnel)   — endpoint compatible OpenAI (Azure, proxy…)
// =============================================================================

import { SYSTEM_PROMPT } from './_systemPrompt.js';

export const config = { runtime: 'edge' };

const DEFAULT_MODEL = 'gpt-4o-mini';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY non configurée côté serveur. Ajoute-la dans Vercel → Settings → Environment Variables, puis redéploie.' }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Corps de requête JSON invalide.' }, 400);
  }

  const turns = Array.isArray(body?.turns) ? body.turns : [];
  const businessType = body?.business_type || 'restaurant';
  const now = body?.now || new Date().toISOString();
  const hint = typeof body?.hint === 'string' ? body.hint : '';
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : '';
  const callId = typeof body?.call_id === 'string' ? body.call_id.slice(0, 64) : '';

  const model = process.env.COACH_MODEL || DEFAULT_MODEL;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

  // ---- Message utilisateur : le transcript roulant -------------------------
  const transcript = turns
    .map((t) => `[${t.speaker === 'PROSPECT' ? 'PROSPECT' : 'MOI'}] ${t.text}`)
    .join('\n');

  let userContent =
    `Type de commerce du prospect : ${businessType}.\n` +
    `Horodatage : ${now}.\n\n` +
    `Transcription en direct (les plus récentes en bas) :\n` +
    `${transcript || "[aucune réplique encore — le vendeur va ouvrir l'appel]"}\n\n` +
    `Donne MAINTENANT la prochaine réplique optimale pour [MOI], au format JSON strict du schéma.`;

  if (notes) {
    userContent +=
      `\n\nNotes du vendeur sur ce prospect / cette situation :\n${notes}\n` +
      `(Tiens compte de ces notes pour personnaliser la réponse.)`;
  }

  if (hint) {
    userContent +=
      `\n\nContrainte : propose une FORMULATION DIFFÉRENTE de la précédente ` +
      `(même phase/objectif, le vendeur veut une alternative). ${hint}`;
  }

  // ---- Appel OpenAI en streaming -------------------------------------------
  let upstream;
  try {
    upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        temperature: 0.55,
        stream: true,
        response_format: { type: 'json_object' },
        // `prompt_cache_key` : route les tours successifs du MÊME appel vers le
        // même cache de prompt OpenAI, pour que le gros system prompt (~2 500
        // tokens, Straight Line complet) reste "chaud" d'un tour à l'autre →
        // 1er token nettement plus rapide sans rien changer à la qualité de
        // la réponse (contrairement à `cache_control`, propre à Anthropic et
        // sans effet ici, qu'il remplace).
        ...(callId ? { prompt_cache_key: callId } : {}),
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
      }),
    });
  } catch (err) {
    return json({ error: 'Échec de connexion à OpenAI : ' + String(err?.message || err) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    let message = `OpenAI a renvoyé ${upstream.status}`;
    let detail = '';
    try {
      const errJson = await upstream.json();
      message = errJson?.error?.message || message;
      detail = JSON.stringify(errJson);
    } catch {
      detail = await upstream.text().catch(() => '');
    }
    return json({ error: message, detail, status: upstream.status }, 502);
  }

  // ---- Re-streaming vers le navigateur : on ne renvoie que le TEXTE (JSON) --
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = '';
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // garde la ligne partielle
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') { controller.close(); return; }
            try {
              const evt = JSON.parse(data);
              const delta = evt.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length) {
                controller.enqueue(encoder.encode(delta));
              } else if (evt.error) {
                controller.enqueue(encoder.encode(JSON.stringify({ error: evt.error?.message || 'erreur OpenAI' })));
              }
            } catch {
              /* ligne SSE non-JSON (keep-alive) : on ignore */
            }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(JSON.stringify({ error: String(err?.message || err) })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}

// =============================================================================
//  /api/coach — le cerveau de SL Copilot (fonction serverless edge)
//
//  Fournisseur : OpenAI (Chat Completions API, en streaming).
//
//  - Reçoit le transcript roulant (12-20 dernières répliques, JSON, section 5).
//  - Appelle l'API OpenAI EN STREAMING avec le system prompt de la section 6
//    (collé mot pour mot dans ./_systemPrompt.js) comme message "system".
//  - Force une sortie JSON (response_format: json_object) → toujours parsable.
//  - Renvoie en streaming le texte (JSON structuré) que le front parse au fil de l'eau.
//
//  Sécurité : la clé OPENAI_API_KEY vit UNIQUEMENT ici (variable d'env serveur).
//             Le navigateur ne parle qu'à ce backend, jamais à OpenAI.
//
//  Variables d'environnement :
//    OPENAI_API_KEY   (obligatoire)  — ta clé OpenAI (sk-...)
//    COACH_MODEL      (optionnel)    — modèle, défaut "gpt-4o-mini" (rapide, < 0,8 s)
//    OPENAI_BASE_URL  (optionnel)    — endpoint compatible OpenAI, défaut api.openai.com/v1
// =============================================================================

import { SYSTEM_PROMPT } from './_systemPrompt.js';

export const config = { runtime: 'edge' };

const DEFAULT_MODEL = 'gpt-4o-mini'; // rapide & économique. Surchargable via COACH_MODEL.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json({ error: 'OPENAI_API_KEY non configurée côté serveur.' }, 500);
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
  // Indice optionnel : "alternative" pour redemander une autre formulation (touche →).
  const hint = typeof body?.hint === 'string' ? body.hint : '';

  const model = process.env.COACH_MODEL || DEFAULT_MODEL;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

  // ---- Construction du message utilisateur (le transcript roulant) ----------
  const transcript = turns
    .map((t) => `[${t.speaker === 'PROSPECT' ? 'PROSPECT' : 'MOI'}] ${t.text}`)
    .join('\n');

  let userContent =
    `Type de commerce du prospect : ${businessType}.\n` +
    `Horodatage : ${now}.\n\n` +
    `Transcription en direct de la conversation (les plus récentes en bas) :\n` +
    `${transcript || '[aucune réplique encore — le vendeur va ouvrir l\'appel]'}\n\n` +
    `Donne MAINTENANT la prochaine réplique optimale pour [MOI], au format JSON strict du schéma.`;

  if (hint) {
    userContent +=
      `\n\nContrainte supplémentaire : propose une FORMULATION DIFFÉRENTE de la précédente ` +
      `(le vendeur veut une alternative), même phase/objectif. ${hint}`;
  }

  // ---- Appel OpenAI en streaming (SSE) ---------------------------------------
  const payload = {
    model,
    max_tokens: 512,
    temperature: 0.6,
    stream: true,
    response_format: { type: 'json_object' }, // garantit un JSON valide (pas de fences)
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
  };

  let upstream;
  try {
    upstream = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: 'Échec de connexion à OpenAI : ' + String(err?.message || err) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    let detail = '';
    let message = `OpenAI a renvoyé ${upstream.status}`;
    try {
      const errJson = await upstream.json();
      message = errJson?.error?.message || message;
      detail = JSON.stringify(errJson);
    } catch {
      detail = await upstream.text().catch(() => '');
    }
    return json({ error: message, detail }, 502);
  }

  // ---- Re-streaming vers le navigateur : on ne renvoie que le TEXTE (le JSON) -
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

          // Découpage SSE par lignes "data: {...}"
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // garde la ligne partielle
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const data = trimmed.slice(5).trim();
            if (!data) continue;
            if (data === '[DONE]') {
              controller.close();
              return;
            }
            try {
              const evt = JSON.parse(data);
              const delta = evt.choices?.[0]?.delta?.content;
              if (typeof delta === 'string' && delta.length) {
                controller.enqueue(encoder.encode(delta));
              } else if (evt.error) {
                controller.enqueue(
                  encoder.encode(JSON.stringify({ error: evt.error?.message || 'erreur OpenAI' })),
                );
              }
            } catch {
              /* ligne SSE non-JSON (commentaire/keep-alive) : on ignore */
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

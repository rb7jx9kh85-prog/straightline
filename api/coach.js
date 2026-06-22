// =============================================================================
//  /api/coach — le cerveau de SL Copilot (fonction serverless edge)
//
//  - Reçoit le transcript roulant (12-20 dernières répliques, JSON, section 5).
//  - Appelle l'API Messages d'Anthropic EN STREAMING avec le system prompt
//    de la section 6 (collé mot pour mot dans ./_systemPrompt.js).
//  - Met en cache le system prompt (prompt caching) → tours suivants plus rapides.
//  - Renvoie en streaming le texte (JSON structuré) que le front parse au fil de l'eau.
//
//  Sécurité : la clé ANTHROPIC_API_KEY vit UNIQUEMENT ici (variable d'env serveur).
//             Le navigateur ne parle qu'à ce backend, jamais à Anthropic.
// =============================================================================

import { SYSTEM_PROMPT } from './_systemPrompt.js';

export const config = { runtime: 'edge' };

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5'; // rapide (< 0,8 s). Surchargable via COACH_MODEL.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json(
      { error: 'ANTHROPIC_API_KEY non configurée côté serveur.' },
      500,
    );
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

  // ---- Appel Anthropic en streaming (SSE) ------------------------------------
  const payload = {
    model,
    max_tokens: 512,
    stream: true,
    system: [
      {
        type: 'text',
        text: SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' }, // cache du prompt → latence/coût réduits
      },
    ],
    messages: [{ role: 'user', content: userContent }],
  };

  let upstream;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return json({ error: 'Échec de connexion à Anthropic : ' + String(err?.message || err) }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '');
    return json({ error: `Anthropic a renvoyé ${upstream.status}`, detail }, 502);
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
            if (!data || data === '[DONE]') continue;
            try {
              const evt = JSON.parse(data);
              if (
                evt.type === 'content_block_delta' &&
                evt.delta &&
                evt.delta.type === 'text_delta' &&
                typeof evt.delta.text === 'string'
              ) {
                controller.enqueue(encoder.encode(evt.delta.text));
              } else if (evt.type === 'error') {
                controller.enqueue(
                  encoder.encode(
                    JSON.stringify({ error: evt.error?.message || 'erreur Anthropic' }),
                  ),
                );
              }
            } catch {
              /* ligne SSE non-JSON (ping, etc.) : on ignore */
            }
          }
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(JSON.stringify({ error: String(err?.message || err) })),
        );
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

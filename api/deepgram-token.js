// =============================================================================
//  /api/deepgram-token — émet un token éphémère Deepgram (courte durée)
//
//  Le front utilise ce token pour ouvrir directement le WebSocket Deepgram,
//  SANS jamais voir la clé permanente (qui reste côté serveur).
//  Si DEEPGRAM_API_KEY n'est pas configurée, le front bascule sur Web Speech.
// =============================================================================

export const config = { runtime: 'edge' };

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

export default async function handler(req) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405);
  }

  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) {
    return json(
      { error: 'DEEPGRAM_API_KEY non configurée. Utilisez Web Speech ou la simulation.' },
      501,
    );
  }

  // Token éphémère (grant token, TTL court). Le front l'utilise comme bearer WS.
  try {
    const r = await fetch('https://api.deepgram.com/v1/auth/grant', {
      method: 'POST',
      headers: {
        Authorization: `Token ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ ttl_seconds: 30 }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      return json({ error: 'Échec de génération du token Deepgram', detail }, 502);
    }
    const data = await r.json();
    // data => { access_token, expires_in }
    return json(data, 200);
  } catch (err) {
    return json({ error: String(err?.message || err) }, 502);
  }
}

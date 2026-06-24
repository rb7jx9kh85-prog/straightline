// =============================================================================
//  /api/transcribe — transcription audio via OpenAI Whisper (fonction edge).
//
//  Pourquoi : la Web Speech API du navigateur ne marche pas (ou très mal) sur
//  iPhone/Safari. Ici on enregistre l'audio par segments (MediaRecorder) côté
//  navigateur et on le transcrit côté serveur avec Whisper → fiable partout,
//  iPhone inclus.
//
//  Reçoit  : multipart/form-data avec un champ "audio" (le segment enregistré).
//  Renvoie : { text } — la transcription FR du segment.
//  Sécurité: la clé OpenAI reste côté serveur. Rien n'est stocké (éphémère).
//
//  Variables d'environnement :
//    OPENAI_API_KEY    (obligatoire) — ta clé OpenAI (sk-...)
//    TRANSCRIBE_MODEL  (optionnel)   — défaut "whisper-1" (compatible partout).
//                                       Plus rapide : "gpt-4o-mini-transcribe".
//    OPENAI_BASE_URL   (optionnel)   — endpoint compatible OpenAI (Azure, proxy…)
// =============================================================================

export const config = { runtime: 'edge' };

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
    return json({ error: 'OPENAI_API_KEY non configurée côté serveur. Ajoute-la dans Vercel, puis redéploie.' }, 500);
  }

  let form;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Requête invalide (multipart/form-data attendu).' }, 400);
  }

  const audio = form.get('audio');
  if (!audio || typeof audio === 'string') {
    return json({ error: 'Aucun fichier audio reçu.' }, 400);
  }

  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.TRANSCRIBE_MODEL || 'whisper-1';

  const out = new FormData();
  out.append('file', audio, audio.name || 'segment.webm');
  out.append('model', model);
  out.append('language', 'fr');
  out.append('response_format', 'json');

  let upstream;
  try {
    upstream = await fetch(`${baseURL}/audio/transcriptions`, {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: out,
    });
  } catch (err) {
    return json({ error: 'Échec de connexion à OpenAI : ' + String(err?.message || err) }, 502);
  }

  if (!upstream.ok) {
    let message = `OpenAI a renvoyé ${upstream.status}`;
    try {
      const errJson = await upstream.json();
      message = errJson?.error?.message || message;
    } catch {
      /* corps non-JSON */
    }
    return json({ error: message, status: upstream.status }, 502);
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    return json({ error: 'Réponse Whisper illisible.' }, 502);
  }

  return json({ text: (data?.text || '').trim() });
}

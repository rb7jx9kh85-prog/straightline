// =============================================================================
//  micRecorder — capture micro par segments + transcription Whisper (/api/transcribe)
//
//  Alternative à la Web Speech API, qui ne marche pas sur iPhone/Safari.
//  • getUserMedia + MediaRecorder : supporté sur iOS Safari (≥ 14.3) en HTTPS.
//  • Découpe l'audio dès que la personne fait une PAUSE (détection de silence
//    via Web Audio), envoie le segment à /api/transcribe → texte FR.
//  • Tombe en repli sur un découpage temporel si l'analyse audio échoue.
//  • Rien n'est stocké : chaque segment est transcrit puis jeté (éphémère).
//
//  ⚠️ iOS ne donne PAS l'audio d'un appel téléphonique au navigateur. Mets le
//     call sur HAUT-PARLEUR : le micro capte alors les deux voix dans la pièce.
// =============================================================================

export const recorderSupported =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof window !== 'undefined' &&
  typeof window.MediaRecorder !== 'undefined';

// iPhone / iPad (y compris iPad « desktop » qui se fait passer pour un Mac).
export const isIOS =
  typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1));

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/mpeg'];
  for (const m of candidates) {
    try { if (window.MediaRecorder.isTypeSupported(m)) return m; } catch { /* ignore */ }
  }
  return ''; // laisse le navigateur choisir (iOS → mp4)
}

function extFor(mime) {
  if (mime.includes('mp4') || mime.includes('aac')) return 'mp4';
  if (mime.includes('mpeg')) return 'mp3';
  return 'webm';
}

export async function createRecorder({
  onSpeechStart, // appelé quand une prise de parole commence (→ latch du locuteur)
  onText, // appelé avec le texte transcrit d'un segment
  onError,
  silenceMs = 700, // durée de silence qui clôt un segment
  maxSegmentMs = 12000, // garde-fou : longueur max d'un segment
  fallbackSegmentMs = 5000, // sans détection audio : on coupe à intervalle fixe
} = {}) {
  if (!recorderSupported) throw new Error('Enregistrement audio non supporté par ce navigateur.');

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
  } catch {
    throw new Error('Micro refusé — autorise le micro pour ce site (iPhone : Réglages → Safari → Micro).');
  }

  const mime = pickMime();
  const ext = extFor(mime);

  // --- Détection de parole/silence (optionnelle, dégrade proprement) ---------
  let analyser = null;
  let audioCtx = null;
  let data = null;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      audioCtx = new AC();
      const source = audioCtx.createMediaStreamSource(stream);
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      data = new Uint8Array(analyser.fftSize);
    }
  } catch {
    analyser = null;
  }
  const hasVAD = !!analyser;

  let running = false;
  let rec = null;
  let chunks = [];
  let voiced = false;
  let speaking = false;
  let silenceAt = 0;
  let segStart = 0;
  let tick = null;

  async function transcribe(blob) {
    if (blob.size < 1500) return; // segment trop court → probablement du silence
    const fd = new FormData();
    fd.append('audio', blob, `segment.${ext}`);
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      if (!res.ok) {
        let msg = `Erreur ${res.status}`;
        try { const j = await res.json(); msg = j.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const j = await res.json();
      const text = (j.text || '').trim();
      if (text) onText?.(text);
    } catch (err) {
      onError?.(err?.message || String(err));
    }
  }

  function newSegment() {
    chunks = [];
    voiced = !hasVAD; // sans VAD : on transcrit tout (on ne peut pas filtrer le silence)
    segStart = performance.now();
    if (!hasVAD) onSpeechStart?.(); // latch le locuteur dès le début du segment
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      rec = new MediaRecorder(stream);
    }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      const had = voiced;
      const blob = new Blob(chunks, { type: mime || 'audio/webm' });
      if (running) newSegment(); // enchaîne immédiatement (coupure minimale)
      if (had) transcribe(blob); // ne transcrit que si on a entendu de la voix
    };
    try { rec.start(); } catch (e) { onError?.(e?.message || 'MediaRecorder a échoué'); }
  }

  function cut() {
    try { if (rec && rec.state !== 'inactive') rec.stop(); } catch { /* ignore */ }
  }

  function loop() {
    if (!running) return;
    const now = performance.now();

    if (hasVAD) {
      analyser.getByteTimeDomainData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) { const v = (data[i] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / data.length);
      const THRESH = 0.025;

      if (rms > THRESH) {
        if (!voiced) { voiced = true; onSpeechStart?.(); } // 1ère voix du segment → latch
        speaking = true;
        silenceAt = 0;
      } else if (speaking) {
        if (!silenceAt) silenceAt = now;
        else if (now - silenceAt > silenceMs && voiced) {
          speaking = false; silenceAt = 0;
          cut(); // pause détectée après de la parole → on clôt le segment
        }
      }
      if (voiced && now - segStart > maxSegmentMs) cut(); // garde-fou
    } else if (now - segStart > fallbackSegmentMs) {
      cut(); // pas de VAD : coupe à intervalle fixe
    }
  }

  return {
    start() {
      if (running) return;
      running = true;
      if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {});
      newSegment();
      tick = setInterval(loop, 100);
    },
    stop() {
      running = false;
      if (tick) { clearInterval(tick); tick = null; }
      cut();
      try { audioCtx?.close(); } catch { /* ignore */ }
      stream.getTracks().forEach((t) => t.stop());
    },
  };
}

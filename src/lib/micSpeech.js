// =============================================================================
//  micSpeech — reconnaissance vocale du navigateur (Web Speech API)
//
//  • Micro du PC, français, ZÉRO clé, transcription éphémère (rien n'est stocké).
//  • Sur haut-parleur, le micro entend les deux voix de l'appel.
//  • L'attribution du locuteur (MOI / PROSPECT) est pilotée par l'app
//    (bouton « parler » / push-to-talk) car Web Speech ne sépare pas les voix.
//  • Chrome coupe le moteur périodiquement : on le relance tant qu'on écoute.
// =============================================================================

const SR =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export const micSupported = !!SR;

export function createMic({ lang = 'fr-FR', onInterim, onFinal, onError } = {}) {
  if (!SR) throw new Error('Reconnaissance vocale non supportée — utilise Chrome, ou passe en Simulation.');

  let rec = null;
  let running = false;

  const spin = () => {
    rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const txt = (r[0]?.transcript || '').trim();
        if (!txt) continue;
        if (r.isFinal) onFinal?.(txt);
        else interim += r[0].transcript;
      }
      const it = interim.trim();
      if (it) onInterim?.(it);
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return; // bénin
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        running = false;
        onError?.('Micro refusé — autorise le micro pour ce site dans le navigateur.');
        return;
      }
      onError?.(e.error || 'erreur de reconnaissance vocale');
    };

    rec.onend = () => {
      // Relance automatique tant qu'on est censé écouter.
      if (running) {
        try { rec.start(); } catch { /* déjà relancé */ }
      }
    };

    try { rec.start(); } catch { /* déjà démarré */ }
  };

  return {
    start() {
      if (running) return;
      running = true;
      spin();
    },
    stop() {
      running = false;
      if (rec) {
        try { rec.onend = null; rec.stop(); } catch { /* */ }
      }
      rec = null;
    },
  };
}

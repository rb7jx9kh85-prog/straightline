// Provider STT n°1 : Web Speech API (natif navigateur, français, ZÉRO clé).
// Capte le micro. Le locuteur (MOI / PROSPECT) est piloté par l'app (toggle / push-to-talk),
// car le Web Speech ne fait pas de diarization.

export class WebSpeechProvider {
  static get isSupported() {
    return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  constructor() {
    this.recognition = null;
    this.running = false;
    this.handlers = {};
    this._restart = false;
  }

  async start(handlers = {}) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) throw new Error("Web Speech API non supportée par ce navigateur (essayez Chrome).");
    this.handlers = handlers;

    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        const txt = r[0].transcript;
        if (r.isFinal) {
          this.handlers.onFinal && this.handlers.onFinal(txt.trim());
        } else {
          interim += txt;
        }
      }
      if (interim) this.handlers.onInterim && this.handlers.onInterim(interim.trim());
    };

    rec.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      this.handlers.onError && this.handlers.onError(e.error || 'erreur reconnaissance');
    };

    rec.onend = () => {
      // Le moteur s'arrête tout seul périodiquement → on relance tant qu'on écoute.
      if (this._restart && this.running) {
        try { rec.start(); } catch { /* déjà en cours */ }
      }
    };

    this.recognition = rec;
    this.running = true;
    this._restart = true;
    rec.start();
  }

  stop() {
    this.running = false;
    this._restart = false;
    if (this.recognition) {
      try { this.recognition.stop(); } catch { /* ignore */ }
    }
  }
}

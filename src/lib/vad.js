// VAD (Voice Activity Detection) côté client — détection énergie + hangover.
// Sert à : (1) l'indicateur "le prospect parle", (2) déclencher au silence en mode micro.

export class VAD {
  constructor(stream, { onSpeechStart, onSpeechEnd, threshold = 0.012, hangoverMs = 550 } = {}) {
    this.stream = stream;
    this.onSpeechStart = onSpeechStart || (() => {});
    this.onSpeechEnd = onSpeechEnd || (() => {});
    this.threshold = threshold;
    this.hangoverMs = hangoverMs;
    this.speaking = false;
    this.lastVoice = 0;
    this._raf = null;
    this._ctx = null;
  }

  start() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this._ctx = new Ctx();
    const src = this._ctx.createMediaStreamSource(this.stream);
    const analyser = this._ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = performance.now();

      if (rms > this.threshold) {
        this.lastVoice = now;
        if (!this.speaking) {
          this.speaking = true;
          this.onSpeechStart();
        }
      } else if (this.speaking && now - this.lastVoice > this.hangoverMs) {
        this.speaking = false;
        this.onSpeechEnd();
      }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    if (this._ctx) {
      this._ctx.close().catch(() => {});
      this._ctx = null;
    }
    this.speaking = false;
  }
}

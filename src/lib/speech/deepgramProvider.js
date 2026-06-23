// Provider STT n°2 : Deepgram (streaming WS, français, diarization).
// Option "propre" du cahier des charges. Récupère un token éphémère via /api/deepgram-token
// (la clé permanente reste côté serveur), puis ouvre le WebSocket Deepgram directement.
//
// Diarization : Deepgram renvoie un index de locuteur par mot. Par convention,
// le 1er locuteur entendu = MOI (le vendeur), les autres = PROSPECT. Best-effort.

export class DeepgramProvider {
  constructor() {
    this.ws = null;
    this.recorder = null;
    this.stream = null;
    this.handlers = {};
    this.firstSpeaker = null;
  }

  async start(handlers = {}, { source = 'mic' } = {}) {
    this.handlers = handlers;
    this.source = source;

    // 1) token éphémère
    const tokRes = await fetch('/api/deepgram-token');
    if (!tokRes.ok) {
      const d = await tokRes.json().catch(() => ({}));
      throw new Error(d.error || 'Token Deepgram indisponible.');
    }
    const { access_token } = await tokRes.json();
    if (!access_token) throw new Error('Token Deepgram vide.');

    // 2) capture audio : micro (haut-parleur) OU audio de l'onglet partagé (le call)
    if (source === 'tab') {
      this.stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      const audio = this.stream.getAudioTracks();
      if (!audio.length) {
        this.stream.getTracks().forEach((t) => t.stop());
        throw new Error("Aucune piste audio partagée — relance et coche « Partager l'audio de l'onglet ».");
      }
      this.stream.getVideoTracks().forEach((t) => t.stop()); // on ne garde que le son
      this.captureStream = new MediaStream(audio);
    } else {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.captureStream = this.stream;
    }

    // 3) WebSocket Deepgram (token passé via sous-protocole, pas d'en-tête possible côté navigateur)
    const params = new URLSearchParams({
      model: 'nova-2',
      language: 'fr',
      smart_format: 'true',
      interim_results: 'true',
      diarize: 'true',
      punctuate: 'true',
      endpointing: '500',
      utterance_end_ms: '1000',
    });
    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`;
    const ws = new WebSocket(url, ['token', access_token]);
    this.ws = ws;

    ws.onopen = () => {
      const rec = new MediaRecorder(this.captureStream, { mimeType: 'audio/webm' });
      this.recorder = rec;
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0 && ws.readyState === WebSocket.OPEN) ws.send(e.data);
      };
      rec.start(250); // chunks de 250 ms
    };

    ws.onmessage = (msg) => {
      let data;
      try { data = JSON.parse(msg.data); } catch { return; }

      if (data.type === 'UtteranceEnd') {
        this.handlers.onUtteranceEnd && this.handlers.onUtteranceEnd();
        return;
      }
      const alt = data.channel?.alternatives?.[0];
      if (!alt) return;
      const text = (alt.transcript || '').trim();
      if (!text) return;

      // locuteur dominant de l'énoncé
      let speakerIdx = 0;
      if (alt.words && alt.words.length) {
        speakerIdx = alt.words[0].speaker ?? 0;
      }
      if (this.firstSpeaker === null) this.firstSpeaker = speakerIdx;
      const speaker = speakerIdx === this.firstSpeaker ? 'MOI' : 'PROSPECT';

      if (data.is_final) {
        this.handlers.onFinal && this.handlers.onFinal(text, speaker, data.speech_final === true);
      } else {
        this.handlers.onInterim && this.handlers.onInterim(text, speaker);
      }
    };

    ws.onerror = () => {
      this.handlers.onError && this.handlers.onError('erreur WebSocket Deepgram');
    };
  }

  stop() {
    try { this.recorder && this.recorder.state !== 'inactive' && this.recorder.stop(); } catch { /* */ }
    try {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'CloseStream' }));
        this.ws.close();
      }
    } catch { /* */ }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.ws = null;
    this.recorder = null;
    this.stream = null;
    this.captureStream = null;
    this.firstSpeaker = null;
  }
}

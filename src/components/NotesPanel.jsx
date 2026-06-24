import { useState, useRef, useEffect } from 'react';
import { createMic, micSupported } from '../lib/micSpeech.js';

const append = (base, add) => {
  const b = (base || '').trimEnd();
  const a = (add || '').trim();
  if (!a) return b;
  return b ? `${b} ${a}` : a;
};

export default function NotesPanel({ onCoach, streaming, micBusy }) {
  const [notes, setNotes] = useState('');
  const [interim, setInterim] = useState('');
  const [dictating, setDictating] = useState(false);
  const [err, setErr] = useState('');
  const micRef = useRef(null);
  const interimRef = useRef('');

  const setInterimSync = (v) => { interimRef.current = v; setInterim(v); };

  useEffect(() => () => { micRef.current?.stop(); }, []);

  const stopDictation = () => {
    micRef.current?.stop();
    micRef.current = null;
    const it = interimRef.current;
    if (it) setNotes((prev) => append(prev, it));
    setInterimSync('');
    setDictating(false);
  };

  const startDictation = () => {
    if (!micSupported || micBusy) return;
    setErr('');
    try {
      const mic = createMic({
        onInterim: (t) => setInterimSync(t),
        onFinal: (t) => { setNotes((prev) => append(prev, t)); setInterimSync(''); },
        onError: (msg) => { setErr(typeof msg === 'string' ? msg : 'micro indisponible'); stopDictation(); },
      });
      mic.start();
      micRef.current = mic;
      setDictating(true);
    } catch (e) {
      setErr(e?.message || 'micro indisponible');
      setDictating(false);
    }
  };

  const toggleDictation = () => (dictating ? stopDictation() : startDictation());

  const fullText = () => append(notes, interimRef.current);

  const submit = () => {
    const text = fullText();
    if (!text || streaming) return;
    if (dictating) stopDictation();
    onCoach(text);
  };

  const clear = () => {
    if (dictating) stopDictation();
    setNotes('');
    setInterimSync('');
    setErr('');
  };

  const display = interim ? append(notes, interim) : notes;
  const hasText = !!fullText();

  const placeholder = micSupported
    ? "Dicte ou tape ce que le prospect a dit : objections, contexte, secteur…"
    : "Tape ce que le prospect a dit : objections, contexte, secteur…";

  return (
    <div className="sl-notes">
      <div className="sl-notes-head">
        <span className="sl-notes-icon">📝</span>
        <span className="sl-notes-title">Notes prospect</span>
        {(notes || interim) && (
          <button className="sl-notes-clear" onClick={clear} title="Effacer">✕</button>
        )}
      </div>

      <textarea
        className="sl-notes-area"
        placeholder={placeholder}
        value={display}
        onChange={(e) => setNotes(e.target.value)}
        rows={4}
      />

      {err && <p className="sl-notes-err">⚠️ {err}</p>}

      <div className="sl-notes-actions">
        {micSupported && (
          <button
            className={`sl-btn sl-notes-mic${dictating ? ' on' : ''}`}
            onClick={toggleDictation}
            disabled={micBusy}
            title={micBusy ? "Stop l'écoute live pour dicter" : 'Dicter tes notes'}
          >
            {dictating ? '● Dictée en cours…' : '🎤 Dicter'}
          </button>
        )}
        <button
          className="sl-btn sl-btn-notes"
          onClick={submit}
          disabled={!hasText || streaming}
        >
          {streaming ? '⏳ Analyse…' : '→ Obtenir conseil'}
        </button>
      </div>
    </div>
  );
}

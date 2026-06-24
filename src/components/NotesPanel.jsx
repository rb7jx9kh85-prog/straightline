import { useState, useRef, useEffect } from 'react';
import { createMic, micSupported } from '../lib/micSpeech.js';

// Concatène proprement deux bouts de texte (gère les espaces).
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
    if (it) setNotes((prev) => append(prev, it)); // ne perd pas la phrase en cours
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

  // Texte complet à envoyer (notes validées + phrase en cours de dictée).
  const fullText = () => append(notes, interimRef.current);

  const submit = () => {
    const text = fullText();
    if (!text || streaming) return;
    if (dictating) stopDictation(); // un seul geste : arrête la dictée ET demande le conseil
    onCoach(text);
  };

  const clear = () => { if (dictating) stopDictation(); setNotes(''); setInterimSync(''); setErr(''); };

  const display = interim ? append(notes, interim) : notes;
  const hasText = !!fullText();

  return (
    <div className="sl-notes">
      <div className="sl-notes-head">
        <span className="sl-notes-icon">📝</span>
        <span className="sl-notes-title">Notes prospect</span>
        {(notes || interim) && !dictating && (
          <button className="sl-notes-clear" onClick={clear} title="Effacer">✕</button>
        )}
      </div>

      <textarea
        className="sl-notes-area"
        placeholder={
          micSupported
            ? 'Touche « Dicter » et parle — ça s’écrit tout seul. (Tu peux aussi écrire.)'
            : 'Écris ce que le prospect a dit : objections, contexte, secteur…'
        }
        value={display}
        onChange={(e) => { if (!dictating) setNotes(e.target.value); }}
        readOnly={dictating}
        rows={4}
      />

      {err && <p className="sl-notes-err">⚠️ {err}</p>}

      <div className="sl-notes-actions">
        {micSupported && (
          <button
            className={`sl-btn sl-notes-mic ${dictating ? 'on' : ''}`}
            onClick={toggleDictation}
            disabled={micBusy}
            title={micBusy ? "Arrête l'écoute live pour dicter tes notes" : 'Dicter tes notes à la voix'}
          >
            {dictating ? '● J’écoute… (toucher pour arrêter)' : '🎤 Dicter'}
          </button>
        )}
        <button
          className="sl-btn sl-btn-notes"
          onClick={submit}
          disabled={!hasText || streaming}
        >
          {streaming ? '⏳ Analyse…' : '→ Obtenir le conseil'}
        </button>
      </div>
    </div>
  );
}

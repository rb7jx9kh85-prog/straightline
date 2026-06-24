import { useState } from 'react';

export default function NotesPanel({ onCoach, streaming }) {
  const [notes, setNotes] = useState('');

  const submit = () => { if (notes.trim() && !streaming) onCoach(notes); };

  const onKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); }
  };

  return (
    <div className="sl-notes">
      <div className="sl-notes-head">
        <span className="sl-notes-icon">📝</span>
        <span className="sl-notes-title">Notes prospect</span>
        <span className="sl-notes-tip">⌘↵ pour envoyer</span>
      </div>
      <textarea
        className="sl-notes-area"
        placeholder="Ce que le prospect a dit, son secteur, ses objections, son contexte… Le coach en tiendra compte même sans transcript."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        onKeyDown={onKeyDown}
        rows={4}
      />
      <button
        className="sl-btn sl-btn-notes"
        onClick={submit}
        disabled={!notes.trim() || streaming}
      >
        {streaming ? '⏳ Analyse en cours…' : '→ Obtenir conseil'}
      </button>
    </div>
  );
}

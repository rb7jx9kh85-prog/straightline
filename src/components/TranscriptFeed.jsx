import { useEffect, useRef } from 'react';

export default function TranscriptFeed({ turns, interim }) {
  const endRef = useRef(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, interim]);

  return (
    <aside className="sl-transcript">
      <div className="sl-transcript-head">Transcription</div>
      <div className="sl-transcript-body">
        {turns.length === 0 && !interim?.text && (
          <p className="sl-transcript-empty">La conversation s'affiche ici, locuteur par locuteur.</p>
        )}
        {turns.map((t, i) => (
          <p key={i} className={`sl-turn sl-turn-${t.speaker === 'PROSPECT' ? 'prospect' : 'moi'}`}>
            <span className="sl-turn-tag">{t.speaker === 'PROSPECT' ? 'PROSPECT' : 'MOI'}</span>
            <span className="sl-turn-text">{t.text}</span>
          </p>
        ))}
        {interim?.text && (
          <p className={`sl-turn sl-turn-interim sl-turn-${interim.speaker === 'PROSPECT' ? 'prospect' : 'moi'}`}>
            <span className="sl-turn-tag">{interim.speaker === 'PROSPECT' ? 'PROSPECT' : 'MOI'}</span>
            <span className="sl-turn-text">{interim.text}…</span>
          </p>
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}

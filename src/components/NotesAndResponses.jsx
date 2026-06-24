import { useState, useCallback } from 'react';
import CoachCard from './CoachCard.jsx';
import { buildPayload } from '../lib/transcript.js';
import { streamCoach } from '../lib/coachClient.js';
import { parsePartial } from '../lib/partialJson.js';

export default function NotesAndResponses() {
  const [businessType, setBusinessType] = useState('restaurant');
  const [prospectText, setProspectText] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [latency, setLatency] = useState({ first: null, full: null });

  const analyze = useCallback(async () => {
    if (!prospectText.trim() || streaming) return;

    setError(null);
    setSuggestion(null);
    setStreaming(true);
    const t0 = performance.now();
    let gotFirst = false;

    const turns = [
      { speaker: 'PROSPECT', text: prospectText.trim(), t: 0 }
    ];
    const payload = buildPayload(turns, businessType);

    try {
      let lastRaw = '';
      let streamErr = null;
      for await (const raw of streamCoach(payload)) {
        lastRaw = raw;
        const parsed = parsePartial(raw);
        if (parsed._error) { streamErr = parsed._error; break; }
        setSuggestion(parsed);
        if (!gotFirst && parsed.phrase_a_dire) {
          gotFirst = true;
          setLatency((l) => ({ ...l, first: performance.now() - t0 }));
        }
      }
      if (streamErr) throw new Error(streamErr);
      const final = parsePartial(lastRaw);
      setSuggestion(final);
      setLatency((l) => ({ first: l.first ?? performance.now() - t0, full: performance.now() - t0 }));
    } catch (e) {
      setError(e.message || String(e));
      setSuggestion(null);
    } finally {
      setStreaming(false);
    }
  }, [prospectText, businessType, streaming]);

  const reset = () => {
    setProspectText('');
    setSuggestion(null);
    setError(null);
    setLatency({ first: null, full: null });
  };

  return (
    <div className="sl-nar">
      <div className="sl-nar-main">
        <div className="sl-nar-section">
          <h3 className="sl-nar-title">Ce que le prospect a dit</h3>
          <textarea
            className="sl-nar-input"
            placeholder="Écris ici ce que le prospect a dit, ses objections, son contexte… Sois détaillé pour une réponse plus précise."
            value={prospectText}
            onChange={(e) => setProspectText(e.target.value)}
            rows={6}
            disabled={streaming}
          />
        </div>

        <div className="sl-nar-section">
          <h3 className="sl-nar-title">Type de commerce</h3>
          <div className="sl-nar-types">
            {['restaurant', 'café/bar', 'hôtel', 'PME locale'].map((type) => (
              <button
                key={type}
                className={`sl-nar-type ${businessType === type ? 'active' : ''}`}
                onClick={() => setBusinessType(type)}
                disabled={streaming}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="sl-nar-actions">
          <button
            className="sl-btn sl-btn-primary"
            onClick={analyze}
            disabled={!prospectText.trim() || streaming}
          >
            {streaming ? '⏳ Analyse en cours…' : '→ Obtenir la réponse Straight Line'}
          </button>
          <button
            className="sl-btn sl-btn-ghost"
            onClick={reset}
            disabled={streaming}
          >
            Effacer
          </button>
        </div>
      </div>

      <div className="sl-nar-result">
        <CoachCard
          suggestion={suggestion}
          streaming={streaming}
          status={streaming ? 'thinking' : 'idle'}
          error={error}
        />
        {suggestion && latency.full && (
          <p className="sl-nar-latency">
            Temps total : <strong>{Math.round(latency.full)}</strong> ms
          </p>
        )}
      </div>
    </div>
  );
}

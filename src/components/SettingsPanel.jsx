import { SCENARIOS } from '../lib/simulation/scenarios.js';

const BUSINESS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'café', label: 'Café / bar' },
  { id: 'hôtel', label: 'Hôtel' },
  { id: 'PME', label: 'PME locale' },
];

const PROVIDERS = [
  { id: 'simulation', label: 'Simulation', hint: 'tester sans appel réel' },
  { id: 'webspeech', label: 'Web Speech', hint: 'micro navigateur (FR)' },
  { id: 'deepgram', label: 'Deepgram', hint: 'diarization (clé requise)' },
];

export default function SettingsPanel({
  settings, onChange, scenarioId, onScenario, webSpeechSupported,
}) {
  return (
    <div className="sl-settings">
      <div className="sl-set-group">
        <label className="sl-set-label">Source audio</label>
        <div className="sl-segmented">
          {PROVIDERS.map((p) => {
            const disabled = p.id === 'webspeech' && !webSpeechSupported;
            return (
              <button
                key={p.id}
                className={`sl-seg ${settings.provider === p.id ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, provider: p.id })}
                disabled={disabled}
                title={disabled ? 'Non supporté par ce navigateur' : p.hint}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="sl-set-group">
        <label className="sl-set-label">Type de commerce du prospect</label>
        <div className="sl-segmented">
          {BUSINESS.map((b) => (
            <button
              key={b.id}
              className={`sl-seg ${settings.businessType === b.id ? 'active' : ''}`}
              onClick={() => onChange({ ...settings, businessType: b.id })}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {settings.provider === 'simulation' && (
        <div className="sl-set-group">
          <label className="sl-set-label">Scénario de simulation</label>
          <div className="sl-scenarios">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                className={`sl-scenario ${scenarioId === sc.id ? 'active' : ''}`}
                onClick={() => onScenario(sc.id)}
              >
                <span className="sl-scenario-title">{sc.title}</span>
                <span className="sl-scenario-desc">{sc.description}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

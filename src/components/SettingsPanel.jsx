import { SCENARIOS } from '../lib/simulation/scenarios.js';

const BUSINESS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'café', label: 'Café / bar' },
  { id: 'hôtel', label: 'Hôtel' },
  { id: 'PME', label: 'PME locale' },
];

const PROVIDERS = [
  { id: 'webspeech', label: 'Live · micro', hint: 'écoute le call (haut-parleur), FR — sans clé' },
  { id: 'deepgram', label: 'Live · Deepgram', hint: 'diarization / audio de l\'onglet (clé requise)' },
  { id: 'simulation', label: 'Simulation', hint: 'tester sans appel réel' },
];

const CAPTURE = [
  { id: 'mic', label: '🎤 Micro (haut-parleur)' },
  { id: 'tab', label: '🖥️ Audio de l\'onglet (le call)' },
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

      {settings.provider === 'deepgram' && (
        <div className="sl-set-group">
          <label className="sl-set-label">Source à capter</label>
          <div className="sl-segmented">
            {CAPTURE.map((c) => (
              <button
                key={c.id}
                className={`sl-seg ${(settings.captureSource || 'mic') === c.id ? 'active' : ''}`}
                onClick={() => onChange({ ...settings, captureSource: c.id })}
                title={c.id === 'tab' ? "Partage l'onglet du call en cochant « Partager l'audio »" : 'Micro de l\'ordinateur'}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      )}

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

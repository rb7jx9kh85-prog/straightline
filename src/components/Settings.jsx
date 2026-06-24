import { SCENARIOS } from '../lib/simulation/scenarios.js';

const BUSINESS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'café', label: 'Café / bar' },
  { id: 'hôtel', label: 'Hôtel' },
  { id: 'PME', label: 'PME locale' },
];

export default function Settings({
  mode, onMode, micSupported, recorderSupported, isIOS,
  engine, onEngine, businessType, onBusiness, scenarioId, onScenario, running,
}) {
  const micUsable = micSupported || recorderSupported;
  return (
    <div className="sl-settings">
      <div className="sl-set-group">
        <label className="sl-set-label">Mode</label>
        <div className="sl-segmented">
          <button
            className={`sl-seg ${mode === 'mic' ? 'active' : ''}`}
            onClick={() => onMode('mic')}
            disabled={!micUsable || running}
            title={micUsable ? 'Micro (mets le call sur haut-parleur), FR' : 'Non supporté ici'}
          >
            🎙️ Live · micro
          </button>
          <button
            className={`sl-seg ${mode === 'simulation' ? 'active' : ''}`}
            onClick={() => onMode('simulation')}
            disabled={running}
            title="Rejoue un appel d'objections — marche même sans clé"
          >
            🎬 Simulation
          </button>
        </div>
      </div>

      {mode === 'mic' && (
        <div className="sl-set-group">
          <label className="sl-set-label">Moteur de transcription</label>
          <div className="sl-segmented">
            <button
              className={`sl-seg ${engine === 'record' ? 'active' : ''}`}
              onClick={() => onEngine('record')}
              disabled={!recorderSupported || running}
              title="Enregistrement + Whisper (OpenAI). Fiable sur iPhone."
            >
              📱 Enregistrement {isIOS && '(iPhone)'}
            </button>
            <button
              className={`sl-seg ${engine === 'speech' ? 'active' : ''}`}
              onClick={() => onEngine('speech')}
              disabled={!micSupported || running}
              title={micSupported ? 'Web Speech du navigateur. Zéro latence (Chrome desktop).' : 'Non supporté ici (iPhone notamment)'}
            >
              💻 Navigateur
            </button>
          </div>
          <p className="sl-set-hint">
            {engine === 'record'
              ? '🎧 iPhone : mets le call sur haut-parleur, le micro capte les deux voix. L\'audio est transcrit par segments puis jeté (rien stocké).'
              : '⚡ Reconnaissance vocale du navigateur, instantanée. Idéal sur Chrome (ordinateur). Ne marche pas sur iPhone.'}
          </p>
        </div>
      )}

      <div className="sl-set-group">
        <label className="sl-set-label">Type de commerce du prospect</label>
        <div className="sl-segmented">
          {BUSINESS.map((b) => (
            <button
              key={b.id}
              className={`sl-seg ${businessType === b.id ? 'active' : ''}`}
              onClick={() => onBusiness(b.id)}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'simulation' && (
        <div className="sl-set-group">
          <label className="sl-set-label">Scénario de simulation</label>
          <div className="sl-scenarios">
            {SCENARIOS.map((sc) => (
              <button
                key={sc.id}
                className={`sl-scenario ${scenarioId === sc.id ? 'active' : ''}`}
                onClick={() => onScenario(sc.id)}
                disabled={running}
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

import { SCENARIOS } from '../lib/simulation/scenarios.js';

const BUSINESS = [
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'café', label: 'Café / bar' },
  { id: 'hôtel', label: 'Hôtel' },
  { id: 'PME', label: 'PME locale' },
];

export default function Settings({
  mode, onMode, micSupported, businessType, onBusiness, scenarioId, onScenario, running,
}) {
  return (
    <div className="sl-settings">
      <div className="sl-set-group">
        <label className="sl-set-label">Mode</label>
        <div className="sl-segmented">
          <button
            className={`sl-seg ${mode === 'mic' ? 'active' : ''}`}
            onClick={() => onMode('mic')}
            disabled={!micSupported || running}
            title={micSupported ? 'Micro du navigateur (mets le call sur haut-parleur), FR — zéro clé' : 'Non supporté ici — utilise Chrome'}
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

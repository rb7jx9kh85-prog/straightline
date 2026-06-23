// La CARTE de conseil — "glanceable". Lisible en un coup d'œil, prononçable immédiatement.

const PHASE_LABELS = {
  AVANT_LIGNE: 'Avant-ligne',
  LIGNE_DROITE: 'Ligne droite',
  PRESENTATION: 'Présentation',
  DEFLEXION: 'Déflexion',
  LOOP_1: 'Loop 1 · Produit',
  LOOP_2_PLUS: 'Loop 2+',
  CLOSE: 'Close',
};

const TEN_LABELS = {
  PRODUIT: '1️⃣ Produit',
  MOI: '2️⃣ Moi (confiance)',
  ENTREPRISE: '3️⃣ Entreprise',
  SEUIL_ACTION: '4️⃣ Seuil d\'action',
  SEUIL_DOULEUR: '5️⃣ Douleur',
};

function certitudeClass(n) {
  if (n == null) return '';
  if (n <= 3) return 'cert-low';
  if (n <= 6) return 'cert-mid';
  return 'cert-high';
}

function CertitudeGauge({ value }) {
  const v = typeof value === 'number' ? Math.max(0, Math.min(10, value)) : null;
  return (
    <div className={`sl-cert ${certitudeClass(v)}`} title="Certitude estimée du prospect">
      <span className="sl-cert-label">Certitude</span>
      <div className="sl-cert-bars">
        {Array.from({ length: 10 }).map((_, i) => (
          <span key={i} className={`sl-cert-seg ${v != null && i < v ? 'on' : ''}`} />
        ))}
      </div>
      <span className="sl-cert-num">{v != null ? `${v}/10` : '–'}</span>
    </div>
  );
}

export default function CoachCard({ suggestion, streaming, status, error }) {
  const s = suggestion || {};
  const hasPhrase = !!(s.phrase_a_dire && s.phrase_a_dire.length);
  const phaseLabel = s.phase ? PHASE_LABELS[s.phase] || s.phase : null;
  const tenLabel = s.ten_cible && s.ten_cible !== 'null' ? TEN_LABELS[s.ten_cible] || s.ten_cible : null;
  const objection =
    s.objection_detectee && s.objection_detectee.toLowerCase() !== 'aucune' ? s.objection_detectee : null;

  if (error || s._error) {
    const msg = error || s._error;
    const isQuota = /quota|billing|exceeded|insufficient|429/i.test(msg);
    return (
      <section className="sl-card sl-card-error">
        <div className="sl-card-error-inner">
          <span className="sl-err-mark">⚠</span>
          <p>{msg}</p>
          <p className="sl-err-hint">
            {isQuota
              ? "Ta clé OpenAI n'a plus de crédit. Ajoute un moyen de paiement sur platform.openai.com → Billing (vérifie que le crédit est sur la bonne organisation). En attendant, la Simulation tourne en mode démo hors-ligne."
              : 'Vérifie ta clé API côté serveur, ou lance le mode simulation.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className={`sl-card ${hasPhrase ? 'has-phrase' : ''} ${streaming ? 'streaming' : ''}`}>
      <div className="sl-card-band">
        <span className={`sl-chip sl-chip-phase ${s.phase ? 'phase-' + s.phase : ''}`}>
          {phaseLabel || '—'}
        </span>
        {tenLabel && <span className="sl-chip sl-chip-ten">{tenLabel}</span>}
        {objection && <span className="sl-chip sl-chip-obj">objection&nbsp;: {objection}</span>}
        {s._offline && (
          <span className="sl-chip sl-chip-offline" title="API indisponible — carte pré-écrite du scénario">
            démo hors-ligne
          </span>
        )}
        <span className="sl-band-spacer" />
        <CertitudeGauge value={s.certitude_estimee} />
      </div>

      <div className="sl-phrase-wrap">
        <span className="sl-phrase-arrow" aria-hidden="true">➤</span>
        {hasPhrase ? (
          <p className="sl-phrase">
            «&nbsp;{s.phrase_a_dire}
            {streaming ? <span className="sl-caret" /> : ' »'}
          </p>
        ) : (
          <p className="sl-phrase sl-phrase-empty">
            {status === 'thinking'
              ? 'Je réfléchis…'
              : status === 'idle'
                ? 'Lance l\'écoute ou la simulation — la phrase à dire apparaîtra ici.'
                : 'En écoute… la phrase à dire apparaît dès que le prospect a fini de parler.'}
          </p>
        )}
      </div>

      <div className="sl-card-foot">
        <div className="sl-tonalites">
          <span className="sl-tona-mic" aria-hidden="true">🎙️</span>
          {Array.isArray(s.tonalite) && s.tonalite.length ? (
            s.tonalite.map((t, i) => (
              <span key={i} className="sl-tona-pill">{t}</span>
            ))
          ) : (
            <span className="sl-tona-pill sl-tona-empty">tonalité…</span>
          )}
        </div>
        <div className="sl-why">
          {s.pourquoi && (
            <p className="sl-why-line"><span className="sl-why-key">Pourquoi</span> {s.pourquoi}</p>
          )}
          {s.prochain_coup && (
            <p className="sl-why-line"><span className="sl-why-key">Prochain coup</span> {s.prochain_coup}</p>
          )}
        </div>
      </div>
    </section>
  );
}

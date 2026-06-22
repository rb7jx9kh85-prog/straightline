export default function Header() {
  return (
    <header className="sl-header">
      <div className="sl-brand">
        <div className="sl-monogram" aria-hidden="true">SL</div>
        <div className="sl-brand-text">
          <h1 className="sl-title">SL&nbsp;COPILOT</h1>
          <p className="sl-subtitle">Souffleur de vente&nbsp;·&nbsp;méthode Straight&nbsp;Line</p>
        </div>
      </div>
      <div className="sl-straightline" aria-hidden="true">
        <span className="sl-line-dot" />
        <span className="sl-line" />
        <span className="sl-line-arrow">▶</span>
      </div>
    </header>
  );
}

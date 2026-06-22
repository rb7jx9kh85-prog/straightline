const STATUS = {
  idle: { dot: 'idle', label: 'En veille' },
  listening: { dot: 'listening', label: '🟢 En écoute' },
  speaking: { dot: 'speaking', label: '🟡 Le prospect parle' },
  thinking: { dot: 'thinking', label: '🔵 Je réfléchis…' },
};

export default function StatusBar({ status, latency }) {
  const st = STATUS[status] || STATUS.idle;
  const ms = latency?.first;
  const ok = ms != null && ms <= 1200;
  return (
    <div className="sl-statusbar">
      <span className={`sl-status sl-status-${st.dot}`}>
        <span className="sl-status-dot" />
        {st.label}
      </span>
      <span className="sl-latency" title="Fin de parole du prospect → première phrase à l'écran. Cible : < 1,2 s.">
        Latence&nbsp;:&nbsp;
        {ms != null ? (
          <strong className={ok ? 'lat-ok' : 'lat-slow'}>{(ms / 1000).toFixed(2)}&nbsp;s</strong>
        ) : (
          <strong>—</strong>
        )}
        {latency?.full != null && (
          <span className="sl-latency-full"> · complet {(latency.full / 1000).toFixed(2)}&nbsp;s</span>
        )}
      </span>
    </div>
  );
}

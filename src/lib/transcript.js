// Transcript roulant : on ne garde que les ~20 dernières répliques (contexte glissant).

export const MAX_TURNS = 20;

export function pushTurn(turns, speaker, text, t) {
  const clean = (text || '').trim();
  if (!clean) return turns;
  const stamp = typeof t === 'number' ? t : Date.now() / 1000;
  const next = [...turns, { speaker: speaker === 'PROSPECT' ? 'PROSPECT' : 'MOI', text: clean, t: stamp }];
  return next.slice(-MAX_TURNS);
}

// Construit le payload envoyé à /api/coach (schéma section 5), horodaté relatif.
export function buildPayload(turns, businessType, hint) {
  const t0 = turns.length ? turns[0].t : 0;
  return {
    now: new Date().toISOString(),
    business_type: businessType,
    turns: turns.map((x) => ({
      speaker: x.speaker,
      text: x.text,
      t: Math.round((x.t - t0) * 10) / 10,
    })),
    ...(hint ? { hint } : {}),
  };
}

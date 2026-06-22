// Client du backend /api/coach — lit la réponse EN STREAMING et renvoie le texte
// accumulé à chaque chunk (le front le parse en partiel pour l'effet "écriture live").

export async function* streamCoach(payload, { signal } = {}) {
  const res = await fetch('/api/coach', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    let msg = `Erreur ${res.status}`;
    try {
      const data = await res.json();
      msg = data.error || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    yield acc;
  }
  yield acc;
}

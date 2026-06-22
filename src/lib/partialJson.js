// Parsing TOLÉRANT du JSON streamé du coach.
// Objectif : afficher `phrase_a_dire` dès les premiers tokens, avant la fin du JSON.

const FIELDS = {
  string: ['phase', 'ten_cible', 'objection_detectee', 'phrase_a_dire', 'pourquoi', 'prochain_coup'],
  number: ['certitude_estimee'],
  array: ['tonalite'],
};

export function cleanJsonText(raw) {
  if (!raw) return '';
  let t = String(raw).trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '');
    const end = t.lastIndexOf('```');
    if (end !== -1) t = t.slice(0, end);
  }
  const i = t.indexOf('{');
  if (i > 0) t = t.slice(i);
  return t.trim();
}

function unescapeJsonString(s) {
  try {
    return JSON.parse('"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"');
  } catch {
    return s;
  }
}

function extractString(text, key) {
  // valeur complète : "key": "....."
  const full = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"');
  const m = text.match(full);
  if (m) return unescapeJsonString(m[1]);
  // valeur partielle : guillemet de fin pas encore arrivé (effet streaming)
  const partial = new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)$');
  const p = text.match(partial);
  if (p) return unescapeJsonString(p[1]);
  return undefined;
}

function extractNumber(text, key) {
  const m = text.match(new RegExp('"' + key + '"\\s*:\\s*(-?\\d+)'));
  return m ? parseInt(m[1], 10) : undefined;
}

function extractArray(text, key) {
  const m = text.match(new RegExp('"' + key + '"\\s*:\\s*\\[([^\\]]*)(?:\\]|$)'));
  if (!m) return undefined;
  const items = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((x) => unescapeJsonString(x[1]));
  return items.length ? items : undefined;
}

const EMPTY = {
  phase: undefined,
  ten_cible: undefined,
  certitude_estimee: undefined,
  objection_detectee: undefined,
  phrase_a_dire: undefined,
  tonalite: undefined,
  pourquoi: undefined,
  prochain_coup: undefined,
};

export function parsePartial(raw) {
  const text = cleanJsonText(raw);
  if (!text) return { ...EMPTY, _complete: false };

  // 1) Tentative de parse complet (cas nominal en fin de stream)
  try {
    const obj = JSON.parse(text);
    if (obj && obj.error) return { ...EMPTY, _error: obj.error, _complete: true };
    return { ...EMPTY, ...obj, _complete: true };
  } catch {
    /* JSON encore incomplet : extraction champ par champ */
  }

  // Erreur backend renvoyée en clair ?
  const errMatch = text.match(/"error"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (errMatch) return { ...EMPTY, _error: unescapeJsonString(errMatch[1]), _complete: false };

  const out = { ...EMPTY, _complete: false };
  for (const k of FIELDS.string) out[k] = extractString(text, k);
  for (const k of FIELDS.number) out[k] = extractNumber(text, k);
  for (const k of FIELDS.array) out[k] = extractArray(text, k);
  return out;
}

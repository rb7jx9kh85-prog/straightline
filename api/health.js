// =============================================================================
//  /api/health — vérifie en un coup d'œil que la config serveur est bonne.
//
//  Ouvre https://<ton-app>.vercel.app/api/health :
//    { ok: true,  openai_key: "configurée" }  → la clé est bien là.
//    { ok: false, openai_key: "MANQUANTE"  }  → ajoute OPENAI_API_KEY sur Vercel.
//
//  Si la clé est "configurée" mais que tu vois quand même « quota » dans l'app,
//  c'est un problème de CRÉDIT/FACTURATION OpenAI (pas de config) : ajoute du
//  crédit sur la bonne organisation dans platform.openai.com → Billing.
// =============================================================================

export const config = { runtime: 'edge' };

export default async function handler() {
  const hasKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.COACH_MODEL || 'gpt-4o-mini';
  const custom = !!process.env.OPENAI_BASE_URL;

  return new Response(
    JSON.stringify(
      {
        ok: hasKey,
        openai_key: hasKey ? 'configurée' : 'MANQUANTE',
        model,
        endpoint: custom ? 'personnalisé (OPENAI_BASE_URL)' : 'OpenAI standard',
        hint: hasKey
          ? "Clé présente. Si l'app affiche encore « quota », c'est le crédit/facturation OpenAI (vérifie la bonne organisation), pas la config."
          : 'Ajoute OPENAI_API_KEY dans Vercel → Settings → Environment Variables, puis redéploie.',
      },
      null,
      2,
    ),
    { status: hasKey ? 200 : 503, headers: { 'content-type': 'application/json; charset=utf-8' } },
  );
}

# Déploiement — Vercel (intégration native GitHub)

La façon la plus simple : on **importe le repo dans Vercel une fois**, et ensuite **chaque push se
déploie automatiquement**. Pas de YAML, pas de secret à gérer dans GitHub. La clé `OPENAI_API_KEY`
vit côté Vercel (serveur), jamais dans le front.

> Pourquoi pas GitHub Pages ? Le backend `/api/coach` est une fonction **serverless** qui détient la
> clé OpenAI. Pages ne sert que du statique : l'IA n'y tournerait pas. Vercel exécute les `/api`.

## Étapes (~3 min, une seule fois)

1. Va sur **[vercel.com/new](https://vercel.com/new)** → **Import Git Repository**.
2. Connecte ton compte GitHub si besoin, puis sélectionne le repo **`straightline`**.
3. Vercel détecte **Vite** automatiquement (build `vite build`, sortie `dist`, déjà fixé dans
   `vercel.json`). Rien à changer.
4. Déplie **Environment Variables** et ajoute :

   | Variable | Obligatoire | Valeur |
   |---|---|---|
   | `OPENAI_API_KEY` | ✅ | `sk-...` (organisation **avec du crédit**) |
   | `COACH_MODEL` | — | `gpt-4o-mini` (défaut) ou `gpt-4o` |
   | `OPENAI_BASE_URL` | — | endpoint compatible OpenAI (Azure/proxy) |

5. Clique **Deploy**. Vercel build et te donne l'URL live.

6. **Vérifie la config** : ouvre `https://<ton-app>.vercel.app/api/health`.
   - `"openai_key": "configurée"` → la clé est bien lue. 👍
   - `"openai_key": "MANQUANTE"` → ajoute `OPENAI_API_KEY`, puis redéploie.
   - Clé « configurée » mais l'app dit encore « quota » → c'est le **crédit/facturation**
     OpenAI (pas la config) : ajoute du crédit sur la **bonne organisation**.

## Ensuite : tout est automatique

- **Push sur la branche de production** (par défaut `main`) → déploiement **production**.
- **Push sur une autre branche / PR** → **URL de preview** dédiée (le `/api` fonctionne aussi).

Comme on travaille sur la branche `claude/awesome-bardeen-wxd7ke`, deux options :
- utiliser directement l'**URL de preview** de cette branche (pleinement fonctionnelle), ou
- dans Vercel → *Project → Settings → Git*, mettre cette branche comme **Production Branch**, ou
  fusionner le travail dans `main`.

## Mettre à jour une variable d'env

Vercel → ton projet → **Settings → Environment Variables** → modifie, puis **Redeploy**
(*Deployments → … → Redeploy*).

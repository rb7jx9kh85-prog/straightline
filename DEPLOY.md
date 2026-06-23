# Déploiement — GitHub Actions → Vercel

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) build et déploie
**automatiquement** SL Copilot (interface + backend OpenAI `/api`) sur Vercel à chaque `push`.

> Pourquoi Vercel et pas GitHub Pages ? Le backend `/api/coach` est une fonction **serverless**
> qui détient la clé `OPENAI_API_KEY`. GitHub Pages ne sert que du statique : l'IA n'y tournerait
> pas et la clé n'aurait nulle part où vivre. GitHub Actions construit, Vercel héberge.

## Configuration (une seule fois, ~5 min)

### 1. Créer le projet Vercel et récupérer les 3 identifiants

En local, à la racine du repo :

```bash
npm i -g vercel
vercel login
vercel link          # crée/associe le projet → écrit .vercel/project.json
```

Dans `.vercel/project.json` tu trouves :
- `orgId`     → **VERCEL_ORG_ID**
- `projectId` → **VERCEL_PROJECT_ID**

Et le **VERCEL_TOKEN** : Vercel → *Account Settings → Tokens → Create Token*.

### 2. Ajouter les 3 secrets dans GitHub

Repo GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

| Secret | Valeur |
|---|---|
| `VERCEL_TOKEN` | le token créé ci-dessus |
| `VERCEL_ORG_ID` | `orgId` |
| `VERCEL_PROJECT_ID` | `projectId` |

### 3. Mettre la clé OpenAI dans Vercel (PAS dans GitHub)

Vercel → ton projet → **Settings → Environment Variables** (environnement **Production**) :

| Variable | Obligatoire | Valeur |
|---|---|---|
| `OPENAI_API_KEY` | ✅ | `sk-...` |
| `COACH_MODEL` | — | `gpt-4o-mini` (défaut) ou `gpt-4o` |
| `OPENAI_BASE_URL` | — | endpoint compatible OpenAI (Azure/proxy) |
| `DEEPGRAM_API_KEY` | — | pour le STT Deepgram (diarization / audio onglet) |

> La clé vit **uniquement** côté Vercel (serveur). Elle n'est jamais dans le bundle front ni dans GitHub.

### 4. Déployer

Pousse un commit (ou lance le workflow manuellement : onglet **Actions → Déploiement Vercel → Run workflow**).
L'URL de production s'affiche à la fin du job (section *Summary*).

## Restreindre à la branche principale (optionnel)

Le workflow déploie en production sur `main` **et** sur les branches `claude/**` (pratique pour voir
le travail en cours en live). Pour ne déployer que `main`, édite le bloc `on.push.branches` du workflow :

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch: {}
```

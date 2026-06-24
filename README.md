# SL Copilot 🐺

**Copilote vocal de vente en temps réel, basé sur la méthode Straight Line de Jordan Belfort.**

Pendant un appel de prospection, SL Copilot écoute, transcrit, analyse où en est la vente, et
affiche **la phrase exacte à dire ensuite** + la **tonalité** à employer + **pourquoi** — en moins
de ~1,2 s après que le prospect a fini de parler.

Contexte métier : vente de **sites web & présence en ligne** à des **restaurants, cafés, hôtels et
PME** en Valais (Suisse romande). Suggestions **en français**, adaptées à ce métier.

> Direction artistique « Wolf of Wall Street » : noir profond, or métallique, ligne droite dorée.

---

## ⚡ Démarrage rapide

```bash
npm install
cp .env.example .env        # renseigner OPENAI_API_KEY
npx vercel dev              # front (Vite) + fonctions serverless /api ensemble
```

Ouvre l'URL affichée. **Mode simulation** (par défaut) : aucune clé micro requise, ça rejoue de
vraies objections (« je dois réfléchir », « trop cher », « j'en parle à mon associé ») et tu vois
la déflexion puis les loops s'enchaîner.

> `npm run dev` lance seulement le front (port 5173) et proxifie `/api` vers `vercel dev` (port 3000).
> Pour tester l'IA en local, lance **`npx vercel dev`** (qui sert front + API). Sinon, déploie.

---

## 🔐 Sécurité (non négociable)

- **Aucune clé API dans le front.** `OPENAI_API_KEY` vit uniquement dans les variables
  d'environnement serveur (fonction `/api/coach`). Le navigateur ne parle qu'à **mon** backend.
- **Aucun enregistrement audio stocké : transcription éphémère.** L'app écoute, transcrit en direct
  pour souffler la réponse, et ne garde **aucun fichier audio**.
- ⚖️ **Note légale (Suisse, art. 179bis CP)** : *enregistrer* un appel privé sans l'accord des deux
  parties est illégal. C'est exactement pourquoi l'app reste en **écoute + souffle live, zéro
  enregistrement** — discret côté prospect (rien à installer chez lui) et safe pour toi.

---

## 🧠 Le system prompt = le cœur

Toute la méthode Straight Line (5 éléments, Three Tens, échelle de certitude, 4 premières secondes,
10 tonalités, déflexion, looping & Forrest Gump, seuils d'action/douleur, 4 archétypes, 10 règles de
prospection) est dans [`api/_systemPrompt.js`](api/_systemPrompt.js) — **collé mot pour mot** depuis
le cahier des charges, injecté tel quel comme `system` de l'appel LLM, et **mis en cache** (prompt
caching) pour réduire la latence des tours suivants.

---

## ⚙️ Architecture & flux

```
Navigateur (React/Vite)
  │  micro (haut-parleur) → Web Speech (STT navigateur, FR, éphémère) → transcript [MOI]/[PROSPECT]
  │  pause du prospect (~420 ms) ──▶ POST /api/coach
  ▼
/api/coach  (edge serverless — détient la clé)
  │  system prompt (section 6) + 12-20 dernières répliques → OpenAI Chat Completions (stream)
  ▼
Carte de conseil (glanceable) — phrase_a_dire en GROS (streaming) + tonalité + pourquoi + prochain coup
```

| Étape | Cible | Comment |
|---|---|---|
| Audio → texte partiel | < 300 ms | STT streaming |
| Fin de parole prospect | ~400–600 ms silence | VAD / endpointing |
| Texte → suggestion | < 800 ms | LLM rapide + stream + `max_tokens` court |
| **Total perçu** | **< 1,2 s** | mesuré et affiché en haut de l'écran |

---

## 🎧 Mode Live — « écoute le call et dis-moi quoi répondre »

L'app écoute en continu, et **dès que le prospect fait une pause** (~450 ms), elle déclenche
automatiquement le coach : la phrase à dire s'écrit en direct. **Mains-libres** — rien à cliquer
pendant que le prospect parle. Quand c'est ton tour, **maintiens le bouton « parler »** (ta voix
est alors étiquetée `MOI` et ne déclenche pas de suggestion).

Deux modes (base volontairement simple, `src/lib/`) :

- **Live · micro** — mets le call sur **haut-parleur**, le micro capte les deux voix. Tu maintiens le
  bouton **« PARLER »** quand c'est ton tour (ta voix est étiquetée `MOI` et ne déclenche pas de
  réponse). Deux **moteurs de transcription** (réglable, auto-détecté) :
  - **📱 Enregistrement** *(défaut sur iPhone)* — MediaRecorder + **Whisper** (`/api/transcribe`).
    L'audio est découpé par segments dès une pause, transcrit côté serveur, puis **jeté** (éphémère).
    Le seul fiable sur **iPhone/Safari**, où la Web Speech API ne marche pas.
  - **💻 Navigateur** *(défaut sur Chrome desktop)* — Web Speech API, **zéro latence, zéro clé**.
    Instantané mais **indisponible sur iPhone**.
  > ⚠️ iOS ne donne **pas** l'audio d'un appel téléphonique au navigateur. D'où le **haut-parleur** :
  > le micro de l'iPhone capte la conversation dans la pièce. (Ou lance l'app sur un 2ᵉ appareil.)
- **Simulation** — rejoue des scénarios d'objections. Idéal pour tester latence + qualité. Si l'API
  OpenAI ne répond pas (quota dépassé, clé sans crédit, hors-ligne…), l'app bascule automatiquement
  sur les **cartes de conseil pré-écrites** du scénario (badge « démo hors-ligne ») : la démo reste
  jouable de bout en bout **sans aucune clé**.

---

## 🔥 Onglet Motivation

Un second onglet « Motivation » (esprit *Wolf of Wall Street*) avec citations, portraits et un
lecteur MP3. Tu y déposes **tes propres fichiers** :

- **Sons** → `public/audio/` : `motivation-1.mp3` … `motivation-4.mp3` (titres modifiables dans
  `src/lib/motivation/tracks.js`).
- **Images** → `public/img/` : `belfort.jpg`, `dicaprio.jpg` (sinon un cadre stylisé s'affiche).

> ⚠️ **Droits** : les extraits du film et les photos de personnes réelles sont protégés. Utilise des
> fichiers dont tu as les droits / en usage personnel ; n'héberge pas d'extraits piratés sur l'URL
> publique. Voir les README dans `public/audio/` et `public/img/`.

## 🤖 Modèle LLM

Fournisseur : **OpenAI** (Chat Completions, en streaming, sortie JSON forcée).
Par défaut : **`gpt-4o-mini`** (faible latence, pour tenir le < 0,8 s). Pour plus de finesse sur un
rendez-vous important, mets `COACH_MODEL=gpt-4o` côté serveur. Endpoint compatible OpenAI
(Azure, proxy) via `OPENAI_BASE_URL`.

---

## ⌨️ Raccourcis

- **Espace** — démarrer / arrêter (écoute ou simulation)
- **→** — « donne-moi une alternative » (autre formulation)
- **M** — changer de locuteur (mode live)

---

## ☁️ Déploiement (Vercel, intégration native GitHub)

Le plus simple — guide complet dans **[DEPLOY.md](DEPLOY.md)** :

1. **[vercel.com/new](https://vercel.com/new)** → *Import Git Repository* → sélectionne `straightline`.
2. Vercel détecte Vite tout seul (build `vite build` → `dist`, fixé dans `vercel.json`).
3. Ajoute `OPENAI_API_KEY` (+ options) dans *Environment Variables*, puis **Deploy**.
4. Ensuite **chaque push se déploie automatiquement** ; chaque branche/PR a une **URL de preview**.

Zéro YAML, zéro secret dans GitHub — la clé OpenAI vit côté Vercel.

> GitHub Pages ne convient pas : il ne sert que du statique et n'exécute pas le backend `/api`.

---

## 📁 Structure

```
api/
  _systemPrompt.js     ← méthode Straight Line, MOT POUR MOT (system prompt)
  coach.js             ← /api/coach : LLM OpenAI en streaming (clé serveur)
  health.js            ← /api/health : vérifie que la clé est bien configurée
src/
  components/          ← Header, CoachCard (la carte), TranscriptFeed, StatusBar, Settings, Motivation
  lib/
    useLiveCoach.js    ← cœur : état + orchestration (micro, déclenchement, streaming, simulation)
    micSpeech.js       ← reconnaissance vocale du navigateur (Web Speech, FR, éphémère)
    coachClient.js     ← lecture du stream /api/coach
    partialJson.js     ← parsing JSON partiel (phrase affichée dès les 1ers tokens)
    transcript.js      ← buffer roulant 20 répliques
    simulation/        ← scénarios d'objections + cartes de conseil de repli (hors-ligne)
  App.jsx              ← vue (branche le hook useLiveCoach sur l'UI)
  styles.css           ← DA Jordan Belfort
```

---

## ✅ Critères d'acceptation couverts

- [x] Transcription en direct, distinction `[MOI]` / `[PROSPECT]`
- [x] Carte avec une **phrase prête à dire** à la fin de la parole du prospect, **< 1,2 s** (mesuré)
- [x] Français, métier sites web pour restos/hôtels/PME, **tonalité(s)** indiquées
- [x] Objection → **déflexion** puis **loops** dans l'ordre (produit → moi → entreprise → seuil → douleur)
- [x] **System prompt section 6 intégré mot pour mot**
- [x] **Aucune clé API exposée côté client**
- [x] **Mode simulation** pour tester sans vrai appel
```

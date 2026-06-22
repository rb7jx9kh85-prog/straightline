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
cp .env.example .env        # renseigner ANTHROPIC_API_KEY
npx vercel dev              # front (Vite) + fonctions serverless /api ensemble
```

Ouvre l'URL affichée. **Mode simulation** (par défaut) : aucune clé micro requise, ça rejoue de
vraies objections (« je dois réfléchir », « trop cher », « j'en parle à mon associé ») et tu vois
la déflexion puis les loops s'enchaîner.

> `npm run dev` lance seulement le front (port 5173) et proxifie `/api` vers `vercel dev` (port 3000).
> Pour tester l'IA en local, lance **`npx vercel dev`** (qui sert front + API). Sinon, déploie.

---

## 🔐 Sécurité (non négociable)

- **Aucune clé API dans le front.** `ANTHROPIC_API_KEY` et `DEEPGRAM_API_KEY` vivent uniquement
  dans les variables d'environnement serveur (fonctions `/api`).
- Le navigateur ne parle qu'à **mon** backend. Pour Deepgram, le backend émet un **token éphémère**
  (30 s) ; la clé permanente ne quitte jamais le serveur.
- Aucun enregistrement audio stocké : transcription éphémère.

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
  │  micro → STT streaming (Web Speech / Deepgram) → transcript roulant [MOI]/[PROSPECT]
  │  au silence du prospect (VAD / fin d'énoncé) ──▶ POST /api/coach
  ▼
/api/coach  (edge serverless — détient la clé)
  │  system prompt (section 6) + 12-20 dernières répliques → Anthropic Messages API (stream)
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

## 🎚️ Sources audio (interface `SpeechProvider`)

- **Simulation** — rejoue des scénarios d'objections. Zéro clé. Idéal pour tester latence + qualité.
- **Web Speech** — micro du navigateur (Chrome), français, zéro clé. Le locuteur (Moi / Prospect)
  se bascule au bouton ou à la touche **M** (push-to-talk logique), car Web Speech ne diarise pas.
- **Deepgram** — option « propre » : streaming WebSocket, français, **diarization** (sépare les
  locuteurs). Nécessite `DEEPGRAM_API_KEY` côté serveur.

Changer de fournisseur n'impacte que le dossier `src/lib/speech/`.

---

## 🤖 Modèle LLM

Par défaut : **`claude-haiku-4-5`** (faible latence, pour tenir le < 0,8 s). Pour un rendez-vous
important où 0,3 s de plus est acceptable, mets `COACH_MODEL=claude-opus-4-8` côté serveur.

---

## ⌨️ Raccourcis

- **Espace** — démarrer / arrêter (écoute ou simulation)
- **→** — « donne-moi une alternative » (autre formulation)
- **M** — changer de locuteur (mode live)

---

## ☁️ Déploiement (Vercel)

1. Importer le repo sur Vercel.
2. Variables d'environnement : `ANTHROPIC_API_KEY` (obligatoire), `COACH_MODEL` (optionnel),
   `DEEPGRAM_API_KEY` (optionnel).
3. Build auto (`vite build` → `dist`), fonctions `/api` en edge runtime. Aussi compatible Netlify.

---

## 📁 Structure

```
api/
  _systemPrompt.js     ← méthode Straight Line, MOT POUR MOT (system prompt)
  coach.js             ← /api/coach : LLM en streaming (clé serveur)
  deepgram-token.js    ← /api/deepgram-token : token éphémère
src/
  components/          ← Header, CoachCard (la carte), TranscriptFeed, StatusBar, SettingsPanel
  lib/
    coachClient.js     ← lecture du stream /api/coach
    partialJson.js     ← parsing JSON partiel (phrase affichée dès les 1ers tokens)
    transcript.js      ← buffer roulant 20 répliques
    vad.js             ← détection de fin de parole
    speech/            ← WebSpeechProvider, DeepgramProvider (interface commune)
    simulation/        ← scénarios d'objections classiques
  App.jsx              ← orchestration (écoute, déclenchement, streaming, simulation)
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

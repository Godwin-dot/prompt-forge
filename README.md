# Prompt Forge

Générateur de prompts IA : décrivez ce dont vous avez besoin, répondez à quelques
questions de clarification, et obtenez un prompt optimisé prêt à coller dans
votre outil d'IA préféré. Multi-fournisseurs avec fallback automatique.

## Fonctionnalités
- Parcours en 3 étapes : idée → précisions → prompt final.
- Fallback automatique entre 4 fournisseurs (Groq, OpenRouter, Google AI, OpenAI).
- Comptes utilisateurs : historique privé, copie et suppression.
- Suggestions de démarrage, recherche/filtres dans l'historique.
- Marquer un prompt comme « utilisé », « régénérer », partager un lien public.
- Réglages de création : température (créativité) et style (concis/équilibré/détaillé).
- Option « ne pas conserver » et brouillon autosauvegardé.
- Affichage du fournisseur, du modèle, du temps de génération et du quota restant.
- Ouverture directe dans ChatGPT / Claude / Gemini.
- Thème clair/sombre, responsive.
- Rate limiting et validation des entrées côté API.

## Stack
- [Next.js](https://nextjs.org/) 14 (App Router, TypeScript)
- [Prisma](https://www.prisma.io/) + SQLite (local) / [Turso](https://turso.tech/) (production)
- [NextAuth](https://next-auth.js.org/) 4 (credentials, JWT) + bcrypt
- Tailwind CSS + Geist

## Démarrage local

1. Cloner et installer :
   ```bash
   npm install
   ```

2. Configurer l'environnement ; copier `.env.example` puis renseigner au minimum :
   ```bash
   cp .env.example .env
   ```
   - `DATABASE_URL="file:./dev.db"` (SQLite local) ;
   - une clé IA au choix (`GROQ_API_KEY` + `GROQ_MODEL`, `OPENROUTER_*`, etc.) ;
   - `NEXTAUTH_SECRET` (générer avec `openssl rand -base64 32`).

3. Synchroniser la base locale :
   ```bash
   npx prisma db push
   ```

4. Lancer :
   ```bash
   npm run dev
   ```
   → http://localhost:3000

## Scripts
| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement |
| `npm run build` | `prisma generate` + build de production |
| `npm start` | Serveur de production |
| `npm run lint` | Lint ESLint |

## Déploiement (Vercel + Turso)
1. Créez une base Turso et notez son URL et votre jeton.
2. En `Settings → Environment Variables` de votre projet Vercel :
   - `DATABASE_URL` = `libsql://<base>.turso.io`
   - `TURSO_AUTH_TOKEN` = votre jeton
   - `NEXTAUTH_SECRET` = une chaîne aléatoire longue
   - `NEXTAUTH_URL` = l'URL de votre déploiement
   - vos clés IA (`GROQ_API_KEY`, `OPENROUTER_*`, `GOOGLE_AI_*`, `OPENAI_*`)
3. Appliquez le schéma à la base Turso (`prisma/turso-migrate.sql` ou équivalent) :
   ```bash
   DATABASE_URL="libsql://..." TURSO_AUTH_TOKEN="..." npx prisma db push
   ```
4. Déployez sur Vercel.

> Note : le CLI Prisma pour SQLite exige une URL `file:`. Pour pousser le schéma
> vers Turso depuis le code, utilisez `@libsql/client` ou le fichier
> `prisma/turso-migrate.sql`, comme décrit dans la doc.

## Securité & limites
- Rate limiting par compte sur `/api/generate` (`RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`).
- Validation des longueurs des entrées côté API.
- Budget de timeout global entre les fournisseurs IA (30 s) pour éviter
  des latences excessives.
- Mots de passe hachés (bcrypt), isolation de l'historique par utilisateur.

## Confidentialité
Vos idées/réponses sont envoyées à des fournisseurs d'IA tiers pour générer le
prompt. Voir la page `/privacy` in-app. Des consentement est demandé au premier
usage.

## Roadmap (backlog)
- Vérification email, réinitialisation de mot de passe.
- Pagination de l'historique.
- Tests unitaires / intégration + CI.
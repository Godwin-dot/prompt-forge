# Prompt Forge

Générateur de prompts IA : décrivez ce dont vous avez besoin, répondez à quelques
questions de clarification, et obtenez un prompt optimisé prêt à coller dans
votre outil d'IA préféré. Le service de génération utilise exclusivement l'API Z.ai.

## Fonctionnalités
- Parcours en 3 étapes : idée → précisions → prompt final.
- Génération via Z.ai ; plusieurs modèles Z.ai facultatifs peuvent être fournis, séparés par des virgules, et sont essayés dans l'ordre.
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
   - une clé Z.ai (`ZAI_API_KEY`) et un modèle (`ZAI_MODEL`) ;
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
| `npm test` | Tests unitaires (Vitest) |
| `npm run lint` | Lint ESLint (nécessite la config ESLint) |

## Déploiement (Vercel + Turso)
1. Créez une base Turso et notez son URL et votre jeton.
2. En `Settings → Environment Variables` de votre projet Vercel :
   - `DATABASE_URL` = `libsql://<base>.turso.io`
   - `TURSO_AUTH_TOKEN` = votre jeton
   - `NEXTAUTH_SECRET` = une chaîne aléatoire longue
   - `NEXTAUTH_URL` = l'URL de votre déploiement
   - `ZAI_API_KEY` et `ZAI_MODEL`
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
Vos idées/réponses sont envoyées à Z.ai pour générer le prompt. Consultez la page
`/privacy` in-app et la politique de confidentialité de Z.ai. Un consentement
est demandé au premier usage.

## Dépannage
- `GET /api/health` : indique si Z.ai est configuré (aucune clé
  exposée, aucun appel facturé). Réflexe n°1 quand `/api/generate` renvoie une erreur,
  surtout en production où les logs sont moins accessibles.
- « Z.ai n'est pas configuré » : `ZAI_API_KEY` ou `ZAI_MODEL` manque. Les anciens fichiers `.env` peuvent encore utiliser `OPENAI_API_KEY` et `OPENAI_MODEL` comme alias de migration; la requête part toujours uniquement vers Z.ai.
- « Z.ai est indisponible » : consulter les logs serveur `[ai]`; ils indiquent le modèle et le statut HTTP, sans contenu de réponse fournisseur. 401/403 indique un problème d'accès à la clé, 400/404 une configuration/requête/modèle à vérifier, 402/429 le quota ou la limite de débit; les 5xx sont généralement temporaires.
- Les messages d'erreur de l'API sont affichés tels quels dans l'interface.

## Roadmap (backlog)
- Vérification email, réinitialisation de mot de passe.
- Pagination de l'historique.
- Tests unitaires / intégration + CI.
# SuperBot

**One AI, multiple skills.** SuperBot est un assistant SaaS francophone qui route chaque demande vers le spécialiste adapté : généraliste, carrière, data ou développement.

## Fonctionnalités opérationnelles

- réponses Gemini diffusées en streaming NDJSON, avec mode démo sans clé ;
- inscription, connexion et sessions sécurisées par cookie HTTP-only ;
- conversations et historique multi-session dans PostgreSQL ;
- extraction réelle PDF, DOCX, XLSX, CSV, JSON, Markdown et texte ;
- mémoire explicite (« souviens-toi… ») et recherche vectorielle pgvector ;
- quotas journaliers et par minute calculés atomiquement côté serveur ;
- isolation des documents non fiables, signatures de fichiers et limites de taille ;
- pages Skills, Fichiers, Intégrations, Utilisation, Historique et Paramètres ;
- préférences synchronisées et suppression RGPD du compte avec cascade ;
- conteneur Docker, CI GitHub Actions et tests Playwright.

Les connecteurs GitHub, les graphiques Data, le pipeline de candidatures, Stripe et l’export PDF restent des modules à intégrer. Ils nécessitent aussi des choix produit et, pour GitHub/Stripe, des identifiants fournisseur.

## Installation locale

Prérequis : Node.js 22 et Docker.

```bash
npm ci
copy .env.example .env.local
docker compose up -d
npm run dev
```

Le schéma PostgreSQL est initialisé automatiquement au premier démarrage du volume. Si le volume existe déjà après une modification du schéma, applique `db/schema.sql` à la base ou recrée uniquement le volume de développement après avoir sauvegardé les données utiles.

Renseigne une **nouvelle** clé Google AI Studio dans `.env.local` :

```dotenv
GEMINI_API_KEY=nouvelle_cle_non_partagee
DATABASE_URL=postgresql://superbot:superbot@localhost:5432/superbot
DATABASE_SSL=false
RATE_LIMIT_SALT=une_valeur_longue_et_aleatoire
```

Ne préfixe jamais les secrets par `NEXT_PUBLIC_` et ne commite aucun fichier `.env`.

## Vérifications

```bash
npm run lint
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

La route `GET /api/health` expose uniquement l’état de disponibilité nécessaire aux probes, sans divulguer de secret.

## Déploiement

### Docker

```bash
docker build -t superbot .
docker run --env-file .env.production -p 3000:3000 superbot
```

### Vercel

1. importe le dépôt GitHub dans Vercel ;
2. configure `GEMINI_API_KEY`, `DATABASE_URL`, `DATABASE_SSL=true`, `RATE_LIMIT_SALT` et les modèles Gemini ;
3. utilise une base PostgreSQL hébergée avec l’extension `vector`, puis applique `db/schema.sql` ;
4. déploie. Next.js est détecté automatiquement.

Pour une base exigeant un certificat privé, adapte la configuration SSL dans `src/lib/server/db.ts` plutôt que de désactiver la vérification TLS.

## Sécurité et confidentialité

- Les clés restent exclusivement côté serveur.
- Les pièces jointes sont limitées à 10 Mo et seuls les formats explicitement autorisés sont analysés.
- Les contenus extraits sont traités comme non fiables par le prompt système.
- Les mots de passe sont dérivés avec `scrypt` et un sel aléatoire.
- La suppression du compte efface les entités liées grâce aux contraintes PostgreSQL `ON DELETE CASCADE`.

Cette base réduit les risques courants, mais un lancement public doit encore ajouter un antivirus de fichiers dédié, une politique de conservation datée, des sauvegardes testées, un suivi d’erreurs externe et une revue juridique RGPD.

## Licence

MIT

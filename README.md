# SuperBot

**One AI, multiple skills.** SuperBot est un MVP de SaaS multi-agent qui comprend l’intention d’une demande et la transmet automatiquement au bon spécialiste.

## Ce qui fonctionne

- Interface de chat responsive et persistante (stockage local)
- Routage automatique entre les agents General, Career, Data et Developer
- Sélection manuelle d’un agent pour garder le contrôle
- Ajout de fichiers avec validation du contexte côté API
- Indicateur de confiance et explication du routage
- États de chargement, erreurs, conversation réinitialisable et design mobile
- API typée, garde-fous de validation et tests unitaires du routeur
- Mode démo local sans clé API

## Démarrage

```bash
npm install
npm run dev
```

Ouvre ensuite [http://localhost:3000](http://localhost:3000).

## Vérification

```bash
npm test
npm run build
```

## Architecture

```text
src/
├── app/
│   ├── api/chat/route.ts   # endpoint de conversation
│   ├── globals.css         # design system responsive
│   ├── layout.tsx
│   └── page.tsx            # expérience de chat
└── lib/
    ├── agents.ts           # catalogue, routage et réponses démo
    └── agents.test.ts      # tests du routeur
```

## Passage en production

Le moteur est volontairement découplé de l’interface. Pour connecter un LLM, remplace `buildDemoResponse` par un adaptateur OpenAI (ou modèle local), conserve `routeIntent` comme fallback rapide, puis ajoute PostgreSQL/pgvector pour la mémoire longue durée. Les prochaines briques recommandées sont l’authentification, l’extraction réelle des PDF/CSV, les connecteurs GitHub et le suivi de consommation.

## Licence

MIT

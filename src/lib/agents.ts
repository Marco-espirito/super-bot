export type AgentId = "general" | "career" | "data" | "developer";

export type Agent = {
  id: AgentId;
  name: string;
  label: string;
  description: string;
  color: string;
  icon: string;
};

export const agents: Agent[] = [
  {
    id: "general",
    name: "Nova",
    label: "General AI",
    description: "Réfléchit, structure et coordonne les autres skills.",
    color: "#8257ff",
    icon: "✦",
  },
  {
    id: "career",
    name: "Atlas",
    label: "Career",
    description: "CV, candidatures, matching et préparation d'entretien.",
    color: "#ff8d5c",
    icon: "↗",
  },
  {
    id: "data",
    name: "Pulse",
    label: "Data",
    description: "Analyse de fichiers, tendances, anomalies et graphiques.",
    color: "#31c8a3",
    icon: "⌁",
  },
  {
    id: "developer",
    name: "Forge",
    label: "Developer",
    description: "Code, architecture, bugs et analyse de dépôts.",
    color: "#5b9dff",
    icon: "⌘",
  },
];

const signals: Record<Exclude<AgentId, "general">, string[]> = {
  career: [
    "cv", "emploi", "offre", "poste", "candidature", "entretien", "recruteur",
    "linkedin", "lettre de motivation", "compétence", "carrière", "job", "resume",
  ],
  data: [
    "csv", "excel", "donnée", "data", "tableau", "graphique", "analyse", "anomalie",
    "kpi", "chiffre d'affaires", "corrélation", "dataset", "prévision", "pandas",
  ],
  developer: [
    "code", "github", "bug", "erreur", "docker", "react", "typescript", "python",
    "api", "sql", "développe", "repository", "repo", "architecture", "fonction",
  ],
};

export function routeIntent(input: string): { agent: Agent; confidence: number; reasons: string[] } {
  const normalized = input.toLocaleLowerCase("fr-FR");
  const scores = Object.entries(signals).map(([id, words]) => {
    const hits = words.filter((word) => normalized.includes(word));
    return { id: id as AgentId, score: hits.length, hits };
  }).sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const selectedId: AgentId = winner.score > 0 ? winner.id : "general";
  const agent = agents.find((item) => item.id === selectedId)!;
  const confidence = winner.score === 0 ? 0.72 : Math.min(0.97, 0.78 + winner.score * 0.055);

  return {
    agent,
    confidence,
    reasons: winner.score ? winner.hits.slice(0, 3) : ["demande générale"],
  };
}

export function buildDemoResponse(message: string, agentId: AgentId, hasFile = false): string {
  const intro = hasFile
    ? "J’ai bien pris en compte le fichier joint. "
    : "";

  const responses: Record<AgentId, string> = {
    general: `${intro}Je peux transformer cette demande en plan d’action clair, puis mobiliser le skill le plus adapté. Pour avancer efficacement, je commencerais par définir le résultat attendu, les contraintes et les données disponibles.`,
    career: `${intro}Je vais traiter cela comme un objectif de candidature : identifier les compétences clés, comparer ton profil aux attentes du poste, puis proposer des améliorations concrètes et directement réutilisables.\n\n**Prochaine étape** — ajoute ton CV ou colle l’offre ciblée pour obtenir un score de compatibilité et un plan d’amélioration priorisé.`,
    data: `${intro}Je vais d’abord contrôler la structure et la qualité des données, puis isoler les tendances, anomalies et indicateurs utiles. Le résultat sera présenté avec des conclusions actionnables, pas seulement des chiffres.\n\n**Analyse prévue** — qualité des colonnes, valeurs manquantes, distributions, évolutions et signaux atypiques.`,
    developer: `${intro}Je vais raisonner du symptôme jusqu’à la cause racine : reproduire le problème, localiser la couche responsable, puis proposer une correction minimale accompagnée d’un test.\n\n**Approche** — architecture, flux de données, erreurs observables, correctif et validation.`,
  };

  const subject = message.trim().length > 100 ? `${message.trim().slice(0, 97)}…` : message.trim();
  return `${responses[agentId]}\n\n_Demande comprise : « ${subject} »_`;
}

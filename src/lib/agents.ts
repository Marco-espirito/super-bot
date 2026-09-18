export type AgentId = "general" | "career" | "data" | "developer";

export type AttachmentInput = {
  name: string;
  type: string;
  size: number;
  content?: string;
};

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

const signals: Record<Exclude<AgentId, "general">, Array<[string, number]>> = {
  career: [
    ["cv", 5], ["emploi", 3], ["offre", 4], ["poste", 3], ["candidature", 4],
    ["entretien", 4], ["recruteur", 4], ["linkedin", 3], ["lettre de motivation", 5],
    ["competence", 2], ["carriere", 3], ["job", 3], ["resume", 4],
  ],
  data: [
    ["csv", 5], ["excel", 5], ["donnee", 3], ["data", 1], ["tableau", 2],
    ["graphique", 4], ["analyse", 1], ["anomalie", 4], ["kpi", 4],
    ["chiffre d'affaires", 5], ["correlation", 4], ["dataset", 4], ["prevision", 3], ["pandas", 3],
  ],
  developer: [
    ["code", 3], ["github", 4], ["bug", 5], ["erreur", 4], ["docker", 4],
    ["react", 3], ["typescript", 3], ["python", 3], ["api", 3], ["sql", 3],
    ["developpe", 2], ["repository", 4], ["repo", 3], ["architecture", 3], ["fonction", 2],
  ],
};

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && agents.some((agent) => agent.id === value);
}

export function getAgent(id: AgentId): Agent {
  return agents.find((agent) => agent.id === id) ?? agents[0];
}

function normalize(value: string) {
  return value.toLocaleLowerCase("fr-FR").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function hasSignal(input: string, signal: string) {
  if (signal.includes(" ") || signal.includes("'")) return input.includes(signal);
  const escaped = signal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(input);
}

export function routeIntent(input: string): { agent: Agent; confidence: number; reasons: string[] } {
  const normalized = normalize(input);
  const scores = Object.entries(signals).map(([id, words]) => {
    const hits = words.filter(([word]) => hasSignal(normalized, word));
    return { id: id as AgentId, score: hits.reduce((total, [, weight]) => total + weight, 0), hits };
  }).sort((a, b) => b.score - a.score);

  const winner = scores[0];
  const selectedId: AgentId = winner.score > 0 ? winner.id : "general";
  const agent = agents.find((item) => item.id === selectedId)!;
  const runnerUp = scores[1]?.score ?? 0;
  const margin = Math.max(0, winner.score - runnerUp);
  const confidence = winner.score === 0 ? 0.72 : Math.min(0.97, 0.78 + winner.score * 0.012 + margin * 0.01);

  return {
    agent,
    confidence,
    reasons: winner.score ? winner.hits.slice(0, 3).map(([word]) => word) : ["demande générale"],
  };
}

function parseCsv(content: string) {
  const lines = content.replace(/\r/g, "").split("\n").filter((line) => line.trim()).slice(0, 501);
  if (lines.length < 2) return null;
  const delimiter = [",", ";", "\t"].sort((a, b) => lines[0].split(b).length - lines[0].split(a).length)[0];
  const split = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && line[index + 1] === '"') { current += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === delimiter && !quoted) { cells.push(current.trim()); current = ""; }
      else current += char;
    }
    cells.push(current.trim());
    return cells;
  };
  const headers = split(lines[0]).map((header, index) => header || `Colonne ${index + 1}`);
  const rows = lines.slice(1).map(split);
  const incomplete = headers.reduce((sum, _, index) => sum + rows.filter((row) => !row[index]).length, 0);
  const numeric = headers.filter((_, index) => {
    const values = rows.map((row) => row[index]).filter(Boolean);
    return values.length > 0 && values.filter((value) => Number.isFinite(Number(value.replace(",", ".")))).length / values.length > 0.8;
  });
  return { headers, rowCount: rows.length, incomplete, numeric };
}

function attachmentInsight(attachments: AttachmentInput[]) {
  const attachment = attachments.find((item) => item.content?.trim());
  if (!attachment?.content) {
    return attachments.length ? `J’ai reçu **${attachments[0].name}**. Son contenu binaire sera analysable dès la connexion du parseur documentaire.` : "";
  }
  const isCsv = /csv|comma-separated/i.test(attachment.type) || attachment.name.toLowerCase().endsWith(".csv");
  if (isCsv) {
    const csv = parseCsv(attachment.content);
    if (csv) {
      const columns = csv.headers.slice(0, 8).join(", ");
      const numeric = csv.numeric.length ? ` Colonnes numériques détectées : ${csv.numeric.slice(0, 5).join(", ")}.` : "";
      const rowLabel = csv.rowCount > 1 ? "lignes" : "ligne";
      const columnLabel = csv.headers.length > 1 ? "colonnes" : "colonne";
      const missingLabel = csv.incomplete > 1 ? "valeurs manquantes" : "valeur manquante";
      return `J’ai inspecté **${attachment.name}** : ${csv.rowCount} ${rowLabel} de données, ${csv.headers.length} ${columnLabel} (${columns}) et ${csv.incomplete} ${missingLabel}.${numeric}`;
    }
  }
  const words = attachment.content.trim().split(/\s+/).filter(Boolean).length;
  const lines = attachment.content.replace(/\r/g, "").split("\n").filter((line) => line.trim()).length;
  return `J’ai lu **${attachment.name}** : ${words} mots répartis sur ${lines} ligne(s).`;
}

export function buildDemoResponse(message: string, agentId: AgentId, attachments: AttachmentInput[] = []): string {
  const insight = attachmentInsight(attachments);
  const intro = insight ? `${insight}\n\n` : "";

  const responses: Record<AgentId, string> = {
    general: `${intro}Je peux transformer cette demande en plan d’action clair, puis mobiliser le skill le plus adapté. Pour avancer efficacement, je commencerais par définir le résultat attendu, les contraintes et les données disponibles.`,
    career: `${intro}Je vais traiter cela comme un objectif de candidature : identifier les compétences clés, comparer ton profil aux attentes du poste, puis proposer des améliorations concrètes et directement réutilisables.\n\n**Prochaine étape** — ajoute ton CV ou colle l’offre ciblée pour obtenir un score de compatibilité et un plan d’amélioration priorisé.`,
    data: `${intro}Je vais contrôler la qualité des données, puis isoler les tendances, anomalies et indicateurs utiles. Le résultat sera présenté avec des conclusions actionnables, pas seulement des chiffres.\n\n**Analyse prévue** — valeurs manquantes, distributions, évolutions et signaux atypiques.`,
    developer: `${intro}Je vais raisonner du symptôme jusqu’à la cause racine : reproduire le problème, localiser la couche responsable, puis proposer une correction minimale accompagnée d’un test.\n\n**Approche** — architecture, flux de données, erreurs observables, correctif et validation.`,
  };

  const subject = message.trim().length > 100 ? `${message.trim().slice(0, 97)}…` : message.trim();
  return `${responses[agentId]}\n\n_Demande comprise : « ${subject} »_`;
}

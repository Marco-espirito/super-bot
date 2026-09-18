import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoResponse, isAgentId, routeIntent } from "./agents.ts";

test("routes a CV request to the career agent", () => {
  const result = routeIntent("Analyse mon CV pour cette offre Data Analyst");
  assert.equal(result.agent.id, "career");
  assert.ok(result.confidence > 0.8);
});

test("routes a CSV analysis to the data agent", () => {
  assert.equal(routeIntent("Trouve les anomalies de ce fichier CSV").agent.id, "data");
});

test("routes a code issue to the developer agent", () => {
  assert.equal(routeIntent("Corrige ce bug React dans mon code").agent.id, "developer");
});

test("falls back to the general agent", () => {
  assert.equal(routeIntent("Aide-moi à organiser ma journée").agent.id, "general");
});

test("includes attachment awareness in demo response", () => {
  const response = buildDemoResponse("Analyse ceci", "data", [{
    name: "ventes.csv",
    type: "text/csv",
    size: 42,
    content: "mois,ca,region\njanvier,1200,nord\nfevrier,,sud",
  }]);
  assert.match(response, /2 lignes de données/);
  assert.match(response, /1 valeur manquante/);
});

test("does not confuse a Data Analyst career request with data analysis", () => {
  assert.equal(routeIntent("Adapte mon CV à cette offre Data Analyst").agent.id, "career");
});

test("matches accented French signals", () => {
  assert.equal(routeIntent("Prépare ma carrière et mes compétences").agent.id, "career");
});

test("validates agent identifiers", () => {
  assert.equal(isAgentId("developer"), true);
  assert.equal(isAgentId("hacker"), false);
});

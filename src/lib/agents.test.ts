import assert from "node:assert/strict";
import test from "node:test";
import { buildDemoResponse, routeIntent } from "./agents.ts";

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
  assert.match(buildDemoResponse("Analyse ceci", "data", true), /fichier joint/);
});

import { describe, it, expect } from "vitest";
import {
  parseAIResult,
  buildLocalFinalPrompt,
  buildUserMessage,
  buildSystemPrompt,
  FORCE_FINAL_PROMPT,
} from "@/lib/prompt";

describe("parseAIResult", () => {
  it("parse un objet final valide", () => {
    expect(parseAIResult('{"type":"final","prompt":"Fais X"}')).toEqual({
      type: "final",
      prompt: "Fais X",
    });
  });

  it("parse un objet questions valide", () => {
    expect(parseAIResult('{"type":"questions","questions":["Q1","Q2"]}')).toEqual({
      type: "questions",
      questions: ["Q1", "Q2"],
    });
  });

  it("retourne null sur JSON invalide", () => {
    expect(parseAIResult("pas du json")).toBeNull();
  });

  it("retourne null si le type est inconnu", () => {
    expect(parseAIResult('{"type":"autre"}')).toBeNull();
  });

  it("retourne null si questions n'est pas un tableau", () => {
    expect(parseAIResult('{"type":"questions","questions":"Q1"}')).toBeNull();
  });

  it("retourne null si prompt n'est pas une chaîne", () => {
    expect(parseAIResult('{"type":"final","prompt":42}')).toBeNull();
  });

  it("retourne null sur un objet vide", () => {
    expect(parseAIResult("{}")).toBeNull();
  });
});

describe("buildLocalFinalPrompt", () => {
  it("inclut la tâche initiale", () => {
    const p = buildLocalFinalPrompt("Créer un site");
    expect(p).toContain("Créer un site");
    expect(p).toContain("expert en rédaction de prompts");
  });

  it("inclut les questions et réponses renseignées", () => {
    const p = buildLocalFinalPrompt("Créer un site", ["Public cible ?"], ["Les devs"]);
    expect(p).toContain("- Public cible ? : Les devs");
  });

  it("ignore les réponses vides", () => {
    const p = buildLocalFinalPrompt("Créer un site", ["Public ?"], [""]);
    expect(p).not.toContain("Public ? :");
  });
});

describe("buildUserMessage", () => {
  it("inclut le contexte des questions/réponses précédentes", () => {
    const msg = buildUserMessage("Idée", ["Q1", "Q2"], ["R1", "R2"]);
    expect(msg.content).toContain("Q1: Q1");
    expect(msg.content).toContain("R1: R1");
    expect(msg.content).toContain("R2: R2");
  });

  it("commence par l'idée initiale", () => {
    expect(buildUserMessage("Mon idée").content).toContain("Mon idée");
  });
});

describe("FORCE_FINAL_PROMPT", () => {
  it("exige le prompt final", () => {
    expect(FORCE_FINAL_PROMPT).toContain("Ne pose plus de questions");
    expect(FORCE_FINAL_PROMPT).toContain("final");
  });
});

describe("buildSystemPrompt", () => {
  it("inclut le style par défaut équilibré", () => {
    const sys = buildSystemPrompt();
    expect(sys.content).toContain("STYLE ÉQUILIBRÉ");
  });

  it("respecte le style demandé", () => {
    expect(buildSystemPrompt("concise").content).toContain("STYLE CONCIS");
    expect(buildSystemPrompt("detailed").content).toContain("STYLE DÉTAILLÉ");
  });
});
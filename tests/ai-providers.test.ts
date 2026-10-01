import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAvailableProviders } from "@/lib/ai";

const WATCHED = [
  "ZAI_API_KEY",
  "ZAI_MODEL",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "GOOGLE_AI_API_KEY",
  "GOOGLE_AI_MODEL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
];

const initial: Record<string, string | undefined> = {};
for (const key of WATCHED) initial[key] = process.env[key];

function clearWatched() {
  for (const key of WATCHED) delete process.env[key];
}

function restoreWatched() {
  for (const key of WATCHED) {
    if (initial[key] === undefined) delete process.env[key];
    else process.env[key] = initial[key];
  }
}

describe("getAvailableProviders", () => {
  beforeEach(clearWatched);
  afterEach(restoreWatched);

  it("ne configure rien sans clé Z.ai", () => {
    expect(getAvailableProviders()).toEqual([]);
  });

  it("utilise ZAI_API_KEY et le modèle gratuit par défaut", () => {
    process.env.ZAI_API_KEY = "cle-de-test";

    expect(getAvailableProviders()).toEqual([
      {
        name: "Z.ai",
        baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
        apiKey: "cle-de-test",
        model: "glm-4.7-flash",
      },
    ]);
  });

  it("utilise uniquement les modèles GLM gratuits configurés", () => {
    process.env.ZAI_API_KEY = "cle-zai-test";
    process.env.ZAI_MODEL = "gpt-4o-mini, glm-4.7-flash, glm-5.3, glm-4.5-flash";

    expect(getAvailableProviders().map(({ model }) => model)).toEqual([
      "glm-4.7-flash",
      "glm-4.5-flash",
    ]);
  });

  it("ignore les anciennes variables OPENAI_*", () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    process.env.OPENAI_MODEL = "glm-4.7-flash";
    expect(getAvailableProviders()).toEqual([]);
  });

  it("ignore les anciennes clés Google, Groq et OpenRouter", () => {
    process.env.GOOGLE_AI_API_KEY = "cle-google-test";
    process.env.GOOGLE_AI_MODEL = "gemini-model";
    process.env.GROQ_API_KEY = "cle-groq-test";
    process.env.GROQ_MODEL = "groq-model";
    process.env.OPENROUTER_API_KEY = "cle-openrouter-test";
    process.env.OPENROUTER_MODEL = "openrouter/model";

    expect(getAvailableProviders()).toEqual([]);
  });

  it("ignore un modèle configuré qui n'est pas un modèle gratuit GLM", () => {
    process.env.ZAI_API_KEY = "cle-de-test";
    process.env.ZAI_MODEL = "gpt-4o-mini";
    expect(getAvailableProviders()).toEqual([]);
  });
});

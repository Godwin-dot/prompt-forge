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

  it("ne configure rien sans clé Z.ai et modèle", () => {
    expect(getAvailableProviders()).toEqual([]);
  });

  it("utilise ZAI_API_KEY / ZAI_MODEL et l'endpoint officiel Z.ai", () => {
    process.env.ZAI_API_KEY = "cle-de-test";
    process.env.ZAI_MODEL = "glm-5.3";

    expect(getAvailableProviders()).toEqual([
      {
        name: "Z.ai",
        baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
        apiKey: "cle-de-test",
        model: "glm-5.3",
      },
    ]);
  });

  it("préfère les variables ZAI_* aux alias de migration OPENAI_*", () => {
    process.env.ZAI_API_KEY = "cle-zai-test";
    process.env.ZAI_MODEL = "glm-5.3";
    process.env.OPENAI_API_KEY = "ancienne-cle-test";
    process.env.OPENAI_MODEL = "ancien-modele-test";

    expect(getAvailableProviders().map((provider) => ({
      name: provider.name,
      model: provider.model,
      baseUrl: provider.baseUrl,
    }))).toEqual([
      {
        name: "Z.ai",
        model: "glm-5.3",
        baseUrl: "https://api.z.ai/api/paas/v4/chat/completions",
      },
    ]);
  });

  it("accepte les noms OPENAI_* existants mais envoie toujours vers Z.ai", () => {
    process.env.OPENAI_API_KEY = "cle-de-test";
    process.env.OPENAI_MODEL = "glm-5.3";

    const [provider] = getAvailableProviders();

    expect(provider.name).toBe("Z.ai");
    expect(provider.baseUrl).toBe(
      "https://api.z.ai/api/paas/v4/chat/completions"
    );
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

  it("ignore une configuration Z.ai incomplète", () => {
    process.env.ZAI_API_KEY = "cle-de-test";
    expect(getAvailableProviders()).toEqual([]);
  });
});

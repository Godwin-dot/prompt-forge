import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAvailableProviders } from "@/lib/ai";

// Variables inspectées par le résolveur de fournisseurs.
const WATCHED = [
  "GOOGLE_AI_API_KEY",
  "GOOGLE_AI_MODEL",
  "GOOGLE_AI_BASE_URL",
  "GROQ_API_KEY",
  "GROQ_MODEL",
  "GROQ_BASE_URL",
  "OPENROUTER_API_KEY",
  "OPENROUTER_MODEL",
  "OPENROUTER_BASE_URL",
  "NEXTAUTH_URL",
  "GOOGLE_API_KEY",
  "GOOGLE_MODEL",
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

  it("ne retourne aucun fournisseur sans clé ni modèle", () => {
    expect(getAvailableProviders()).toEqual([]);
  });

  it("lit bien GOOGLE_AI_API_KEY / GOOGLE_AI_MODEL", () => {
    process.env.GOOGLE_AI_API_KEY = "cle-de-test";
    process.env.GOOGLE_AI_MODEL = "gemini-3.8-flash";

    const providers = getAvailableProviders();

    expect(providers).toHaveLength(1);
    expect(providers[0].name).toBe("google");
    expect(providers[0].model).toBe("gemini-3.8-flash");
    expect(providers[0].baseUrl).toContain("generativelanguage.googleapis.com");
  });

  it("inclut Groq et développe les modèles configurés en liste", () => {
    process.env.GROQ_API_KEY = "cle-de-test";
    process.env.GROQ_MODEL = "llama-3.3-70b, , llama-3.1-8b";

    const providers = getAvailableProviders();

    expect(providers.map(({ name, model }) => [name, model])).toEqual([
      ["groq", "llama-3.3-70b"],
      ["groq", "llama-3.1-8b"],
    ]);
    expect(providers[0].baseUrl).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
  });

  it("configure OpenRouter avec ses en-têtes d'identification", () => {
    process.env.OPENROUTER_API_KEY = "cle-de-test";
    process.env.OPENROUTER_MODEL = "provider/model";
    process.env.NEXTAUTH_URL = "https://prompt-forge.example";

    const [provider] = getAvailableProviders();

    expect(provider.name).toBe("openrouter");
    expect(provider.baseUrl).toBe(
      "https://openrouter.ai/api/v1/chat/completions"
    );
    expect(provider.headers).toEqual({
      "HTTP-Referer": "https://prompt-forge.example",
      "X-Title": "Prompt Forge",
    });
  });

  it("ignore l'ancien préfixe GOOGLE_* (régression : clé Google jamais lue)", () => {
    process.env.GOOGLE_API_KEY = "cle-de-test";
    process.env.GOOGLE_MODEL = "gemini-3.8-flash";
    expect(getAvailableProviders()).toEqual([]);
  });

  it("respecte l'override GOOGLE_AI_BASE_URL", () => {
    process.env.GOOGLE_AI_API_KEY = "cle-de-test";
    process.env.GOOGLE_AI_MODEL = "gemini-3.8-flash";
    process.env.GOOGLE_AI_BASE_URL = "http://localhost:4310/gemini";

    expect(getAvailableProviders()[0].baseUrl).toBe("http://localhost:4310/gemini");
  });

  it("ignore un fournisseur à moitié configuré (modèle manquant)", () => {
    process.env.GOOGLE_AI_API_KEY = "cle-de-test";
    expect(getAvailableProviders()).toEqual([]);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callAI } from "@/lib/ai";

// Contexte : Gemini a renvoyé un 503 « model is overloaded » en production,
// et comme un seul fournisseur est configuré, il n'y a plus de repli derrière.
// D'où le réessai automatique sur erreur transitoire, verrouillé ici.

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PROVIDER_ENV = [
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
];

describe("callAI — réessai sur erreur transitoire", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      PROVIDER_ENV.map((key) => [key, process.env[key]])
    );
    for (const key of PROVIDER_ENV) delete process.env[key];
    process.env.GOOGLE_AI_API_KEY = "cle-de-test";
    process.env.GOOGLE_AI_MODEL = "gemini-3.8-flash";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of PROVIDER_ENV) {
      const value = originalEnv[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("envoie les identifiants et le modèle au endpoint Gemini compatible OpenAI", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          choices: [{ message: { content: "OK" } }],
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    await callAI([{ role: "user", content: "test" }]);

    const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    );
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer cle-de-test"
    );
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "gemini-3.8-flash",
    });
  });

  it("réessaie une fois après un 503 puis renvoie la réponse", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ error: { message: "model is overloaded" } }, 503);
        }
        return jsonResponse({
          choices: [{ message: { content: "OK-APRES-RETRY" } }],
        });
      })
    );

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result.content).toBe("OK-APRES-RETRY");
    expect(result.provider).toBe("google");
    expect(calls).toBe(2);
  }, 10_000);

  it("passe au modèle suivant si le premier modèle échoue", async () => {
    process.env.GOOGLE_AI_MODEL = "gemini-indisponible, gemini-de-repli";
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const { model } = JSON.parse(String(init?.body)) as { model: string };
      if (model === "gemini-indisponible") {
        return jsonResponse({ error: { message: "model not found" } }, 404);
      }
      return jsonResponse({
        choices: [{ message: { content: "OK-MODELE-SECONDAIRE" } }],
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result).toMatchObject({
      provider: "google",
      model: "gemini-de-repli",
      content: "OK-MODELE-SECONDAIRE",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("bascule vers Groq après l'échec définitif de Google", async () => {
    process.env.GROQ_API_KEY = "cle-groq-test";
    process.env.GROQ_MODEL = "llama-3.3-70b";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ error: { message: "invalid key" } }, 401)
      )
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "OK-GROQ" } }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result).toMatchObject({
      provider: "groq",
      model: "llama-3.3-70b",
      content: "OK-GROQ",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(
      "https://api.groq.com/openai/v1/chat/completions"
    );
  });

  it("passe au fournisseur suivant après une erreur réseau sans répéter le même appel", async () => {
    process.env.GROQ_API_KEY = "cle-groq-test";
    process.env.GROQ_MODEL = "llama-3.3-70b";
    const sensitiveErrorText = "private-fetch-error-detail";
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError(sensitiveErrorText))
      .mockResolvedValueOnce(
        jsonResponse({
          choices: [{ message: { content: "OK-GROQ" } }],
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result.provider).toBe("groq");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledWith(
      "[ai] google/gemini-3.8-flash a échoué (network)"
    );
    expect(
      vi.mocked(console.error).mock.calls.flat().join(" ")
    ).not.toContain(sensitiveErrorText);
  });

  it("envoie les en-têtes d'identification à OpenRouter", async () => {
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_MODEL;
    process.env.OPENROUTER_API_KEY = "cle-openrouter-test";
    process.env.OPENROUTER_MODEL = "provider/model";
    process.env.NEXTAUTH_URL = "https://prompt-forge.example";
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          choices: [{ message: { content: "OK-OPENROUTER" } }],
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);
    const [, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    const headers = new Headers(init.headers);

    expect(result.provider).toBe("openrouter");
    expect(headers.get("Authorization")).toBe("Bearer cle-openrouter-test");
    expect(headers.get("HTTP-Referer")).toBe("https://prompt-forge.example");
    expect(headers.get("X-Title")).toBe("Prompt Forge");
  });

  it("ne réessaie pas sur une erreur définitive (401)", async () => {
    let calls = 0;
    const responseDetail = "provider-error-detail-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return jsonResponse(
          { error: { message: responseDetail } },
          401
        );
      })
    );

    await expect(
      callAI([{ role: "user", content: "test" }])
    ).rejects.toThrow(/indisponibles/);
    expect(calls).toBe(1);
    expect(console.error).toHaveBeenCalledWith(
      "[ai] google/gemini-3.8-flash a échoué (HTTP 401)"
    );
    expect(
      vi.mocked(console.error).mock.calls.flat().join(" ")
    ).not.toContain(responseDetail);
  }, 10_000);

  it("renvoie une erreur « surchargé » (503) quand tous les essais échouent", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return jsonResponse(
          { error: { code: 503, message: "high demand", status: "UNAVAILABLE" } },
          503
        );
      })
    );

    await expect(
      callAI([{ role: "user", content: "test" }])
    ).rejects.toMatchObject({
      status: 503,
      message: expect.stringMatching(/surchargé/),
    });
    expect(calls).toBe(3);
  }, 15_000);
});

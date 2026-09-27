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

describe("callAI — réessai sur erreur transitoire", () => {
  beforeEach(() => {
    process.env.GOOGLE_AI_API_KEY = "cle-de-test";
    process.env.GOOGLE_AI_MODEL = "gemini-3.8-flash";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GOOGLE_AI_API_KEY;
    delete process.env.GOOGLE_AI_MODEL;
    delete process.env.GOOGLE_AI_BASE_URL;
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

  it("ne réessaie pas sur une erreur définitive (401)", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        return jsonResponse({ error: { message: "invalid api key" } }, 401);
      })
    );

    await expect(
      callAI([{ role: "user", content: "test" }])
    ).rejects.toThrow(/indisponibles/);
    expect(calls).toBe(1);
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

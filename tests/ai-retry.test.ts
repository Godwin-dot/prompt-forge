import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { callAI } from "@/lib/ai";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const PROVIDER_ENV = [
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

describe("callAI — Z.ai", () => {
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(
      PROVIDER_ENV.map((key) => [key, process.env[key]])
    );
    for (const key of PROVIDER_ENV) delete process.env[key];
    process.env.ZAI_API_KEY = "cle-de-test";
    process.env.ZAI_MODEL = "glm-4.7-flash";
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

  it("appelle l'endpoint Z.ai avec le modèle configuré et l'authentification Bearer", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          choices: [{ message: { content: "OK" } }],
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    const [url, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];
    expect(url).toBe("https://api.z.ai/api/paas/v4/chat/completions");
    expect(new Headers(init.headers).get("Authorization")).toBe(
      "Bearer cle-de-test"
    );
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "glm-4.7-flash" });
    expect(result.provider).toBe("Z.ai");
  });

  it("réessaie une erreur HTTP transitoire puis renvoie la réponse", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) {
          return jsonResponse({ error: { message: "temporary overload" } }, 503);
        }
        return jsonResponse({
          choices: [{ message: { content: "OK-APRES-RETRY" } }],
        });
      })
    );

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result.content).toBe("OK-APRES-RETRY");
    expect(calls).toBe(2);
  });

  it("essaie le modèle Z.ai suivant si le modèle configuré échoue", async () => {
    process.env.ZAI_MODEL = "glm-4.7-flash, glm-4.5-flash";
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) => {
        const { model } = JSON.parse(String(init?.body)) as { model: string };
        if (model === "glm-4.7-flash") {
          return jsonResponse({ error: { message: "model not found" } }, 404);
        }
        return jsonResponse({
          choices: [{ message: { content: "OK-GLM-4.5-FLASH" } }],
        });
      }
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result).toMatchObject({
      provider: "Z.ai",
      model: "glm-4.5-flash",
      content: "OK-GLM-4.5-FLASH",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("n'appelle que Z.ai même si les anciennes clés fournisseur sont présentes", async () => {
    process.env.GOOGLE_AI_API_KEY = "cle-google-test";
    process.env.GOOGLE_AI_MODEL = "gemini-model";
    process.env.GROQ_API_KEY = "cle-groq-test";
    process.env.GROQ_MODEL = "groq-model";
    process.env.OPENROUTER_API_KEY = "cle-openrouter-test";
    process.env.OPENROUTER_MODEL = "openrouter/model";
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse({
          choices: [{ message: { content: "OK-ZAI" } }],
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);

    expect(result.provider).toBe("Z.ai");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.z.ai/api/paas/v4/chat/completions"
    );
  });

  it("ignore l'ancien modèle OpenAI gpt-4o-mini et utilise uniquement GLM gratuit", async () => {
    process.env.OPENAI_API_KEY = "cle-openai-test";
    process.env.OPENAI_MODEL = "gpt-4o-mini";
    delete process.env.ZAI_MODEL;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, init?: RequestInit) =>
        jsonResponse({
          choices: [{ message: { content: "OK-GLM" } }],
        })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callAI([{ role: "user", content: "test" }]);
    const [, init] = fetchMock.mock.calls[0] as [URL | string, RequestInit];

    expect(result.model).toBe("glm-4.7-flash");
    expect(JSON.parse(String(init.body))).toMatchObject({
      model: "glm-4.7-flash",
    });
  });

  it("signale une erreur réseau sans révéler le détail ni réessayer sur d'autres fournisseurs", async () => {
    const sensitiveErrorText = "private-fetch-error-detail";
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError(sensitiveErrorText));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      callAI([{ role: "user", content: "test" }])
    ).rejects.toThrow(/Z\.ai est indisponible/);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "[ai] Z.ai/glm-4.7-flash a échoué (network)"
    );
    expect(
      vi.mocked(console.error).mock.calls.flat().join(" ")
    ).not.toContain(sensitiveErrorText);
  });

  it("n'expose que le statut HTTP dans le journal, jamais la réponse du fournisseur", async () => {
    const responseDetail = "provider-error-detail-test";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ error: { message: responseDetail } }, 401))
    );

    await expect(
      callAI([{ role: "user", content: "test" }])
    ).rejects.toThrow(/Z\.ai est indisponible/);

    expect(console.error).toHaveBeenCalledWith(
      "[ai] Z.ai/glm-4.7-flash a échoué (HTTP 401)"
    );
    expect(
      vi.mocked(console.error).mock.calls.flat().join(" ")
    ).not.toContain(responseDetail);
  });

  it("renvoie une erreur « surchargé » après les échecs 503", async () => {
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
  });
});

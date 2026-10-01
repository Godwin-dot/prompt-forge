export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  headers?: Record<string, string>;
};

export type AIResponse = {
  provider: string;
  model: string;
  content: string;
};

// Résultat d'une tentative : contenu, ou échec (status HTTP, null si réseau).
type ProviderOutcome =
  | { ok: true; content: string }
  | {
      ok: false;
      status: number | null;
      reason?: "timeout" | "network" | "response";
    };

const REQUEST_TIMEOUT_MS = 15_000;
const TOTAL_TIMEOUT_MS = 30_000;

// Erreurs transitoires : le fournisseur est surchargé ou limité temporairement.
// Cas réel rencontré : Gemini 503 « This model is currently experiencing high
// demand » — même le modèle recommandé par Google tombe parfois en saturation.
const TRANSIENT_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [700, 1600];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Erreur d'indisponibilité, porteuse du code HTTP à renvoyer au client :
// 503 = surcharge temporaire (réessayer), 502 = échec définitif.
export class AIUnavailableError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AIUnavailableError";
    this.status = status;
  }
}

// Un fournisseur = un préfixe de variables d'environnement EXPLICITE.
// Correctif : le préfixe était déduit du nom (`google` -> `GOOGLE_*`) alors que
// le .env fournit `GOOGLE_AI_*` ; la clé Google n'était donc jamais lue et le
// fournisseur était ignoré en silence (aucune erreur, aucun appel).
type ProviderDefinition = {
  name: string;
  envPrefix: string;
  // Endpoint /chat/completions complet, compatible OpenAI.
  baseUrl: string;
  headers?: (env: NodeJS.ProcessEnv) => Record<string, string>;
};

// Ordre = priorité de repli. Les modèles séparés par des virgules sont tentés
// dans l'ordre fourni avant de passer au fournisseur suivant.
const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    name: "google",
    envPrefix: "GOOGLE_AI",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
  {
    name: "groq",
    envPrefix: "GROQ",
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
  },
  {
    name: "openrouter",
    envPrefix: "OPENROUTER",
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    headers: (env) => ({
      ...(env.NEXTAUTH_URL ? { "HTTP-Referer": env.NEXTAUTH_URL } : {}),
      "X-Title": "Prompt Forge",
    }),
  },
];

export function getAvailableProviders(): AIProvider[] {
  return PROVIDER_DEFINITIONS.flatMap((definition) => {
    const apiKey = process.env[`${definition.envPrefix}_API_KEY`] ?? "";
    const models = (process.env[`${definition.envPrefix}_MODEL`] ?? "")
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean);

    if (!apiKey || models.length === 0) return [];

    return models.map((model) => ({
      name: definition.name,
      baseUrl:
        process.env[`${definition.envPrefix}_BASE_URL`] ?? definition.baseUrl,
      apiKey,
      model,
      headers: definition.headers?.(process.env),
    }));
  });
}

// Un appel fournisseur, avec réessais espacés sur erreur transitoire.
// Le budget global (remainingMs) est respecté à chaque tentative.
async function callProvider(
  provider: AIProvider,
  messages: AIMessage[],
  remainingMs: number,
  temperature = 0.7
): Promise<ProviderOutcome> {
  const deadline = Date.now() + remainingMs;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const left = deadline - Date.now();
    if (left <= 0) return { ok: false, status: null };

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.min(REQUEST_TIMEOUT_MS, left)
    );

    try {
      const res = await fetch(provider.baseUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
          ...provider.headers,
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const transient = TRANSIENT_STATUSES.has(res.status);
        console.error(
          `[ai] ${provider.name}/${provider.model} a échoué (HTTP ${res.status}${transient ? ", transitoire" : ""})`
        );
        try {
          await res.body?.cancel();
        } catch {
          console.error(
            `[ai] ${provider.name}/${provider.model} : fermeture impossible de la réponse HTTP ${res.status}`
          );
        }
        if (transient && attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
          continue;
        }
        return { ok: false, status: res.status };
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error(`[ai] ${provider.name} a renvoyé une réponse vide`);
        if (attempt < MAX_ATTEMPTS) {
          await sleep(RETRY_DELAYS_MS[attempt - 1]);
          continue;
        }
        return { ok: false, status: null };
      }

      return { ok: true, content };
    } catch (error) {
      const reason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : error instanceof TypeError
            ? "network"
            : "response";
      console.error(
        `[ai] ${provider.name}/${provider.model} a échoué (${reason})`
      );
      return { ok: false, status: null, reason };
    } finally {
      clearTimeout(timeout);
    }
  }

  return { ok: false, status: null };
}

// Parcourt les fournisseurs dans l'ordre de priorité et retourne la première
// réponse valide. Un budget global borne la durée totale, quel que soit le nombre
// de fournisseurs tentés : chaque appel reçoit au plus le temps restant (et au
// plus REQUEST_TIMEOUT_MS). Si tous échouent (ou si le budget expire), lève une
// AIUnavailableError explicite (503 surcharge temporaire / 502 échec définitif).
export async function callAI(
  messages: AIMessage[],
  options?: { temperature?: number }
): Promise<AIResponse> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error(
      "Aucun fournisseur IA configuré. Renseigne au moins une paire de variables " +
        "API_KEY et MODEL pour Google AI, Groq ou OpenRouter."
    );
  }

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const failures: string[] = [];
  let lastStatus: number | null = null;

  for (let index = 0; index < providers.length; index++) {
    const provider = providers[index];
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const providerBudget = Math.ceil(remaining / (providers.length - index));
    const outcome = await callProvider(
      provider,
      messages,
      providerBudget,
      options?.temperature
    );
    if (outcome.ok) {
      return {
        provider: provider.name,
        model: provider.model,
        content: outcome.content,
      };
    }
    lastStatus = outcome.status;
    failures.push(
      `${provider.name}/${provider.model} (${outcome.status ?? outcome.reason ?? "erreur inconnue"})`
    );
  }

  // Surcharge temporaire : on le dit clairement (au lieu d'accuser à tort la clé
  // ou le modèle) et on renvoie 503 pour que le client puisse réessayer.
  if (lastStatus !== null && TRANSIENT_STATUSES.has(lastStatus)) {
    throw new AIUnavailableError(
      `Le fournisseur IA est momentanément surchargé (HTTP ${lastStatus}). ` +
        `Réessaie dans quelques secondes.`,
      503
    );
  }

  const timedOut = Date.now() >= deadline;
  const providerNames = Array.from(
    new Set(providers.map((provider) => provider.name))
  );
  throw new AIUnavailableError(
    `Tous les fournisseurs IA sont indisponibles (${providerNames.join(", ")}). ` +
      (timedOut
        ? `Le délai global (${TOTAL_TIMEOUT_MS} ms) est épuisé.`
        : `Échecs : ${failures.join(", ")}. Vérifie la configuration du fournisseur et les quotas.`),
    502
  );
}
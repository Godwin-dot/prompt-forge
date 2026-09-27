export type AIMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AIProvider = {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type AIResponse = {
  provider: string;
  model: string;
  content: string;
};

// Résultat d'une tentative : contenu, ou échec (status HTTP, null si réseau).
type ProviderOutcome =
  | { ok: true; content: string }
  | { ok: false; status: number | null };

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
};

// Ordre = priorité de repli. Tout fournisseur sans clé ET modèle est ignoré.
// Aujourd'hui : Google AI uniquement (modèle Groq retiré, clé OpenRouter
// invalide et crédits OpenAI épuisés au moment du diagnostic).
// Pour en ajouter un : une entrée ci-dessous + les variables
// <PREFIXE>_API_KEY / <PREFIXE>_MODEL (/ <PREFIXE>_BASE_URL si besoin).
const PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    name: "google",
    envPrefix: "GOOGLE_AI",
    baseUrl:
      "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  },
];

export function getAvailableProviders(): AIProvider[] {
  return PROVIDER_DEFINITIONS.map((p) => ({
    name: p.name,
    baseUrl: process.env[`${p.envPrefix}_BASE_URL`] ?? p.baseUrl,
    apiKey: process.env[`${p.envPrefix}_API_KEY`] ?? "",
    model: process.env[`${p.envPrefix}_MODEL`] ?? "",
  })).filter((p) => p.apiKey && p.model);
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
          // Un fournisseur exigeant des en-têtes en plus s'ajoute ici
          // (ex. OpenRouter : HTTP-Referer / X-Title).
        },
        body: JSON.stringify({
          model: provider.model,
          messages,
          temperature,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const isQuota = res.status === 429 || res.status === 402;
        const transient = TRANSIENT_STATUSES.has(res.status);
        const reason = isQuota
          ? "quota/rate-limit"
          : `HTTP ${res.status}${transient ? ", transitoire" : ""}`;
        console.error(
          `[ai] ${provider.name} a échoué (${reason}) : ${(await res.text()).slice(0, 500)}`
        );
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
      console.error(`[ai] ${provider.name} a échoué :`, error);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
        continue;
      }
      return { ok: false, status: null };
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
      "Aucun fournisseur IA configuré. Renseigne GOOGLE_AI_API_KEY et " +
        "GOOGLE_AI_MODEL (fichier .env en local, variables d'environnement en production)."
    );
  }

  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  let lastError: string = "inconnue";
  let lastStatus: number | null = null;

  for (const provider of providers) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    const outcome = await callProvider(
      provider,
      messages,
      remaining,
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
    lastError = `${provider.name} (${outcome.status ?? "échec réseau"})`;
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
  throw new AIUnavailableError(
    `Tous les fournisseurs IA sont indisponibles (${providers
      .map((p) => p.name)
      .join(", ")}). ` +
      (timedOut
        ? `Le délai global (${TOTAL_TIMEOUT_MS} ms) est épuisé.`
        : `Dernier échec : ${lastError}. Vérifie la clé API, le nom du modèle et les quotas.`),
    502
  );
}
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

const REQUEST_TIMEOUT_MS = 60_000;

// Ordre = priorité (Groq d'abord pour la vitesse, OpenAI gratuit en dernier recours).
// baseUrl est l'endpoint /chat/completions complet, compatible OpenAI.
function getAvailableProviders(): AIProvider[] {
  const definitions: Array<Omit<AIProvider, "apiKey" | "model">> = [
    {
      name: "groq",
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    },
    {
      name: "openrouter",
      baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    },
    {
      name: "google",
      baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    },
    {
      name: "openai",
      baseUrl: "https://api.openai.com/v1/chat/completions",
    },
  ];

  const providers = definitions
    .map((p) => {
      const name = p.name.toUpperCase();
      return {
        ...p,
        baseUrl: process.env[`${name}_BASE_URL`] ?? p.baseUrl,
        apiKey: process.env[`${name}_API_KEY`] ?? "",
        model: process.env[`${name}_MODEL`] ?? "",
      };
    })
    .filter((p) => p.apiKey && p.model);

  return providers;
}

async function callProvider(
  provider: AIProvider,
  messages: AIMessage[]
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(provider.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...(provider.name === "openrouter"
          ? { "HTTP-Referer": "https://prompt-forge.local", "X-Title": "Prompt Forge" }
          : {}),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const isQuota = res.status === 429 || res.status === 402;
      const reason = isQuota ? "quota/rate-limit" : `HTTP ${res.status}`;
      console.error(
        `[ai] ${provider.name} a échoué (${reason}) : ${(await res.text()).slice(0, 500)}`
      );
      return null;
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.error(`[ai] ${provider.name} a renvoyé une réponse vide`);
      return null;
    }

    return content;
  } catch (error) {
    console.error(`[ai] ${provider.name} a échoué :`, error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// Parcourt les providers dans l'ordre de priorité et retourne la première réponse valide.
// Si tous échouent, lève une erreur claire.
export async function callAI(messages: AIMessage[]): Promise<AIResponse> {
  const providers = getAvailableProviders();

  if (providers.length === 0) {
    throw new Error(
      "Aucun provider IA configuré. Renseignez les clés API et modèles dans .env " +
        "(GROQ_API_KEY, OPENROUTER_API_KEY, GOOGLE_AI_API_KEY, OPENAI_API_KEY)."
    );
  }

  let lastError: string = "inconnue";

  for (const provider of providers) {
    const content = await callProvider(provider, messages);
    if (content !== null) {
      return { provider: provider.name, model: provider.model, content };
    }
    lastError = provider.name;
  }

  throw new Error(
    `Tous les providers IA sont indisponibles (dernier testé : ${lastError}). ` +
      `Vérifiez vos clés API et vos quotas.`
  );
}
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { callAI, type AIMessage } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import {
  checkRateLimit,
  getRemainingQuota,
  RATE_LIMIT_ENDPOINTS,
} from "@/lib/rate-limit";
import {
  buildSystemPrompt,
  buildUserMessage,
  parseAIResult,
  buildLocalFinalPrompt,
  FORCE_FINAL_PROMPT,
  type AIResult,
  type PromptStyle,
} from "@/lib/prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_USER_INPUT = 2000;
const MAX_QUESTIONS = 8;
const MAX_ITEM_LENGTH = 200;

const STYLES: PromptStyle[] = ["concise", "balanced", "detailed"];

type GenerateRequest = {
  userInput: string;
  previousQuestions?: string[];
  previousAnswers?: string[];
  temperature?: number;
  style?: PromptStyle;
  save?: boolean;
};

class ForceFinalError extends Error {}

async function requestAI(
  messages: AIMessage[],
  forceFinal = false,
  temperature?: number
): Promise<{ result: AIResult; usedProvider: string; usedModel: string }> {
  const call = (msgs: AIMessage[]) => callAI(msgs, { temperature });

  const response = await call(messages);

  const parsed = parseAIResult(response.content);
  if (parsed && parsed.type === "final") {
    return {
      result: parsed,
      usedProvider: response.provider,
      usedModel: response.model,
    };
  }
  if (parsed && parsed.type === "questions" && !forceFinal) {
    return {
      result: parsed,
      usedProvider: response.provider,
      usedModel: response.model,
    };
  }

  // JSON invalide/inattendu, OU questions alors qu'on exige le prompt final :
  // relance une fois en forçant le format / le résultat attendu.
  const retry = await call([
    ...messages,
    {
      role: "user",
      content: forceFinal
        ? FORCE_FINAL_PROMPT
        : "Ta réponse précédente n'était pas un JSON strict valide. " +
          "Recommence en répondant UNIQUEMENT avec un objet JSON : " +
          '{"type":"questions","questions":["..."]} ou {"type":"final","prompt":"..."}. ' +
          "Aucun autre texte.",
    },
  ]);

  const retryParsed = parseAIResult(retry.content);
  if (retryParsed && retryParsed.type === "final") {
    return {
      result: retryParsed,
      usedProvider: retry.provider,
      usedModel: retry.model,
    };
  }
  if (retryParsed && retryParsed.type === "questions" && !forceFinal) {
    return {
      result: retryParsed,
      usedProvider: retry.provider,
      usedModel: retry.model,
    };
  }

  if (forceFinal) {
    // On ne renvoie jamais des questions après que l'utilisateur a répondu.
    throw new ForceFinalError("L'IA refuse de produire le prompt final.");
  }

  throw new Error("L'IA n'a pas renvoyé de JSON valide après retry.");
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const userId = session.user.id;

  const { allowed, retryAfterSeconds } = await checkRateLimit(
    userId,
    RATE_LIMIT_ENDPOINTS.GENERATE
  );
  if (!allowed) {
    return NextResponse.json(
      {
        error: `Quota de génération dépassé. Réessaie dans ${retryAfterSeconds} s.`,
      },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }
    );
  }

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const userInput = typeof body.userInput === "string" ? body.userInput.trim() : "";
  if (!userInput) {
    return NextResponse.json(
      { error: "Le champ 'userInput' est requis." },
      { status: 400 }
    );
  }
  if (userInput.length > MAX_USER_INPUT) {
    return NextResponse.json(
      {
        error: `Ta demande est trop longue (${userInput.length} caractères, max ${MAX_USER_INPUT}).`,
      },
      { status: 400 }
    );
  }

  const validateList = (
    label: string,
    value: unknown
  ): string[] | null => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) return null;
    if (value.length > MAX_QUESTIONS) return null;
    for (const item of value) {
      if (typeof item !== "string" || item.length > MAX_ITEM_LENGTH) return null;
    }
    return value as string[];
  };

  const previousQuestions = validateList("previousQuestions", body.previousQuestions);
  const previousAnswers = validateList("previousAnswers", body.previousAnswers);

  if (previousQuestions === null || previousAnswers === null) {
    return NextResponse.json(
      { error: "Format des questions/réponses invalide (tableau de chaînes limités)." },
      { status: 400 }
    );
  }
  if (previousAnswers.length > previousQuestions.length) {
    return NextResponse.json(
      { error: "Il y a plus de réponses que de questions." },
      { status: 400 }
    );
  }

  // Paramètres optionnels (température, style, conservation).
  let temperature = 0.7;
  if (typeof body.temperature === "number") {
    if (Number.isFinite(body.temperature) && body.temperature >= 0 && body.temperature <= 2) {
      temperature = body.temperature;
    } else {
      return NextResponse.json(
        { error: "La température doit être comprise entre 0 et 2." },
        { status: 400 }
      );
    }
  }

  const style: PromptStyle =
    body.style && STYLES.includes(body.style) ? body.style : "balanced";

  const save = body.save !== false;

  const startedAt = Date.now();

  const messages: AIMessage[] = [
    buildSystemPrompt(style),
    buildUserMessage(userInput, body.previousQuestions, body.previousAnswers),
  ];

  // Dès que l'utilisateur a répondu aux questions, on exige le prompt final.
  const forceFinal = Boolean(body.previousAnswers?.length);

  const persistFinal = async (finalPrompt: string, provider: string, model?: string) => {
    const durationMs = Date.now() - startedAt;
    if (save) {
      await prisma.generatedPrompt.create({
        data: {
          userInput,
          clarifyingQuestions: body.previousQuestions?.length
            ? JSON.stringify(body.previousQuestions)
            : null,
          clarifyingAnswers: body.previousAnswers?.length
            ? JSON.stringify(body.previousAnswers)
            : null,
          finalPrompt,
          provider,
          model: model ?? null,
          userId,
        },
      });
    }
    const quota = await getRemainingQuota(userId, RATE_LIMIT_ENDPOINTS.GENERATE);
    return NextResponse.json({
      type: "final",
      prompt: finalPrompt,
      provider,
      model: model ?? null,
      durationMs,
      saved: save,
      remaining: quota.remaining,
    });
  };

  try {
    const { result, usedProvider, usedModel } = await requestAI(
      messages,
      forceFinal,
      temperature
    );

    if (result.type === "final") {
      return await persistFinal(result.prompt, usedProvider, usedModel);
    }

    const quota = await getRemainingQuota(userId, RATE_LIMIT_ENDPOINTS.GENERATE);
    return NextResponse.json({
      ...result,
      provider: usedProvider,
      model: usedModel,
      durationMs: Date.now() - startedAt,
      remaining: quota.remaining,
    });
  } catch (error) {
    // Dernière sécurité : si l'IA persiste à renvoyer des questions (ou du JSON
    // invalide) après les réponses, on génère un prompt final localement.
    if (error instanceof ForceFinalError) {
      console.warn(
        "[api/generate] Fallback local : l'IA a refusé de produire le prompt final."
      );
      const fallback = buildLocalFinalPrompt(
        userInput,
        body.previousQuestions,
        body.previousAnswers
      );
      try {
        return await persistFinal(fallback, "local");
      } catch (persistError) {
        console.error("[api/generate] Erreur de persistance fallback :", persistError);
      }
    }

    console.error("[api/generate] Erreur :", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Erreur inattendue." },
      { status: 500 }
    );
  }
}
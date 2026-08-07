import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { callAI, type AIMessage } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GenerateRequest = {
  userInput: string;
  previousQuestions?: string[];
  previousAnswers?: string[];
};

type ClarifyResponse = { type: "questions"; questions: string[] };
type FinalResponse = { type: "final"; prompt: string };
type AIResult = ClarifyResponse | FinalResponse;

function buildSystemPrompt(): AIMessage {
  const system = `
Tu es un assistant qui optimise les prompts utilisateur pour de l'IA générative.

À partir de la phrase de l'utilisateur (et des réponses aux questions de clarification si elles existent), tu dois :

1. ANALYSER si tu disposes d'assez de contexte pour écrire un prompt final excellent.
   - Si le contexte contient déjà des réponses aux questions de clarification (les "R" de la section contexte) : NE pose JAMAIS de nouvelles questions. Produis le prompt final directement.
   - Sinon, si trop d'ambiguïtés ou d'infos manquantes jugées importantes subsistent : générer 2 à 4 questions de clarification ciblées, courtes et précises.
   - Sinon : produire le prompt final optimisé, détaillé, avec instructions claires et rôle explicite.

2. SORTIE :
   - Pour des questions : strictement, sans rien d'autre, ce JSON :
     {"type":"questions","questions":["...","..."]}
   - Pour le prompt final : strictement, sans rien d'autre, ce JSON :
     {"type":"final","prompt":"..."}

CONTRAINTES STRICTES :
- Réponds UNIQUEMENT avec un objet JSON valide. Aucun texte avant/après, aucun markdown.
- Le JSON doit être parfaitement parsable (guillemets échappés correctement).
`.trim();

  return { role: "system", content: system };
}

function buildUserMessage(
  userInput: string,
  previousQuestions?: string[],
  previousAnswers?: string[]
): AIMessage {
  let content = `Idée initiale de l'utilisateur :\n${userInput}`;

  if (previousQuestions?.length || previousAnswers?.length) {
    content += "\n\nContexte des questions précédentes :";
    previousQuestions?.forEach((q, i) => {
      content += `\nQ${i + 1}: ${q}`;
      if (previousAnswers?.[i]) {
        content += `\nR${i + 1}: ${previousAnswers[i]}`;
      }
    });
  }

  return { role: "user", content };
}

function parseAIResult(raw: string, userInput: string): AIResult | null {
  try {
    const parsed = JSON.parse(raw) as AIResult;

    if (parsed.type === "questions" && Array.isArray(parsed.questions)) {
      return { type: "questions", questions: parsed.questions };
    }

    if (parsed.type === "final" && typeof parsed.prompt === "string") {
      return { type: "final", prompt: parsed.prompt };
    }

    return null;
  } catch {
    return null;
  }
}

class ForceFinalError extends Error {}

// Fallback local : garantit qu'on renvoie toujours un prompt final exploitable
// même si l'IA persiste à renvoyer des questions après les réponses.
function buildLocalFinalPrompt(
  userInput: string,
  questions: string[] = [],
  answers: string[] = []
): string {
  let prompt = `Tu es un expert en rédaction de prompts et en IA générative.\n\n`;
  prompt += `Tâche :\n${userInput}\n`;

  const details = questions
    .map((q, i) => {
      const answer = answers[i]?.trim();
      return answer ? `- ${q} : ${answer}` : `- ${q}`;
    })
    .join("\n");

  if (details) {
    prompt += `\nExigences et précisions :\n${details}`;
  }

  prompt += `\n\nProduis une réponse complète, structurée et de haute qualité, avec des instructions claires et un rôle explicite.`;
  return prompt;
}

const FORCE_FINAL_PROMPT =
  "L'utilisateur a déjà répondu aux questions de clarification. " +
  "Ne pose plus de questions : écris maintenant le prompt final optimisé. " +
  'Réponds UNIQUEMENT avec un objet JSON : {"type":"final","prompt":"..."}. ' +
  "Aucun autre texte.";

async function requestAI(
  messages: AIMessage[],
  forceFinal = false
): Promise<{ result: AIResult; usedProvider: string }> {
  const response = await callAI(messages);

  const parsed = parseAIResult(response.content, "");
  if (parsed && parsed.type === "final") {
    return { result: parsed, usedProvider: response.provider };
  }
  if (parsed && parsed.type === "questions" && !forceFinal) {
    return { result: parsed, usedProvider: response.provider };
  }

  // JSON invalide/inattendu, OU questions alors qu'on exige le prompt final :
  // relance une fois en forçant le format / le résultat attendu.
  const retry = await callAI([
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

  const retryParsed = parseAIResult(retry.content, "");
  if (retryParsed && retryParsed.type === "final") {
    return { result: retryParsed, usedProvider: retry.provider };
  }
  if (retryParsed && retryParsed.type === "questions" && !forceFinal) {
    return { result: retryParsed, usedProvider: retry.provider };
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

  let body: GenerateRequest;
  try {
    body = (await req.json()) as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }

  const userInput = body.userInput?.trim();
  if (!userInput) {
    return NextResponse.json(
      { error: "Le champ 'userInput' est requis." },
      { status: 400 }
    );
  }

  const messages: AIMessage[] = [
    buildSystemPrompt(),
    buildUserMessage(userInput, body.previousQuestions, body.previousAnswers),
  ];

  // Dès que l'utilisateur a répondu aux questions, on exige le prompt final.
  const forceFinal = Boolean(body.previousAnswers?.length);

  const persistFinal = async (finalPrompt: string, provider: string) => {
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
        userId,
      },
    });
    return NextResponse.json({ type: "final", prompt: finalPrompt, provider });
  };

  try {
    const { result, usedProvider } = await requestAI(messages, forceFinal);

    if (result.type === "final") {
      return await persistFinal(result.prompt, usedProvider);
    }

    return NextResponse.json({ ...result, provider: usedProvider });
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
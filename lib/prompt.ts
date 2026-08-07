import type { AIMessage } from "@/lib/ai";

export type AIResult =
  | { type: "questions"; questions: string[] }
  | { type: "final"; prompt: string };

export function buildSystemPrompt(): AIMessage {
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

export function buildUserMessage(
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

export function parseAIResult(raw: string): AIResult | null {
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

export function buildLocalFinalPrompt(
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

export const FORCE_FINAL_PROMPT =
  "L'utilisateur a déjà répondu aux questions de clarification. " +
  "Ne pose plus de questions : écris maintenant le prompt final optimisé. " +
  'Réponds UNIQUEMENT avec un objet JSON : {"type":"final","prompt":"..."}. ' +
  "Aucun autre texte.";

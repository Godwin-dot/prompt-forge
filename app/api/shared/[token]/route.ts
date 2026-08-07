import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Endpoint public en lecture seule : sert un prompt partagé via son token.
export async function GET(
  _req: Request,
  { params }: { params: { token: string } }
) {
  try {
    const item = await prisma.generatedPrompt.findFirst({
      where: { shareToken: params.token },
      select: {
        userInput: true,
        clarifyingQuestions: true,
        clarifyingAnswers: true,
        finalPrompt: true,
        provider: true,
        model: true,
        createdAt: true,
      },
    });

    if (!item) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }

    let clarifyingQuestions: string[] | null = null;
    let clarifyingAnswers: string[] | null = null;
    if (item.clarifyingQuestions) {
      try {
        clarifyingQuestions = JSON.parse(item.clarifyingQuestions);
      } catch {}
    }
    if (item.clarifyingAnswers) {
      try {
        clarifyingAnswers = JSON.parse(item.clarifyingAnswers);
      } catch {}
    }

    return NextResponse.json({
      userInput: item.userInput,
      finalPrompt: item.finalPrompt,
      clarifyingQuestions,
      clarifyingAnswers,
      provider: item.provider,
      model: item.model,
      createdAt: item.createdAt,
    });
  } catch (error) {
    console.error("[api/shared] error:", error);
    return NextResponse.json({ error: "Erreur serveur." }, { status: 500 });
  }
}
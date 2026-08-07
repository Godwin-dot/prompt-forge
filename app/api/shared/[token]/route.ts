import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkIpRateLimit, getClientIp, RATE_LIMIT_ENDPOINTS } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOKEN_RE = /^[0-9a-f]{24}$/;

// Endpoint public en lecture seule : sert un prompt partagé via son token.
// Rate-limit par IP (anti brute-force / DoS) + validation stricte du token.
export async function GET(
  req: NextRequest,
  { params }: { params: { token: string } }
) {
  const token = params.token;
  if (typeof token !== "string" || !TOKEN_RE.test(token)) {
    return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  }

  const ip = getClientIp(req) ?? "unknown";
  const { allowed } = await checkIpRateLimit(ip, RATE_LIMIT_ENDPOINTS.SHARED);
  if (!allowed) {
    return NextResponse.json({ error: "Trop de requêtes." }, { status: 429 });
  }

  try {
    const item = await prisma.generatedPrompt.findFirst({
      where: { shareToken: token },
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
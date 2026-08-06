import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prompts = await prisma.generatedPrompt.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({ prompts });
  } catch (error) {
    console.error("[api/history] GET error:", error);
    return NextResponse.json(
      { error: "Impossible de charger l'historique." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    try {
      await prisma.generatedPrompt.delete({ where: { id } });
    } catch (error: unknown) {
      const code = (error as { code?: string }).code;
      if (code === "P2025") {
        return NextResponse.json({ error: "Introuvable." }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/history] DELETE error:", error);
    return NextResponse.json(
      { error: "Impossible de supprimer." },
      { status: 500 }
    );
  }
}
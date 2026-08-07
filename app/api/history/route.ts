import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { randomBytes } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await requireUser();
  if (!authed) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const userId = authed.id;

  try {
    const prompts = await prisma.generatedPrompt.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
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
  const authed = await requireUser();
  if (!authed) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const userId = authed.id;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    // deleteMany + userId pour empêcher de supprimer un prompt d'un autre user.
    const result = await prisma.generatedPrompt.deleteMany({
      where: { id, userId },
    });

    if (result.count === 0) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
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

// Marque un prompt comme "utilisé" (ou non) / génère un token de partage.
export async function PATCH(req: Request) {
  const authed = await requireUser();
  if (!authed) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }
  const userId = authed.id;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const action = searchParams.get("action");

    if (!id) {
      return NextResponse.json({ error: "ID manquant." }, { status: 400 });
    }

    const existing = await prisma.generatedPrompt.findFirst({
      where: { id, userId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }

    if (action === "toggleUsed") {
      const updated = await prisma.generatedPrompt.update({
        where: { id },
        data: { used: !existing.used },
      });
      return NextResponse.json({ used: updated.used });
    }

    if (action === "share") {
      const token = existing.shareToken ?? randomBytes(12).toString("hex");
      if (!existing.shareToken) {
        await prisma.generatedPrompt.update({
          where: { id },
          data: { shareToken: token },
        });
      }
      return NextResponse.json({ shareToken: token });
    }

    if (action === "unshare") {
      await prisma.generatedPrompt.update({
        where: { id },
        data: { shareToken: null },
      });
      return NextResponse.json({ shareToken: null });
    }

    return NextResponse.json({ error: "Action inconnue." }, { status: 400 });
  } catch (error) {
    console.error("[api/history] PATCH error:", error);
    return NextResponse.json(
      { error: "Impossible de mettre à jour." },
      { status: 500 }
    );
  }
}
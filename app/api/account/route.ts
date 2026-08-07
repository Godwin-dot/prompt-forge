import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suppression définitive du compte et de toutes ses données (cascade).
// Ré-authentification : exige le mot de passe + un en-tête Origin/de même
// origine pour éviter une suppression via CSRF.
export async function DELETE(req: NextRequest) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (origin && host && origin !== `https://${host}` && origin !== `http://${host}`) {
    return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  }

  const authed = await requireUser();
  if (!authed) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Corps JSON invalide." }, { status: 400 });
  }
  const { password } = body as { password?: unknown };
  if (typeof password !== "string" || !password) {
    return NextResponse.json(
      { error: "Confirme avec ton mot de passe." },
      { status: 400 }
    );
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: authed.id },
      select: { passwordHash: true },
    });
    if (!user) {
      return NextResponse.json({ error: "Introuvable." }, { status: 404 });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Mot de passe incorrect." },
        { status: 403 }
      );
    }

    await prisma.user.delete({ where: { id: authed.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/account] DELETE error:", error);
    return NextResponse.json(
      { error: "Impossible de supprimer le compte." },
      { status: 500 }
    );
  }
}
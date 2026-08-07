import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import {
  checkIpRateLimit,
  getClientIp,
  RATE_LIMIT_ENDPOINTS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req) ?? "unknown";
  const { allowed } = await checkIpRateLimit(ip, RATE_LIMIT_ENDPOINTS.REGISTER);
  if (!allowed) {
    return NextResponse.json(
      { error: "Trop de créations de compte depuis cette adresse." },
      { status: 429 }
    );
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
  const { email: emailRaw, password: passwordRaw } = body as {
    email?: unknown;
    password?: unknown;
  };

  const email = typeof emailRaw === "string" ? emailRaw.trim().toLowerCase() : "";
  const password = typeof passwordRaw === "string" ? passwordRaw : "";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Adresse email invalide." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Mot de passe requis (8 caractères minimum)." },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Un compte existe déjà avec cet email. Connecte-toi plutôt." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    await prisma.user.create({ data: { email, passwordHash } });
  } catch (error) {
    // Course à l'inscription : l'email a été créé entre le check et le create.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Un compte existe déjà avec cet email. Connecte-toi plutôt." },
        { status: 409 }
      );
    }
    throw error;
  }

  return NextResponse.json({ ok: true });
}
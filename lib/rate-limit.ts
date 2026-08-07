import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

const DEFAULT_MAX = 30;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

// Limite par défaut des endpoints publics/IP.
const DEFAULT_IP_MAX = 60;
const DEFAULT_IP_WINDOW_MS = 60 * 1000;

export const RATE_LIMIT_ENDPOINTS = {
  GENERATE: "/api/generate",
  SHARED: "/api/shared",
  REGISTER: "/api/auth/register",
} as const;

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

// Lit une variable d'env comme nombre valide (> 0), sinon fallback.
function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Insère puis compte sur une fenêtre glissante : correct en serverless même
// avec des requêtes simultanées, et fail-closed (une exception = refus).
async function consumeWindow(
  create: () => Promise<{ id: string; createdAt: Date }>,
  countInWindow: (cutoff: Date) => Promise<number>,
  max: number,
  windowMs: number,
  now = new Date()
): Promise<RateLimitResult> {
  const { id, createdAt } = await create();

  const cutoff = new Date(now.getTime() - windowMs);
  const total = await countInWindow(cutoff);

  if (total > max) {
    // La requête courante dépasse le quota : on retire l'enregistrement créé
    // pour ne pas pénaliser les requêtes suivantes.
    await prisma.apiUsage
      .deleteMany({ where: { id: { equals: id } as never } })
      .catch(() => undefined);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((createdAt.getTime() + windowMs - now.getTime()) / 1000)
    );
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: max - total };
}

// Quota par utilisateur+endpoint (consomme un appel).
export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<RateLimitResult> {
  const max = envNumber("RATE_LIMIT_MAX", DEFAULT_MAX);
  const windowMs = envNumber("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);

  return consumeWindow(
    () => prisma.apiUsage.create({ data: { userId, endpoint } }),
    (cutoff) =>
      prisma.apiUsage.count({
        where: { userId, endpoint, createdAt: { gte: cutoff } },
      }),
    max,
    windowMs
  );
}

// Quota par IP pour les endpoints publics ou la création de comptes.
export async function checkIpRateLimit(
  ip: string,
  endpoint: string
): Promise<RateLimitResult> {
  const max = envNumber("IP_RATE_LIMIT_MAX", DEFAULT_IP_MAX);
  const windowMs = envNumber("IP_RATE_LIMIT_WINDOW_MS", DEFAULT_IP_WINDOW_MS);
  const now = new Date();

  const { id, createdAt } = await prisma.ipUsage.create({
    data: { ip, endpoint, createdAt: now },
  });

  const cutoff = new Date(now.getTime() - windowMs);
  const total = await prisma.ipUsage.count({
    where: { ip, endpoint, createdAt: { gte: cutoff } },
  });

  if (total > max) {
    await prisma.ipUsage
      .deleteMany({ where: { id: { equals: id } as never } })
      .catch(() => undefined);
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((createdAt.getTime() + windowMs - now.getTime()) / 1000)
    );
    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: max - total };
}

// Extraction de l'IP cliente (Vercel : x-forwarded-for). Retourne null si absente.
export function getClientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

// Retourne le quota restant pour un utilisateur+endpoint sans consommer d'appel.
export async function getRemainingQuota(
  userId: string,
  endpoint: string
): Promise<{ remaining: number; max: number }> {
  const max = envNumber("RATE_LIMIT_MAX", DEFAULT_MAX);
  const windowMs = envNumber("RATE_LIMIT_WINDOW_MS", DEFAULT_WINDOW_MS);
  const cutoff = new Date(Date.now() - windowMs);

  const count = await prisma.apiUsage.count({
    where: {
      userId,
      endpoint,
      createdAt: { gte: cutoff },
    },
  });

  return { remaining: Math.max(0, max - count), max };
}
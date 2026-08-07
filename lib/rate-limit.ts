import { prisma } from "@/lib/prisma";

const DEFAULT_MAX = 30;
const DEFAULT_WINDOW_MS = 60 * 60 * 1000;

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

// Compte les appels par utilisateur+endpoint sur une fenêtre glissante.
// Insère d'abord, compte ensuite : cela évite les courses entre requêtes
// simultanées et reste correct en environnement serverless.
export async function checkRateLimit(
  userId: string,
  endpoint: string
): Promise<RateLimitResult> {
  const max = Number(process.env.RATE_LIMIT_MAX ?? DEFAULT_MAX);
  const windowMs = Number(
    process.env.RATE_LIMIT_WINDOW_MS ?? DEFAULT_WINDOW_MS
  );

  const now = new Date();

  const { id: usageId } = await prisma.apiUsage.create({
    data: { userId, endpoint, createdAt: now },
  });

  const cutoff = new Date(now.getTime() - windowMs);
  const count = await prisma.apiUsage.count({
    where: {
      userId,
      endpoint,
      createdAt: { gte: cutoff },
    },
  });

  if (count > max) {
    // La requête courante dépasse le quota : on retire l'enregistrement
    // qu'on vient de créer pour ne pas pénaliser les suivantes.
    await prisma.apiUsage.delete({ where: { id: usageId } });

    const oldest = await prisma.apiUsage.findFirst({
      where: { userId, endpoint },
      orderBy: { createdAt: "asc" },
    });
    const retryAfterSeconds = oldest
      ? Math.max(1, Math.ceil((oldest.createdAt.getTime() + windowMs - now.getTime()) / 1000))
      : 1;

    return { allowed: false, retryAfterSeconds, remaining: 0 };
  }

  return { allowed: true, retryAfterSeconds: 0, remaining: max - count };
}

export const RATE_LIMIT_ENDPOINTS = {
  GENERATE: "/api/generate",
} as const;

// Retourne le quota restant pour un utilisateur+endpoint sans consommer
// d'appel (compte les enregistrements sur la fenêtre courante).
export async function getRemainingQuota(
  userId: string,
  endpoint: string
): Promise<{ remaining: number; max: number }> {
  const max = Number(process.env.RATE_LIMIT_MAX ?? DEFAULT_MAX);
  const windowMs = Number(
    process.env.RATE_LIMIT_WINDOW_MS ?? DEFAULT_WINDOW_MS
  );
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

import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// @libsql/client résout les chemins file: par rapport au cwd, alors que Prisma
// les résolvait par rapport au dossier prisma/. On réconcilie les deux.
function resolveSqlitePath(url: string): string {
  const rel = url.slice("file:".length).replace(/^\.\//, "");
  if (rel.includes("/") || rel.includes("\\")) {
    return "file:" + path.resolve(rel);
  }
  return "file:" + path.join(process.cwd(), "prisma", rel);
}

// Compatible Turso (production) ET SQLite local (développement) :
// @libsql/client gère les deux (file:. / libsql://).
function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient({
    url: rawUrl.startsWith("file:") ? resolveSqlitePath(rawUrl) : rawUrl,
    authToken: authToken || undefined,
  });
  const adapter = new PrismaLibSQL(client);

  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

export const prisma =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
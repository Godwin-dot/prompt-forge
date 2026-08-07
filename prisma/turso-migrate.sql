-- Migration manuelle à appliquer sur Turso (créannées / évolution depuis le schéma précédent)
-- Objectif : supprimer le modèle inutilisé `Prompt`, ajouter le modèle `ApiUsage`,
-- et ajouter un index composite sur `GeneratedPrompt(userId, createdAt)`.

-- 1) Table d'usage pour le rate limiting
CREATE TABLE IF NOT EXISTS "ApiUsage" (
    "id"        TEXT    NOT NULL PRIMARY KEY,
    "userId"    TEXT    NOT NULL,
    "endpoint"  TEXT    NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiUsage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ApiUsage_userId_endpoint_createdAt_idx"
    ON "ApiUsage"("userId", "endpoint", "createdAt");

-- 2) index composite sur l'historique (tri par user + date)
CREATE INDEX IF NOT EXISTS "GeneratedPrompt_userId_createdAt_idx"
    ON "GeneratedPrompt"("userId", "createdAt");

-- 3) suppression du modèle inutilisé `Prompt`
DROP TABLE IF EXISTS "Prompt";
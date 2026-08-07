CREATE TABLE IF NOT EXISTS "IpUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ip" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "IpUsage_ip_endpoint_createdAt_idx" ON "IpUsage"("ip", "endpoint", "createdAt");
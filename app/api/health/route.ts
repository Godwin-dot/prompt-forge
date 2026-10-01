import { NextResponse } from "next/server";
import { getAvailableProviders } from "@/lib/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Diagnostic de configuration : répond à « pourquoi /api/generate échoue-t-il ? »
// sans jamais exposer une clé ni dépenser un appel IA.
export async function GET() {
  const providers = getAvailableProviders();

  return NextResponse.json(
    {
      ok: providers.length > 0,
      providers: providers.map((p) => ({
        name: p.name,
        model: p.model,
        baseUrl: p.baseUrl,
        apiKeyConfigured: Boolean(p.apiKey),
      })),
      hint:
        providers.length > 0
          ? "Z.ai est configuré. Si /api/generate échoue, vérifie le statut HTTP dans les logs serveur ([ai] ...)."
          : "Z.ai n'est pas configuré : renseigne ZAI_API_KEY (.env en local, variables d'environnement en production). ZAI_MODEL accepte glm-4.7-flash et glm-4.5-flash.",
    },
    { status: providers.length > 0 ? 200 : 503 }
  );
}

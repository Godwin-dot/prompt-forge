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
        // Seule la longueur est exposée : utile pour repérer une clé tronquée
        // lors d'un copier-coller dans les variables d'environnement.
        apiKeyLength: p.apiKey.length,
      })),
      hint:
        providers.length > 0
          ? "Fournisseur configuré. Si /api/generate échoue encore, la clé est invalide, le modèle a été retiré ou le quota est épuisé : voir les logs serveur ([ai] ...)."
          : "Aucun fournisseur IA configuré : renseigne GOOGLE_AI_API_KEY et GOOGLE_AI_MODEL (.env en local, variables d'environnement en production).",
    },
    { status: providers.length > 0 ? 200 : 503 }
  );
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import {
  getRemainingQuota,
  RATE_LIMIT_ENDPOINTS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const authed = await requireUser();
  if (!authed) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const quota = await getRemainingQuota(
    authed.id,
    RATE_LIMIT_ENDPOINTS.GENERATE
  );

  return NextResponse.json(quota);
}
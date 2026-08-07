import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRemainingQuota,
  RATE_LIMIT_ENDPOINTS,
} from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  const quota = await getRemainingQuota(
    session.user.id,
    RATE_LIMIT_ENDPOINTS.GENERATE
  );

  return NextResponse.json(quota);
}
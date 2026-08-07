import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Suppression définitive du compte et de toutes ses données (cascade).
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  }

  try {
    await prisma.user.delete({ where: { id: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[api/account] DELETE error:", error);
    return NextResponse.json(
      { error: "Impossible de supprimer le compte." },
      { status: 500 }
    );
  }
}
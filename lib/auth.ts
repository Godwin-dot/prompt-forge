import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 jours
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET ?? process.env.AUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const email = credentials.email.trim().toLowerCase();
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;
        const valid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!valid) return null;
        return { id: user.id, email: user.email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user && user.id) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
      }
      return session;
    },
  },
};

export type AuthedUser = { id: string; email: string };

// Vérifie la session ET que l'utilisateur existe encore en base.
// Évite les "sessions fantômes" après suppression de compte :
// renvoie null si la session est absente ou si le compte n'existe plus.
export async function requireUser(): Promise<AuthedUser | null> {
  if (
    process.env.NODE_ENV === "production" &&
    !process.env.NEXTAUTH_SECRET &&
    !process.env.AUTH_SECRET
  ) {
    // Fail-closed : sans secret stable, aucune session n'est fiable.
    return null;
  }

  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  const email = session?.user?.email;
  if (!id || !email) return null;

  const exists = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!exists) return null;

  return { id, email };
}
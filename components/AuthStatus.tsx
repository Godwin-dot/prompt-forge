"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function AuthStatus() {
  const { data: session, status } = useSession();
  const [loadingSignOut, setLoadingSignOut] = useState(false);

  if (status === "loading") {
    return (
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-accent)]" aria-hidden="true" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[160px] truncate text-xs text-[var(--color-text-muted)] sm:block">
          {session.user.email}
        </span>
        <button
          type="button"
          disabled={loadingSignOut}
          onClick={async () => {
            setLoadingSignOut(true);
            await signOut({ callbackUrl: "/" });
          }}
          className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Link
        href="/login"
        className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
      >
        Connexion
      </Link>
      <Link
        href="/register"
        className="rounded-lg bg-[var(--color-accent)] px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[var(--color-accent-hover)]"
      >
        S&apos;inscrire
      </Link>
    </div>
  );
}
"use client";

import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (status === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-5 py-10 sm:px-6 sm:py-14">
        <p className="text-sm text-[var(--color-text-muted)]" role="status">
          Chargement…
        </p>
      </main>
    );
  }

  if (!session?.user) {
    router.replace("/login");
    return null;
  }

  const removeAccount = async () => {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch("/api/account", { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      await signOut({ callbackUrl: "/" });
    } catch (err) {
      console.error("[account] delete error:", err);
      setError("Impossible de supprimer le compte. Réessaie.");
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-3">
        <span className="label-step">Mon compte</span>
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[var(--color-text)] sm:text-[32px]">
          Paramètres du compte
        </h1>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-sm">
        <span className="label-field">Adresse email</span>
        <span className="text-[var(--color-text)]">{session.user.email}</span>
      </div>

      <section className="flex flex-col gap-3 rounded-xl border border-[var(--color-error)]/40 bg-[var(--color-error-bg)] p-5">
        <h2 className="text-sm font-semibold text-[var(--color-error)]">
          Zone sensible
        </h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          La suppression de votre compte efface définitivement votre profil,
          votre historique et toutes les données associées. Cette action est
          irréversible.
        </p>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="btn-ghost self-start text-[var(--color-error)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
          >
            Supprimer mon compte
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={removeAccount}
              disabled={deleting}
              className="rounded-lg bg-[var(--color-error)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {deleting ? "Suppression…" : "Oui, supprimer définitivement"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={deleting}
              className="btn-ghost"
            >
              Annuler
            </button>
          </div>
        )}

        {error && <p className="text-sm text-[var(--color-error)]">{error}</p>}
      </section>
    </main>
  );
}
"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "pf_privacy_consent";

function readConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY) === "accepted";
  } catch {
    return false;
  }
}

export default function PrivacyConsent() {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  // Ouvre uniquement si le consentement n'a pas déjà été donné.
  useEffect(() => {
    if (!readConsent()) setOpen(true);
  }, []);

  // Focus trap : verrouille la navigation clavier dans la modale et
  // restaure le focus sur l'élément déclencheur à la fermeture.
  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    acceptRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [open]);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {}
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="privacy-title"
        className="animate-fade-in w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl"
      >
        <h2
          id="privacy-title"
          className="text-lg font-semibold text-[var(--color-text)]"
        >
          Confidentialité
        </h2>
        <p className="mt-3 text-sm leading-[1.6] text-[var(--color-text-muted)]">
          Ton idée et tes réponses sont envoyées à un fournisseur d&apos;IA externe
          (Groq, OpenRouter, Google AI ou OpenAI) pour générer ton prompt. Elles
          ne sont pas utilisées pour t&apos;identifier ; évite d&apos;y inscrire des
          données personnelles sensibles. Chaque prompt final est enregistré
          dans ton historique privé.
        </p>
        <div className="mt-5 flex justify-end gap-3">
          <a
            href="/privacy"
            className="text-sm font-medium text-[var(--color-text-subtle)] underline underline-offset-4 hover:text-[var(--color-text)]"
          >
            En savoir plus
          </a>
          <button
            ref={acceptRef}
            type="button"
            onClick={accept}
            className="rounded-lg bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90"
          >
            J&apos;accepte
          </button>
        </div>
      </div>
    </div>
  );
}
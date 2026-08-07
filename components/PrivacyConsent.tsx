"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!readConsent()) setOpen(true);
  }, []);

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
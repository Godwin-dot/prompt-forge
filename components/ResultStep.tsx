"use client";

import { useState } from "react";
import TerminalBlock from "@/components/TerminalBlock";
import RevealText from "@/components/RevealText";

type Props = {
  prompt: string;
  provider?: string;
  model?: string | null;
  durationMs?: number;
  saved?: boolean;
  remaining?: number;
  onNewPrompt: () => void;
};

const DESTINATIONS: Array<{ label: string; url: (p: string) => string }> = [
  {
    label: "ChatGPT",
    url: (p) => `https://chat.openai.com/?q=${encodeURIComponent(p)}`,
  },
  {
    label: "Claude",
    url: (p) => `https://claude.ai/new?q=${encodeURIComponent(p)}`,
  },
  {
    label: "Gemini",
    url: (p) => `https://gemini.google.com/app?q=${encodeURIComponent(p)}`,
  },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function ResultStep({
  prompt,
  provider,
  model,
  durationMs,
  saved,
  remaining,
  onNewPrompt,
}: Props) {
  const [revealed, setRevealed] = useState(false);

  const showReveal = revealed || !model; // le fallback "local" s'affiche directement

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Prompt final
        </h2>
        {(provider || model) && (
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
            {model ?? provider}
          </span>
        )}
      </div>

      <TerminalBlock
        title="prompt-final.txt"
        content={showReveal ? prompt : ""}
        reveal={!showReveal}
        revealed={revealed}
        onRevealed={() => setRevealed(true)}
      />

      <div className="flex flex-col gap-2 text-xs text-[var(--color-text-subtle)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {provider && <span>via {provider}</span>}
          {durationMs != null && <span>en {formatDuration(durationMs)}</span>}
          {saved === false && <span>non enregistré dans l&apos;historique</span>}
        </div>
        {typeof remaining === "number" && (
          <span>
            {remaining} génération{remaining > 1 ? "s" : ""} restante
            {remaining > 1 ? "s" : ""} aujourd&apos;hui
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <span className="label-field">Ouvrir dans :</span>
        <div className="flex flex-wrap gap-2">
          {DESTINATIONS.map((d) => (
            <a
              key={d.label}
              href={d.url(prompt)}
              target="_blank"
              rel="noreferrer"
              className="btn-secondary"
            >
              {d.label} ↗
            </a>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onNewPrompt} className="btn-secondary sm:order-last">
          ← Nouveau prompt
        </button>
        <span className="text-xs text-[var(--color-text-subtle)]">
          {saved === false
            ? "Ce prompt n'est pas conservé"
            : "Prompt enregistré dans ton historique"}
        </span>
      </div>
    </div>
  );
}
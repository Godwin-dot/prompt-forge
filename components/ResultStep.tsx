"use client";

import TerminalBlock from "@/components/TerminalBlock";

type Props = {
  prompt: string;
  provider?: string;
  onNewPrompt: () => void;
};

export default function ResultStep({ prompt, provider, onNewPrompt }: Props) {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">
          Prompt final
        </h2>
        {provider && (
          <span className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
            {provider}
          </span>
        )}
      </div>

      <TerminalBlock title="prompt-final.txt" content={prompt} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button type="button" onClick={onNewPrompt} className="btn-secondary sm:order-last">
          ← Nouveau prompt
        </button>
        <span className="text-xs text-[var(--color-text-subtle)]">
          Prompt enregistré dans ton historique
        </span>
      </div>
    </div>
  );
}
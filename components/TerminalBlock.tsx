"use client";

import { useState, useEffect } from "react";
import RevealText from "@/components/RevealText";

type Props = {
  title: string;
  content: string;
  onCopy?: (text: string) => Promise<void> | void;
  reveal?: boolean;
  revealed?: boolean;
  onRevealed?: () => void;
};

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Bloc "terminal" signature : toujours sombre, quel que soit le thème global.
export default function TerminalBlock({
  title,
  content,
  onCopy,
  reveal = false,
  revealed = false,
  onRevealed,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  // À la fin de l'effet de révélation, on bascule sur le texte complet.
  useEffect(() => {
    if (!reveal) return;
    const words = content.split(" ");
    const timer = setTimeout(() => onRevealed?.(), words.length * 12 + 50);
    return () => clearTimeout(timer);
  }, [reveal, content, onRevealed]);

  const copy = async () => {
    if (onCopy) {
      await onCopy(content);
    } else {
      try {
        await navigator.clipboard.writeText(content);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
    }
    setCopied(true);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--terminal-border)] bg-[var(--terminal-bg)]">
      {/* Barre de titre */}
      <div className="flex h-10 items-center gap-3 border-b border-[var(--terminal-border)] bg-[var(--terminal-titlebar)] px-4">
        <span className="flex shrink-0 items-center gap-1.5" aria-hidden="true">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--dot-red)" }} />
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--dot-yellow)" }} />
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: "var(--dot-green)" }} />
        </span>
        <span className="min-w-0 flex-1 truncate text-center font-mono text-xs text-[var(--terminal-muted)]">
          {title}
        </span>
        <button
          type="button"
          onClick={copy}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--terminal-muted)] transition-colors duration-150 hover:bg-white/5 hover:text-[var(--terminal-text)]"
          aria-label={copied ? "Copié" : "Copier le prompt"}
        >
          <span className="relative block h-3.5 w-3.5">
            <ClipboardIcon
              className={`absolute inset-0 transition-all duration-200 ${
                copied ? "scale-50 rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100"
              }`}
            />
            <CheckIcon
              className={`absolute inset-0 text-[var(--color-success)] transition-all duration-200 ${
                copied ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0"
              }`}
            />
          </span>
          <span>{copied ? "Copié" : "Copier"}</span>
        </button>
      </div>

      {/* Corps */}
      <pre className="scrollbar-thin max-h-[50vh] overflow-auto whitespace-pre-wrap p-5 font-mono text-[13px] leading-relaxed text-[var(--terminal-text)] sm:p-6">
        {reveal && !revealed ? <RevealText text={content} /> : content}
      </pre>
    </div>
  );
}
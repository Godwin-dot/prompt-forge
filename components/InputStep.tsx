"use client";

import { useRef, useEffect, useState, KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string, save?: boolean, options?: GenerateOptions) => void;
  loading: boolean;
};

export type GenerateOptions = {
  temperature: number;
  style: "concise" | "balanced" | "detailed";
};

const SUGGESTIONS: Array<{ title: string; prompt: string }> = [
  {
    title: "Cahier des charges",
    prompt: "Je veux un prompt pour rédiger le cahier des charges d'un site vitrine",
  },
  {
    title: "Article de blog",
    prompt: "Je veux un prompt pour écrire un article de blog sur les énergies renouvelables",
  },
  {
    title: "Email professionnel",
    prompt: "Je veux un prompt pour rédiger un email professionnel de relance client",
  },
  {
    title: "Cours de formation",
    prompt: "Je veux un prompt pour créer un plan de cours d'initiation à la data science",
  },
];

const STYLE_LABELS: Record<GenerateOptions["style"], string> = {
  concise: "Concis",
  balanced: "Équilibré",
  detailed: "Détaillé",
};

export default function InputStep({ value, onChange, onSubmit, loading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [save, setSave] = useState(true);
  const [temperature, setTemperature] = useState(0.7);
  const [style, setStyle] = useState<GenerateOptions["style"]>("balanced");

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  };

  useEffect(() => {
    textareaRef.current?.focus();
    resize();
  }, []);

  useEffect(resize, [value]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !loading) {
      e.preventDefault();
      const text = value.trim();
      if (text) onSubmit(text, save, { temperature, style });
    }
  };

  const submit = () => {
    const text = value.trim();
    if (text && !loading) onSubmit(text, save, { temperature, style });
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="userInput" className="sr-only">
        Décris le prompt dont tu as besoin
      </label>
      <textarea
        ref={textareaRef}
        id="userInput"
        name="userInput"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Je veux un prompt pour rédiger mon cahier des charges…"
        disabled={loading}
        rows={3}
        className="field resize-none overflow-hidden"
        style={{ minHeight: 96 }}
      />

      <div className="flex flex-wrap items-center gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s.title}
            type="button"
            disabled={loading}
            onClick={() => onChange(s.prompt)}
            className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-medium text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-50"
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Réglages de création */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
            <label htmlFor="temperature" className="font-medium">
              Créativité
            </label>
            <span className="font-mono">{temperature.toFixed(1)}</span>
          </div>
          <input
            id="temperature"
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            disabled={loading}
            className="h-1.5 w-full cursor-pointer accent-[var(--color-accent)] disabled:opacity-50"
          />
          <div className="flex justify-between text-[10px] text-[var(--color-text-subtle)]">
            <span>Fidèle</span>
            <span>Original</span>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--color-text-muted)]">
            Style
          </span>
          <div className="flex rounded-lg border border-[var(--color-border)] p-0.5" role="radiogroup" aria-label="Style du prompt">
            {(Object.keys(STYLE_LABELS) as Array<GenerateOptions["style"]>).map((s) => (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={style === s}
                disabled={loading}
                onClick={() => setStyle(s)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                  style === s
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                }`}
              >
                {STYLE_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button type="submit" disabled={loading || !value.trim()} className="btn-primary">
            {loading && (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
            )}
            {loading ? "Génération…" : "Générer"}
          </button>
          <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-subtle)]">
            <kbd className="kbd">↵</kbd>
            pour valider
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={save}
            onChange={(e) => setSave(e.target.checked)}
            disabled={loading}
            className="h-3.5 w-3.5 accent-[var(--color-accent)]"
          />
          Enregistrer dans l&apos;historique
        </label>
      </div>
    </form>
  );
}
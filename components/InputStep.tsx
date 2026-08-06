"use client";

import { useRef, useEffect, KeyboardEvent } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  loading: boolean;
};

export default function InputStep({ value, onChange, onSubmit, loading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      if (text) onSubmit(text);
    }
  };

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (text && !loading) onSubmit(text);
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

      <div className="flex items-center justify-between gap-4">
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
    </form>
  );
}
"use client";

import { useState, useEffect, useRef, KeyboardEvent } from "react";

type Props = {
  questions: string[];
  onSubmit: (answers: string[]) => void;
  onBack: () => void;
  loading: boolean;
};

export default function QuestionsStep({ questions, onSubmit, onBack, loading }: Props) {
  const [answers, setAnswers] = useState<string[]>(() => questions.map(() => ""));
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, [questions]);

  const update = (index: number, value: string) => {
    setAnswers((prev) => prev.map((a, i) => (i === index ? value : a)));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter" && !loading) {
      if (index === questions.length - 1) {
        if (answers.every((a) => a.trim())) {
          e.preventDefault();
          onSubmit(answers);
        }
      } else {
        e.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
    }
    if (e.key === "ArrowDown" && index < questions.length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
    if (e.key === "ArrowUp" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    }
  };

  const setInputRef = (index: number) => (el: HTMLInputElement | null) => {
    inputRefs.current[index] = el;
  };

  const allFilled = answers.every((a) => a.trim());

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!loading && allFilled) onSubmit(answers);
      }}
    >
      <div className="flex flex-col gap-5" role="group" aria-label="Questions de clarification">
        {questions.map((question, i) => (
          <div key={i} className="flex flex-col gap-2" style={{ animationDelay: `${i * 40}ms` }}>
            <label htmlFor={`answer-${i}`} className="label-field">
              {question}
            </label>
            <input
              ref={setInputRef(i)}
              id={`answer-${i}`}
              type="text"
              value={answers[i]}
              onChange={(e) => update(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, i)}
              placeholder="Votre réponse…"
              disabled={loading}
              className="field"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="btn-ghost self-start sm:self-auto"
        >
          ← Retour
        </button>
        <button type="submit" disabled={loading || !allFilled} className="btn-primary sm:order-last">
          {loading && (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
          )}
          {loading ? "Génération…" : "Valider mes réponses"}
        </button>
      </div>
    </form>
  );
}
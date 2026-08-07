"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import InputStep from "@/components/InputStep";
import QuestionsStep from "@/components/QuestionsStep";
import ResultStep from "@/components/ResultStep";
import HistorySection from "@/components/HistorySection";

type AIResult =
  | { type: "questions"; questions: string[]; provider?: string }
  | { type: "final"; prompt: string; provider?: string };

type Step = "input" | "questions" | "result";

const SCREEN_LABEL: Record<Step, string> = {
  input: "Étape 1 — Ton besoin",
  questions: "Étape 2 — Précisions",
  result: "Étape 3 — Ton prompt",
};

const SCREEN_TITLE: Record<Step, string> = {
  input: "Décris le prompt dont tu as besoin",
  questions: "Quelques précisions pour t'aider",
  result: "Ton prompt est prêt",
};

const SCREEN_SUBTITLE: Record<Step, string> = {
  input:
    "Explique ce que tu veux obtenir. L'IA te posera ensuite quelques questions pour affiner le résultat.",
  questions:
    "Réponds aux questions ci-dessous pour que le prompt final soit le plus précis possible.",
  result:
    "Copie-le et colle-le dans ton outil d'IA préféré. Il est aussi enregistré dans ton historique.",
};

export default function Home() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("input");
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);

  const reset = useCallback(() => {
    setStep("input");
    setUserInput("");
    setPrompt("");
    setQuestions([]);
    setError("");
  }, []);

  async function generate(payload: {
    userInput: string;
    previousQuestions?: string[];
    previousAnswers?: string[];
  }) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as AIResult & { error?: string };

      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        throw new Error(data.error || "Une erreur est survenue");
      }

      setUserInput(payload.userInput);

      if (data.type === "questions") {
        setQuestions(data.questions ?? []);
        setProvider(data.provider ?? "");
        setStep("questions");
      } else if (data.type === "final") {
        setPrompt(data.prompt ?? "");
        setProvider(data.provider ?? "");
        setStep("result");
        setHistoryKey((k) => k + 1);
      }
    } catch (err) {
      console.error("[page] Erreur :", err);
      setError("La génération a échoué, réessaie.");
      setStep("input");
    } finally {
      setLoading(false);
    }
  }

  const handleInputSubmit = useCallback((input: string) => {
    setUserInput(input);
    setPrompt("");
    setQuestions([]);
    generate({ userInput: input });
  }, []);

  const handleAnswersSubmit = useCallback(
    (answers: string[]) => {
      generate({
        userInput,
        previousQuestions: questions,
        previousAnswers: answers,
      });
    },
    [userInput, questions]
  );

  // Remonte en haut de page à chaque changement d'écran.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [step]);

  // Échap contextuel : retour à l'étape précédente, sinon retour au départ.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (step === "questions") {
          setStep("input");
        } else {
          reset();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, reset]);

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-10 px-5 py-10 sm:px-6 sm:py-14">
      {/* En-tête d'écran */}
      <div key={`head-${step}`} className="animate-screen flex flex-col gap-3">
        <span className="label-step">{SCREEN_LABEL[step]}</span>
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[var(--color-text)] sm:text-[32px]">
          {SCREEN_TITLE[step]}
        </h1>
        <p className="text-[15px] leading-[1.6] text-[var(--color-text-muted)]">
          {SCREEN_SUBTITLE[step]}
        </p>
      </div>

      {/* Erreur — sobre, sans icône alarmiste */}
      {error && (
        <div className="error-banner animate-fade-in" role="alert">
          <p>{error}</p>
          {userInput && (
            <button
              type="button"
              onClick={() => generate({ userInput })}
              className="mt-2 text-sm font-medium text-[var(--color-text)] underline decoration-[var(--color-text-subtle)] underline-offset-4 hover:decoration-[var(--color-accent)]"
            >
              Réessayer
            </button>
          )}
        </div>
      )}

      {/* Contenu d'étape */}
      <div key={`body-${step}`} className="animate-screen">
        {step === "input" && (
          <InputStep value={userInput} onChange={setUserInput} onSubmit={handleInputSubmit} loading={loading} />
        )}

        {step === "questions" && (
          <QuestionsStep
            key={questions.join("|")}
            questions={questions}
            onSubmit={handleAnswersSubmit}
            onBack={() => setStep("input")}
            loading={loading}
          />
        )}

        {step === "result" && (
          <ResultStep prompt={prompt} provider={provider} onNewPrompt={reset} />
        )}
      </div>

      {/* Historique */}
      <div className="pt-4">
        <HistorySection refreshKey={historyKey} />
      </div>
    </main>
  );
}
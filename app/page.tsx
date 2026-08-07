"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import InputStep, { type GenerateOptions } from "@/components/InputStep";
import QuestionsStep from "@/components/QuestionsStep";
import ResultStep from "@/components/ResultStep";
import HistorySection from "@/components/HistorySection";

type AIResult =
  | {
      type: "questions";
      questions: string[];
      provider?: string;
      model?: string | null;
      durationMs?: number;
      remaining?: number;
    }
  | {
      type: "final";
      prompt: string;
      provider?: string;
      model?: string | null;
      durationMs?: number;
      saved?: boolean;
      remaining?: number;
    };

type Step = "input" | "questions" | "result";

const DRAFT_KEY = "pf_draft";
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
    "Copie-le, ouvre-le dans ton outil d'IA préféré, ou enregistre le lien pour le partager.",
};

export default function Home() {
  const router = useRouter();
  const { status } = useSession();
  const [step, setStep] = useState<Step>("input");
  const [userInput, setUserInput] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | undefined>(undefined);
  const [saved, setSaved] = useState<boolean | undefined>(undefined);
  const [remaining, setRemaining] = useState<number | undefined>(undefined);
  const [saveOption, setSaveOption] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [historyKey, setHistoryKey] = useState(0);

  const reset = useCallback(() => {
    setStep("input");
    setUserInput("");
    setPrompt("");
    setQuestions([]);
    setProvider("");
    setModel(null);
    setDurationMs(undefined);
    setSaved(undefined);
    setRemaining(undefined);
    setError("");
    setSaveOption(true);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, []);

  // Rappel du brouillon à l'arrivée (étape 1).
  useEffect(() => {
    if (step !== "input") return;
    try {
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft && !userInput) setUserInput(draft);
    } catch {}
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sauvegarde auto du brouillon tant qu'on écrit (non envoyé, non en étape résultat).
  const handleInputChange = useCallback((value: string) => {
    setUserInput(value);
    try {
      localStorage.setItem(DRAFT_KEY, value);
    } catch {}
  }, []);

  // Chiffre du quota affiché en étape 1.
  const loadQuota = useCallback(async () => {
    if (status !== "authenticated") return;
    try {
      const res = await fetch("/api/quota");
      if (!res.ok) return;
      const data = (await res.json()) as { remaining: number };
      setRemaining(data.remaining);
    } catch {}
  }, [status]);

  useEffect(() => {
    loadQuota();
  }, [loadQuota, status]);

  async function generate(
    payload: {
      userInput: string;
      previousQuestions?: string[];
      previousAnswers?: string[];
    },
    options?: Partial<GenerateOptions> & { save?: boolean }
  ) {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...options,
          save: options?.save ?? saveOption,
        }),
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
      if (typeof data.remaining === "number") setRemaining(data.remaining);

      if (data.type === "questions") {
        setQuestions(data.questions ?? []);
        setProvider(data.provider ?? "");
        setModel(data.model ?? null);
        setStep("questions");
        setError("");
      } else if (data.type === "final") {
        setPrompt(data.prompt ?? "");
        setProvider(data.provider ?? "");
        setModel(data.model ?? null);
        setDurationMs(data.durationMs);
        setSaved(data.saved);
        setStep("result");
        setHistoryKey((k) => k + 1);
        setError("");
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }
    } catch (err) {
      console.error("[page] Erreur :", err);
      setError("La génération a échoué, réessaie.");
      setStep("input");
    } finally {
      setLoading(false);
    }
  }

  const handleInputSubmit = useCallback(
    (input: string, save = true, options?: GenerateOptions) => {
      setSaveOption(save);
      setPrompt("");
      setQuestions([]);
      generate({ userInput: input }, { ...options, save });
    },
    [] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const handleAnswersSubmit = useCallback(
    (answers: string[]) => {
      generate(
        {
          userInput,
          previousQuestions: questions,
          previousAnswers: answers,
        },
        { save: saveOption }
      );
    },
    [userInput, questions, saveOption] // eslint-disable-line react-hooks/exhaustive-deps
  );

  // "Régénérer" depuis l'historique : réaffiche directement ce prompt en étape 3.
  const handleRegenerate = useCallback((promptText: string, title: string) => {
    setPrompt(promptText);
    setQuestions([]);
    setStep("result");
    setSaved(false);
    setUserInput(title);
  }, []);

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

      {/* Quota (étape 1, connecté) */}
      {step === "input" && typeof remaining === "number" && status === "authenticated" && (
        <p className="text-xs text-[var(--color-text-subtle)]">
          {remaining} génération{remaining > 1 ? "s" : ""} restante
          {remaining > 1 ? "s" : ""} aujourd&apos;hui
        </p>
      )}

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
          <InputStep
            value={userInput}
            onChange={handleInputChange}
            onSubmit={handleInputSubmit}
            loading={loading}
          />
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
          <ResultStep
            prompt={prompt}
            provider={provider}
            model={model}
            durationMs={durationMs}
            saved={saved}
            remaining={remaining}
            onNewPrompt={reset}
          />
        )}
      </div>

      {/* Historique */}
      <div className="pt-4">
        <HistorySection
          refreshKey={historyKey}
          enabled={status === "authenticated"}
          onRegenerate={handleRegenerate}
        />
      </div>
    </main>
  );
}
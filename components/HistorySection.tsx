"use client";

import { useEffect, useState } from "react";
import TerminalBlock from "@/components/TerminalBlock";

type HistoryItem = {
  id: string;
  userInput: string;
  finalPrompt: string;
  createdAt: string;
};

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} aria-hidden="true">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

/* Dates relatives : il y a 5 min / il y a 3 h / hier / 2 août */
function formatRelative(dateStr: string): string {
  const date = new Date(dateStr);
  const diff = Date.now() - date.getTime();
  const hour = 3600_000;
  const day = 24 * hour;

  if (diff < 60_000) return "à l'instant";
  if (diff < hour) return `il y a ${Math.floor(diff / 60_000)} min`;
  if (diff < day) return `il y a ${Math.floor(diff / hour)} h`;

  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (
    date.getFullYear() === yesterday.getFullYear() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getDate() === yesterday.getDate()
  ) {
    return "hier";
  }

  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function HistorySection({ refreshKey = 0 }: { refreshKey?: number }) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchHistory = () => {
    fetch("/api/history")
      .then((res) => {
        if (res.status === 401) throw new Error("auth");
        if (!res.ok) throw new Error("Chargement impossible");
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data.prompts) ? data.prompts : []))
      .catch((err) => setError(err.message === "auth" ? "auth" : "load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    setError("");
    fetchHistory();
  }, [refreshKey]);

  const deleteItem = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/history?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Échec de la suppression");
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (openId === id) setOpenId(null);
    } catch (err) {
      console.error("[history] delete error:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const truncate = (str: string, len = 70) =>
    str.length > len ? `${str.slice(0, len)}…` : str;

  return (
    <section aria-labelledby="history-title" className="animate-fade-in">
      <h2 id="history-title" className="label-step">
        Historique
      </h2>

      {loading && (
        <p className="py-4 text-sm text-[var(--color-text-muted)]" role="status" aria-live="polite">
          Chargement…
        </p>
      )}

      {error === "auth" && (
        <p className="py-4 text-sm text-[var(--color-text-muted)]">
          Connecte-toi pour retrouver ton historique.
        </p>
      )}

      {error === "load" && (
        <p className="error-banner mt-3" role="alert">
          Impossible de charger l&apos;historique
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="py-6 text-sm text-[var(--color-text-muted)]">
          Aucun prompt pour l&apos;instant. Tes créations apparaîtront ici.
        </p>
      )}

      <ul className="flex flex-col" role="list">
        {items.map((item) => {
          const open = openId === item.id;
          const deleting = deletingId === item.id;

          return (
            <li key={item.id} className="border-b border-[var(--color-border)] last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                aria-controls={`history-details-${item.id}`}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition-colors duration-150 ${open ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"}`}
              >
                <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--color-text)]">
                  {truncate(item.userInput)}
                </span>
                <time className="shrink-0 text-xs text-[var(--color-text-subtle)]">
                  {formatRelative(item.createdAt)}
                </time>
                <ChevronIcon open={open} />
              </button>

              {open && (
                <div
                  id={`history-details-${item.id}`}
                  className="animate-fade-in pb-6 pt-2"
                >
                  <TerminalBlock
                    title={`${truncate(item.userInput, 40)}.txt`}
                    content={item.finalPrompt}
                  />
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-subtle)]">
                      {item.finalPrompt.length} caractères
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      disabled={deleting}
                      className="btn-ghost text-[var(--color-text-muted)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
                      aria-label="Supprimer cet élément"
                    >
                      {deleting ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-error)]" aria-hidden="true" />
                      ) : (
                        <TrashIcon />
                      )}
                      Supprimer
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
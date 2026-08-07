"use client";

import { useEffect, useState } from "react";
import TerminalBlock from "@/components/TerminalBlock";

type HistoryItem = {
  id: string;
  userInput: string;
  finalPrompt: string;
  createdAt: string;
  used: boolean;
  provider?: string | null;
  model?: string | null;
  shareToken?: string | null;
};

type Filter = "all" | "used" | "unused";

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

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
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

type Props = {
  refreshKey?: number;
  enabled?: boolean;
  onRegenerate?: (prompt: string, title: string) => void;
};

export default function HistorySection({
  refreshKey = 0,
  enabled = true,
  onRegenerate,
}: Props) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError("auth");
      setItems([]);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError("");

    fetch("/api/history", { signal: controller.signal })
      .then((res) => {
        if (res.status === 401) throw new Error("auth");
        if (!res.ok) throw new Error("Chargement impossible");
        return res.json();
      })
      .then((data) => setItems(Array.isArray(data.prompts) ? data.prompts : []))
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err.message === "auth" ? "auth" : "load");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [refreshKey, enabled]);

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

  const toggleUsed = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${id}&action=toggleUsed`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Échec");
      const data = (await res.json()) as { used: boolean };
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, used: data.used } : item))
      );
    } catch (err) {
      console.error("[history] toggleUsed error:", err);
    }
  };

  const shareItem = async (id: string) => {
    try {
      const res = await fetch(`/api/history?id=${id}&action=share`, {
        method: "PATCH",
      });
      if (!res.ok) throw new Error("Échec du partage");
      const data = (await res.json()) as { shareToken: string };
      const url = `${window.location.origin}/shared/${data.shareToken}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch (err) {
      console.error("[history] share error:", err);
    }
  };

  const truncate = (str: string, len = 70) =>
    str.length > len ? `${str.slice(0, len)}…` : str;

  const q = query.trim().toLowerCase();
  const filtered = items.filter((item) => {
    if (filter === "used" && !item.used) return false;
    if (filter === "unused" && item.used) return false;
    if (q && !`${item.userInput} ${item.finalPrompt}`.toLowerCase().includes(q))
      return false;
    return true;
  });

  const filterBtn = (value: Filter, label: string) => (
    <button
      key={value}
      type="button"
      onClick={() => setFilter(value)}
      aria-pressed={filter === value}
      className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
        filter === value
          ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
          : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]"
      }`}
    >
      {label}
    </button>
  );

  return (
    <section aria-labelledby="history-title" className="animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="history-title" className="label-step">
          Historique
        </h2>
        {!loading && !error && items.length > 0 && (
          <div className="flex items-center gap-1" role="group" aria-label="Filtrer l'historique">
            {filterBtn("all", "Tout")}
            {filterBtn("used", "Utilisés")}
            {filterBtn("unused", "À tester")}
          </div>
        )}
      </div>

      {!loading && !error && items.length > 0 && (
        <div className="mt-3">
          <label htmlFor="history-search" className="sr-only">
            Rechercher dans l&apos;historique
          </label>
          <input
            id="history-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une idée ou un prompt…"
            className="field py-2 text-sm"
          />
        </div>
      )}

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

      {!loading && !error && items.length > 0 && filtered.length === 0 && (
        <p className="py-6 text-sm text-[var(--color-text-muted)]">
          Aucun résultat pour cette recherche ou ce filtre.
        </p>
      )}

      <ul className="flex flex-col" role="list">
        {filtered.map((item) => {
          const open = openId === item.id;
          const deleting = deletingId === item.id;
          const copied = copiedId === item.id;

          return (
            <li key={item.id} className="border-b border-[var(--color-border)] last:border-b-0">
              <button
                type="button"
                onClick={() => setOpenId(open ? null : item.id)}
                aria-expanded={open}
                aria-controls={`history-details-${item.id}`}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-1.5 text-left transition-colors duration-150 ${open ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"}`}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  {item.used && (
                    <CheckIcon className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]" />
                  )}
                  <span className={`min-w-0 flex-1 truncate text-[15px] ${item.used ? "text-[var(--color-text-muted)] line-through decoration-[var(--color-text-subtle)]/60" : "text-[var(--color-text)]"}`}>
                    {truncate(item.userInput)}
                  </span>
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
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-subtle)]">
                      <span>{item.finalPrompt.length} caractères</span>
                      {item.model && <span>via {item.model}</span>}
                      {item.shareToken && (
                        <a
                          href={`/shared/${item.shareToken}`}
                          target="_blank"
                          rel="noreferrer"
                          className="link"
                        >
                          Voir le lien public
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleUsed(item.id)}
                        className="btn-ghost text-[var(--color-text-muted)]"
                      >
                        {item.used ? "Marquer à tester" : "✓ Utilisé"}
                      </button>
                      <button
                        type="button"
                        onClick={() => shareItem(item.id)}
                        className="btn-ghost text-[var(--color-text-muted)]"
                      >
                        {copied ? "Lien copié !" : "Partager"}
                      </button>
                      {onRegenerate && (
                        <button
                          type="button"
                          onClick={() => onRegenerate(item.finalPrompt, item.userInput)}
                          className="btn-ghost text-[var(--color-text-muted)]"
                        >
                          Régénérer
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        disabled={deleting}
                        className="btn-ghost text-[var(--color-text-muted)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error)]"
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
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
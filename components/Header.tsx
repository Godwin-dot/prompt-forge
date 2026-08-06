"use client";

import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 h-16 border-b border-[var(--color-border)] bg-[var(--color-bg)]/85 backdrop-blur">
      <div className="mx-auto flex h-full max-w-[720px] items-center justify-between px-5 sm:px-6">
        <a
          href="/"
          className="text-sm font-semibold tracking-tight text-[var(--color-text)]"
          aria-label="Prompt Forge — accueil"
        >
          Prompt<span className="text-[var(--color-accent)]">Forge</span>
        </a>
        <ThemeToggle />
      </div>
    </header>
  );
}
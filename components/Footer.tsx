export default function Footer() {
  return (
    <footer className="border-t border-[var(--color-border)]">
      <div className="mx-auto flex max-w-[720px] items-center justify-between px-5 py-6 sm:px-6">
        <p className="text-xs text-[var(--color-text-subtle)]">
          Prompt Forge
        </p>
        <p className="text-xs text-[var(--color-text-subtle)]">
          Collez le résultat dans votre outil d&apos;IA
        </p>
      </div>
    </footer>
  );
}
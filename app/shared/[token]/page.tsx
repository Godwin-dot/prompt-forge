import TerminalBlock from "@/components/TerminalBlock";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Prompt partagé — Prompt Forge",
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function SharedPromptPage({
  params,
}: {
  params: { token: string };
}) {
  const item = await prisma.generatedPrompt.findFirst({
    where: { shareToken: params.token },
    select: {
      userInput: true,
      finalPrompt: true,
      provider: true,
      model: true,
      createdAt: true,
    },
  });

  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-10 px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-3">
        <span className="label-step">Prompt partagé</span>
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[var(--color-text)] sm:text-[32px]">
          {item ? item.userInput : "Introuvable"}
        </h1>
        {item?.createdAt && (
          <p className="text-xs text-[var(--color-text-subtle)]">
            Partagé le {formatDate(item.createdAt)}
          </p>
        )}
      </div>

      {item ? (
        <div className="flex flex-col gap-6">
          <TerminalBlock title="prompt-final.txt" content={item.finalPrompt} />

          <div className="flex flex-col gap-2 text-xs text-[var(--color-text-muted)]">
            {item.provider && (
              <p>
                Généré avec{" "}
                <span className="font-medium text-[var(--color-text)]">
                  {item.model ?? item.provider}
                </span>
              </p>
            )}
            <a href="/" className="link">
              ← Créer ton propre prompt avec Prompt Forge
            </a>
          </div>
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-muted)]">
          Ce lien de partage n&apos;est plus valide ou n&apos;existe pas.
        </p>
      )}
    </main>
  );
}
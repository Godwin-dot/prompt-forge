export const metadata = {
  title: "Confidentialité — Prompt Forge",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-[640px] flex-col gap-8 px-5 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-3">
        <span className="label-step">Confidentialité</span>
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[var(--color-text)] sm:text-[32px]">
          Ce que nous faisons de vos données
        </h1>
      </div>

      <div className="flex flex-col gap-5 text-[15px] leading-[1.7] text-[var(--color-text-muted)]">
        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            1. Ce qui est envoyé à l&apos;IA
          </h2>
          <p>
            Votre idée initiale et vos réponses aux questions de clarification
            sont transmises à un fournisseur d&apos;IA tiers (Groq, OpenRouter,
            Google AI ou OpenAI) afin de générer votre prompt optimisé. Ces
            fournisseurs peuvent stocker et utiliser les données transmises
            selon leurs propres politiques.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            2. Ce qui est enregistré
          </h2>
          <p>
            Votre compte est créé avec une adresse email et un mot de passe
            haché (jamais stocké en clair). Les prompts finaux générés sont
            enregistrés dans votre historique privé, visible uniquement par
            vous. Votre idée initiale et vos réponses de clarification y sont
            associées uniquement pour reconstituer le contexte.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            3. Ce que nous vous recommandons
          </h2>
          <p>
            N&apos;inscrivez pas de données personnelles sensibles (informations
            de santé, numéros de pièces d&apos;identité, données bancaires) dans
            vos idées ou vos réponses. L&apos;outil est conçu pour optimiser des
            prompts, pas pour traiter des données confidentielles.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            4. Vos droits
          </h2>
          <p>
            Vous pouvez supprimer votre historique à tout moment. La
            suppression de votre compte et de toutes vos données associées est
            également disponible sur demande.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-[var(--color-text)]">
            5. Cookies
          </h2>
          <p>
            L&apos;application utilise un cookie de session pour maintenir votre
            connexion. Aucun traceur publicitaire n&apos;est utilisé.
          </p>
        </section>
      </div>
    </main>
  );
}

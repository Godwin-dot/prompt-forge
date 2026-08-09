import type { Metadata } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ThemeProvider } from "@/components/ThemeProvider";
import Providers from "./Providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PrivacyConsent from "@/components/PrivacyConsent";

export const metadata: Metadata = {
  title: "Prompt Forge — Créateur de prompts IA",
  description:
    "Générez et optimisez vos prompts IA avec multi-providers et fallback automatique.",
  applicationName: "Prompt Forge",
};

// Applique data-theme avant le premier paint pour éviter le flash.
// Priorité : préférence sauvegardée (localStorage) puis préférence système.
const themeScript = `
(function () {
  try {
    var saved = null;
    try { saved = localStorage.getItem('pf-theme'); } catch (e) {}
    var t = saved === 'light' || saved === 'dark'
      ? saved
      : (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${GeistSans.variable} ${GeistMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#contenu"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--color-accent)] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Aller au contenu
        </a>
        <ThemeProvider>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Header />
              <div id="contenu" className="flex-1" tabIndex={-1}>
                {children}
              </div>
              <Footer />
            </div>
          </Providers>
        </ThemeProvider>
        <PrivacyConsent />
      </body>
    </html>
  );
}
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
const themeScript = `
(function () {
  try {
    var t = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
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
        <ThemeProvider>
          <Providers>
            <div className="flex min-h-screen flex-col">
              <Header />
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
          </Providers>
        </ThemeProvider>
        <PrivacyConsent />
      </body>
    </html>
  );
}
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Email ou mot de passe incorrect.");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <main className="mx-auto flex w-full max-w-[440px] flex-col gap-8 px-5 py-14 sm:px-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-[28px] font-semibold leading-[1.2] tracking-tight text-[var(--color-text)]">
          Connexion
        </h1>
        <p className="text-[15px] text-[var(--color-text-muted)]">
          Retrouve ton historique personnel.
        </p>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="label-field">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vous@exemple.fr"
            className="field"
            autoComplete="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="label-field">
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="field"
            autoComplete="current-password"
          />
        </div>
        <button type="submit" disabled={loading || !email || !password} className="btn-primary">
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <p className="text-sm text-[var(--color-text-muted)]">
        Pas encore de compte ?{" "}
        <Link href="/register" className="link">
          Créer un compte
        </Link>
      </p>
    </main>
  );
}
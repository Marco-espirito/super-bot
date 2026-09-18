"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import ProductShell from "@/app/components/product-shell";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true); setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password: data.get("password") }),
    });
    const result = await response.json();
    setLoading(false);
    if (!response.ok) { setError(result.error || "Connexion impossible."); return; }
    router.push("/"); router.refresh();
  }

  return <ProductShell eyebrow="COMPTE SÉCURISÉ" title={mode === "login" ? "Heureux de te revoir" : "Créer ton espace SuperBot"}>
    <div className="auth-card">
      <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Connexion</button><button className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Inscription</button></div>
      <form onSubmit={submit}>
        {mode === "register" && <label>Nom<input name="name" minLength={2} maxLength={80} required autoComplete="name" /></label>}
        <label>E-mail<input name="email" type="email" required autoComplete="email" /></label>
        <label>Mot de passe<input name="password" type="password" minLength={10} maxLength={128} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-action" disabled={loading}>{loading ? "Patiente…" : mode === "login" ? "Se connecter" : "Créer mon compte"}</button>
      </form>
      <p className="form-note">Session HTTP-only, protégée contre l’accès JavaScript et les requêtes intersites.</p>
    </div>
  </ProductShell>;
}

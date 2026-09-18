"use client";

import { useEffect, useState } from "react";
import ProductShell from "@/app/components/product-shell";

export default function SettingsPage() {
  const [theme, setTheme] = useState("light");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const savedTheme = localStorage.getItem("superbot-theme") ?? "light";
    setTheme(savedTheme);
    document.documentElement.dataset.theme = savedTheme;
    fetch("/api/preferences").then(async (response) => ({ ok: response.ok, body: await response.json() })).then(({ ok, body }) => {
      if (ok && body.preferences) {
        setAuthenticated(true); setTheme(body.preferences.theme); setMemoryEnabled(body.preferences.memoryEnabled);
        document.documentElement.dataset.theme = body.preferences.theme;
      }
    }).catch(() => undefined);
  }, []);
  function updateTheme(value: string) { setTheme(value); localStorage.setItem("superbot-theme", value); document.documentElement.dataset.theme = value; }
  async function save() {
    setNotice("");
    if (!authenticated) { setNotice("Réglages enregistrés localement. Connecte-toi pour les synchroniser."); return; }
    const response = await fetch("/api/preferences", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ theme, memoryEnabled }) });
    setNotice(response.ok ? "Préférences enregistrées." : "Impossible d’enregistrer les préférences.");
  }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
  async function removeAccount() {
    if (!window.confirm("Supprimer définitivement ton compte, tes conversations et tes fichiers ?")) return;
    const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "SUPPRIMER" }) });
    if (response.ok) { localStorage.removeItem("superbot-conversation"); localStorage.removeItem("superbot-conversation-id"); window.location.href = "/"; }
    else setNotice("La suppression du compte a échoué.");
  }
  return <ProductShell eyebrow="PRÉFÉRENCES" title="Personnalise ton espace"><div className="settings-card"><label>Thème<select value={theme} onChange={(event) => updateTheme(event.target.value)}><option value="light">Clair</option><option value="dark">Sombre</option><option value="system">Système</option></select></label><label className="setting-toggle"><input type="checkbox" checked={memoryEnabled} onChange={(event) => setMemoryEnabled(event.target.checked)} /> Activer la mémoire personnalisée</label><button className="primary-action" onClick={() => void save()}>Enregistrer</button>{notice && <p role="status">{notice}</p>}{authenticated && <div className="account-actions"><button onClick={() => void logout()}>Se déconnecter</button><button className="danger-action" onClick={() => void removeAccount()}>Supprimer mon compte et mes données</button></div>}<p>Les réglages locaux sont immédiatement appliqués. La synchronisation PostgreSQL s’active après connexion.</p></div></ProductShell>;
}

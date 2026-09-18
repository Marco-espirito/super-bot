"use client";

import { useEffect, useState } from "react";
import ProductShell from "@/app/components/product-shell";

export default function UsagePage() {
  const [usage, setUsage] = useState({ used: 0, limit: 50, remaining: 50, plan: "invité" });
  useEffect(() => { fetch("/api/usage").then((response) => response.json()).then(setUsage).catch(() => undefined); }, []);
  const percentage = Math.min(100, Math.round((usage.used / usage.limit) * 100));
  return <ProductShell eyebrow="CONSOMMATION" title="Une utilisation claire et maîtrisée"><div className="usage-dashboard"><article><span>Messages sur 24 h</span><strong>{usage.used}</strong><small>sur {usage.limit}</small></article><article><span>Messages restants</span><strong>{usage.remaining}</strong><small>plan {usage.plan}</small></article></div><div className="usage-large-track"><span style={{ width: `${percentage}%` }} /></div><p className="product-lead">Les quotas sont calculés côté serveur et ne peuvent pas être modifiés depuis le navigateur.</p></ProductShell>;
}

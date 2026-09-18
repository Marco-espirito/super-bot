import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SuperBot — One AI, multiple skills", template: "%s | SuperBot" },
  description: "Un assistant IA qui choisit automatiquement le bon expert pour chaque mission.",
  applicationName: "SuperBot",
  keywords: ["assistant IA", "multi-agent", "analyse de données", "carrière", "développement"],
  openGraph: {
    type: "website",
    locale: "fr_FR",
    title: "SuperBot — One AI, multiple skills",
    description: "Un assistant IA qui choisit automatiquement le bon expert pour chaque mission.",
    siteName: "SuperBot",
  },
  twitter: {
    card: "summary",
    title: "SuperBot — One AI, multiple skills",
    description: "Un assistant IA qui choisit automatiquement le bon expert pour chaque mission.",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

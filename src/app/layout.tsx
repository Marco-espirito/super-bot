import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SuperBot — One AI, multiple skills",
  description: "Un assistant IA qui choisit automatiquement le bon expert pour chaque mission.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}

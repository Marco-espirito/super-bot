import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SuperBot — One AI, multiple skills",
    short_name: "SuperBot",
    description: "Un assistant IA qui choisit automatiquement le bon expert pour chaque mission.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f7fa",
    theme_color: "#7147ed",
    lang: "fr",
  };
}

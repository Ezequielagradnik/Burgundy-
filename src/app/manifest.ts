import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Burgundy · Gastos",
    short_name: "Burgundy",
    description: "Gastos de la florería Burgundy",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f0ea",
    theme_color: "#f6f0ea",
    lang: "es-AR",
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

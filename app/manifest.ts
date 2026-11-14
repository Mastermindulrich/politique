import type { MetadataRoute } from "next";

/** Lets phones install POLITIQUE as an app. iPhones only accept Web Push from an installed app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "POLITIQUE",
    short_name: "POLITIQUE",
    description: "Le réseau social politique de la Côte d'Ivoire",
    lang: "fr",
    start_url: "/accueil",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16181C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

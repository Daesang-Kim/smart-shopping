import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "오늘 이 가격, 싼 걸까?",
    short_name: "오늘가격",
    description: "장보기 가격 판단 도우미 — KAMIS 데이터로 오늘 가격이 싼지 비싼지 알려줘요",
    start_url: "/",
    display: "standalone",
    background_color: "#1F241E",
    theme_color: "#1F241E",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

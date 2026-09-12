"use client";

import { useEffect } from "react";

// PWA 설치 가능 조건(Chrome) 충족용 — public/sw.js 참고
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패해도 앱 사용에는 지장 없음
      });
    }
  }, []);

  return null;
}

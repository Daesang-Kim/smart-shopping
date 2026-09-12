"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "smart-shopping:favorites";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getSnapshot(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "[]";
}

function getServerSnapshot(): string {
  return "[]";
}

function parse(raw: string): string[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// 즐겨찾기는 계정 시스템 없이 브라우저 로컬(localStorage)에만 저장한다 — 기기별로 따로 관리됨.
// useSyncExternalStore를 쓰는 이유: SSR 시점엔 localStorage가 없으므로 서버 스냅샷([])으로
// 렌더링하고, 하이드레이션 이후에만 실제 값으로 안전하게 갈아끼워 하이드레이션 불일치를 피한다.
export function useFavorites() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const favorites = parse(raw);

  const toggle = useCallback((key: string) => {
    const current = parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      // 'storage' 이벤트는 다른 탭에서만 자동 발생하므로, 같은 탭 리렌더를 위해 수동 발행한다.
      window.dispatchEvent(new Event("storage"));
    } catch {
      // 저장 실패(프라이빗 모드 등)해도 앱은 계속 동작
    }
  }, []);

  const isFavorite = useCallback((key: string) => favorites.includes(key), [favorites]);

  return { favorites, toggle, isFavorite };
}

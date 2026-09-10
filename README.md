# smart-shopping

장보기 앱 - 오늘 사는 식품의 가격이 적절한지 알아보는 어플리케이션

- 상세 스펙: [docs/spec.md](docs/spec.md)
- 프론트엔드 참고 목업: [docs/mockup.html](docs/mockup.html)
- DB 스키마: [docs/db-schema.sql](docs/db-schema.sql)
- 진행 상황 / 남은 할 일: [docs/setup-todo.md](docs/setup-todo.md)

## 기술 스택

- Next.js (App Router) — 프론트엔드(PWA) + 백엔드(Route Handlers) 통합
- Supabase (Postgres) — 일별 가격 데이터 캐싱
- Vercel Cron — KAMIS/축평원 데이터 일일 수집
- Google Cloud Vision — 가격표 OCR
- Vercel — 배포

## 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000)에서 확인.

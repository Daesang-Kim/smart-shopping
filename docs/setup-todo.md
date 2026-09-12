# 남은 할 일

## 1. 직접 발급받아야 하는 것

| 항목 | 어디서 | 왜 필요한지 | 상태 |
|---|---|---|---|
| KAMIS API 키 | 공공데이터포털 | 농산물/수산물 소매가격 수집 | ✅ 완료 |
| Supabase 프로젝트 | https://supabase.com | 일별 가격 캐싱 DB | ✅ 완료 (조직/프로젝트 생성, 스키마 적용, 5개 품목 백필까지 끝) |
| Vercel 계정 + 배포 | https://vercel.com | 배포 + Cron 스케줄 | ✅ 완료 (GitHub 연동, 자동배포, cron 등록) |
| Google Cloud Vision API | https://console.cloud.google.com | 가격표 촬영 OCR | ✅ 완료 (전용 GCP 프로젝트 `smart-shopping-82693`, 결제 연결, Vision 전용 제한 키) |

발급이 필요한 항목은 모두 끝났어요. 다음은 기능 보완 작업만 남았습니다 (아래 4번).

## 2. 진행한 것 (누적)

- KAMIS API 실제 연동 — 축산물은 데이터 0건임을 API로 재확인, MVP는 배추/양파/대파/무(농산물) + 고등어(수산물) 5개 (`src/lib/items.ts`)
- 품목 상세 화면: 오늘가격, 백분위 배지, 전년비교, 가격대 게이지, 90일 추이 그래프, 요일별 평균가(토·일 추정), 최근 90일 최저가
- **Supabase 연동 완료**:
  - 조직/프로젝트 CLI로 생성 (서울 리전), `supabase/migrations/`로 스키마 관리 (`items`, `daily_prices`, `sync_runs`)
  - `src/lib/sync.ts` — KAMIS → 정규화 → Supabase upsert
  - `src/app/api/cron/sync/route.ts` — 동기화 엔드포인트 (`CRON_SECRET`으로 보호)
  - `vercel.json` — 매일 UTC 11시(KST 20시) 자동 실행되는 Vercel Cron 등록
  - `src/lib/priceSummary.ts`를 라이브 KAMIS 호출 대신 **Supabase 읽기로 전환** → 응답속도 44초 → 0.9초로 개선
  - 5개 품목 최근 400일치 백필 완료
- Vercel 배포 완료, GitHub push 시 자동배포, 환경변수(KAMIS/Supabase/CRON_SECRET/Vision) 3개 환경 모두 등록
- **OCR 검색 구현 완료**:
  - `src/lib/ocr.ts` — Google Cloud Vision TEXT_DETECTION 호출
  - `src/lib/matchItem.ts` — OCR 텍스트와 품목명을 편집거리 기반으로 유사도 매칭, 후보 최대 3개 제시
  - `src/app/api/ocr/route.ts`, `src/components/OcrSearch.tsx` — 홈 화면에 "가격표 촬영으로 찾기" 버튼 추가 (모바일 카메라 바로 실행, 업로드 전 클라이언트에서 1024px로 리사이즈)
  - 실제 이미지로 종단간 테스트 완료: "양파(국산) 1,890원" → 양파 100%, 대파 50% 순으로 정확히 매칭

## 3. 알아두어야 할 트레이드오프

- **품종/등급을 구분하지 않고 그날 조사된 모든 시장·품종의 평균**을 "오늘 가격"으로 계산 (MVP 단순화)
- **전년동기 비교는 정확히 365일 전 날짜가 없으면 가장 가까운 날(최대 ±5일)로 대체**
- **가격 추이 그래프는 올해 실선만 표시** — 작년 점선(고스트) 라인, 명절 마커는 아직 미구현 (음력 변환 라이브러리 선정 필요)
- **OCR 매칭은 편집거리 기반의 단순 알고리즘** — 품목이 5개뿐이라 충분하지만, 품목이 늘어나면 자모 단위 매칭 등으로 고도화 필요
- Google Cloud Vision 키는 **smart-shopping-82693이라는 별도 GCP 프로젝트**에 결제가 연결되어 있음 — 다른 프로젝트(MenoWebApp 등)와 무관

## 4. 추천하는 다음 순서

1. 가격 추이 그래프에 작년 점선 라인 + 명절 마커 추가
2. 품목 확대, 축평원(축산물) 연동 검토
3. OCR 매칭 정확도 개선 (품목 늘어날 경우)

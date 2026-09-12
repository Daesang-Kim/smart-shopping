# 남은 할 일

## 1. 직접 발급받아야 하는 것

| 항목 | 어디서 | 왜 필요한지 | 상태 |
|---|---|---|---|
| KAMIS API 키 | 공공데이터포털 | 농산물/수산물 소매가격 수집 | ✅ 완료 |
| Supabase 프로젝트 | https://supabase.com | 일별 가격 캐싱 DB | ✅ 완료 |
| Vercel 계정 + 배포 | https://vercel.com | 배포 + Cron 스케줄 | ✅ 완료 (GitHub 연동, 자동배포, cron 등록) |
| Google Cloud Vision API | https://console.cloud.google.com | 가격표 촬영 OCR | ✅ 완료 (전용 GCP 프로젝트 `smart-shopping-82693`, 결제 연결, Vision 전용 제한 키) |

발급이 필요한 항목은 모두 끝났어요.

## 2. 핵심 아키텍처: 지연 수집(lazy backfill)

처음엔 배추/양파/대파/무/고등어 5개만 하드코딩해서 데이터를 수집했는데, **KAMIS가 제공하는 123개 품목 전부를 지원하도록 바뀌었어요.** 123개를 한꺼번에 백필하는 대신:

- `src/lib/catalog.ts`의 `BROWSABLE_ITEMS`(123개, 이름 중복 제거)가 전체 카탈로그이고, 모든 품목이 `/item/[ctgryCode-itemCode]`로 클릭 가능함
- **사용자가 처음 클릭하는 품목만 그 자리에서 KAMIS를 호출해 Supabase에 캐싱**하고(`src/lib/priceSummary.ts` → `src/lib/sync.ts`의 `syncItem`), 이후 방문부터는 캐시를 읽어 빠름 (최초 1회 ~5~18초, 이후 ~0.3초)
- 매일 도는 cron(`src/app/api/cron/sync/route.ts` → `syncAllActiveItems`)은 고정 목록이 아니라 **그동안 실제로 조회돼서 DB에 쌓인 품목들만** 갱신함 — 사용량에 따라 자연스럽게 커버리지가 늘어남
- "미지원" 개념은 완전히 없앴음 — 모든 품목이 목록/검색/OCR 어디서든 클릭하면 동작함

## 3. 진행한 것 (누적)

- KAMIS API 실제 연동 — 축산물은 데이터 0건임을 API로 재확인, 지원 범위는 농산물+수산물 123개
- 품목 상세 화면: 오늘가격, 백분위 배지, 전년비교, 가격대 게이지, 90일 추이 그래프, 요일별 평균가(토·일 추정), 최근 90일 최저가
- Supabase 연동 — 조직/프로젝트 CLI로 생성(서울 리전), `supabase/migrations/`로 스키마 관리 (`items`, `daily_prices`, `sync_runs`)
- Vercel 배포 — GitHub push 시 자동배포, 환경변수(KAMIS/Supabase/CRON_SECRET/Vision) 3개 환경 모두 등록
- OCR 검색 — Google Cloud Vision TEXT_DETECTION(`src/lib/ocr.ts`) + 편집거리 기반 유사도 매칭(`src/lib/matchItem.ts`)으로 전체 카탈로그 대상 인식, 후보 최대 3개 제시
- 홈 화면 재설계 — 텍스트 검색이 기본, 카메라(OCR)는 검색창 옆 아이콘 버튼(사이드 옵션). 즐겨찾기는 `localStorage`에 저장(계정 없이 기기별 관리, `useSyncExternalStore`로 하이드레이션 이슈 없이 구현), 별 아이콘으로 토글하면 목록 최상단 고정
- 지연 수집 아키텍처로 전환 — 위 2번 참고

## 4. 알아두어야 할 트레이드오프

- **품종/등급을 구분하지 않고 그날 조사된 모든 시장·품종의 평균**을 "오늘 가격"으로 계산 (단순화)
- **전년동기 비교는 정확히 365일 전 날짜가 없으면 가장 가까운 날(최대 ±5일)로 대체**
- **가격 추이 그래프는 올해 실선만 표시** — 작년 점선(고스트) 라인, 명절 마커는 아직 미구현 (음력 변환 라이브러리 선정 필요)
- **처음 조회하는 품목은 로딩이 몇 초 걸림** (`item/[itemId]/loading.tsx`로 안내 문구 표시) — KAMIS 라이브 호출이 필요해서 구조적으로 피할 수 없음
- Google Cloud Vision 키는 **smart-shopping-82693이라는 별도 GCP 프로젝트**에 결제가 연결되어 있음 — 다른 프로젝트(MenoWebApp 등)와 무관

## 5. 추천하는 다음 순서

1. 가격 추이 그래프에 작년 점선 라인 + 명절 마커 추가
2. 축평원(축산물) 연동 검토
3. OCR/검색 매칭 정확도 개선 (품목이 더 늘어날 경우 자모 단위 매칭 등)

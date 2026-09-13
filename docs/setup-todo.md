# 남은 할 일

## 1. 직접 발급받아야 하는 것

| 항목 | 어디서 | 왜 필요한지 | 상태 |
|---|---|---|---|
| KAMIS API 키 | 공공데이터포털 | 농산물/수산물 소매가격 수집 | ✅ 완료 |
| Supabase 프로젝트 | https://supabase.com | 일별 가격 캐싱 DB | ✅ 완료 |
| Vercel 계정 + 배포 | https://vercel.com | 배포 + Cron 스케줄 | ✅ 완료 (GitHub 연동, 자동배포, cron 등록) |
| Google Cloud Vision API | https://console.cloud.google.com | 가격표 촬영 OCR | ✅ 완료 (전용 GCP 프로젝트 `smart-shopping-82693`, 결제 연결, Vision 전용 제한 키) |
| 축산물품질평가원(EKAPE) API 키 | 공공데이터포털 (KAMIS와 별개로 활용신청 필요) | 삼겹살 등 축산물 소비자가격 수집 | ✅ 완료 |

발급이 필요한 항목은 모두 끝났어요.

## 2. 핵심 아키텍처: 지연 수집(lazy backfill)

처음엔 배추/양파/대파/무/고등어 5개만 하드코딩해서 데이터를 수집했는데, **KAMIS가 제공하는 123개 품목 전부를 지원하도록 바뀌었어요.** 123개를 한꺼번에 백필하는 대신:

- `src/lib/catalog.ts`의 `BROWSABLE_ITEMS`(123개, 이름 중복 제거)가 전체 카탈로그이고, 모든 품목이 `/item/[ctgryCode-itemCode]`로 클릭 가능함
- **사용자가 처음 클릭하는 품목만 그 자리에서 KAMIS를 호출해 Supabase에 캐싱**하고(`src/lib/priceSummary.ts` → `src/lib/sync.ts`의 `syncItem`), 이후 방문부터는 캐시를 읽어 빠름 (최초 1회 ~5~18초, 이후 ~0.3초)
- cron(`src/app/api/cron/sync/route.ts` → `syncAllActiveItems`)은 고정 목록이 아니라 **그동안 실제로 조회돼서 DB에 쌓인 품목들만** 갱신함 — 사용량에 따라 자연스럽게 커버리지가 늘어남. 단, 한 번에 4개씩(`last_synced_at` 오래된 순)만 처리하고 매일 1회(Vercel Hobby 플랜 cron 제약) 돌아서 여러 날에 걸쳐 순환 갱신함 (아래 트레이드오프 참고)
- "미지원" 개념은 완전히 없앴음 — 모든 품목이 목록/검색/OCR 어디서든 클릭하면 동작함

## 3. 진행한 것 (누적)

- KAMIS API 실제 연동 — 축산물은 KAMIS에 데이터 0건임을 API로 재확인(2022년부터 축평원으로 이관됨), 지원 범위는 농산물+수산물 123개
- 품목 상세 화면: 오늘가격, 백분위 배지, 전년비교, 가격대 게이지, 90일 추이 그래프, 요일별 평균가(토·일 추정), 최근 90일 최저가
- Supabase 연동 — 조직/프로젝트 CLI로 생성(서울 리전), `supabase/migrations/`로 스키마 관리 (`items`, `daily_prices`, `sync_runs`)
- Vercel 배포 — GitHub push 시 자동배포, 환경변수(KAMIS/Supabase/CRON_SECRET/Vision) 3개 환경 모두 등록
- OCR 검색 — Google Cloud Vision TEXT_DETECTION(`src/lib/ocr.ts`) + 편집거리 기반 유사도 매칭(`src/lib/matchItem.ts`)으로 전체 카탈로그 대상 인식, 후보 최대 3개 제시
- 홈 화면 재설계 — 텍스트 검색이 기본, 카메라(OCR)는 검색창 옆 아이콘 버튼(사이드 옵션). 즐겨찾기는 `localStorage`에 저장(계정 없이 기기별 관리, `useSyncExternalStore`로 하이드레이션 이슈 없이 구현), 별 아이콘으로 토글하면 목록 최상단 고정
- 지연 수집 아키텍처로 전환 — 위 2번 참고
- **가격 추이 그래프에 작년 점선 라인 + 명절 마커 추가**:
  - `src/lib/holidays.ts` — `korean-lunar-calendar`로 설날/추석의 양력 날짜를 매년 계산(하드코딩 없음). 2025 추석 10/6, 2026 추석 9/25 등 스펙에 명시된 검증값과 일치 확인
  - `src/lib/stats.ts`의 `buildChartData` — 올해(실측, -90일~오늘)와 작년(-90일~+30일, 미래분까지) 라인을 "기준일로부터 며칠"이라는 공통 x축에 정렬해서 같은 위치에서 비교 가능하게 함
  - `src/components/PriceCard.tsx` — 실선(올해)+점선(작년) 두 라인과 명절 마커(올해=주황, 작년=회색)를 SVG로 렌더링
- **도매가 토글 추가**:
  - "소매가/도매가" 토글 버튼 클릭 시에만 그 자리에서 KAMIS 중도매(se_cd=02) 데이터를 수집·캐싱 (지연 수집과 동일 원칙 — 누르지 않으면 아무 요청도 안 나감)
  - 소매/도매는 완전히 다른 데이터라 슬러그를 분리해서(`{slug}-w`) 별도 캐시 행으로 저장, `/api/prices/[itemId]?priceType=wholesale`로 조회
- **버그 수정: `unit_sz`(단위당 개수) 누락** — KAMIS는 "마리", "장" 같은 단위와 별개로 `unit_sz`(예: 전어는 5마리, 새우/김은 10개)를 따로 주는데 이를 무시하고 있었음. 예를 들어 전어가 "마리당 4,779원"이 아니라 실제로는 "5마리당 4,779원"이었음 — `src/lib/normalize.ts`에서 `unit_sz > 1`이면 "5마리"처럼 합쳐서 표기하도록 수정
- **가격 추이 그래프에 "오늘" 지점 표시** — 실선(올해)이 어디서 끝나는지 알기 어렵다는 피드백으로, 세로 점선+점+"오늘" 라벨 추가 (`PriceCard.tsx`의 `TodayMarker`)
- **cron 안정성 개선 (실측 기반)**:
  - 품목이 늘면서 cron이 실제로 함수 제한시간(60초)을 초과하기 시작함 (8개 품목에서 재현)
  - data.go.kr가 짧은 시간에 요청이 몰리면 429를 반환하는 것도 확인 — `kamis/client.ts`에 429 전용 지수 백오프 재시도 추가
  - 근본 해결로 **cron이 한 번에 4개씩만(`items.last_synced_at`이 가장 오래된 순) 순환 갱신**하도록 변경 (`syncAllActiveItems`) — 품목이 아무리 늘어도 1회 실행시간은 항상 배치 크기만큼으로 유지됨

## 4. 알아두어야 할 트레이드오프

- **품종/등급을 구분하지 않고 그날 조사된 모든 시장·품종의 평균**을 "오늘 가격"으로 계산 (단순화)
- **전년동기 비교는 정확히 365일 전 날짜가 없으면 가장 가까운 날(최대 ±5일)로 대체**
- **처음 조회하는 품목(또는 처음 켜는 도매가 토글)은 로딩이 몇 초 걸림** (`item/[itemId]/loading.tsx`로 안내 문구 표시) — KAMIS 라이브 호출이 필요해서 구조적으로 피할 수 없음
- **작년 점선 라인은 400일 백필 범위를 벗어나면 표시가 안 될 수 있음** — 예: 조사 자체가 뜸한 계절성 품목(전어 등)은 "최신 데이터"가 몇 달 전이라, 그 기준으로 "작년"을 계산하면 400일 백필 범위 밖으로 나가 점선이 안 그려짐. 정기적으로 조사되는 품목(농산물 대부분)은 문제없음
- 음력 계산은 `korean-lunar-calendar`(한국 전용, 외부 API 의존 없음) 사용 — 중국 음력 라이브러리와 달리 한중 간 하루 오차 이슈 없음
- Google Cloud Vision 키는 **smart-shopping-82693이라는 별도 GCP 프로젝트**에 결제가 연결되어 있음 — 다른 프로젝트(MenoWebApp 등)와 무관
- **Vercel Hobby 플랜은 cron이 하루 1회로 제한됨** (실측: 하루 여러 번 도는 스케줄은 배포 자체가 거부됨) — 그래서 cron이 하루에 4개씩만 순환 갱신하고, 현재 활성 품목(~8개) 기준 전체가 한 바퀴 도는 데 이틀 정도 걸림. 품목이 늘면 그만큼 개별 품목 갱신 주기도 길어지므로, 필요시 배치 크기를 늘리거나 Pro 플랜(더 잦은 cron) 전환 검토

## 5. PWA 설치 지원 추가

- 아이콘: "가격 게이지(저렴~비쌈 계기판) + 바늘" 디자인 — 앱 안의 실제 가격대 게이지 UI와 동일한 모양으로 직관성을 높임. `scripts/icon-source.svg`(일반용)·`scripts/icon-maskable-source.svg`(Android 마스커블용, 세이프존 고려)가 원본. `npm i -D sharp` 후 이 SVG를 재편집하고 다시 PNG로 뽑으면 아이콘 교체 가능
- `src/app/manifest.ts` — Next.js App Router의 manifest 특수 파일로 `/manifest.webmanifest` 자동 생성 (이름/아이콘/standalone 모드 등)
- `src/app/icon.png`, `src/app/apple-icon.png` — Next.js가 자동으로 `<link rel="icon">`, `<link rel="apple-touch-icon">` 태그 생성
- `public/sw.js` + `src/components/ServiceWorkerRegister.tsx` — Chrome의 PWA 설치 조건(등록된 서비스워커) 충족용 최소 구현. 가격 데이터가 자주 바뀌므로 오프라인 캐싱은 하지 않음
- 로컬에서 매니페스트/아이콘/서비스워커 등록까지 확인 완료. 실기기(안드로이드 Chrome "홈 화면에 추가", iOS Safari "홈 화면에 추가")에서의 설치 동작은 배포 후 직접 확인 필요

## 6. 축평원(축산물) 연동

- `src/lib/ekapeCatalog.ts` — 축산물품질평가원 "일자별 축산물소비자가격" API의 공식 활용가이드에 명시된 축종/품목코드만 등록 (소/돼지/수입소고기/수입돼지고기/우유 — 삼겹살, 안심, 목살, 흰우유 등). 닭·계란은 품목코드 체계가 문서에 없어 제외
- `src/lib/ekape/client.ts` — KAMIS와 달리 **기간 조회가 안 되고 하루당 1회 호출**해야 하는 API라, 날짜별로 개별 요청해서 모음 (동시성 8, 개별 날짜 실패는 건너뛰고 계속 진행). 응답이 XML이라 `fast-xml-parser` 사용, HTTPS 미지원 서버라 HTTP로만 통신
- `src/lib/catalog.ts`를 KAMIS/EKAPE 두 소스를 아우르는 판별 유니온(discriminated union)으로 재구성 — 슬러그는 `ekape-{judgeKind}-{itemCd}` 형태로 KAMIS와 구분
- 도매가 토글은 축산물 품목엔 안 보이게 처리 (축평원 API는 소비자가격 하나만 제공, 소매/도매 구분 없음)
- **버그 발견 및 수정**: 축평원은 KAMIS와 달리 **주말에도 실제로 조사**함(직접 확인). 기존 요일별 평균가 로직이 무조건 토·일을 "추정"으로 처리하던 걸, 실측 데이터가 있으면 그대로 쓰고 없을 때만 추정하도록 `stats.ts`의 `weekdayAverages`를 수정 (`estimated` 플래그로 구분)
- fast-xml-parser 관련 버그: 기본 설정(`parseTagValue: true`)이 응답의 `resultCode: "00"`을 숫자 `0`으로 바꿔버려 정상 응답을 오류로 오판하는 문제 발견 → `parseTagValue: false`로 해결
- **성능 이슈 발견 및 해결**: 처음엔 400일 백필로 로컬 26초, 프로덕션은 최대 56초까지 걸려 60초 함수 제한시간에 거의 다 닿았음. 원인 두 가지를 찾아 해결:
  1. Vercel 함수가 미국 버지니아(`iad1`) 리전에서 돌고 있어서 한국 정부 API 왕복 지연이 컸음 → `vercel.json`에 `"regions": ["icn1"]`(서울) 추가
  2. 그래도 EKAPE는 날짜당 1건씩 호출하는 구조라 근본적으로 느림 → 축산물 품목만 **400일 대신 100일**만 백필하도록 `sync.ts`에서 소스별로 분기 (작년 비교/작년 점선 라인은 데이터 부족으로 생략됨 — 계절성 품목과 같은 트레이드오프). 적용 후 실측 3~6초로 안정화

## 7. 추천하는 다음 순서

1. OCR/검색 매칭 정확도 개선 (품목이 더 늘어날 경우 자모 단위 매칭 등)
2. 계절성 품목의 "작년 라인 데이터 없음" 케이스 보완 (필요시 해당 품목만 더 넓게 백필)

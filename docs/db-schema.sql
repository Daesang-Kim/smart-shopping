-- 농수산물 가격 판단 앱 — DB 스키마 (Postgres / Supabase)
-- 설계 원칙: KAMIS/축평원 등 데이터 소스가 여러 개여도, daily_prices 이후의
-- 계산 로직(백분위, 요일평균, 전년비교)은 소스를 전혀 몰라도 되게 정규화한다.

create type item_category as enum ('농산물', '수산물', '축산물');
create type price_source as enum ('kamis', 'ekape');

-- 품목 마스터
create table items (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                  -- 표시명, 예: "삼겹살(냉장)"
  category      item_category not null,
  unit_label    text not null,                  -- 표시용, 예: "100g 기준"
  source        price_source not null,          -- 이 품목의 가격을 어디서 수집하는지
  -- 소스별로 조회에 필요한 파라미터 체계가 다름 (KAMIS: 품목/품종/등급코드 조합,
  -- 축평원: 축종코드 등 다른 체계) → 컬럼을 늘리는 대신 유연하게 jsonb에 저장.
  -- 예) KAMIS: {"itemcategorycode":"200","itemcode":"231","kindcode":"01","productrankcode":"04"}
  source_params jsonb not null,
  is_active     boolean not null default true,  -- cron 수집 대상 여부 (품목 추가/중단 시 토글)
  created_at    timestamptz not null default now()
);

-- 일별 소매가격 (정규화됨 — 소스 무관하게 동일한 형태)
create table daily_prices (
  id           bigint generated always as identity primary key,
  item_id      uuid not null references items(id) on delete cascade,
  price_date   date not null,
  retail_price numeric(12, 2) not null,
  created_at   timestamptz not null default now(),
  unique (item_id, price_date)  -- 같은 날짜 중복 저장 방지, cron 재실행 시 upsert 기준
);

create index idx_daily_prices_item_date on daily_prices (item_id, price_date desc);

-- cron 수집 이력 (운영/디버깅용 — 언제 어느 소스가 실패했는지 추적)
create table sync_runs (
  id            bigint generated always as identity primary key,
  source        price_source not null,
  run_date      date not null,
  status        text not null check (status in ('success', 'partial', 'failed')),
  items_synced  int not null default 0,
  error_message text,
  created_at    timestamptz not null default now()
);

-- cron이 "가장 오래 전에 갱신된 품목부터" 우선 처리할 수 있도록 갱신 시각을 기록한다.
-- (품목이 늘어날수록 한 번에 다 갱신하면 함수 제한시간을 넘기므로, 배치로 나눠 순환 갱신함)
alter table items add column last_synced_at timestamptz;

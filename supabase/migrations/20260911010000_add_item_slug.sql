-- 앱 코드(src/lib/items.ts)가 사용하는 안정적인 외부 식별자.
-- items.id(uuid)는 DB 내부 PK로 유지하고, slug로 upsert/조회한다.
alter table items add column slug text unique;

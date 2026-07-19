-- Persist official application timing separately from source freshness and policy expiration.

alter table public.policies
  add column if not exists application_period jsonb not null default '{}'::jsonb
  check (jsonb_typeof(application_period) = 'object');

update public.policies
set application_period = case id
  when 'k-pass' then '{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"상시 가입. K-패스 카드 발급 후 회원가입"}'::jsonb
  when 'climate-card' then '{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"상시 충전. 공식 안내에 따라 카드 발급·충전"}'::jsonb
  when 'jongno-bus-support' then '{"kind":"ongoing","startsAt":"2026-01-05T00:00:00+09:00","endsAt":null,"label":"2026년 1월부터 상시 신청"}'::jsonb
  when 'seoul-youth-monthly-rent-2026' then '{"kind":"closed","startsAt":null,"endsAt":"2026-05-19T18:00:00+09:00","label":"접수 종료"}'::jsonb
  when 'seoul-youth-allowance-2026-2nd' then '{"kind":"closed","startsAt":null,"endsAt":"2026-05-29T16:00:00+09:00","label":"접수 종료"}'::jsonb
  when 'youth-future-savings-2026' then '{"kind":"closed","startsAt":null,"endsAt":"2026-07-03T23:59:59+09:00","label":"1차 가입 신청 종료"}'::jsonb
  else application_period
end
where id in ('k-pass', 'climate-card', 'jongno-bus-support', 'seoul-youth-monthly-rent-2026', 'seoul-youth-allowance-2026-2nd', 'youth-future-savings-2026');
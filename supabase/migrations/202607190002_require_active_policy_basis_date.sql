-- Backfill the official basis/effective dates verified for existing active seed records.
-- A policy without an official basis date must remain in needs_review or expired status.

update public.policies
set source_published_at = case id
  when 'k-pass' then '2026-04-01T00:00:00+09:00'::timestamptz
  when 'climate-card' then '2026-06-08T00:00:00+09:00'::timestamptz
  when 'jongno-bus-support' then '2026-01-05T00:00:00+09:00'::timestamptz
  else source_published_at
end
where id in ('k-pass', 'climate-card', 'jongno-bus-support')
  and source_published_at is null;

update public.policies
set status = 'needs_review'
where status = 'active'
  and source_published_at is null;

alter table public.policies
  add constraint active_policies_require_source_basis_date
  check (status <> 'active' or source_published_at is not null);
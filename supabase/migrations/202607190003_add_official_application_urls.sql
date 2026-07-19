-- Keep the official source notice separate from the official online application or enrollment route.
-- When an institution offers no separate online route, application_url remains null and the UI links only to the official guidance.

alter table public.policies
  add column if not exists application_url text
  check (application_url is null or application_url ~ '^https://');

update public.policies
set application_url = case id
  when 'k-pass' then 'https://korea-pass.kr/join/join.do'
  when 'jongno-bus-support' then 'https://tbokji.tmoney.co.kr/jongno'
  else application_url
end
where id in ('k-pass', 'jongno-bus-support')
  and application_url is null;
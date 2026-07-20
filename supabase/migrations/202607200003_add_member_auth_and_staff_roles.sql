-- Member accounts and stakeholder access for Bridge Youth.
-- Run after the existing Bridge Youth migrations.

create table if not exists public.member_role_allowlist (
  email text primary key check (email = lower(email)),
  role text not null check (role in ('staff', 'admin')),
  created_at timestamptz not null default now()
);

insert into public.member_role_allowlist (email, role)
values ('thgus6688@gmail.com', 'staff')
on conflict (email) do update set role = excluded.role;

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique check (email = lower(email)),
  nickname text not null check (char_length(nickname) between 2 and 40),
  role text not null default 'member' check (role in ('member', 'staff', 'admin')),
  consented_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.member_role_allowlist enable row level security;
alter table public.member_profiles enable row level security;

create or replace function public.handle_new_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
begin
  select role into assigned_role
  from public.member_role_allowlist
  where email = lower(new.email);

  insert into public.member_profiles (id, email, nickname, role, consented_at)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), split_part(new.email, '@', 1)),
    coalesce(assigned_role, 'member'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created_member_profile'
      and tgrelid = 'auth.users'::regclass
      and not tgisinternal
  ) then
    create trigger on_auth_user_created_member_profile
      after insert on auth.users
      for each row execute procedure public.handle_new_member_profile();
  end if;
end;
$$;

insert into public.member_profiles (id, email, nickname, role, consented_at)
select
  users.id,
  lower(users.email),
  coalesce(nullif(trim(users.raw_user_meta_data ->> 'nickname'), ''), split_part(users.email, '@', 1)),
  coalesce(allowlist.role, 'member'),
  coalesce(users.created_at, now())
from auth.users as users
left join public.member_role_allowlist as allowlist on allowlist.email = lower(users.email)
where users.email is not null
on conflict (id) do update
set role = excluded.role,
    email = excluded.email,
    updated_at = now();
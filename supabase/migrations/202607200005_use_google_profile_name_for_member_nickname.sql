-- Use the verified Google profile name as the initial nickname for Google OAuth members.
-- Existing generated member IDs remain internal IDs; this migration only updates generated display nicknames.

create or replace function public.handle_new_member_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assigned_role text;
  profile_nickname text;
begin
  select role into assigned_role
  from public.member_role_allowlist
  where email = lower(new.email);

  if coalesce(new.raw_app_meta_data ->> 'provider', '') = 'google' then
    profile_nickname := coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'given_name'), '')
    );
  else
    profile_nickname := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');
  end if;

  if char_length(coalesce(profile_nickname, '')) < 2 then
    profile_nickname := split_part(lower(new.email), '@', 1);
  end if;
  profile_nickname := left(profile_nickname, 40);
  if char_length(profile_nickname) < 2 then
    profile_nickname := 'member_' || replace(new.id::text, '-', '');
  end if;

  insert into public.member_profiles (id, email, nickname, role, consented_at)
  values (
    new.id,
    lower(new.email),
    profile_nickname,
    coalesce(assigned_role, 'member'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

update public.member_profiles as profile
set nickname = left(
      coalesce(
        nullif(trim(users.raw_user_meta_data ->> 'full_name'), ''),
        nullif(trim(users.raw_user_meta_data ->> 'name'), ''),
        nullif(trim(users.raw_user_meta_data ->> 'given_name'), ''),
        split_part(lower(users.email), '@', 1)
      ),
      40
    ),
    updated_at = now()
from auth.users as users
where profile.id = users.id
  and coalesce(users.raw_app_meta_data ->> 'provider', '') = 'google';
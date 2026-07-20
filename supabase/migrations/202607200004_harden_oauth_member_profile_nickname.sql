-- Ensure OAuth-created member profiles always satisfy the nickname constraint.
-- This migration only replaces the profile-creation function; it does not delete data.

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

  profile_nickname := nullif(trim(new.raw_user_meta_data ->> 'nickname'), '');
  if char_length(coalesce(profile_nickname, '')) < 2 or char_length(profile_nickname) > 40 then
    profile_nickname := '회원_' || substr(new.id::text, 1, 8);
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
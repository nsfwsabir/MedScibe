-- Profiles table for cloud-synced user profile (displayName, specialty, etc.)
-- Extends local SecureStore profile with Supabase persistence.

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  specialty text,
  phone text,
  clinic_name text,
  updated_at timestamptz default now()
);

alter table profiles enable row level security;

drop policy if exists "users can manage own profile" on profiles;
create policy "users can manage own profile"
on profiles for all
using (id = auth.uid())
with check (id = auth.uid());

create or replace function set_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute function set_profiles_updated_at();

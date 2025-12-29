-- 1. Ensure the column exists
alter table public.profiles 
add column if not exists language_preference text default 'English';

-- 2. Enable RLS (just in case)
alter table public.profiles enable row level security;

-- 3. Drop existing update policy to avoid conflicts (if named this way)
drop policy if exists "Users can update own profile" on public.profiles;

-- 4. Create explicit UPDATE policy
create policy "Users can update own profile"
on public.profiles
for update
using ( auth.uid() = id );

-- 5. Grant permissions to authenticated users
grant update (language_preference) on public.profiles to authenticated;

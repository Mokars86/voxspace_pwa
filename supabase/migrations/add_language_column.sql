-- Add language_preference column to profiles if it doesn't exist
alter table public.profiles 
add column if not exists language_preference text default 'English';

-- Policy is likely already covering updates for user's own profile, but good to ensure.
-- (Assuming standard CRUD policies exist from auth template)

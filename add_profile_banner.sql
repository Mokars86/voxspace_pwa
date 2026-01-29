-- Add banner_url to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS banner_url text;

-- Verify
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' AND column_name = 'banner_url';

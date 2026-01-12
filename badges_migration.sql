
-- Add badge_type column to profiles if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'badge_type') THEN 
        ALTER TABLE public.profiles ADD COLUMN badge_type text CHECK (badge_type IN ('blue', 'creator', 'business', 'elite', 'education', 'founder'));
    END IF; 
END $$;

-- Assign Founder Badge to 'Mubarik Tuahir Ali' and 'Kausara Mohammed'
-- Note: This assumes 'full_name' matches exactly. In a real scenario we'd use IDs or emails if possible.
UPDATE public.profiles
SET badge_type = 'founder'
WHERE full_name IN ('Mubarik Tuahir Ali', 'Kausara Mohammed');

-- Verify the update
SELECT full_name, badge_type FROM public.profiles WHERE badge_type = 'founder';

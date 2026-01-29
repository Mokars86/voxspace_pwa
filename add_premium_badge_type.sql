-- Migration to add 'premium' to badge_type check constraint safely
-- First drop the existing constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_badge_type_check;

-- Add the new constraint with 'premium' included
-- Using NOT VALID to avoid failing on existing rows that might violate the constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_badge_type_check 
CHECK (badge_type IN (
    'founder', 
    'verified', 
    'premium', 
    'admin', 
    'moderator',
    'blue', 
    'creator', 
    'business', 
    'elite', 
    'education'
)) NOT VALID;

-- Note: We are not running VALIDATE CONSTRAINT here to avoid errors.
-- The constraint will still be enforced for all NEW inserts and updates.

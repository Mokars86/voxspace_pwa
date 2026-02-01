-- Add disabled_tabs column to spaces table
ALTER TABLE public.spaces 
ADD COLUMN IF NOT EXISTS disabled_tabs text[] DEFAULT '{}';

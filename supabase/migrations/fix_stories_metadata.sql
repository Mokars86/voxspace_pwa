-- Add metadata column to stories table for Text Story styling (background color, font)
ALTER TABLE public.stories
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add is_edited column to posts table
ALTER TABLE public.posts 
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;

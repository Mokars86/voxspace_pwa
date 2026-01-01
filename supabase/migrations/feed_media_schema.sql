-- Add media_type and location to posts
alter table public.posts 
add column if not exists media_type text default 'image' check (media_type in ('image', 'audio', 'video')),
add column if not exists location jsonb; -- { lat: number, lng: number, name: string }

-- Allow audio uploads in storage (reuse post_media bucket)
-- Policies are already on 'post_media', so we just need to ensure client uploads to correct folders if we want organization,
-- but for granular RLS, the existing policy is bucket-wide which is fine for now.

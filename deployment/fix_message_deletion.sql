-- 1. Add missing columns to messages table
alter table public.messages 
add column if not exists is_deleted boolean default false,
add column if not exists is_pinned boolean default false,
add column if not exists is_edited boolean default false,
add column if not exists is_viewed boolean default false,
add column if not exists expires_at timestamp with time zone;

-- 2. Message Table Policies
-- Enable Update (for Soft Delete/Edit/Pin)
drop policy if exists "Users can update their own messages" on public.messages;
create policy "Users can update their own messages"
on public.messages for update
using ( auth.uid() = sender_id );

-- 3. Storage Policies (for Media cleanup)
-- Bucket: chat-attachments

-- Allow Uploads
drop policy if exists "Users can upload chat attachments" on storage.objects;
create policy "Users can upload chat attachments"
on storage.objects for insert
with check ( bucket_id = 'chat-attachments' and auth.uid() = owner );

-- Allow Deletion (Cleanup)
drop policy if exists "Users can delete own chat attachments" on storage.objects;
create policy "Users can delete own chat attachments"
on storage.objects for delete
using ( bucket_id = 'chat-attachments' and auth.uid() = owner );

-- Allow Visuals (Read)
drop policy if exists "Anyone can view chat attachments" on storage.objects;
create policy "Anyone can view chat attachments"
on storage.objects for select
using ( bucket_id = 'chat-attachments' );

-- 4. Verification
do $$
begin
  raise notice 'Message schema and Storage policies updated successfully.';
end $$;

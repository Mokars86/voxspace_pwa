-- Add last_read_at to chat_participants if it doesn't exist
alter table public.chat_participants 
add column if not exists last_read_at timestamp with time zone default now();

-- Function to get unread counts for a user
-- Returns chat_id and the count of unread messages
create or replace function public.get_unread_counts(p_user_id uuid)
returns table (chat_id uuid, unread_count bigint) as $$
begin
  return query
  select 
    m.chat_id,
    count(m.id) as unread_count
  from 
    public.messages m
  join 
    public.chat_participants cp on m.chat_id = cp.chat_id
  where 
    cp.user_id = p_user_id -- Scope to specific user's participations
    and m.created_at > cp.last_read_at -- Count messages newer than last read
    and m.sender_id != p_user_id -- Ignore own messages
  group by 
    m.chat_id;
end;
$$ language plpgsql security definer;

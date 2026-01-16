-- Enable Realtime for critical tables
-- This ensures that the client receives 'INSERT' and 'UPDATE' events instantly.

-- Add 'messages' to realtime publication
alter publication supabase_realtime add table public.messages;

-- Add 'chat_participants' (for typing indicators / read receipts tracking if logic uses DB)
alter publication supabase_realtime add table public.chat_participants;

-- Add 'notifications' (for global notification bell)
alter publication supabase_realtime add table public.notifications;

-- Add 'message_reactions' (for instant emoji updates)
alter publication supabase_realtime add table public.message_reactions;

-- Verify
do $$
begin
  raise notice 'Realtime replication enabled for messages, chat_participants, notifications, and message_reactions.';
end $$;

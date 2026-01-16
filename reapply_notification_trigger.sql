-- Re-apply Notification Trigger
-- Run this to ensure the database is definitely trying to call the Edge Function.

create extension if not exists "pg_net";

create or replace function public.handle_new_message_notification()
returns trigger as $$
begin
  -- Call the Edge Function using pg_net
  -- We use a fire-and-forget approach (timeout 2s) to not slow down the chat
  perform
    net.http_post(
      url := 'https://ogjydrxxglkgvocqywzb.supabase.co/functions/v1/push-notification',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object(
        'record', row_to_json(new),
        'type', 'INSERT',
        'table', 'messages',
        'schema', 'public'
      ),
      timeout_milliseconds := 2000
    );
    
  return new;
end;
$$ language plpgsql security definer;

-- Drop and Recreate Trigger
drop trigger if exists on_new_message_push on public.messages;

create trigger on_new_message_push
  after insert on public.messages
  for each row execute procedure public.handle_new_message_notification();

-- Log for verification
do $$
begin
  raise notice 'Notification Trigger re-applied successfully.';
end $$;

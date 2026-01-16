-- Enable the pg_net extension to allow making HTTP requests
create extension if not exists "pg_net";

-- Create the function that calls the Edge Function
create or replace function public.handle_new_message_notification()
returns trigger as $$
begin
  -- Call the Edge Function using pg_net
  perform
    net.http_post(
      url := 'https://ogjydrxxglkgvocqywzb.supabase.co/functions/v1/push-notification',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nanlkcnh4Z2xrZ3ZvY3F5d3piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4NTc3MTgsImV4cCI6MjA4MjQzMzcxOH0.FhhBvTZYuAn8jiWeDU7jqZze5lH3cJc-8unwvG0ZwGU"}'::jsonb,
      body := jsonb_build_object(
        'record', row_to_json(new),
        'type', 'INSERT',
        'table', 'messages',
        'schema', 'public'
      )
    );
    
  return new;
end;
$$ language plpgsql security definer;

-- Drop the trigger if it exists to avoid duplicates
drop trigger if exists on_new_message_push on public.messages;

-- Create the Trigger to fire on every new message
create trigger on_new_message_push
  after insert on public.messages
  for each row execute procedure public.handle_new_message_notification();

-- Verification Log
do $$
begin
  raise notice 'Webhook trigger created successfully. Attempts to insert into messages will now trigger the Edge Function.';
end $$;

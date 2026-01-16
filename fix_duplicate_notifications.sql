-- Fix Duplicate Notifications
-- This script does the following:
-- 1. Drops all known variations of message triggers to eliminate duplicates.
-- 2. Redefines the `handle_new_message_notification` function to perform TWO actions:
--    a. Insert into the `notifications` table (for in-app history).
--    b. Send ONE webhook to the Edge Function (for Push Notifications).
-- 3. Creates a single, unified trigger `on_message_created`.

-- Step 1: Drop existing triggers (Clean State)
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;
DROP TRIGGER IF EXISTS on_new_message_notification ON public.messages;
DROP TRIGGER IF EXISTS on_message_insert ON public.messages;

-- Step 2: Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Step 3: Define the consolidated function
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  participant record;
BEGIN
  -- Action A: Insert into notifications table (Restores in-app notification history)
  -- Iterate through recipients (everyone in chat except sender)
  FOR participant IN SELECT user_id FROM public.chat_participants WHERE chat_id = new.chat_id AND user_id != new.sender_id
  LOOP
    INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
    VALUES (
      participant.user_id,
      new.sender_id,
      'message',
      'New Message',
      left(new.content, 50), -- Preview content
      jsonb_build_object('chat_id', new.chat_id, 'message_id', new.id)
    );
  END LOOP;

  -- Action B: Send Webhook to Edge Function (Triggers Push Notification)
  -- The Edge Function handles looking up FCM tokens for all participants.
  PERFORM
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
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 4: Create the Single Trigger
CREATE TRIGGER on_message_created
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_message_notification();

-- Verification Log
DO $$
BEGIN
  RAISE NOTICE 'Duplicate triggers dropped. Unified trigger on_message_created created successfully.';
END $$;

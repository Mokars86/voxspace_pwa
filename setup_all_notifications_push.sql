-- Enable Push Notifications for General Notifications (Feed, Space, etc.)
-- This script ensures that ANY insert into the 'notifications' table triggers the edge function.
-- This effectively covers Feed Posts, Space Posts, Comments, Likes, etc.

CREATE OR REPLACE FUNCTION public.handle_general_notification_push()
RETURNS TRIGGER AS $$
BEGIN
  -- We use net.http_post to call the Edge Function.
  PERFORM
    net.http_post(
      -- URL for your specific project's function
      url := 'https://ogjydrxxglkgvocqywzb.supabase.co/functions/v1/push-notification',
      
      -- Standard headers
      headers := '{"Content-Type": "application/json"}'::jsonb,
      
      -- Payload: send the new record
      body := jsonb_build_object(
        'record', row_to_json(new),
        'type', 'INSERT',
        'table', 'notifications',
        'schema', 'public'
      )
    );
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the notifications table
DROP TRIGGER IF EXISTS on_general_notification_push ON public.notifications;

CREATE TRIGGER on_general_notification_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_general_notification_push();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'General notification push trigger set up successfully.';
END $$;

-- Enable the pg_net extension to make HTTP requests
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create the function that triggers the webhook
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- We use net.http_post to call the Edge Function.
  -- Since we deployed with --no-verify-jwt, we don't strictly need a valid Authorization header for the function itself to accept the request,
  -- but we'll include a dummy one or you can replace with your ANON key if you prefer standard security.
  
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
        'table', 'messages',
        'schema', 'public'
      )
    );
    
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the messages table
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;

CREATE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_message_notification();

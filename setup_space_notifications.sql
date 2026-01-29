-- Setup Space Notifications
-- This script creates triggers to notify space members when new posts or events are created.

-- Function to handle new space posts
CREATE OR REPLACE FUNCTION public.handle_new_space_post()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if it is a space post
  IF NEW.space_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
    SELECT 
      sm.user_id,
      NEW.user_id,
      'space_post',
      'New Post in Space',
      LEFT(NEW.content, 50),
      jsonb_build_object('space_id', NEW.space_id, 'post_id', NEW.id)
    FROM public.space_members sm
    WHERE sm.space_id = NEW.space_id 
      AND sm.user_id != NEW.user_id -- Don't notify the author
      AND sm.status = 'approved'; -- Only notify approved members
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Space Posts
DROP TRIGGER IF EXISTS on_space_post_created ON public.posts;
CREATE TRIGGER on_space_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_space_post();


-- Function to handle new space events
CREATE OR REPLACE FUNCTION public.handle_new_space_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
  SELECT 
    sm.user_id,
    NEW.created_by,
    'space_event',
    'New Event: ' || NEW.title,
    LEFT(NEW.description, 50),
    jsonb_build_object('space_id', NEW.space_id, 'event_id', NEW.id)
  FROM public.space_members sm
  WHERE sm.space_id = NEW.space_id 
    AND sm.user_id != NEW.created_by -- Don't notify the creator
    AND sm.status = 'approved';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Space Events
-- Note: Assuming table is named 'space_events' based on frontend usage
DROP TRIGGER IF EXISTS on_space_event_created ON public.space_events;
CREATE TRIGGER on_space_event_created
  AFTER INSERT ON public.space_events
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_space_event();

-- Log success
DO $$
BEGIN
  RAISE NOTICE 'Space notification triggers set up successfully.';
END $$;

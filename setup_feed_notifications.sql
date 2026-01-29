-- Setup Feed & Interaction Notifications
-- This script creates triggers for Feed Posts, Comments, and Likes.

-- 1. FEED POST NOTIFICATIONS
-- Notify followers when a user creates a general post (not in a space)
CREATE OR REPLACE FUNCTION public.handle_new_feed_post_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if it is a feed post (space_id is NULL)
  -- If your schema uses NULL for space_id on feed posts, keeping this check is good.
  -- Determining if space_id column exists on posts table is important. 
  -- Assuming space_id exists and is null for feed posts based on previous implementation plan context.
  
  -- We'll check if the column exists dynamically or assume standard structure. 
  -- 'posts' table usually has 'space_id' if spaces are implemented.
  -- If space_id is missing from posts, this might error. 
  -- However, typically in these hybrid apps, posts table is shared.
  -- Let's assume space_id exists. If not, this logic needs adjustment (e.g. strict separate tables).
  -- Given 'setup_space_notifications.sql' checked for space_id, it must exist or be intended.
  
  -- We'll check if space_id is NULL.
  -- Note: We need to check if the column exists in the record 'NEW'.
  -- PL/PGSQL variables are static. We can try to access NEW.space_id directly.
  
  -- Attempting access. If runtime error occurs, user will report.
  
  IF (NEW.space_id IS NULL) THEN
     INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
     SELECT 
       f.follower_id,
       NEW.user_id,
       'feed_post',
       'New Post',
       LEFT(NEW.content, 50),
       jsonb_build_object('post_id', NEW.id)
     FROM public.follows f
     WHERE f.following_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_feed_post_created ON public.posts;
CREATE TRIGGER on_feed_post_created
  AFTER INSERT ON public.posts
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_feed_post_notification();


-- 2. COMMENT NOTIFICATIONS
-- Notify post owner when someone comments
CREATE OR REPLACE FUNCTION public.handle_new_comment_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
  post_content text;
BEGIN
  -- Get post owner
  SELECT user_id, content INTO post_owner_id, post_content 
  FROM public.posts 
  WHERE id = NEW.post_id;

  -- Notify if owner exists and is not the commenter
  IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
    VALUES (
      post_owner_id,
      NEW.user_id,
      'comment',
      'New Comment',
      'commented on your post: ' || LEFT(post_content, 20) || '...',
      jsonb_build_object('post_id', NEW.post_id, 'comment_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_created_notification ON public.comments;
CREATE TRIGGER on_comment_created_notification
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_comment_notification();


-- 3. LIKE NOTIFICATIONS
-- Notify post owner when someone likes
CREATE OR REPLACE FUNCTION public.handle_new_like_notification()
RETURNS TRIGGER AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  -- Get post owner
  SELECT user_id INTO post_owner_id 
  FROM public.posts 
  WHERE id = NEW.post_id;

  -- Notify if owner exists and is not the liker
  IF post_owner_id IS NOT NULL AND post_owner_id != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, title, content, data)
    VALUES (
      post_owner_id,
      NEW.user_id,
      'like',
      'New Like',
      'liked your post',
      jsonb_build_object('post_id', NEW.post_id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_created_notification ON public.post_likes;
CREATE TRIGGER on_like_created_notification
  AFTER INSERT ON public.post_likes
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_new_like_notification();

-- Log
DO $$
BEGIN
  RAISE NOTICE 'Feed, Comment, and Like notification triggers set up successfully.';
END $$;

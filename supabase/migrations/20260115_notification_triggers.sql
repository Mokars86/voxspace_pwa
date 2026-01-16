-- Database triggers to populate the notifications table

-- 1. Helper function to insert notification safely
create or replace function public.create_notification(
  p_user_id uuid,
  p_actor_id uuid,
  p_type text,
  p_title text,
  p_content text,
  p_data jsonb
) returns void as $$
begin
  if p_user_id != p_actor_id then
    insert into public.notifications (user_id, actor_id, type, title, content, data)
    values (p_user_id, p_actor_id, p_type, p_title, p_content, p_data);
  end if;
end;
$$ language plpgsql security definer;

-- 2. Trigger for New Comments
create or replace function public.handle_new_comment_notification()
returns trigger as $$
declare
  post_author_id uuid;
  commenter_name text;
begin
  select user_id into post_author_id from public.posts where id = new.post_id;
  select full_name into commenter_name from public.profiles where id = new.user_id;

  if post_author_id is not null then
    perform public.create_notification(
      post_author_id,
      new.user_id,
      'comment', -- or 'message' if you want it keyed as message, but 'comment' is better for filtering
      'New Comment',
      coalesce(commenter_name, 'Someone') || ' commented on your post',
      jsonb_build_object('post_id', new.post_id, 'comment_id', new.id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_comment_notification on public.comments;
create trigger on_comment_notification
  after insert on public.comments
  for each row execute procedure public.handle_new_comment_notification();


-- 3. Trigger for Post Likes
create or replace function public.handle_post_like_notification()
returns trigger as $$
declare
  post_author_id uuid;
  liker_name text;
begin
  select user_id into post_author_id from public.posts where id = new.post_id;
  select full_name into liker_name from public.profiles where id = new.user_id;

  if post_author_id is not null then
     perform public.create_notification(
      post_author_id,
      new.user_id,
      'like',
      'New Like',
      coalesce(liker_name, 'Someone') || ' liked your post',
      jsonb_build_object('post_id', new.post_id)
    );
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_post_like_notification on public.post_likes;
create trigger on_post_like_notification
  after insert on public.post_likes
  for each row execute procedure public.handle_post_like_notification();


-- 4. Trigger for Follows
create or replace function public.handle_follow_notification()
returns trigger as $$
declare
  follower_name text;
begin
  select full_name into follower_name from public.profiles where id = new.follower_id;

  perform public.create_notification(
    new.following_id,
    new.follower_id,
    'follow',
    'New Follower',
    coalesce(follower_name, 'Someone') || ' started following you',
    jsonb_build_object('follower_id', new.follower_id)
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_follow_notification on public.follows;
create trigger on_follow_notification
  after insert on public.follows
  for each row execute procedure public.handle_follow_notification();

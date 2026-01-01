-- COMMENTS Table (Supports nesting via parent_id)
create table if not exists public.comments (
  id uuid default uuid_generate_v4() primary key,
  post_id uuid references public.posts(id) on delete cascade not null,
  user_id uuid references public.profiles(id) not null,
  parent_id uuid references public.comments(id) on delete cascade, -- Null for top-level, set for replies
  content text not null,
  likes_count bigint default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Comments
alter table public.comments enable row level security;
create policy "Comments are viewable by everyone" on public.comments for select using (true);
create policy "Authenticated users can comment" on public.comments for insert with check (auth.role() = 'authenticated');
create policy "Users can delete own comments" on public.comments for delete using (auth.uid() = user_id);

-- COMMENT LIKES
create table if not exists public.comment_likes (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null,
  comment_id uuid references public.comments(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, comment_id)
);

alter table public.comment_likes enable row level security;
create policy "Comment likes viewable by everyone" on public.comment_likes for select using (true);
create policy "Authenticated users can like comments" on public.comment_likes for insert with check (auth.role() = 'authenticated');
create policy "Users can unlike comments" on public.comment_likes for delete using (auth.uid() = user_id);

-- Trigger: Increment Post Comment Count
create or replace function public.handle_new_comment()
returns trigger as $$
begin
  update public.posts
  set comments_count = comments_count + 1
  where id = new.post_id;
  
  -- Notification for Post Author (if not self)
  -- (We can add this later or integrate with notification system)
  
  return new;
end;
$$ language plpgsql security definer;

create trigger on_comment_created
  after insert on public.comments
  for each row execute procedure public.handle_new_comment();

-- Trigger: Decrement Post Comment Count
create or replace function public.handle_delete_comment()
returns trigger as $$
begin
  update public.posts
  set comments_count = comments_count - 1
  where id = old.post_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_comment_deleted
  after delete on public.comments
  for each row execute procedure public.handle_delete_comment();

-- Trigger: Comment Likes
create or replace function public.handle_comment_like()
returns trigger as $$
begin
  update public.comments
  set likes_count = likes_count + 1
  where id = new.comment_id;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_comment_like
  after insert on public.comment_likes
  for each row execute procedure public.handle_comment_like();

create or replace function public.handle_comment_unlike()
returns trigger as $$
begin
  update public.comments
  set likes_count = likes_count - 1
  where id = old.comment_id;
  return old;
end;
$$ language plpgsql security definer;

create trigger on_comment_unlike
  after delete on public.comment_likes
  for each row execute procedure public.handle_comment_unlike();

-- STORAGE POLICIES for 'post_media'
-- Ensure authenticated users can upload
create policy "Authenticated users can upload post media"
on storage.objects for insert
with check ( bucket_id = 'post_media' and auth.role() = 'authenticated' );

create policy "Anyone can view post media"
on storage.objects for select
using ( bucket_id = 'post_media' );

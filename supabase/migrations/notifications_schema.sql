-- Create Notifications Table
create table if not exists public.notifications (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) not null, -- Who receives the notification
  actor_id uuid references public.profiles(id),          -- Who caused it (e.g. sender)
  type text not null, -- 'message', 'like', 'follow', 'system'
  title text,
  content text,
  data jsonb, -- Extra data like { chat_id: ... }
  is_read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.notifications enable row level security;

create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications (mark as read)"
  on public.notifications for update
  using (auth.uid() = user_id);

-- TRIGGER: New Message Notification
create or replace function public.handle_new_message_notification()
returns trigger as $$
declare
  participant record;
begin
  -- For every participant in the chat (EXCEPT the sender), create a notification
  for participant in select user_id from public.chat_participants where chat_id = new.chat_id and user_id != new.sender_id
  loop
    insert into public.notifications (user_id, actor_id, type, title, content, data)
    values (
      participant.user_id,
      new.sender_id,
      'message',
      'New Message',
      left(new.content, 50), -- Preview content
      jsonb_build_object('chat_id', new.chat_id, 'message_id', new.id)
    );
  end loop;
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists to avoid duplication errors on re-run
drop trigger if exists on_new_message_notification on public.messages;

create trigger on_new_message_notification
  after insert on public.messages
  for each row execute procedure public.handle_new_message_notification();

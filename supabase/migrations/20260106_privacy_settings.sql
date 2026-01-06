-- Add privacy settings to profiles
alter table public.profiles
add column if not exists last_seen_at timestamp with time zone,
add column if not exists last_seen_privacy text default 'everyone' check (last_seen_privacy in ('everyone', 'contacts', 'nobody')),
add column if not exists profile_photo_privacy text default 'everyone' check (profile_photo_privacy in ('everyone', 'contacts', 'nobody')),
add column if not exists about_privacy text default 'everyone' check (about_privacy in ('everyone', 'contacts', 'nobody')),
add column if not exists online_status_privacy text default 'everyone' check (online_status_privacy in ('everyone', 'contacts', 'nobody'));

-- Blocked Users Table
create table if not exists public.blocked_users (
    blocker_id uuid references public.profiles(id) on delete cascade not null,
    blocked_id uuid references public.profiles(id) on delete cascade not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (blocker_id, blocked_id)
);

-- RLS for blocked_users
alter table public.blocked_users enable row level security;

create policy "Users can view who they blocked"
on public.blocked_users for select
using (auth.uid() = blocker_id);

create policy "Users can block others"
on public.blocked_users for insert
with check (auth.uid() = blocker_id);

create policy "Users can unblock others"
on public.blocked_users for delete
using (auth.uid() = blocker_id);

-- Function to check if blocked (Bidirectional check helper maybe? No, strict check)
create or replace function public.is_blocked(blocker uuid, blocked uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.blocked_users
    where blocker_id = blocker and blocked_id = blocked
  );
end;
$$ language plpgsql security definer;

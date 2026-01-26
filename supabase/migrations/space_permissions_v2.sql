-- Migration: Space Permissions V2
-- Adds role and status to space_members and enforce approval logic

-- 1. Add new columns if they don't exist
do $$
begin
    if not exists (select 1 from information_schema.columns where table_name = 'space_members' and column_name = 'role') then
        alter table public.space_members add column role text default 'member';
    end if;

    if not exists (select 1 from information_schema.columns where table_name = 'space_members' and column_name = 'status') then
        alter table public.space_members add column status text default 'pending';
    end if;
end $$;

-- 2. Backfill existing members
-- Set existing members to 'approved' and 'member' (or 'admin' for owners if we can track that, but for now 'member' is safe + owner check exists in code)
-- Actually, we should set status to 'approved' for all currently existing rows so they don't lose access
update public.space_members 
set status = 'approved' 
where status = 'pending' AND joined_at < now(); 

-- Optimization: Set the space OWNER as 'admin' in space_members (if they are in there)
update public.space_members sm
set role = 'admin', status = 'approved'
from public.spaces s
where sm.space_id = s.id AND sm.user_id = s.owner_id;

-- 3. Update RLS Policies

-- Drop old policies to avoid conflicts
drop policy if exists "Authenticated users can join spaces" on public.space_members;
drop policy if exists "Members can send messages" on public.space_messages;
drop policy if exists "Authenticated users can send messages" on public.space_messages;

-- A. "Authenticated users can REQUEST to join spaces" (Initial Insert)
create policy "Authenticated users can request to join" 
on public.space_members for insert 
with check (
    auth.role() = 'authenticated' AND
    auth.uid() = user_id
    -- Logic: You can only insert yourself. Status defaults to 'pending' in DB definition or client sends 'pending'
);

-- B. "Admins/Co-Admins can update member status/role"
create policy "Admins can update members" 
on public.space_members for update 
using (
    exists (
        select 1 from public.space_members as admins
        where admins.space_id = space_members.space_id
        and admins.user_id = auth.uid()
        and admins.role in ('admin', 'co_admin')
        and admins.status = 'approved'
    )
    OR
    exists (
        select 1 from public.spaces s
        where s.id = space_members.space_id
        and s.owner_id = auth.uid()
    )
);

-- C. "Admins/Co-Admins can delete members (kick/reject)"
create policy "Admins can remove members" 
on public.space_members for delete 
using (
    (auth.uid() = user_id) -- Users can leave
    OR
    exists (
        select 1 from public.space_members as admins
        where admins.space_id = space_members.space_id
        and admins.user_id = auth.uid()
        and admins.role in ('admin', 'co_admin')
        and admins.status = 'approved'
    )
    OR
    exists (
        select 1 from public.spaces s
        where s.id = space_members.space_id
        and s.owner_id = auth.uid()
    )
);


-- D. "Only APPROVED members can send messages"
create policy "Approved members can send messages" 
on public.space_messages for insert 
with check (
    auth.role() = 'authenticated' AND 
    sender_id = auth.uid() AND
    exists (
        select 1 from public.space_members 
        where space_id = space_messages.space_id 
        and user_id = auth.uid()
        and status = 'approved'
    )
    )
);

-- E. "Restricting POSTS creation"
-- Drop old broad policy if it exists (check name from schema)
drop policy if exists "Authenticated users can create posts." on public.posts;

-- New Policy: Global Feed Posts (Where space_id is NULL)
create policy "Users can create public posts"
on public.posts for insert
with check (
    auth.role() = 'authenticated' AND
    space_id IS NULL
);

-- New Policy: Space Posts (Where space_id is NOT NULL)
create policy "Members can post in spaces"
on public.posts for insert
with check (
    auth.role() = 'authenticated' AND
    space_id IS NOT NULL AND
    exists (
        select 1 from public.space_members
        where space_id = posts.space_id
        and user_id = auth.uid()
        and status = 'approved'
    )
);

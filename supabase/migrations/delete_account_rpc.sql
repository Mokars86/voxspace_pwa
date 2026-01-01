-- Create a function to allow users to delete their own account
create or replace function delete_user_account()
returns void
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
begin
  -- Get the ID of the authenticated user
  current_user_id := auth.uid();
  
  -- Check if user is logged in
  if current_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete from public.profiles (should cascade if foreign keys are set up, but safe to be explicit)
  delete from public.profiles where id = current_user_id;

  -- Delete from auth.users
  -- Note: This requires the function to be security definer and the postgres role to have permissions
  -- or for this to be run by a service role. 
  -- However, a user deleting themselves is a special case. 
  -- Usually, we need to allow the postgres role to delete from auth.users or use a specific RPC.
  
  -- IMPORTANT: Standard supabase users cannot delete from auth.users directly even with RLS.
  -- This function MUST be called with a role that has permission, or we assume the standard
  -- setup where `delete from auth.users` works for the user themselves if configured, 
  -- BUT usually it doesn't.
  
  -- A safer way in Supabase is typically to use the Service Role API from the client (dangerous) 
  -- OR have this RPC run as SECURITY DEFINER which runs as the owner (postgres).
  
  delete from auth.users where id = current_user_id;
end;
$$;

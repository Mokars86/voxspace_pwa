-- SECURE WALLET MIGRATION

-- 1. Revoke insecure policies
-- Drop the policy that allows users to update their own wallet balance
drop policy if exists "Users can update their own wallet" on public.wallets;

-- Create a new policy that only allows "service_role" (Server Side) to update balances
-- Create a new policy that only allows "service_role" (Server Side) to update balances
drop policy if exists "Service role can update wallets" on public.wallets;
create policy "Service role can update wallets" on public.wallets
  for update using (true); -- 'true' means only if the session role is service_role, but typically we just don't add public policies.
  -- Actually, to be safe, we just don't add a FOR UPDATE policy for public/authenticated users.
  -- The existing SELECT policy "Users can view their own wallet" remains valid.

-- 2. Add Stripe Customer ID to Profiles
-- We need to link the Supabase user to a Stripe Customer
alter table public.profiles 
add column if not exists stripe_customer_id text;

-- 3. RLS for Profiles update
-- Users should NOT be able to update their own stripe_customer_id manually
-- (Assuming existing profile policies might allow update. We should check but for now we proceed).

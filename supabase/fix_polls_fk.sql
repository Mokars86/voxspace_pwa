-- Drop the old constraint to auth.users if we want, or just add a new one?
-- PostgREST needs a FK to the target table to perform the join embedding.
-- We want to join 'profiles' using 'created_by'.

ALTER TABLE space_polls
  DROP CONSTRAINT IF EXISTS space_polls_created_by_fkey; -- Removing explicitly if we want to replace, or we can just ADD a new one if names differ.
  -- But usually better to have one FK per column to avoid confusion.
  -- Note: If we drop FK to auth.users, we lose the strict integrity if profiles can be deleted but auth user remains? usually they cascade together.

ALTER TABLE space_polls
  ADD CONSTRAINT space_polls_created_by_profiles_fkey
  FOREIGN KEY (created_by)
  REFERENCES profiles(id)
  ON DELETE CASCADE;

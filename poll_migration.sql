-- Add poll options to posts table
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS poll_options jsonb;

-- Table to track votes
CREATE TABLE IF NOT EXISTS public.poll_votes (
    id uuid default uuid_generate_v4() primary key,
    post_id uuid references public.posts(id) ON DELETE CASCADE not null,
    user_id uuid references public.profiles(id) ON DELETE CASCADE not null,
    option_index integer not null, -- 0-based index
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    UNIQUE(post_id, user_id)
);

-- RLS
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'Poll votes are viewable by everyone'
    ) THEN
        CREATE POLICY "Poll votes are viewable by everyone" ON public.poll_votes FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'Authenticated users can vote'
    ) THEN
        CREATE POLICY "Authenticated users can vote" ON public.poll_votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- Trigger Function to update JSON B counts
CREATE OR REPLACE FUNCTION public.handle_new_poll_vote() 
RETURNS trigger AS $$
DECLARE
  old_options jsonb;
  new_options jsonb;
BEGIN
  -- Get current options
  SELECT poll_options INTO old_options FROM public.posts WHERE id = new.post_id;
  
  IF old_options IS NULL THEN
    RETURN new;
  END IF;

  -- Rebuild JSON array with incremented count for the selected index
  SELECT jsonb_agg(
    CASE 
      WHEN (ord - 1) = new.option_index THEN 
        jsonb_build_object('text', el->>'text', 'count', COALESCE((el->>'count')::int, 0) + 1)
      ELSE el
    END
  )
  INTO new_options
  FROM jsonb_array_elements(old_options) WITH ORDINALITY as t(el, ord);
  
  -- Update the post
  UPDATE public.posts SET poll_options = new_options WHERE id = new.post_id;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists to avoid duplication errors on re-run
DROP TRIGGER IF EXISTS on_poll_vote_added ON public.poll_votes;

CREATE TRIGGER on_poll_vote_added
AFTER INSERT ON public.poll_votes
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_poll_vote();

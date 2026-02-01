-- Create pinned_spaces table
CREATE TABLE IF NOT EXISTS public.pinned_spaces (
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  space_id UUID REFERENCES public.spaces(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, space_id)
);

-- RLS
ALTER TABLE public.pinned_spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pinned spaces"
  ON public.pinned_spaces FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can pin spaces"
  ON public.pinned_spaces FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unpin their own spaces"
  ON public.pinned_spaces FOR DELETE
  USING (auth.uid() = user_id);

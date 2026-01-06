-- Create space-media bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('space-media', 'space-media', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for space-media
CREATE POLICY "Authenticated users can upload space media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'space-media' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Anyone can view space media"
ON storage.objects FOR SELECT
USING ( bucket_id = 'space-media' );

-- Ensure space_events policies exist (re-runnable safely)
ALTER TABLE public.space_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'space_events' AND policyname = 'Events viewable by everyone'
    ) THEN
        CREATE POLICY "Events viewable by everyone" ON public.space_events FOR SELECT USING (true);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'space_events' AND policyname = 'Members can create events'
    ) THEN
        CREATE POLICY "Members can create events" ON public.space_events FOR INSERT 
        WITH CHECK (
            auth.role() = 'authenticated' AND
            EXISTS (
                SELECT 1 FROM public.space_members
                WHERE space_id = space_events.space_id
                AND user_id = auth.uid()
            )
        );
    END IF;
END $$;

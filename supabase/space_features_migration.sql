-- Space Roles
ALTER TABLE space_members ADD COLUMN IF NOT EXISTS role text DEFAULT 'member';
-- Add constraint if needed, but text is flexible for now. 'owner', 'moderator', 'member'

-- Space Polls
CREATE TABLE IF NOT EXISTS space_polls (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id uuid REFERENCES spaces(id) ON DELETE CASCADE,
    question text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    expires_at timestamptz,
    is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS space_poll_options (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id uuid REFERENCES space_polls(id) ON DELETE CASCADE,
    text text NOT NULL,
    vote_count int DEFAULT 0
);

CREATE TABLE IF NOT EXISTS space_poll_votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    poll_id uuid REFERENCES space_polls(id) ON DELETE CASCADE,
    option_id uuid REFERENCES space_poll_options(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    UNIQUE(poll_id, user_id)
);

-- Space Resources
CREATE TABLE IF NOT EXISTS space_resources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id uuid REFERENCES spaces(id) ON DELETE CASCADE,
    title text NOT NULL,
    description text,
    url text NOT NULL,
    type text DEFAULT 'link', -- 'link', 'pdf', 'doc', 'image'
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);

-- Space Announcements
CREATE TABLE IF NOT EXISTS space_announcements (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id uuid REFERENCES spaces(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    active_until timestamptz
);

-- Space Voice Session (Active Speakers)
CREATE TABLE IF NOT EXISTS space_voice_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    space_id uuid REFERENCES spaces(id) ON DELETE CASCADE,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    joined_at timestamptz DEFAULT now(),
    is_muted boolean DEFAULT false,
    is_speaking boolean DEFAULT false,
    UNIQUE(space_id, user_id)
);

-- Policies (Basic RLS)
ALTER TABLE space_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_poll_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE space_voice_sessions ENABLE ROW LEVEL SECURITY;

-- Allow read for members
CREATE POLICY "Members can view polls" ON space_polls FOR SELECT USING (true);
CREATE POLICY "Members can view poll options" ON space_poll_options FOR SELECT USING (true);
CREATE POLICY "Members can view votes" ON space_poll_votes FOR SELECT USING (true);
CREATE POLICY "Members can view resources" ON space_resources FOR SELECT USING (true);
CREATE POLICY "Members can view announcements" ON space_announcements FOR SELECT USING (true);
CREATE POLICY "Members can view voice sessions" ON space_voice_sessions FOR SELECT USING (true);

-- Allow insert/update for members (simple for now, refinements later)
CREATE POLICY "Members can vote" ON space_poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can join voice" ON space_voice_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice status" ON space_voice_sessions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can leave voice" ON space_voice_sessions FOR DELETE USING (auth.uid() = user_id);

-- Moderator/Owner policies would go here (simplified: allow specific inserts for now)
CREATE POLICY "Anyone can create polls for now (refine later)" ON space_polls FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Anyone can create options" ON space_poll_options FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can upload resources" ON space_resources FOR INSERT WITH CHECK (auth.uid() = created_by);

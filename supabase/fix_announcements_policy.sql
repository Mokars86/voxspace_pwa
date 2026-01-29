-- Allow authenticated users (owners/moderators ideally, but anyone for now like other features) to create announcements
CREATE POLICY "Users can create announcements" ON space_announcements FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Allow creators/owners to update/dismiss (existing policy might be missing too for update)
CREATE POLICY "Users can update own announcements" ON space_announcements FOR UPDATE USING (auth.uid() = created_by);

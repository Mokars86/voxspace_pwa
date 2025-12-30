-- Add Message Status Columns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_edited') THEN
        ALTER TABLE messages ADD COLUMN is_edited BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'is_deleted') THEN
        ALTER TABLE messages ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'messages' AND column_name = 'deleted_at') THEN
        ALTER TABLE messages ADD COLUMN deleted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add Chat Settings
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chats' AND column_name = 'disappearing_duration') THEN
        ALTER TABLE chats ADD COLUMN disappearing_duration INTEGER DEFAULT NULL; -- Duration in minutes. NULL = Off.
    END IF;
END $$;

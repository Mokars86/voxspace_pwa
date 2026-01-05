-- Add is_pinned column to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;

-- Create index for faster lookup of pinned messages
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON public.messages(chat_id) WHERE is_pinned = true;

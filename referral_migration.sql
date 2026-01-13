-- Migration Script: Generate Referral Codes for Existing Users
-- Run this in the Supabase SQL Editor

UPDATE profiles
SET referral_code = UPPER(
  -- Part 1: First 5 characters of clean username (or 'USER' if empty)
  COALESCE(NULLIF(SUBSTRING(REGEXP_REPLACE(username, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 5), ''), 'USER')
  ||
  -- Part 2: 4 Random characters (from MD5 hex, perfectly fine for uniqueness here)
  SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 4)
)
WHERE referral_code IS NULL;

-- Verify results
SELECT username, referral_code FROM profiles;

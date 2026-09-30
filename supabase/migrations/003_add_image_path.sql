-- =============================================================================
-- CivicConnect — Migration 003: Add image_path to complaints
-- Stores the primary Supabase Storage path for the citizen's uploaded photo.
-- The full public URL is derived at runtime; the path is the canonical reference.
-- =============================================================================

ALTER TABLE complaints ADD COLUMN IF NOT EXISTS image_path TEXT;

-- Index for quickly finding complaints that have an image
CREATE INDEX IF NOT EXISTS complaints_image_path_idx ON complaints (image_path)
  WHERE image_path IS NOT NULL;

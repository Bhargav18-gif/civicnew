-- =============================================================================
-- CivicConnect — Migration 004: Supabase Storage RLS Policies for complaint-images
-- Enables public read and insert access so citizens can upload complaint photos
-- and admins/citizens can view uploaded evidence.
-- =============================================================================

-- 1. Ensure the bucket exists and is marked public
INSERT INTO storage.buckets (id, name, public)
VALUES ('complaint-images', 'complaint-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Drop any previous policies to avoid name conflicts
DROP POLICY IF EXISTS "Allow public uploads to complaint-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public reads from complaint-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public deletes from complaint-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated and anon uploads to complaint-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public view for complaint-images" ON storage.objects;

-- 3. Policy: Allow Anyone (Anon & Authenticated) to upload complaint photos
CREATE POLICY "Allow public uploads to complaint-images"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (bucket_id = 'complaint-images');

-- 4. Policy: Allow Anyone (Anon & Authenticated) to view complaint photos
CREATE POLICY "Allow public reads from complaint-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'complaint-images');

-- 5. Policy: Allow deletion of orphaned uploads if database insert fails
CREATE POLICY "Allow public deletes from complaint-images"
ON storage.objects
FOR DELETE
TO public
USING (bucket_id = 'complaint-images');

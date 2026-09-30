/**
 * CivicConnect — Supabase Storage: Complaint Image Upload Service
 *
 * Uses the frontend Supabase client (anon key) to upload images to the
 * existing `complaint-images` bucket.
 *
 * SECURITY:
 *  - Only the anon/publishable key is used here — never the service-role key.
 *  - The bucket's RLS policy must allow authenticated or anon uploads
 *    (see Supabase Dashboard → Storage → complaint-images → Policies).
 *  - The returned `storagePath` is stored in the DB; the public URL is
 *    derived from it at display time.
 */

import { supabase } from '../../lib/supabase.js';

const BUCKET = 'complaint-images';
const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

/**
 * Validates a File object for upload suitability.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageFile(file) {
  if (!file) return { valid: false, error: 'No file selected.' };

  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || 'unknown'}. Please upload a JPEG, PNG, or WebP image.`
    };
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `Image is too large (${sizeMB} MB). Maximum allowed size is ${MAX_FILE_SIZE_MB} MB.`
    };
  }

  return { valid: true };
}

/**
 * Generates a unique storage path for a complaint image.
 * Uses userId + timestamp + random suffix to prevent collisions.
 *
 * Path format: complaints/{userId}/{timestamp}-{randomId}.{ext}
 * If complaintId is provided: complaints/{complaintId}/{timestamp}-{randomId}.{ext}
 *
 * @param {File} file
 * @param {string} userId  - Firebase UID or Supabase UUID of the citizen
 * @param {string} [complaintId] - Optional complaint UUID (if known before upload)
 * @returns {string} Storage path
 */
export function generateStoragePath(file, userId, complaintId = null) {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 9);
  const folder = complaintId || userId || 'anonymous';
  return `complaints/${folder}/${timestamp}-${randomId}.${ext}`;
}

/**
 * Uploads a complaint image to Supabase Storage `complaint-images` bucket.
 *
 * @param {File} file       - The image File object
 * @param {string} userId   - The citizen's Firebase UID or Supabase UUID
 * @param {string} [complaintId] - Optional complaint ID for folder organisation
 * @returns {Promise<{ storagePath: string, publicUrl: string }>}
 * @throws {Error} on validation failure or upload failure
 */
export async function uploadComplaintImage(file, userId, complaintId = null) {
  console.log('[STORAGE] Image selected:', { name: file.name, size: file.size, type: file.type });

  // 1. Validate
  const validation = validateImageFile(file);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // 2. Generate unique path
  const storagePath = generateStoragePath(file, userId, complaintId);
  console.log('[STORAGE] Upload started:', storagePath);

  // 3. Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,       // Never overwrite — unique names prevent collisions
      cacheControl: '3600' // 1-hour browser cache
    });

  if (error) {
    console.error('[STORAGE] Upload failed:', error.message);
    throw new Error(`Image upload failed: ${error.message}`);
  }

  console.log('[STORAGE] Upload successful. Path:', data.path);

  // 4. Get the public URL
  const { data: urlData } = supabase.storage
    .from(BUCKET)
    .getPublicUrl(data.path);

  const publicUrl = urlData?.publicUrl || null;
  console.log('[STORAGE] Public URL:', publicUrl);

  return {
    storagePath: data.path,
    publicUrl
  };
}

/**
 * Derives the public URL for a stored image path without re-uploading.
 * Use this in admin/citizen views to display images from stored paths.
 *
 * @param {string} storagePath - The path stored in the database
 * @returns {string|null} Public URL or null if path is empty
 */
export function getPublicImageUrl(storagePath) {
  if (!storagePath) return null;
  if (typeof storagePath === 'string' && (storagePath.startsWith('http://') || storagePath.startsWith('https://'))) {
    return storagePath;
  }
  try {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    if (data?.publicUrl) return data.publicUrl;
  } catch (e) {
    console.warn('[STORAGE] Failed to derive public URL from client:', e.message);
  }

  const baseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 
                  (typeof process !== 'undefined' && (process.env?.VITE_SUPABASE_URL || process.env?.SUPABASE_URL));
  if (baseUrl) {
    return `${baseUrl.replace(/\/$/, '')}/storage/v1/object/public/${BUCKET}/${storagePath}`;
  }
  return null;
}

/**
 * Attempts to delete an orphaned image from storage.
 * Called when a complaint DB insert fails after a successful image upload.
 * Failures here are logged but not re-thrown — data consistency is handled by the caller.
 *
 * @param {string} storagePath
 */
export async function deleteOrphanedImage(storagePath) {
  if (!storagePath) return;
  try {
    const { error } = await supabase.storage.from(BUCKET).remove([storagePath]);
    if (error) {
      console.warn('[STORAGE] Could not delete orphaned image:', storagePath, error.message);
    } else {
      console.log('[STORAGE] Orphaned image deleted:', storagePath);
    }
  } catch (e) {
    console.warn('[STORAGE] Delete orphan failed silently:', e.message);
  }
}

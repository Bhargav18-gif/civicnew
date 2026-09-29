-- =============================================================================
-- CivicConnect — Migration 002: Add Department Code
-- Adds canonical 'code' column to departments table and populates standard codes.
-- =============================================================================

ALTER TABLE departments ADD COLUMN IF NOT EXISTS code TEXT;

-- Seed canonical codes
UPDATE departments SET code = 'ROADS' WHERE id = 'roads';
UPDATE departments SET code = 'WATER' WHERE id = 'water';
UPDATE departments SET code = 'ELECTRICAL' WHERE id = 'electricity';
UPDATE departments SET code = 'SANITATION' WHERE id = 'garbage';
UPDATE departments SET code = 'DRAINAGE' WHERE id = 'drainage';
UPDATE departments SET code = 'PUBLIC_HEALTH' WHERE id = 'health';
UPDATE departments SET code = 'TRANSPORT' WHERE id = 'transport';
UPDATE departments SET code = 'PUBLIC_SAFETY' WHERE id = 'public_safety';

-- Add unique constraint on code
CREATE UNIQUE INDEX IF NOT EXISTS departments_code_idx ON departments (code);

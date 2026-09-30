-- =============================================================================
-- CivicConnect — Supabase PostgreSQL Schema
-- Migration: 001_initial_schema
--
-- Architecture:
--   Firebase Authentication  → identity provider (firebase_uid is the link)
--   Supabase PostgreSQL      → all application data
--
-- IMPORTANT: Execute this in the Supabase SQL Editor or via CLI.
--   supabase db query < supabase/migrations/001_initial_schema.sql
-- =============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- DEPARTMENTS
-- =============================================================================
CREATE TABLE IF NOT EXISTS departments (
  id            TEXT        PRIMARY KEY,                  -- e.g. 'roads', 'water'
  name          TEXT        NOT NULL,
  description   TEXT,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed canonical departments
INSERT INTO departments (id, name, description) VALUES
  ('roads',         'Roads & Infrastructure',  'Road maintenance, potholes, footpaths'),
  ('water',         'Water Supply',            'Water leakage, supply issues, quality'),
  ('electricity',   'Electricity & Lighting',  'Power outages, streetlights, transformers'),
  ('garbage',       'Sanitation & Waste',      'Waste collection, dumping, cleanliness'),
  ('drainage',      'Drainage & Sewage',       'Blocked drains, sewage overflow'),
  ('health',        'Public Health',           'Hygiene, mosquito breeding, health hazards'),
  ('transport',     'Transport & Traffic',     'Bus stops, traffic signals, road marking'),
  ('public_safety', 'Public Safety',           'Street lighting, safety hazards, encroachments')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- USERS
-- Links Firebase Authentication UID to application profile and role.
-- firebase_uid is the single source of truth for identity linking.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid    TEXT        NOT NULL UNIQUE,            -- Firebase Auth UID
  name            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  phone           TEXT,
  role            TEXT        NOT NULL DEFAULT 'CITIZEN'  -- CITIZEN | ENGINEER | DEPARTMENT | ADMIN
                              CHECK (role IN ('CITIZEN', 'ENGINEER', 'DEPARTMENT', 'ADMIN')),
  department_id   TEXT        REFERENCES departments(id),
  is_active       BOOLEAN     NOT NULL DEFAULT true,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_firebase_uid_idx ON users (firebase_uid);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_department_id_idx ON users (department_id);

-- =============================================================================
-- COMPLAINTS
-- Core application entity.
-- =============================================================================
CREATE TABLE IF NOT EXISTS complaints (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id    TEXT        NOT NULL UNIQUE,            -- e.g. CC-2026-4A7B2C
  citizen_id      UUID        NOT NULL REFERENCES users(id),
  title           TEXT        NOT NULL,
  description     TEXT        NOT NULL,
  category        TEXT,
  priority        TEXT        NOT NULL DEFAULT 'MEDIUM'
                              CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status          TEXT        NOT NULL DEFAULT 'SUBMITTED'
                              CHECK (status IN (
                                'SUBMITTED', 'AI_PROCESSING', 'AI_FAILED',
                                'PENDING_ADMIN_REVIEW', 'ROUTED',
                                'DEPARTMENT_ACCEPTED', 'ASSIGNED',
                                'ACCEPTED_BY_ENGINEER', 'EN_ROUTE', 'ON_SITE',
                                'IN_PROGRESS', 'VERIFICATION_PENDING',
                                'DEPARTMENT_REVIEW', 'CITIZEN_VERIFICATION',
                                'REOPENED', 'CLOSED', 'REJECTED'
                              )),
  previous_status TEXT,
  -- Location
  latitude        DOUBLE PRECISION,
  longitude       DOUBLE PRECISION,
  address         TEXT,
  -- Routing
  department_id   TEXT        REFERENCES departments(id),
  routing_method  TEXT        DEFAULT 'PENDING',          -- AI_AUTO | ADMIN_MANUAL
  routed_at       TIMESTAMPTZ,
  -- Assignment (denormalized for performance; canonical in assignments table)
  assigned_engineer_id UUID   REFERENCES users(id),
  assigned_at     TIMESTAMPTZ,
  assigned_by     UUID        REFERENCES users(id),
  -- Verification
  dept_verification_decision  TEXT,                       -- ACCEPT | REJECT
  dept_verification_remarks   TEXT,
  dept_verified_by            UUID REFERENCES users(id),
  dept_verified_at            TIMESTAMPTZ,
  citizen_verification_decision TEXT,                     -- APPROVED | REOPENED
  citizen_verification_feedback TEXT,
  citizen_verified_at         TIMESTAMPTZ,
  -- Resolution
  engineer_notes  TEXT,
  parts_used      JSONB,
  -- SLA
  sla_deadline    TIMESTAMPTZ,
  sla_breached    BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS complaints_citizen_id_idx     ON complaints (citizen_id);
CREATE INDEX IF NOT EXISTS complaints_status_idx         ON complaints (status);
CREATE INDEX IF NOT EXISTS complaints_department_id_idx  ON complaints (department_id);
CREATE INDEX IF NOT EXISTS complaints_assigned_engineer_idx ON complaints (assigned_engineer_id);
CREATE INDEX IF NOT EXISTS complaints_reference_id_idx   ON complaints (reference_id);
CREATE INDEX IF NOT EXISTS complaints_created_at_idx     ON complaints (created_at DESC);

-- =============================================================================
-- COMPLAINT MEDIA
-- =============================================================================
CREATE TABLE IF NOT EXISTS complaint_media (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  media_type      TEXT        NOT NULL CHECK (media_type IN ('BEFORE', 'AFTER')),
  storage_path    TEXT,
  file_url        TEXT        NOT NULL,
  file_type       TEXT,                                   -- image/jpeg, etc.
  caption         TEXT,
  uploaded_by     UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS complaint_media_complaint_id_idx ON complaint_media (complaint_id);

-- =============================================================================
-- ASSIGNMENTS
-- Canonical record of engineer assignments.
-- =============================================================================
CREATE TABLE IF NOT EXISTS assignments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  department_id   TEXT        REFERENCES departments(id),
  engineer_id     UUID        NOT NULL REFERENCES users(id),
  assigned_by     UUID        REFERENCES users(id),
  status          TEXT        NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REASSIGNED')),
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS assignments_complaint_id_idx ON assignments (complaint_id);
CREATE INDEX IF NOT EXISTS assignments_engineer_id_idx  ON assignments (engineer_id);

-- =============================================================================
-- AI RESULTS
-- One row per AI classification attempt per complaint.
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_results (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id          UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  category              TEXT,
  department_id         TEXT        REFERENCES departments(id),
  priority              TEXT        CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  confidence            DOUBLE PRECISION CHECK (confidence >= 0.0 AND confidence <= 1.0),
  model_name            TEXT,
  model_version         TEXT,
  duplicate_score       DOUBLE PRECISION,
  duplicate_of_id       UUID        REFERENCES complaints(id),
  requires_human_review BOOLEAN     NOT NULL DEFAULT false,
  reasoning_summary     TEXT,
  processing_status     TEXT        NOT NULL DEFAULT 'PENDING'
                                    CHECK (processing_status IN ('PENDING', 'COMPLETED', 'FAILED')),
  failure_reason        TEXT,                             -- AI_UNAVAILABLE | MODEL_ARTIFACT_MISSING | AI_INVALID_RESPONSE
  processed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_results_complaint_id_idx ON ai_results (complaint_id);

-- =============================================================================
-- AUDIT LOGS
-- Immutable event log — no UPDATE or DELETE should be permitted.
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    UUID        REFERENCES complaints(id),  -- NULL allowed for system events
  actor_id        UUID        REFERENCES users(id),       -- NULL for system/anonymous events
  actor_firebase_uid TEXT,                                -- for events before user record is created
  actor_role      TEXT        NOT NULL DEFAULT 'system',
  event_type      TEXT        NOT NULL,
  old_status      TEXT,
  new_status      TEXT,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_complaint_id_idx ON audit_logs (complaint_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx   ON audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_event_type_idx   ON audit_logs (event_type);

-- =============================================================================
-- NOTIFICATIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS notifications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  complaint_id    UUID        REFERENCES complaints(id),
  title           TEXT        NOT NULL,
  message         TEXT        NOT NULL,
  type            TEXT        NOT NULL,
  is_read         BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications (user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications (is_read);

-- =============================================================================
-- FEEDBACK (AI training corrections)
-- =============================================================================
CREATE TABLE IF NOT EXISTS feedback (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id      UUID        NOT NULL REFERENCES complaints(id),
  model_version     TEXT,
  ai_prediction     TEXT,
  ai_confidence     DOUBLE PRECISION,
  human_decision    JSONB,                                -- {category, department, priority}
  human_user_id     UUID        REFERENCES users(id),
  reason            TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feedback_complaint_id_idx ON feedback (complaint_id);

-- =============================================================================
-- SLA RECORDS
-- =============================================================================
CREATE TABLE IF NOT EXISTS sla_records (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  complaint_id    UUID        NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
  sla_deadline    TIMESTAMPTZ NOT NULL,
  breached_at     TIMESTAMPTZ,
  is_breached     BOOLEAN     NOT NULL DEFAULT false,
  priority        TEXT,
  department_id   TEXT        REFERENCES departments(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS sla_records_complaint_id_idx  ON sla_records (complaint_id);
CREATE INDEX IF NOT EXISTS sla_records_is_breached_idx   ON sla_records (is_breached);

-- =============================================================================
-- MODEL VERSIONS
-- =============================================================================
CREATE TABLE IF NOT EXISTS model_versions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name      TEXT        NOT NULL,
  model_version   TEXT        NOT NULL UNIQUE,
  base_model      TEXT,
  status          TEXT        NOT NULL DEFAULT 'STAGING'
                              CHECK (status IN ('STAGING', 'PRODUCTION', 'DEPRECATED', 'ROLLBACK')),
  accuracy        DOUBLE PRECISION,
  macro_f1        DOUBLE PRECISION,
  precision_score DOUBLE PRECISION,
  recall_score    DOUBLE PRECISION,
  artifact_hash   TEXT,
  artifact_path   TEXT,
  deployment_timestamp TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- TRAINING RUNS
-- =============================================================================
CREATE TABLE IF NOT EXISTS training_runs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id  UUID        REFERENCES model_versions(id),
  dataset_version   TEXT,
  status            TEXT        NOT NULL DEFAULT 'PENDING'
                                CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
  epochs            INTEGER,
  final_accuracy    DOUBLE PRECISION,
  final_loss        DOUBLE PRECISION,
  training_samples  INTEGER,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  logs              JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'complaints', 'assignments', 'sla_records'] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS set_updated_at ON %I',
      t
    );
    EXECUTE format(
      'CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()',
      t
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY
-- IMPORTANT: The frontend uses the anon key.
-- Sensitive mutations must go through the backend API (which uses service-role key).
-- The following RLS policies allow read-only access for authenticated patterns.
--
-- For now, RLS is enabled but all policies are deny-all for the anon role.
-- The backend service-role key bypasses RLS.
-- =============================================================================

ALTER TABLE departments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE users             ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints        ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaint_media   ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_results        ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications     ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback          ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_records       ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_runs     ENABLE ROW LEVEL SECURITY;

-- Allow public read of departments (non-sensitive reference data)
DROP POLICY IF EXISTS "departments_public_read" ON departments;
CREATE POLICY "departments_public_read" ON departments
  FOR SELECT TO anon, authenticated USING (true);

-- All other tables: deny anon access (all data access through backend API)
-- Backend uses service-role key which bypasses RLS.

-- =============================================================================
-- GRANT DATA API ACCESS
-- Expose tables to the PostgREST Data API for the anon/authenticated roles.
-- Only departments is exposed for public read; others require backend.
-- =============================================================================
GRANT SELECT ON departments TO anon, authenticated;

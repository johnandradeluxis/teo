BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'student')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf text NOT NULL,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS reset_tokens (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON reset_tokens(expires_at);

CREATE TABLE IF NOT EXISTS settings (
  id text PRIMARY KEY,
  payload jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_profiles_owner ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_updated ON profiles(updated_at DESC);

CREATE TABLE IF NOT EXISTS study_preferences (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_preferences_owner ON study_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_study_preferences_updated ON study_preferences(updated_at DESC);

CREATE TABLE IF NOT EXISTS curriculum (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_curriculum_owner ON curriculum(user_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_updated ON curriculum(updated_at DESC);

CREATE TABLE IF NOT EXISTS disciplines (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disciplines_owner ON disciplines(user_id);
CREATE INDEX IF NOT EXISTS idx_disciplines_updated ON disciplines(updated_at DESC);

CREATE TABLE IF NOT EXISTS modules (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_modules_owner ON modules(user_id);
CREATE INDEX IF NOT EXISTS idx_modules_updated ON modules(updated_at DESC);

CREATE TABLE IF NOT EXISTS lessons (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lessons_owner ON lessons(user_id);
CREATE INDEX IF NOT EXISTS idx_lessons_updated ON lessons(updated_at DESC);

CREATE TABLE IF NOT EXISTS lesson_versions (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lesson_versions_owner ON lesson_versions(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_versions_updated ON lesson_versions(updated_at DESC);

CREATE TABLE IF NOT EXISTS content_reviews (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_content_reviews_owner ON content_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_content_reviews_updated ON content_reviews(updated_at DESC);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at DESC);

CREATE TABLE IF NOT EXISTS document_chunks (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_document_chunks_owner ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_updated ON document_chunks(updated_at DESC);

CREATE TABLE IF NOT EXISTS questions (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_owner ON questions(user_id);
CREATE INDEX IF NOT EXISTS idx_questions_updated ON questions(updated_at DESC);

CREATE TABLE IF NOT EXISTS question_attempts (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_attempts_owner ON question_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_question_attempts_updated ON question_attempts(updated_at DESC);

CREATE TABLE IF NOT EXISTS study_sessions (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_sessions_owner ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_updated ON study_sessions(updated_at DESC);

CREATE TABLE IF NOT EXISTS student_progress (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_student_progress_owner ON student_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_updated ON student_progress(updated_at DESC);

CREATE TABLE IF NOT EXISTS mastery_records (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mastery_records_owner ON mastery_records(user_id);
CREATE INDEX IF NOT EXISTS idx_mastery_records_updated ON mastery_records(updated_at DESC);

CREATE TABLE IF NOT EXISTS study_plans (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_study_plans_owner ON study_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_study_plans_updated ON study_plans(updated_at DESC);

CREATE TABLE IF NOT EXISTS journey_milestones (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journey_milestones_owner ON journey_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_journey_milestones_updated ON journey_milestones(updated_at DESC);

CREATE TABLE IF NOT EXISTS simulations (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulations_owner ON simulations(user_id);
CREATE INDEX IF NOT EXISTS idx_simulations_updated ON simulations(updated_at DESC);

CREATE TABLE IF NOT EXISTS simulation_answers (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulation_answers_owner ON simulation_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_simulation_answers_updated ON simulation_answers(updated_at DESC);

CREATE TABLE IF NOT EXISTS personal_journey (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_personal_journey_owner ON personal_journey(user_id);
CREATE INDEX IF NOT EXISTS idx_personal_journey_updated ON personal_journey(updated_at DESC);

CREATE TABLE IF NOT EXISTS notes (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notes_owner ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated ON notes(updated_at DESC);

CREATE TABLE IF NOT EXISTS favorites (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_favorites_owner ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_updated ON favorites(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_providers (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_providers_owner ON ai_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_providers_updated ON ai_providers(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_owner ON ai_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_updated ON ai_usage_logs(updated_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_owner ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_updated ON notifications(updated_at DESC);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_owner ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_updated ON audit_logs(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_cache (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_cache_owner ON ai_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_cache_updated ON ai_cache(updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id text PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_owner ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_updated ON ai_conversations(updated_at DESC);

ALTER TABLE document_chunks
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

INSERT INTO schema_migrations(version)
VALUES (1)
ON CONFLICT (version) DO NOTHING;

COMMIT;


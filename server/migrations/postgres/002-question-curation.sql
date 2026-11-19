BEGIN;

CREATE TABLE IF NOT EXISTS question_sources (
  id text PRIMARY KEY,
  title text NOT NULL,
  url text NOT NULL,
  publisher text,
  kind text NOT NULL,
  usage text NOT NULL,
  license_status text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_id text REFERENCES question_sources(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS provenance_kind text NOT NULL DEFAULT 'original';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pending_review';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS reviewed_by text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_question_sources_kind ON question_sources(kind);
CREATE INDEX IF NOT EXISTS idx_questions_review_status ON questions(review_status);
CREATE INDEX IF NOT EXISTS idx_questions_provenance ON questions(provenance_kind);

COMMIT;

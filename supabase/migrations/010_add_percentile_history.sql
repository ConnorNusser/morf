-- Add percentile history column for tracking strength over time
-- Structure: [{ "percentile": 45, "date": "2024-01-15" }, ...]

ALTER TABLE user_percentiles
ADD COLUMN IF NOT EXISTS percentile_history jsonb DEFAULT '[]'::jsonb;

-- Add index for querying users with history
CREATE INDEX IF NOT EXISTS idx_user_percentiles_history
ON user_percentiles USING gin (percentile_history);

-- Add risk assessment fields to call_logs
-- Run this migration in the Supabase SQL editor

ALTER TABLE call_logs
  ADD COLUMN IF NOT EXISTS risk_level text DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS risk_score integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS emotional_analysis jsonb DEFAULT '{}'::jsonb;

-- Index for dashboard queries that filter by risk
CREATE INDEX IF NOT EXISTS idx_call_logs_risk_level ON call_logs (patient_id, risk_level);
CREATE INDEX IF NOT EXISTS idx_call_logs_risk_score ON call_logs (patient_id, risk_score DESC);

COMMENT ON COLUMN call_logs.risk_level IS 'Overall risk level: low, moderate, high, critical';
COMMENT ON COLUMN call_logs.risk_score IS 'Numeric risk score 0-100 (higher = more concern)';
COMMENT ON COLUMN call_logs.emotional_analysis IS 'Detailed emotional analysis from MERaLiON: {emotions, sentiment, vocal_cues, loneliness_indicator, cognitive_flags, recommendations}';

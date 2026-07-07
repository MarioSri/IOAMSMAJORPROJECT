-- ============================================
-- Analytics Dashboard Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- Analytics Metrics table (stores real-time metrics)
CREATE TABLE IF NOT EXISTS analytics_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  metric_type TEXT NOT NULL, -- 'document', 'approval', 'user_activity', etc.
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Department Statistics table
CREATE TABLE IF NOT EXISTS department_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  department_name TEXT NOT NULL,
  submitted INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  pending INTEGER DEFAULT 0,
  avg_processing_time NUMERIC DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(department_name, period_start, period_end)
);

-- Monthly Trends table
CREATE TABLE IF NOT EXISTS monthly_trends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month TEXT NOT NULL,
  year INTEGER NOT NULL,
  documents INTEGER DEFAULT 0,
  approved INTEGER DEFAULT 0,
  rejected INTEGER DEFAULT 0,
  pending INTEGER DEFAULT 0,
  avg_time NUMERIC DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(month, year)
);

-- User Activity table
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  activity_type TEXT NOT NULL, -- 'document_submit', 'approval', 'login', etc.
  activity_data JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_user ON analytics_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_type ON analytics_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_created ON analytics_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_department_stats_name ON department_stats(department_name);
CREATE INDEX IF NOT EXISTS idx_department_stats_period ON department_stats(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_monthly_trends_date ON monthly_trends(year DESC, month);
CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created ON user_activity(created_at DESC);

-- Enable Row Level Security
ALTER TABLE analytics_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE department_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all analytics metrics" ON analytics_metrics;
DROP POLICY IF EXISTS "Users can insert analytics metrics" ON analytics_metrics;
DROP POLICY IF EXISTS "Users can update own analytics metrics" ON analytics_metrics;
DROP POLICY IF EXISTS "Users can view all department stats" ON department_stats;
DROP POLICY IF EXISTS "System can manage department stats" ON department_stats;
DROP POLICY IF EXISTS "Users can view all monthly trends" ON monthly_trends;
DROP POLICY IF EXISTS "System can manage monthly trends" ON monthly_trends;
DROP POLICY IF EXISTS "Users can view own activity" ON user_activity;
DROP POLICY IF EXISTS "Users can insert own activity" ON user_activity;

-- RLS Policies
CREATE POLICY "Users can view all analytics metrics" ON analytics_metrics FOR SELECT USING (true);
CREATE POLICY "Users can insert analytics metrics" ON analytics_metrics FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own analytics metrics" ON analytics_metrics FOR UPDATE USING (true);

CREATE POLICY "Users can view all department stats" ON department_stats FOR SELECT USING (true);
CREATE POLICY "System can manage department stats" ON department_stats FOR ALL USING (true);

CREATE POLICY "Users can view all monthly trends" ON monthly_trends FOR SELECT USING (true);
CREATE POLICY "System can manage monthly trends" ON monthly_trends FOR ALL USING (true);

CREATE POLICY "Users can view own activity" ON user_activity FOR SELECT USING (true);
CREATE POLICY "Users can insert own activity" ON user_activity FOR INSERT WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE analytics_metrics;
ALTER PUBLICATION supabase_realtime ADD TABLE department_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE monthly_trends;
ALTER PUBLICATION supabase_realtime ADD TABLE user_activity;

-- Function to update analytics metrics
CREATE OR REPLACE FUNCTION update_analytics_metrics()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_analytics_metrics_timestamp
  BEFORE UPDATE ON analytics_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics();

CREATE TRIGGER update_department_stats_timestamp
  BEFORE UPDATE ON department_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics();

CREATE TRIGGER update_monthly_trends_timestamp
  BEFORE UPDATE ON monthly_trends
  FOR EACH ROW
  EXECUTE FUNCTION update_analytics_metrics();

-- Verify tables created
SELECT 'Analytics Metrics table created' as status, COUNT(*) as count FROM analytics_metrics
UNION ALL
SELECT 'Department Stats table created' as status, COUNT(*) as count FROM department_stats
UNION ALL
SELECT 'Monthly Trends table created' as status, COUNT(*) as count FROM monthly_trends
UNION ALL
SELECT 'User Activity table created' as status, COUNT(*) as count FROM user_activity;

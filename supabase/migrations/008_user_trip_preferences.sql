-- Learned trip preferences per user (stop categories, fuel brands, restaurant types)
CREATE TABLE IF NOT EXISTS user_trip_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stop_categories JSONB NOT NULL DEFAULT '{}',
  fuel_brands JSONB NOT NULL DEFAULT '{}',
  restaurant_types JSONB NOT NULL DEFAULT '{}',
  avg_stops_per_trip NUMERIC NOT NULL DEFAULT 0,
  trip_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE user_trip_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own trip preferences"
  ON user_trip_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users upsert own trip preferences"
  ON user_trip_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own trip preferences"
  ON user_trip_preferences FOR UPDATE
  USING (auth.uid() = user_id);

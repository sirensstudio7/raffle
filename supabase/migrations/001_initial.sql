-- Raffle spin wheel — single-site schema

CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS raffle_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  screen_ratio VARCHAR(10) NOT NULL DEFAULT 'auto',
  spin_keybinding VARCHAR(32) NOT NULL DEFAULT 'Space',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO raffle_settings (id, enabled) VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS raffle_campaigns (
  id VARCHAR(36) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  daily_limit INTEGER,
  total_limit INTEGER,
  one_per_user BOOLEAN NOT NULL DEFAULT TRUE,
  odds_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_campaigns_status ON raffle_campaigns(status);

CREATE TABLE IF NOT EXISTS raffle_prizes (
  id VARCHAR(36) PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL REFERENCES raffle_campaigns(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  probability NUMERIC(5,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  voucher_prefix VARCHAR(20) NOT NULL DEFAULT 'SPIN',
  expires_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_prizes_campaign ON raffle_prizes(campaign_id);

CREATE TABLE IF NOT EXISTS raffle_winners (
  id VARCHAR(36) PRIMARY KEY,
  campaign_id VARCHAR(36) NOT NULL REFERENCES raffle_campaigns(id) ON DELETE CASCADE,
  prize_id VARCHAR(36) REFERENCES raffle_prizes(id) ON DELETE SET NULL,
  prize_name VARCHAR(255) NOT NULL DEFAULT '',
  customer_identifier VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  voucher_code VARCHAR(100) NOT NULL UNIQUE,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  won_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  redeemed_by VARCHAR(36)
);

CREATE INDEX IF NOT EXISTS idx_raffle_winners_campaign ON raffle_winners(campaign_id);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_voucher ON raffle_winners(voucher_code);
CREATE INDEX IF NOT EXISTS idx_raffle_winners_customer ON raffle_winners(campaign_id, customer_identifier);

CREATE TABLE IF NOT EXISTS raffle_analytics_events (
  id VARCHAR(36) PRIMARY KEY,
  event_name VARCHAR(100) NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supabase Storage bucket for prize images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'raffle-prizes',
  'raffle-prizes',
  true,
  2097152,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

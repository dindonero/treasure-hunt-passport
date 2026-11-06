-- ===========================================
-- Treasure Hunt — Cadaval Edition
-- Consolidated Supabase Database Schema
-- ===========================================
-- Run this once in the Supabase SQL Editor for a fresh deploy.
-- Creates all tables, indexes, functions, and storage. No sample data.
-- ===========================================


-- =============================================
-- 1. TREASURE HUNT USERS
-- =============================================
CREATE TABLE IF NOT EXISTS treasure_hunt_users (
  wallet_address VARCHAR(42) PRIMARY KEY,
  unicorn_handle VARCHAR(255),   -- stores the player's chosen username (DB column name kept for compatibility)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_wallet ON treasure_hunt_users(wallet_address);

-- Case-insensitive unique index on usernames to prevent collisions
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_handle_unique
  ON treasure_hunt_users (LOWER(unicorn_handle));


-- =============================================
-- 2. ADMIN WALLETS
-- =============================================
CREATE TABLE IF NOT EXISTS admin_wallets (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  label VARCHAR(100),
  added_by VARCHAR(42) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_wallets_address ON admin_wallets(wallet_address);


-- =============================================
-- 3. NFC TAGS
-- =============================================
-- Flow: admin creates blank tag → first user claims ownership →
--       owner fills details → marks hidden → in game
CREATE TABLE IF NOT EXISTS nfc_tags (
  id SERIAL PRIMARY KEY,
  chain_id UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  claim_code UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  owner_address VARCHAR(42),
  name VARCHAR(255),
  hint TEXT,
  token_reward VARCHAR(50) DEFAULT '100',
  status VARCHAR(20) DEFAULT 'blank' CHECK (status IN ('blank', 'registered', 'hidden')),
  location_x DECIMAL(5,2),
  location_y DECIMAL(5,2),
  find_count INTEGER DEFAULT 0,
  created_by VARCHAR(42),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nfc_tags_owner ON nfc_tags(owner_address);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_claim_code ON nfc_tags(claim_code);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_chain_id ON nfc_tags(chain_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_status ON nfc_tags(status);
CREATE INDEX IF NOT EXISTS idx_nfc_tags_find_count ON nfc_tags(find_count DESC);


-- =============================================
-- 4. NFC TAG FINDS
-- =============================================
-- Tracks which players found which tags (each player can find each tag once)
-- Denormalized cache of on-chain ObjectFound events. Populated by the
-- leaderboard cron only; the find flow does NOT write here. Two real
-- consumers: (1) deriving nfc_tags.find_count, (2) the admin health panel.
CREATE TABLE IF NOT EXISTS nfc_tag_finds (
  id SERIAL PRIMARY KEY,
  tag_id INTEGER REFERENCES nfc_tags(id) ON DELETE CASCADE,
  finder_address VARCHAR(42) NOT NULL,
  found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tag_id, finder_address)
);

CREATE INDEX IF NOT EXISTS idx_nfc_tag_finds_tag ON nfc_tag_finds(tag_id);
CREATE INDEX IF NOT EXISTS idx_nfc_tag_finds_finder ON nfc_tag_finds(finder_address);


-- =============================================
-- 5. MERCH
-- =============================================
CREATE TABLE IF NOT EXISTS merch (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price VARCHAR(50) NOT NULL,
  image TEXT,
  is_active BOOLEAN DEFAULT true,
  -- Free-text category set per item. NULL / empty = "Other" in the store.
  -- Public /merch tabs are derived from the distinct values currently in use.
  category VARCHAR(60),
  stock INTEGER,                                    -- total inventory (NULL = unlimited)
  focal VARCHAR(20) DEFAULT '50% 50%' NOT NULL,     -- object-position for every render
  fit BOOLEAN DEFAULT false NOT NULL,               -- true = letterbox non-portrait surfaces
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Idempotent column-adds. `CREATE TABLE IF NOT EXISTS` above is a no-op when
-- the table already exists, so re-running this script on a project that
-- pre-dates the consolidated schema needs explicit ADD COLUMN IF NOT EXISTS
-- to actually pick up newer fields.
ALTER TABLE merch ADD COLUMN IF NOT EXISTS category VARCHAR(60);
ALTER TABLE merch ADD COLUMN IF NOT EXISTS stock    INTEGER;
ALTER TABLE merch ADD COLUMN IF NOT EXISTS focal    VARCHAR(20) DEFAULT '50% 50%' NOT NULL;
ALTER TABLE merch ADD COLUMN IF NOT EXISTS fit      BOOLEAN     DEFAULT false   NOT NULL;

CREATE INDEX IF NOT EXISTS idx_merch_active ON merch(is_active);
CREATE INDEX IF NOT EXISTS idx_merch_category ON merch(category);


-- =============================================
-- 6. SOCIAL ACCOUNTS
-- =============================================
CREATE TABLE IF NOT EXISTS social_accounts (
  id SERIAL PRIMARY KEY,
  platform VARCHAR(50) NOT NULL,
  handle VARCHAR(255) NOT NULL,
  profile_url TEXT NOT NULL,
  token_reward VARCHAR(50) DEFAULT '1',
  is_active BOOLEAN DEFAULT true,
  action_type VARCHAR(20) DEFAULT 'follow',
  tweet_template TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);


-- =============================================
-- 7. LEADERBOARD SYNC STATE
-- =============================================
-- Tracks last synced block per scoring category (used by cron job)
CREATE TABLE IF NOT EXISTS sync_state (
  category VARCHAR(30) PRIMARY KEY,
  last_block_number BIGINT DEFAULT 0,
  last_synced_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sync_state (category) VALUES ('mvp'),('tokens'),('found'),('social')
ON CONFLICT DO NOTHING;


-- =============================================
-- 8. LEADERBOARD CACHE
-- =============================================
-- Pre-aggregated scores per (category, address), updated by cron sync
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  category VARCHAR(30) NOT NULL,
  address VARCHAR(42) NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (category, address)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_cache_cat_score ON leaderboard_cache(category, score DESC);


-- =============================================
-- 9. CONTRACT DEPLOYMENTS
-- =============================================
-- Tracks all deployed TreasureHuntRewards contracts; exactly one is active at a time.
CREATE TABLE IF NOT EXISTS contract_deployments (
  id SERIAL PRIMARY KEY,
  address VARCHAR(42) UNIQUE NOT NULL,
  deploy_block BIGINT NOT NULL,
  deploy_tx_hash VARCHAR(66),
  label VARCHAR(100),
  token_name VARCHAR(100) NOT NULL DEFAULT 'Cadaval Coin',
  token_symbol VARCHAR(20) NOT NULL DEFAULT 'CAD',
  is_active BOOLEAN NOT NULL DEFAULT false,
  deployed_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  deployed_by VARCHAR(42)
);

-- Partial unique index: only one row can have is_active = true
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_contract
  ON contract_deployments (is_active) WHERE is_active = true;

-- Atomic switch: deactivate old contract, activate new, wipe game state
CREATE OR REPLACE FUNCTION switch_active_contract(target_id INTEGER)
RETURNS void AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(42);

  -- Deactivate current
  UPDATE contract_deployments SET is_active = false WHERE is_active = true;

  -- Activate target
  UPDATE contract_deployments
    SET is_active = true, activated_at = NOW()
    WHERE id = target_id;

  -- Wipe game state for fresh round
  DELETE FROM leaderboard_cache WHERE true;
  DELETE FROM sync_state WHERE true;
  DELETE FROM nfc_tag_finds WHERE true;
  UPDATE nfc_tags SET find_count = 0 WHERE true;

  -- Re-seed sync_state categories
  INSERT INTO sync_state (category, last_block_number)
  VALUES ('mvp', 0), ('tokens', 0), ('found', 0), ('social', 0);
END;
$$ LANGUAGE plpgsql;


-- =============================================
-- 10. STORAGE OBJECTS (image uploads)
-- =============================================
-- Neon has no blob store, so uploaded images (admin tag/merch photos and
-- player report photos, capped at 1 MB by the upload route) live here as
-- bytea. `key` is "<bucket>/<path>", e.g. "images/uploads/<file>.jpg".
-- Served publicly by app/api/images/[...key]/route.ts; written/deleted via
-- the storage shim in lib/db.ts.
CREATE TABLE IF NOT EXISTS storage_objects (
  key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  bytes BYTEA NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =============================================
-- 11. CHAIN EVENTS
-- =============================================
-- Persists every parsed log from the leaderboard cron so aggregations
-- recompute from the database (cheap) instead of re-fetching the entire
-- on-chain history every run. Idempotent insert key:
-- (contract_address, tx_hash, log_index) — combined with a confirmation /
-- lookback window in the cron, the same log can be ingested twice with no
-- duplicate row.
CREATE TABLE IF NOT EXISTS chain_events (
  id BIGSERIAL PRIMARY KEY,
  category VARCHAR(30) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  tx_hash VARCHAR(66) NOT NULL,
  log_index INTEGER NOT NULL,
  block_number BIGINT NOT NULL,
  user_address VARCHAR(42) NOT NULL,
  item_id TEXT,
  amount NUMERIC,
  CONSTRAINT chain_events_event_key UNIQUE (contract_address, tx_hash, log_index)
);

CREATE INDEX IF NOT EXISTS idx_chain_events_lookup
  ON chain_events (contract_address, category, user_address);

CREATE INDEX IF NOT EXISTS idx_chain_events_item
  ON chain_events (contract_address, category, item_id);


-- =============================================
-- 12. TAG REPORTS
-- =============================================
-- Player-submitted issue reports for NFC tags. Surfaced in the admin Reports
-- tab. Display id is "R-<id>"; numeric id is what's stored.
--
-- type values match the issue ids in lib/reports.ts (kept in sync with the
-- ReportSheet picker): not_scanning | missing | wrong_place | damaged |
-- duplicate | other.
--
-- proposed_x / proposed_y store percent-of-image coords for wrong_place
-- reports where the reporter dropped a relocated pin; null otherwise.
CREATE TABLE IF NOT EXISTS tag_reports (
  id SERIAL PRIMARY KEY,
  tag_id INTEGER REFERENCES nfc_tags(id) ON DELETE CASCADE,
  tag_name VARCHAR(255),
  type VARCHAR(20) NOT NULL CHECK (type IN ('not_scanning','missing','wrong_place','damaged','duplicate','other')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','progress','resolved')),
  priority VARCHAR(10) NOT NULL DEFAULT 'med' CHECK (priority IN ('high','med','low')),
  reporter_address VARCHAR(42),
  description TEXT,
  has_photo BOOLEAN DEFAULT false,
  photo_url TEXT,
  proposed_x DECIMAL(5,2),
  proposed_y DECIMAL(5,2),
  assignee_address VARCHAR(42),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by VARCHAR(42)
);

CREATE INDEX IF NOT EXISTS idx_tag_reports_tag      ON tag_reports(tag_id);
CREATE INDEX IF NOT EXISTS idx_tag_reports_status   ON tag_reports(status);
CREATE INDEX IF NOT EXISTS idx_tag_reports_reporter ON tag_reports(reporter_address);
CREATE INDEX IF NOT EXISTS idx_tag_reports_created  ON tag_reports(created_at DESC);


-- =============================================
-- 13. DISABLE ROW LEVEL SECURITY
-- =============================================
-- The Next.js API layer is the only caller; authorization is enforced by
-- JWT cookies in route handlers. Skip RLS to avoid duplicating auth logic.
ALTER TABLE treasure_hunt_users   DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_wallets         DISABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_tags              DISABLE ROW LEVEL SECURITY;
ALTER TABLE nfc_tag_finds         DISABLE ROW LEVEL SECURITY;
ALTER TABLE merch                 DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_accounts       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sync_state            DISABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache     DISABLE ROW LEVEL SECURITY;
ALTER TABLE contract_deployments  DISABLE ROW LEVEL SECURITY;
ALTER TABLE chain_events          DISABLE ROW LEVEL SECURITY;
ALTER TABLE tag_reports           DISABLE ROW LEVEL SECURITY;

ALTER TABLE storage_objects DISABLE ROW LEVEL SECURITY;

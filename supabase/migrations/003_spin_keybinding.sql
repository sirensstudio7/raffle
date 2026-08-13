ALTER TABLE raffle_settings
  ADD COLUMN IF NOT EXISTS spin_keybinding VARCHAR(32) NOT NULL DEFAULT 'Space';

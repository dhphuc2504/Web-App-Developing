-- Additive: existing staff, sessions, dishes and history remain unchanged.
CREATE TABLE restaurant.admin_mfa (
 user_id uuid PRIMARY KEY REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 secret text, enabled boolean NOT NULL DEFAULT false,
 last_step integer NOT NULL DEFAULT -1, failures integer NOT NULL DEFAULT 0,
 locked_until timestamptz,
 CONSTRAINT enabled_secret CHECK (NOT enabled OR secret IS NOT NULL),
 CONSTRAINT valid_failures CHECK (failures >= 0)
);
CREATE TABLE restaurant.mfa_challenges (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 token_hash varchar(64) UNIQUE NOT NULL, purpose varchar(24) NOT NULL,
 version integer NOT NULL, payload jsonb NOT NULL,
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX mfa_challenges_user_id_created_at_idx ON restaurant.mfa_challenges(user_id,created_at);
CREATE INDEX mfa_challenges_expires_at_idx ON restaurant.mfa_challenges(expires_at);
CREATE TABLE restaurant.mfa_recovery_codes (
 id varchar(8) PRIMARY KEY, user_id uuid NOT NULL REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 hash text NOT NULL, used_at timestamptz
);
CREATE INDEX mfa_recovery_codes_user_id_idx ON restaurant.mfa_recovery_codes(user_id);

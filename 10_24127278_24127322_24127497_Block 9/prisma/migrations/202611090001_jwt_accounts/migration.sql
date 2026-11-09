-- Preserve Block 8 verification and approval decisions when sharing its database.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='restaurant' AND table_name='staff_users' AND column_name='approval_status') THEN
  ALTER TABLE restaurant.staff_users ADD COLUMN email_verified_at timestamptz,
   ADD COLUMN approval_status varchar(10) NOT NULL DEFAULT 'pending',
   ADD COLUMN session_version integer NOT NULL DEFAULT 0;
  UPDATE restaurant.staff_users SET email_verified_at=CURRENT_TIMESTAMP, approval_status='approved';
  ALTER TABLE restaurant.staff_users ADD CONSTRAINT staff_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS restaurant.auth_tokens (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 purpose varchar(10) NOT NULL CHECK (purpose IN ('verify','reset')), token_hash varchar(64) NOT NULL UNIQUE,
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS auth_tokens_user_id_purpose_created_at_idx ON restaurant.auth_tokens(user_id,purpose,created_at);
CREATE INDEX IF NOT EXISTS auth_tokens_expires_at_idx ON restaurant.auth_tokens(expires_at);
ALTER TABLE restaurant.dishes ADD COLUMN IF NOT EXISTS chef_id uuid REFERENCES restaurant.staff_users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS dishes_chef_id_idx ON restaurant.dishes(chef_id);
CREATE TABLE IF NOT EXISTS restaurant.login_challenges (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 token_hash varchar(64) NOT NULL UNIQUE, code_hash varchar(64) NOT NULL,
 attempts integer NOT NULL DEFAULT 0, session_version integer NOT NULL,
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS login_challenges_user_id_created_at_idx ON restaurant.login_challenges(user_id,created_at);
CREATE INDEX IF NOT EXISTS login_challenges_expires_at_idx ON restaurant.login_challenges(expires_at);
CREATE TABLE IF NOT EXISTS restaurant.failed_attempts (
 key varchar(64) PRIMARY KEY, count integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL
);

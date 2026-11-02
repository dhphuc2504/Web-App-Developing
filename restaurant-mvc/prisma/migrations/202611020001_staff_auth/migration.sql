-- Additive migration: retain existing staff access and all restaurant records.
ALTER TABLE restaurant.staff_users
 ADD COLUMN email_verified_at TIMESTAMPTZ,
 ADD COLUMN approval_status VARCHAR(10) NOT NULL DEFAULT 'pending',
 ADD COLUMN session_version INTEGER NOT NULL DEFAULT 0;
UPDATE restaurant.staff_users SET email_verified_at = CURRENT_TIMESTAMP, approval_status = 'approved';
ALTER TABLE restaurant.staff_users ADD CONSTRAINT staff_approval_status_check CHECK (approval_status IN ('pending','approved','rejected'));
CREATE TABLE restaurant.auth_tokens (
 id UUID PRIMARY KEY,
 user_id UUID NOT NULL REFERENCES restaurant.staff_users(id) ON DELETE CASCADE,
 purpose VARCHAR(10) NOT NULL CHECK (purpose IN ('verify','reset')),
 token_hash VARCHAR(64) NOT NULL UNIQUE,
 expires_at TIMESTAMPTZ NOT NULL,
 used_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX auth_tokens_user_id_purpose_created_at_idx ON restaurant.auth_tokens(user_id,purpose,created_at);
CREATE INDEX auth_tokens_expires_at_idx ON restaurant.auth_tokens(expires_at);

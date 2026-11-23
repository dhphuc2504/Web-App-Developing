CREATE SCHEMA IF NOT EXISTS stillroom;
CREATE TABLE IF NOT EXISTS stillroom.accounts (
  id uuid PRIMARY KEY, username text NOT NULL, email text, password_hash text
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_username ON stillroom.accounts(lower(username));
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email ON stillroom.accounts(lower(email));
ALTER TABLE stillroom.accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_digest text,
  ADD COLUMN IF NOT EXISTS verification_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_verification ON stillroom.accounts(verification_digest)
  WHERE verification_digest IS NOT NULL;
CREATE TABLE IF NOT EXISTS stillroom.sessions (
  digest text PRIMARY KEY, account_id uuid NOT NULL REFERENCES stillroom.accounts(id), expires timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS stillroom.photos (
  id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES stillroom.accounts(id),
  title text NOT NULL, public boolean NOT NULL DEFAULT false, created_at timestamptz(3) NOT NULL DEFAULT now(),
  format text NOT NULL, bytes integer NOT NULL, original_width integer NOT NULL, original_height integer NOT NULL,
  width integer NOT NULL, height integer NOT NULL, captured text, latitude double precision, longitude double precision,
  edit jsonb NOT NULL, revision uuid NOT NULL
);
ALTER TABLE stillroom.photos ADD COLUMN IF NOT EXISTS variant_widths jsonb;
CREATE INDEX IF NOT EXISTS gallery_page ON stillroom.photos(owner_id, created_at DESC, id DESC);
CREATE TABLE IF NOT EXISTS stillroom.garbage (key text PRIMARY KEY, after_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS stillroom.daily_picks (
  account_id uuid NOT NULL REFERENCES stillroom.accounts(id), day date NOT NULL,
  photo_id uuid NOT NULL REFERENCES stillroom.photos(id) ON DELETE CASCADE,
  PRIMARY KEY (account_id, day)
);

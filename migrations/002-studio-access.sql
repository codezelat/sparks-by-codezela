CREATE TABLE IF NOT EXISTS admin_users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS signin_limits (
  key text PRIMARY KEY,
  attempts integer NOT NULL,
  window_started timestamptz NOT NULL DEFAULT now()
);

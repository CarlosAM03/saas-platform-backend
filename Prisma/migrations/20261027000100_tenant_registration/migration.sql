-- ADR-006. Run audit-email.sql first. Atomic DDL/data transformation; collisions
-- abort BEFORE any historical email or schema changes. Never merge accounts.
BEGIN;
LOCK TABLE "users" IN ACCESS EXCLUSIVE MODE;

-- Explicit ECMAScript trim whitespace, including Unicode spaces.
CREATE FUNCTION canonical_user_email(value TEXT) RETURNS TEXT
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(btrim(value, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF'));
$$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM users GROUP BY canonical_user_email(email) HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'ADR006_EMAIL_COLLISION: audit and resolve explicitly before migrating';
  END IF;
END $$;
UPDATE users SET email = canonical_user_email(email) WHERE email <> canonical_user_email(email);
CREATE FUNCTION normalize_user_email_write() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.email := canonical_user_email(NEW.email); RETURN NEW; END $$;
CREATE TRIGGER users_normalize_email BEFORE INSERT OR UPDATE OF email ON users
FOR EACH ROW EXECUTE FUNCTION normalize_user_email_write();
-- Keep Prisma's ordinary @unique usable for findUnique/upsert. The expression
-- index additionally protects mixed-case/concurrent SQL writers. No citext extension.
CREATE UNIQUE INDEX users_email_case_insensitive_key ON users (canonical_user_email(email));

CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_FIRST_ACCESS', 'COMPLETED');
CREATE TYPE "DeliveryStatus" AS ENUM ('PENDING', 'SENDING', 'ACCEPTED', 'FAILED', 'UNKNOWN');
ALTER TABLE users ADD COLUMN must_change_password BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE tenant_onboardings (
 id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 owner_user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 generation INTEGER NOT NULL DEFAULT 1 CHECK (generation > 0),
 activation_status "OnboardingStatus" NOT NULL DEFAULT 'PENDING_FIRST_ACCESS',
 delivery_status "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
 created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP(3),
 CHECK ((activation_status = 'COMPLETED') = (completed_at IS NOT NULL))
);
CREATE TABLE activation_links (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 onboarding_id TEXT NOT NULL REFERENCES tenant_onboardings(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 generation INTEGER NOT NULL CHECK (generation > 0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMP(3) NOT NULL, consumed_at TIMESTAMP(3),
 UNIQUE (onboarding_id, generation), CHECK (expires_at > created_at),
 CHECK (expires_at <= created_at + INTERVAL '24 hours')
);
CREATE TABLE first_access_challenges (
 id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 onboarding_id TEXT NOT NULL REFERENCES tenant_onboardings(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 generation INTEGER NOT NULL CHECK (generation > 0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 expires_at TIMESTAMP(3) NOT NULL, consumed_at TIMESTAMP(3),
 UNIQUE (onboarding_id, generation), CHECK (expires_at > created_at),
 CHECK (expires_at <= created_at + INTERVAL '15 minutes'),
 FOREIGN KEY (onboarding_id, generation) REFERENCES activation_links(onboarding_id, generation) ON DELETE RESTRICT
);
CREATE TABLE delivery_attempts (
 id TEXT PRIMARY KEY, onboarding_id TEXT NOT NULL REFERENCES tenant_onboardings(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 generation INTEGER NOT NULL CHECK (generation > 0), created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 lease_expires_at TIMESTAMP(3) NOT NULL, status "DeliveryStatus" NOT NULL DEFAULT 'SENDING',
 provider_accepted_at TIMESTAMP(3), UNIQUE (onboarding_id, generation),
 CHECK (lease_expires_at > created_at)
);
CREATE INDEX delivery_attempts_onboarding_id_created_at_idx ON delivery_attempts(onboarding_id, created_at);
CREATE INDEX delivery_attempts_created_at_idx ON delivery_attempts(created_at);
CREATE TABLE activation_rate_limits (
 key TEXT PRIMARY KEY, count INTEGER NOT NULL CHECK (count > 0 AND count <= 6), expires_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX activation_rate_limits_expires_at_idx ON activation_rate_limits(expires_at);
COMMIT;

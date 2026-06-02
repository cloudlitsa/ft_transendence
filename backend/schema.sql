-- =========================================================================
-- Check-in app — initial database schema
--
-- Five tables: users, friendships, alerts, acknowledgements, messages.
-- Designed to cover the MVP: auth + profiles + friends + alerts + chat.
--
-- Conventions:
--   - All IDs are UUIDs (Universally Unique Identifiers) (unguessable, slightly slower than integers — fine).
--   - Every table has created_at / updated_at where useful.
--   - Foreign keys ON DELETE CASCADE where the child can't exist without
--     the parent (e.g. messages without an alert make no sense).
-- =========================================================================

-- Postgres extension that gives us gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- -------------------------------------------------------------------------
-- users — one row per account
-- -------------------------------------------------------------------------
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,                  -- bcrypt hash, never plain
    display_name    TEXT NOT NULL,
    avatar_url      TEXT,                            -- nullable; default avatar in UI
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Faster login lookups by email
CREATE INDEX idx_users_email ON users (email);


-- -------------------------------------------------------------------------
-- friendships — one row per relationship (Option A: symmetric storage)
--
-- Convention: user_id_a < user_id_b ALWAYS. The CHECK constraint enforces
-- this so we can't accidentally create two rows for the same pair.
-- requested_by tells us who sent the invite (matters only while pending).
-- -------------------------------------------------------------------------
CREATE TYPE friendship_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE friendships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id_a       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_id_b       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status          friendship_status NOT NULL DEFAULT 'pending',
    requested_by    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT pair_ordered     CHECK (user_id_a < user_id_b),
    CONSTRAINT pair_unique      UNIQUE (user_id_a, user_id_b),
    CONSTRAINT requester_is_one_of_pair
        CHECK (requested_by = user_id_a OR requested_by = user_id_b)
);

-- Lookups: "give me all friendships involving this user"
CREATE INDEX idx_friendships_user_a ON friendships (user_id_a);
CREATE INDEX idx_friendships_user_b ON friendships (user_id_b);


-- -------------------------------------------------------------------------
-- alerts — one row per check-in someone has sent
-- -------------------------------------------------------------------------
CREATE TYPE alert_type   AS ENUM ('need_chat', 'not_okay', 'reach_out');
CREATE TYPE alert_status AS ENUM ('active', 'closed');

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type      alert_type NOT NULL,
    status          alert_status NOT NULL DEFAULT 'active',
    note            TEXT,                            -- optional short context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ
);

CREATE INDEX idx_alerts_sender   ON alerts (sender_id);
CREATE INDEX idx_alerts_active   ON alerts (status) WHERE status = 'active';


-- -------------------------------------------------------------------------
-- acknowledgements — friends marking an alert as "I see you"
--
-- Composite primary key (alert_id, user_id) means a friend can ack an
-- alert at most once.
-- -------------------------------------------------------------------------
CREATE TABLE acknowledgements (
    alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (alert_id, user_id)
);

CREATE INDEX idx_ack_alert ON acknowledgements (alert_id);


-- -------------------------------------------------------------------------
-- messages — chat attached to an alert
-- -------------------------------------------------------------------------
CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL CHECK (length(content) > 0 AND length(content) <= 2000),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_alert_time ON messages (alert_id, created_at);


-- -------------------------------------------------------------------------
-- updated_at maintenance — a trigger to keep these columns honest
-- -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_touch_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER friendships_touch_updated_at
    BEFORE UPDATE ON friendships
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

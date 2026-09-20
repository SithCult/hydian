-- Hydian backend schema. Append-only, as raw as the client can make it.
-- Identity is ALWAYS (server, character_id); names are display-only.

CREATE TABLE IF NOT EXISTS installs (
  id          uuid PRIMARY KEY,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  app_version text
);

-- Reject delayed uploads after erasure without keeping the original install credential.
CREATE TABLE IF NOT EXISTS erased_installs (
  digest text PRIMARY KEY
);

-- A removed character stays removed for this installation until explicit sharing resumes.
CREATE TABLE IF NOT EXISTS removed_characters (
  install_digest text NOT NULL,
  character_digest text NOT NULL,
  PRIMARY KEY (install_digest, character_digest)
);

CREATE TABLE IF NOT EXISTS characters (
  server      text   NOT NULL,
  id          bigint NOT NULL,
  name        text   NOT NULL,
  class       text,
  discipline  text,
  first_seen  timestamptz NOT NULL DEFAULT now(),
  last_seen   timestamptz NOT NULL DEFAULT now(),
  install_id  uuid,                      -- last install that reported this character as its own
  PRIMARY KEY (server, id)
);

-- Every ping a client sends about ITS OWN character. Never updated, never deleted.
CREATE TABLE IF NOT EXISTS pings (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  received_at   timestamptz NOT NULL DEFAULT now(),
  install_id    uuid   NOT NULL,
  app_version   text,
  kind          text   NOT NULL,         -- login | area | move | status | heartbeat
  server        text   NOT NULL,
  character_id  bigint NOT NULL,
  character_name text  NOT NULL,
  class         text,
  discipline    text,
  area_id       bigint,
  area_name     text,
  area_mode     text,
  x             real,  y real,  h real,  heading real,
  hp            integer, hp_max integer,
  status        text,                    -- ic | ooc | invisible
  lfrp          boolean NOT NULL DEFAULT false,
  instance      smallint,                -- server instance ("Nar Shaddaa 2"), set by hand in the app; not in the log
  log_ts        timestamptz,             -- timestamp of the log line that produced this ping (client clock)
  raw           text                     -- the original combat-log line, verbatim
) PARTITION BY RANGE (received_at);

-- Other players a client's log mentioned (targeting, grouping). Unregistered; name + position only.
CREATE TABLE IF NOT EXISTS sightings (
  id            bigint GENERATED ALWAYS AS IDENTITY,
  received_at   timestamptz NOT NULL DEFAULT now(),
  install_id    uuid   NOT NULL,
  server        text   NOT NULL,
  seen_by       bigint NOT NULL,         -- character_id of the reporting character
  character_id  bigint NOT NULL,
  character_name text  NOT NULL,
  area_id       bigint,
  x             real,  y real,  h real,
  log_ts        timestamptz,
  raw           text
) PARTITION BY RANGE (received_at);

ALTER TABLE pings ADD COLUMN IF NOT EXISTS instance smallint;
-- the install that first shared a character keeps priority over later claimants (see routes/pings.ts)
ALTER TABLE characters ADD COLUMN IF NOT EXISTS claimed_by uuid;
-- Friend edges, install -> character. The friend list itself lives on the client; this is the graph.
CREATE TABLE IF NOT EXISTS friends (
  install_id   uuid   NOT NULL,
  server       text   NOT NULL,
  character_id bigint NOT NULL,
  added_at     timestamptz NOT NULL DEFAULT now(),
  removed_at   timestamptz,
  PRIMARY KEY (install_id, server, character_id)
);

-- Why people leave (offboarding) or what they think: optional, tied to an install id only.
CREATE TABLE IF NOT EXISTS feedback (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now(),
  install_id  uuid,
  kind        text NOT NULL,                 -- offboarding | general
  reasons     text[] NOT NULL DEFAULT '{}',
  rating      smallint,                      -- 1..5
  comment     text,
  app_version text
);

CREATE TABLE IF NOT EXISTS pings_default     PARTITION OF pings     DEFAULT;
CREATE TABLE IF NOT EXISTS sightings_default PARTITION OF sightings DEFAULT;

CREATE INDEX IF NOT EXISTS pings_received_brin   ON pings     USING brin (received_at);
CREATE INDEX IF NOT EXISTS pings_char            ON pings     (server, character_id, received_at);
CREATE INDEX IF NOT EXISTS pings_area            ON pings     (server, area_id, received_at);
CREATE INDEX IF NOT EXISTS sightings_received    ON sightings USING brin (received_at);
CREATE INDEX IF NOT EXISTS sightings_char        ON sightings (server, character_id, received_at);
-- heat map / analytics read by log time, not arrival time (history backfill arrives years late)
CREATE INDEX IF NOT EXISTS pings_area_log        ON pings     (server, area_id, log_ts);
CREATE INDEX IF NOT EXISTS sightings_area_log    ON sightings (server, area_id, log_ts);

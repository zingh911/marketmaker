-- MarketMaker — initial schema
-- Built to HANDOFF.md "The data model", agreed by Harpreet 2026-08-28.
-- Four tables. Do not add a fifth without a ruling.
--
-- Shared-vs-private corpus (expensive decision 2) is STILL OPEN. This file is
-- the SHARED shape: no tenant column anywhere. If that call comes back
-- "private", apply 0002_private_corpus.sql on top — it is written and waiting.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- markets — the canonical, reusable thing a query resolves to.
-- ---------------------------------------------------------------------------
create table markets (
  id              uuid primary key default gen_random_uuid(),
  canonical_name  text not null unique,
  -- Free-text phrasings that resolve here. Empty in phase 1: nothing routes
  -- through search yet (work order 7, do not build).
  query_aliases   text[] not null default '{}',
  created_at      timestamptz not null default now(),
  -- Stays null until the crawler exists. A non-null value here means someone
  -- built work order 7 — check RULINGS.md before believing it.
  last_crawled_at timestamptz
);

-- ---------------------------------------------------------------------------
-- companies — the spine. Everything else in the system reads this contract.
-- ---------------------------------------------------------------------------
create type entity_type as enum ('target', 'acquirer');
create type ownership_kind as enum ('independent', 'franchise', 'pe_backed', 'public');

create table companies (
  id          uuid primary key default gen_random_uuid(),

  -- Which question this row answers. 'acquirer' = who is buying and where.
  -- 'target' = where do I buy. Different products; a map that cannot tell
  -- them apart will mislead. See HANDOFF.md.
  entity_type entity_type not null,

  name            text not null,
  -- lowercased, punctuation and legal suffixes stripped. Half the match key.
  normalized_name text not null,

  website text,
  domain  text,           -- extracted from website. The other half of the match key.

  -- Fallback point only. THE MAP READS company_locations, not this.
  -- A single-location company can live here alone and cost nothing extra.
  address text,
  city    text,
  region  text,
  country text,
  lat     double precision,
  lng     double precision,

  market_id uuid not null references markets(id),

  -- normalized_name + domain + approximate location. What dedup runs against.
  match_key text not null,

  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now(),
  -- Decision 5. Null until something re-checks the row. A market mapped in
  -- January is wrong by June and a dead company destroys trust faster than a
  -- missing one.
  last_verified timestamptz,
  closed        boolean not null default false,

  -- Decision 4: store the judgment, not just the verdict. Null for phase 1's
  -- hand-held list — nothing is being classified yet. Required the day a model
  -- starts deciding market membership. Impossible to backfill.
  classification_reasoning     text,
  classification_source_text   text,
  classification_prompt_version text,

  -- Signals. Nullable, accumulated over time. This is the layer that compounds.
  -- `sector` is a documented deviation from the schema agreed 2026-08-28,
  -- added 2026-08-29: market_id says which market a company is in, sector says
  -- where inside it. Dataset one has 30+ sectors across 72 acquirers and the
  -- crowding read depends on it. See HANDOFF.md.
  sector         text,
  employees_est  text,          -- a band ("51-200"), not a number — see below
  revenue_est    text,
  year_founded   integer,
  locations_count integer,
  ownership      ownership_kind,
  owner_name     text,
  review_count   integer,
  review_avg     numeric(2,1),
  license_status text,
  notes          text
);

create index companies_market_idx    on companies (market_id);
create index companies_match_key_idx on companies (match_key);
create index companies_entity_idx    on companies (entity_type);

-- ---------------------------------------------------------------------------
-- company_locations — where a company actually OPERATES.
-- Added 2026-08-28 after the first real record (Resolve Pain Solutions: HQ
-- Atlanta, clinics across six states) would not fit the table above.
-- ---------------------------------------------------------------------------
create type location_kind as enum ('hq', 'site');

create table company_locations (
  id         uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  kind       location_kind not null,

  address text,
  city    text,
  region  text,
  country text,

  -- NULLABLE ON PURPOSE. A real record can say "operates in Tennessee" without
  -- naming a town. A null point means known-present, not-located: the map shows
  -- the region, and nobody invents a pin to fill the gap.
  lat double precision,
  lng double precision,

  source        text,
  first_seen    timestamptz not null default now(),
  -- A site can close while the company lives.
  last_verified timestamptz
);

create index company_locations_company_idx on company_locations (company_id);

-- Exactly one hq per company.
create unique index company_locations_one_hq
  on company_locations (company_id)
  where kind = 'hq';

-- ---------------------------------------------------------------------------
-- company_source_records — one row per source hit, NEVER overwritten.
-- Decision 1: if merges are reversible, a bad match rule is a bad afternoon.
-- If you merged destructively, it is a re-crawl.
-- ---------------------------------------------------------------------------
create table company_source_records (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  source      text not null,   -- which pull found this. Tells a stale source from a quiet one.
  raw_name    text,            -- exactly what that source said, untouched
  raw_address text,
  pulled_at   timestamptz not null default now()
);

create index company_source_records_company_idx on company_source_records (company_id);
create index company_source_records_source_idx  on company_source_records (source);

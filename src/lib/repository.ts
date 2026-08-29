/**
 * The repository — the seam the whole architecture hangs off.
 *
 * RULINGS.md, 2026-08-28: "the map reads a set of rows matching the company
 * table, never a named file. Pointing it at the first dataset directly is how
 * 'the user brings a list' gets hardcoded into the foundation by accident."
 *
 * That ruling is enforced HERE and nowhere else. Above this line the map asks
 * for rows and does not know or care where they came from. Below it there are
 * two adapters:
 *
 *   postgres — used the moment DATABASE_URL exists. The real one.
 *   seed     — the records in src/data/dataset-one.ts, in memory, used until
 *              a database is connected (work order 3 is blocked on Supabase).
 *
 * The seed adapter is a temporary answer to "where do the rows come from",
 * NOT a second way to build the product. Nothing above this file may import
 * src/data/* directly. If a component ever does, the ruling has been broken and
 * search cannot be added later without a rewrite.
 *
 * Which adapter is live is printed on boot and shown in the UI — never a guess.
 */

import type {
  Company,
  CompanyLocation,
  CompanyWithLocations,
  MapPoint,
  Market,
  Source,
} from "@/lib/types";
import {
  COMPANIES,
  COMPANY_LOCATIONS,
  MARKET_AI_NATIVE_ROLLUPS,
} from "@/data/dataset-one";

// ---------------------------------------------------------------------------
// Adapter selection
// ---------------------------------------------------------------------------

const DATABASE_URL = process.env.DATABASE_URL?.trim();

export function activeSource(): Source {
  if (DATABASE_URL) {
    // Never log or return the URL itself — it carries a password.
    let host = "unknown host";
    try {
      host = new URL(DATABASE_URL).host;
    } catch {
      /* malformed URL still counts as "postgres configured" */
    }
    return { name: "postgres", detail: host };
  }
  return {
    name: "seed",
    detail: `${COMPANIES.length} real record${
      COMPANIES.length === 1 ? "" : "s"
    } from the handed-over list · no database connected`,
  };
}

let announced = false;
function announceOnce() {
  if (announced) return;
  announced = true;
  const s = activeSource();
  // dev-agent standing rule: the running app announces which data universe it
  // is in, so it is never a guess.
  console.log(`[marketmaker] data source: ${s.name} — ${s.detail}`);
}

// ---------------------------------------------------------------------------
// Postgres adapter
// ---------------------------------------------------------------------------

type PgPool = import("pg").Pool;
let pool: PgPool | null = null;

async function getPool(): Promise<PgPool> {
  if (pool) return pool;
  const { Pool } = await import("pg");
  pool = new Pool({
    connectionString: DATABASE_URL,
    // Supabase's pooled connection requires TLS and presents a cert Node does
    // not chain to a local root. Standard for this provider.
    ssl: { rejectUnauthorized: false },
    max: 3,
  });
  return pool;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToCompany(r: any): Company {
  return {
    id: r.id,
    entityType: r.entity_type,
    name: r.name,
    normalizedName: r.normalized_name,
    website: r.website,
    domain: r.domain,
    address: r.address,
    city: r.city,
    region: r.region,
    country: r.country,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    marketId: r.market_id,
    matchKey: r.match_key,
    firstSeen: iso(r.first_seen),
    lastSeen: iso(r.last_seen),
    lastVerified: r.last_verified ? iso(r.last_verified) : null,
    closed: r.closed,
    classificationReasoning: r.classification_reasoning,
    classificationSourceText: r.classification_source_text,
    classificationPromptVersion: r.classification_prompt_version,
    employeesEst: r.employees_est,
    revenueEst: r.revenue_est,
    yearFounded: r.year_founded,
    locationsCount: r.locations_count,
    ownership: r.ownership,
    ownerName: r.owner_name,
    reviewCount: r.review_count,
    reviewAvg: r.review_avg === null ? null : Number(r.review_avg),
    licenseStatus: r.license_status,
    notes: r.notes,
  };
}

function rowToLocation(r: any): CompanyLocation {
  return {
    id: r.id,
    companyId: r.company_id,
    kind: r.kind,
    address: r.address,
    city: r.city,
    region: r.region,
    country: r.country,
    lat: r.lat === null ? null : Number(r.lat),
    lng: r.lng === null ? null : Number(r.lng),
    source: r.source,
    firstSeen: iso(r.first_seen),
    lastVerified: r.last_verified ? iso(r.last_verified) : null,
  };
}

function rowToMarket(r: any): Market {
  return {
    id: r.id,
    canonicalName: r.canonical_name,
    queryAliases: r.query_aliases ?? [],
    createdAt: iso(r.created_at),
    lastCrawledAt: r.last_crawled_at ? iso(r.last_crawled_at) : null,
  };
}

function iso(v: unknown): string {
  return v instanceof Date ? v.toISOString() : String(v);
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// The public interface. Everything above the seam calls only these.
// ---------------------------------------------------------------------------

export async function getMarket(canonicalName: string): Promise<Market | null> {
  announceOnce();
  if (!DATABASE_URL) {
    return MARKET_AI_NATIVE_ROLLUPS.canonicalName === canonicalName
      ? MARKET_AI_NATIVE_ROLLUPS
      : null;
  }
  const db = await getPool();
  const { rows } = await db.query(
    "select * from markets where canonical_name = $1",
    [canonicalName],
  );
  return rows[0] ? rowToMarket(rows[0]) : null;
}

/**
 * The one query the map runs. Give it a market and it hands back rows matching
 * the company table, with their locations resolved.
 *
 * When search arrives it calls this with a different market id. That is the
 * whole change.
 */
export async function getCompanies(
  marketId: string,
): Promise<CompanyWithLocations[]> {
  announceOnce();

  if (!DATABASE_URL) {
    return COMPANIES.filter((c) => c.marketId === marketId).map((c) => ({
      ...c,
      locations: COMPANY_LOCATIONS.filter((l) => l.companyId === c.id),
    }));
  }

  const db = await getPool();
  const companies = await db.query(
    "select * from companies where market_id = $1 and closed = false order by name",
    [marketId],
  );
  if (companies.rows.length === 0) return [];

  const ids = companies.rows.map((r) => r.id);
  const locations = await db.query(
    "select * from company_locations where company_id = any($1::uuid[])",
    [ids],
  );

  const byCompany = new Map<string, CompanyLocation[]>();
  for (const r of locations.rows) {
    const loc = rowToLocation(r);
    const list = byCompany.get(loc.companyId);
    if (list) list.push(loc);
    else byCompany.set(loc.companyId, [loc]);
  }

  return companies.rows.map((r) => ({
    ...rowToCompany(r),
    locations: byCompany.get(r.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Derived reads. Pure functions over rows — no data access, no industry logic.
// ---------------------------------------------------------------------------

/**
 * Every point the map can honestly draw.
 *
 * A company with located rows contributes those. A company with none falls back
 * to its own lat/lng, so a single-location target costs nothing extra — that is
 * the fallback HANDOFF.md promises. A company with neither contributes nothing
 * and is NOT silently dropped from the product: see regionsWithoutPoints.
 */
export function toMapPoints(companies: CompanyWithLocations[]): MapPoint[] {
  const points: MapPoint[] = [];

  for (const c of companies) {
    const located = c.locations.filter(
      (l): l is CompanyLocation & { lat: number; lng: number } =>
        l.lat !== null && l.lng !== null,
    );

    if (located.length > 0) {
      for (const l of located) {
        points.push({
          companyId: c.id,
          companyName: c.name,
          locationId: l.id,
          kind: l.kind,
          label: [l.city, l.region].filter(Boolean).join(", ") || c.name,
          lat: l.lat,
          lng: l.lng,
        });
      }
      continue;
    }

    if (c.lat !== null && c.lng !== null) {
      points.push({
        companyId: c.id,
        companyName: c.name,
        locationId: `${c.id}:fallback`,
        kind: "hq",
        label: [c.city, c.region].filter(Boolean).join(", ") || c.name,
        lat: c.lat,
        lng: c.lng,
      });
    }
  }

  return points;
}

/**
 * States a company is known to operate in but that we cannot place.
 *
 * These are the rows with a region and a null point. They are shown as text,
 * never as pins. A map that quietly drops them under-reports the footprint; a
 * map that centroids them over-reports its own precision. Listing them is the
 * only honest option.
 */
export function regionsWithoutPoints(c: CompanyWithLocations): string[] {
  const seen = new Set<string>();
  for (const l of c.locations) {
    if (l.lat === null && l.lng === null && l.region) seen.add(l.region);
  }
  return [...seen].sort();
}

/** Every state a company touches, located or not. */
export function allRegions(c: CompanyWithLocations): string[] {
  const seen = new Set<string>();
  for (const l of c.locations) if (l.region) seen.add(l.region);
  if (seen.size === 0 && c.region) seen.add(c.region);
  return [...seen].sort();
}

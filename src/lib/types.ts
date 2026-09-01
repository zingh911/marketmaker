/**
 * The company table, in TypeScript.
 *
 * This mirrors db/migrations/0001_init.sql and is the ONLY shape the map ever
 * sees. HANDOFF.md, "The architecture": the map reads a set of rows matching
 * the company table, however they were obtained — never a named file. Search
 * (work order 7) becomes a layer in front that decides which rows to hand over,
 * and nothing below this line changes when it arrives.
 */

export type EntityType = "target" | "acquirer";
export type LocationKind = "hq" | "site";
export type Ownership = "independent" | "franchise" | "pe_backed" | "public";

export interface Market {
  id: string;
  canonicalName: string;
  queryAliases: string[];
  createdAt: string;
  lastCrawledAt: string | null;
}

export interface CompanyLocation {
  id: string;
  companyId: string;
  kind: LocationKind;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  /**
   * Null means known-present, not-located. A source can say "operates in
   * Tennessee" without naming a town, and the map shows that as a region
   * rather than inventing a pin. Do not backfill these with a state centroid:
   * a made-up point is indistinguishable from a real one once it is drawn.
   */
  lat: number | null;
  lng: number | null;
  source: string | null;
  firstSeen: string;
  lastVerified: string | null;
}

export interface Company {
  id: string;
  entityType: EntityType;

  name: string;
  normalizedName: string;
  website: string | null;
  domain: string | null;

  /** Fallback point. Used only when the company has no located rows. */
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;

  marketId: string;
  matchKey: string;

  firstSeen: string;
  lastSeen: string;
  lastVerified: string | null;
  closed: boolean;

  classificationReasoning: string | null;
  classificationSourceText: string | null;
  classificationPromptVersion: string | null;

  // Signals — nullable, accumulated over time.
  /**
   * Sub-classification inside the market ("Roofing Services", "Freight
   * Broker"). Added 2026-08-29 as a deviation from the agreed schema, with
   * reason: dataset one carries 30+ distinct sectors across 72 acquirers, and
   * "which sub-sector is crowded" is exactly the market read this product
   * promises. market_id says which market; this says where inside it.
   */
  sector: string | null;
  employeesEst: string | null;
  revenueEst: string | null;
  yearFounded: number | null;
  locationsCount: number | null;
  ownership: Ownership | null;
  ownerName: string | null;
  reviewCount: number | null;
  reviewAvg: number | null;
  licenseStatus: string | null;
  notes: string | null;
}

/** A company with its locations resolved. What the map actually renders. */
export interface CompanyWithLocations extends Company {
  locations: CompanyLocation[];
}

/**
 * Where a pin goes, and whether it is real.
 *
 * `located` rows have a real lat/lng from a real address. `regionOnly` rows are
 * places we know the company operates but cannot place — they are listed, never
 * pinned. Keeping them apart is the difference between a map that reports and a
 * map that guesses.
 */
export interface MapPoint {
  companyId: string;
  companyName: string;
  locationId: string;
  kind: LocationKind;
  label: string;
  lat: number;
  lng: number;
}

export interface Source {
  /** Which adapter answered. Printed on boot and shown in the UI. */
  name: "postgres" | "seed";
  detail: string;
}

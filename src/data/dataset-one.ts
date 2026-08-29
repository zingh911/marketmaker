/**
 * Dataset one — AI-native roll-ups. THE REAL RECORDS WE ACTUALLY HOLD.
 *
 * Right now that is exactly one company. Harpreet handed over the Resolve Pain
 * Solutions record on 2026-08-28 while the mockups were being drawn; the rest
 * of the list has not been handed over yet (work order 4, STATUS.md).
 *
 * NOTHING IN THIS FILE IS INVENTED. HANDOFF.md "Start here" step 4: build the
 * map against real data, not fake rows, because a map built on invented data
 * gets rebuilt the day real data arrives and the fields do not match. One real
 * company exercises the whole path — schema, repository, locations, map — and
 * the day the full list lands it loads into the same tables with no code
 * change. Do not pad this file to make the map look busier.
 *
 * The mockups (mockup/Main.dc.html) show a 118-row market. Those figures are
 * illustrative and are marked as such in HANDOFF.md. They are not here.
 */

import type { Company, CompanyLocation, Market } from "@/lib/types";

const NOW = "2026-08-28T00:00:00.000Z";

export const MARKET_AI_NATIVE_ROLLUPS: Market = {
  id: "00000000-0000-4000-8000-000000000001",
  canonicalName: "AI-native roll-ups",
  // Empty on purpose. Nothing routes through search yet — work order 7, and
  // RULINGS.md says do not start it.
  queryAliases: [],
  createdAt: NOW,
  // Null because nothing has been crawled. If this is ever non-null in phase 1,
  // someone built the crawler and should not have.
  lastCrawledAt: null,
};

const RESOLVE_PAIN_ID = "00000000-0000-4000-8000-000000000101";

export const COMPANIES: Company[] = [
  {
    id: RESOLVE_PAIN_ID,
    // This list is acquirers — the firms doing the roll-ups. It answers
    // "who is buying and where", not "where do I buy".
    entityType: "acquirer",

    name: "Resolve Pain Solutions",
    normalizedName: "resolve pain solutions",
    website: "https://resolvepainsolutions.com",
    domain: "resolvepainsolutions.com",

    // Fallback point only — this company has located rows, so the map uses
    // those. Kept because the schema says a single-location company can live
    // on this alone.
    address: null,
    city: "Atlanta",
    region: "GA",
    country: "US",
    lat: 33.749,
    lng: -84.388,

    marketId: MARKET_AI_NATIVE_ROLLUPS.id,
    matchKey: "resolve pain solutions|resolvepainsolutions.com|us-ga-atlanta",

    firstSeen: NOW,
    lastSeen: NOW,
    // Null. Nothing has re-checked this row. Do not stamp a date here to make
    // the UI look fresher — that is the field a dealmaker trusts.
    lastVerified: null,
    closed: false,

    // Null across the board: phase 1's list is hand-held, nothing is being
    // classified by a model yet. These become required the day one is.
    classificationReasoning: null,
    classificationSourceText: null,
    classificationPromptVersion: null,

    // Self-reported LinkedIn band, and the source itself carried a "probably
    // undercounts" caveat. Stored as the band it actually is, not as a number.
    // The UI marks it `est`. Printing it as a fact is lying by formatting.
    employeesEst: "51-200",
    revenueEst: null,
    yearFounded: 2022,
    // Known: it operates across six states. NOT the same as how many clinics —
    // we do not have that number, so this stays null rather than guessing from
    // the located rows below.
    locationsCount: null,
    ownership: "pe_backed",
    ownerName: "Compass Group",
    reviewCount: null,
    reviewAvg: null,
    licenseStatus: null,
    notes:
      "Platform launched 2022 by founding CEO Eric Schnapp. Andrew Jones CEO since Jul 2025 — both are carried because the real record is ambiguous and a single 'founder' row flattens it. Corporate Development Manager seat open, reporting to the CEO, owning the M&A pipeline sourcing through close.",
  },
];

/**
 * The record that broke the first schema.
 *
 * HQ in Atlanta, operating across six states — Georgia, Tennessee, Mississippi,
 * Alabama, Louisiana, South Carolina. One lat/lng could only draw the head
 * office, which is the wrong answer to the question the map exists to ask.
 *
 * READ THE NULLS. The source names cities for the acquisitions (Aiken SC,
 * Baton Rouge LA, New Orleans LA) and nothing more precise than the state for
 * Tennessee, Mississippi and Alabama. Those three carry a null point on
 * purpose: known-present, not-located. Filling them with a state centroid would
 * put three pins on the map that look exactly like the four real ones.
 */
export const COMPANY_LOCATIONS: CompanyLocation[] = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    companyId: RESOLVE_PAIN_ID,
    kind: "hq",
    address: null,
    city: "Atlanta",
    region: "GA",
    country: "US",
    lat: 33.749,
    lng: -84.388,
    source: "handed-over-list-2026-08-28",
    firstSeen: NOW,
    lastVerified: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: "Aiken",
    region: "SC",
    country: "US",
    lat: 33.5604,
    lng: -81.7196,
    source: "handed-over-list-2026-08-28 (Southcoast Spine, Mar 2026)",
    firstSeen: NOW,
    lastVerified: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: "Baton Rouge",
    region: "LA",
    country: "US",
    lat: 30.4515,
    lng: -91.1871,
    source: "handed-over-list-2026-08-28 (Spine Diagnostic, Jan 2026)",
    firstSeen: NOW,
    lastVerified: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: "New Orleans",
    region: "LA",
    country: "US",
    lat: 29.9511,
    lng: -90.0715,
    source: "handed-over-list-2026-08-28 (Louisiana Pain Specialists, Dec 2024)",
    firstSeen: NOW,
    lastVerified: null,
  },
  // Known-present, not-located. No pin. Listed in the panel instead.
  {
    id: "00000000-0000-4000-8000-000000000205",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: null,
    region: "TN",
    country: "US",
    lat: null,
    lng: null,
    source: "handed-over-list-2026-08-28 (state named, no city)",
    firstSeen: NOW,
    lastVerified: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000206",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: null,
    region: "MS",
    country: "US",
    lat: null,
    lng: null,
    source: "handed-over-list-2026-08-28 (state named, no city)",
    firstSeen: NOW,
    lastVerified: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000207",
    companyId: RESOLVE_PAIN_ID,
    kind: "site",
    address: null,
    city: null,
    region: "AL",
    country: "US",
    lat: null,
    lng: null,
    source: "handed-over-list-2026-08-28 (state named, no city)",
    firstSeen: NOW,
    lastVerified: null,
  },
];

/**
 * Source records — one row per source hit, never overwritten.
 *
 * One entry today because one source handed us this company. When the crawl
 * exists and finds "Resolve Pain Solutions LLC" somewhere else, it lands here
 * as a second row linked to the same company, and nothing gets overwritten.
 */
export const COMPANY_SOURCE_RECORDS = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    companyId: RESOLVE_PAIN_ID,
    source: "handed-over-list-2026-08-28",
    rawName: "Resolve Pain Solutions",
    rawAddress: "Atlanta, GA",
    pulledAt: NOW,
  },
];

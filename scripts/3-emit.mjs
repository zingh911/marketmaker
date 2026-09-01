import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(readFileSync("intermediate.json", "utf8"));
const OUT = "/Users/harpreetzingh/Desktop/Heavyweight Studios/products/MarketMaker/app/src/data/dataset-one.ts";
const j = (v) => JSON.stringify(v);

const companies = d.companies.map((c) => `  {
    id: ${j(c.id)},
    entityType: "acquirer",
    name: ${j(c.name)},
    normalizedName: ${j(c.normalizedName)},
    website: ${j(c.website)},
    domain: ${j(c.domain)},
    address: null,
    city: ${j(c.city)},
    region: ${j(c.region)},
    country: ${j(c.country)},
    lat: ${c.lat},
    lng: ${c.lng},
    marketId: MARKET_ID,
    matchKey: ${j(c.matchKey)},
    firstSeen: NOW,
    lastSeen: NOW,
    lastVerified: null,
    closed: false,
    classificationReasoning: null,
    classificationSourceText: null,
    classificationPromptVersion: null,
    sector: ${j(c.sector)},
    employeesEst: ${j(c.employeesEst)},
    revenueEst: null,
    yearFounded: ${c.yearFounded},
    locationsCount: null,
    ownership: ${j(c.ownership)},
    ownerName: ${j(c.ownerName)},
    reviewCount: null,
    reviewAvg: null,
    licenseStatus: null,
    notes: ${j(c.notes)},
  },`).join("\n");

const locations = d.locations.map((l) => `  { id: ${j(l.id)}, companyId: ${j(l.companyId)}, kind: ${j(l.kind)}, address: null, city: ${j(l.city)}, region: ${j(l.region)}, country: ${j(l.country)}, lat: ${l.lat}, lng: ${l.lng}, source: ${j(l.source)}, firstSeen: NOW, lastVerified: null },`).join("\n");

const nLocated = d.locations.filter((l) => l.lat !== null).length;
const nRegionOnly = d.locations.filter((l) => l.lat === null).length;
const placeable = new Set(d.locations.filter((l) => l.lat !== null).map((l) => l.companyId)).size;

const header = `/**
 * Dataset one - AI-native roll-ups. GENERATED, from real sources only.
 *
 * Nothing in this file is invented. Every row traces to one of two real files:
 *
 *   products/Origination Radar/ai-rollups/companies.json   (72 companies,
 *     scraped from ai-rollup.fyi/companies, fetched 2026-08, US/Canada slice
 *     of a 209-company database)
 *   products/Origination Radar/ai-rollups/locations.json   (a text-extraction
 *     pass over the above - locations quoted out of fields that already
 *     existed, NOT fresh research)
 *
 * Plus Resolve Pain Solutions, handed over separately on 2026-08-28 and not
 * part of that batch.
 *
 * WHAT THE NUMBERS ACTUALLY ARE, so nobody quotes them wrongly:
 *   ${d.companies.length} companies
 *   ${placeable} of them have at least one point and appear on the map
 *   ${d.companies.length - placeable} have no location at all and are listed, never pinned
 *   ${nLocated} located rows, ${nRegionOnly} region-only rows
 *
 * The ${d.companies.length - placeable} unplaced companies are NOT a bug and must not be "fixed" by
 * inferring a location. locations.json was a parse of existing text, so a
 * company whose record never mentioned a city simply has no location known.
 * Real HQ research on the remainder is a separate work order.
 *
 * Coordinates came from OpenStreetMap Nominatim, one request per distinct
 * place at ~1/sec. Region-only rows keep null lat/lng on purpose: the map
 * lists them and never draws them. A state centroid would be indistinguishable
 * from a real pin, and counts are this product's entire output.
 *
 * To regenerate: the source files are the truth. Do not hand-edit this file.
 */

import type { Company, CompanyLocation, Market } from "@/lib/types";

const NOW = "2026-08-28T00:00:00.000Z";
const MARKET_ID = "00000000-0000-4000-8000-000000000001";

export const MARKET_AI_NATIVE_ROLLUPS: Market = {
  id: MARKET_ID,
  canonicalName: "AI-native roll-ups",
  // Empty on purpose - nothing routes through search yet (work order 7).
  queryAliases: [],
  createdAt: NOW,
  // Null because nothing has been crawled. Non-null here in phase 1 means
  // somebody built the crawler and should not have.
  lastCrawledAt: null,
};

export const COMPANIES: Company[] = [
${companies}
];

export const COMPANY_LOCATIONS: CompanyLocation[] = [
${locations}
];
`;

writeFileSync(OUT, header);
console.log("companies:", d.companies.length, "| placeable:", placeable, "| located rows:", nLocated, "| region-only:", nRegionOnly);
console.log("wrote", OUT);

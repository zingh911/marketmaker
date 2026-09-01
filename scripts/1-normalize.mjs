/**
 * Generates app/src/data/dataset-one.ts from the two real source files.
 * Run from the scratchpad. Nothing here invents a value.
 */
import { readFileSync, writeFileSync } from "node:fs";

const AI = "/Users/harpreetzingh/Desktop/Heavyweight Studios/products/Origination Radar/ai-rollups";
const OUT = "/Users/harpreetzingh/Desktop/Heavyweight Studios/products/MarketMaker/app/src/data/dataset-one.ts";

const src = JSON.parse(readFileSync(`${AI}/companies.json`, "utf8"));
const locSrc = JSON.parse(readFileSync(`${AI}/locations.json`, "utf8"));

const NOW = "2026-08-28T00:00:00.000Z";
const MARKET_ID = "00000000-0000-4000-8000-000000000001";

const LEGAL = /\b(inc|llc|l\.l\.c|ltd|limited|corp|corporation|co|company|holdings|group|plc|gmbh|sa|sas|bv|ab|oy)\b\.?/gi;

function normalizeName(n) {
  return n.toLowerCase().replace(LEGAL, " ").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}
function domainOf(url) {
  if (!url) return null;
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}
function intOrNull(v) {
  if (v === null || v === undefined) return null;
  const m = String(v).match(/\b(1[89]\d{2}|20\d{2})\b/);
  return m ? Number(m[1]) : null;
}
function uuid(n) {
  return `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
function clean(s) {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  return t === "" ? null : t;
}

// --- companies -------------------------------------------------------------

let idc = 1000;
const companies = src.companies.map((c) => {
  const e = c.enrichment || {};
  const website = clean(e.website);
  const notes = [
    clean(e.founder) && `Founder: ${e.founder}`,
    clean(e.past_completed_deals) && `Deals: ${e.past_completed_deals}`,
    clean(e.open_role) && `Hiring: ${e.open_role}`,
    clean(e.funding_detail) && `Funding: ${e.funding_detail}`,
  ].filter(Boolean).join("\n\n") || null;

  return {
    id: uuid(++idc),
    sourceName: c.name,
    entityType: "acquirer",
    name: c.name,
    normalizedName: normalizeName(c.name),
    website,
    domain: domainOf(website),
    address: null, city: null, region: null, country: c.country === "USA" ? "US" : c.country,
    lat: null, lng: null,
    marketId: MARKET_ID,
    matchKey: `${normalizeName(c.name)}|${domainOf(website) ?? ""}|`,
    firstSeen: NOW, lastSeen: NOW, lastVerified: null, closed: false,
    classificationReasoning: null, classificationSourceText: null, classificationPromptVersion: null,
    employeesEst: clean(e.headcount),
    revenueEst: null,
    yearFounded: intOrNull(e.year_founded),
    locationsCount: null,
    ownership: null,
    ownerName: null,
    reviewCount: null, reviewAvg: null, licenseStatus: null,
    notes,
    sector: clean(c.sector),
    fundingTier: clean(c.funding_tier),
    priority: clean(c.priority),
  };
});

// Resolve Pain Solutions — handed over separately, not in the batch.
const RP_ID = uuid(101);
companies.unshift({
  id: RP_ID,
  sourceName: "Resolve Pain Solutions",
  entityType: "acquirer",
  name: "Resolve Pain Solutions",
  normalizedName: "resolve pain solutions",
  website: "https://resolvepainsolutions.com",
  domain: "resolvepainsolutions.com",
  address: null, city: "Atlanta", region: "GA", country: "US",
  lat: 33.749, lng: -84.388,
  marketId: MARKET_ID,
  matchKey: "resolve pain solutions|resolvepainsolutions.com|us-ga-atlanta",
  firstSeen: NOW, lastSeen: NOW, lastVerified: null, closed: false,
  classificationReasoning: null, classificationSourceText: null, classificationPromptVersion: null,
  employeesEst: "51-200",
  revenueEst: null, yearFounded: 2022, locationsCount: null,
  ownership: "pe_backed", ownerName: "Compass Group",
  reviewCount: null, reviewAvg: null, licenseStatus: null,
  notes: "Founder: Eric Schnapp (founding CEO, 2022 launch); Andrew Jones CEO since Jul 2025 — both carried because the real record is ambiguous.\n\nDeals: Southcoast Spine, Aiken SC (Mar 2026); Spine Diagnostic, Baton Rouge LA (Jan 2026); Louisiana Pain Specialists (Dec 2024).\n\nHiring: Corporate Development Manager open, reporting to the CEO, owning the M&A pipeline sourcing through close.",
  sector: "Medical",
  fundingTier: null,
  priority: "priority",
});

const byName = new Map(companies.map((c) => [c.sourceName, c]));

// --- locations -------------------------------------------------------------

let idl = 2000;
const locations = [];

// Resolve Pain's own footprint (4 located, 3 region-only).
for (const [kind, city, region, lat, lng, note] of [
  ["hq", "Atlanta", "GA", 33.749, -84.388, "handed-over record"],
  ["site", "Aiken", "SC", 33.5604, -81.7196, "Southcoast Spine, Mar 2026"],
  ["site", "Baton Rouge", "LA", 30.4515, -91.1871, "Spine Diagnostic, Jan 2026"],
  ["site", "New Orleans", "LA", 29.9511, -90.0715, "Louisiana Pain Specialists, Dec 2024"],
  ["site", null, "TN", null, null, "state named, no city"],
  ["site", null, "MS", null, null, "state named, no city"],
  ["site", null, "AL", null, null, "state named, no city"],
]) {
  locations.push({
    id: uuid(++idl), companyId: RP_ID, kind, address: null, city, region, country: "US",
    lat, lng, source: `handed-over-list-2026-08-28 (${note})`, firstSeen: NOW, lastVerified: null,
    confidence: "high",
  });
}

const unmatched = [];
for (const r of locSrc.locations) {
  const c = byName.get(r.company);
  if (!c) { unmatched.push(r.company); continue; }
  locations.push({
    id: uuid(++idl),
    companyId: c.id,
    kind: r.kind,
    address: null,
    city: clean(r.city),
    region: clean(r.region),
    country: r.country === "USA" ? "US" : clean(r.country),
    lat: null, lng: null,
    source: clean(r.source),
    firstSeen: NOW,
    lastVerified: null,
    confidence: clean(r.confidence),
  });
}

console.log("companies:", companies.length);
console.log("location rows:", locations.length);
console.log("unmatched company names in locations.json:", unmatched.length ? unmatched.join(", ") : "none");
console.log("rows needing geocode (city present, no lat):", locations.filter((l) => l.city && l.lat === null).length);

writeFileSync("./intermediate.json", JSON.stringify({ companies, locations }, null, 1));
console.log("wrote intermediate.json");

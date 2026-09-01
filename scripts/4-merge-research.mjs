/**
 * Merges scripts/research-2026-08-31/*.json into intermediate.json.
 *
 * That directory holds real per-company research: four agents visited each
 * company's own website (About/Contact/footer) for the 55 companies that had
 * zero location on file after the first pass, following the same rules as
 * everything else in this pipeline — null beats a guess, region-only is kept,
 * every row quotes its source and a confidence tier. See result0-3.json for
 * the raw per-company findings and new-locations.json for the merged,
 * geocoded, schema-shaped rows actually applied.
 *
 * This step is NOT re-run automatically by 1-3 — it is a one-time addition to
 * intermediate.json, run once after 1-normalize.mjs + 2-geocode.mjs. If the
 * base dataset ever changes enough to need a full regenerate, re-apply this
 * file too, or the 55-company gap comes back.
 *
 * Usage: node scripts/1-normalize.mjs && node scripts/2-geocode.mjs && \
 *        node scripts/4-merge-research.mjs && node scripts/3-emit.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const d = JSON.parse(readFileSync("intermediate.json", "utf8"));
const rows = JSON.parse(
  readFileSync("scripts/research-2026-08-31/new-locations.json", "utf8"),
);

const NOW = "2026-08-28T00:00:00.000Z";
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
let idl = 3000;

const alreadyMerged = d.locations.some((l) => l.id?.endsWith("003001"));
if (alreadyMerged) {
  console.log("already merged — skipping");
} else {
  d.locations.push(
    ...rows.map((r) => ({
      id: uuid(++idl),
      companyId: r.companyId,
      kind: r.kind,
      address: null,
      city: r.city,
      region: r.region,
      country: r.country,
      lat: r.lat,
      lng: r.lng,
      source: r.source,
      firstSeen: NOW,
      lastVerified: null,
      confidence: r.confidence,
    })),
  );
  writeFileSync("intermediate.json", JSON.stringify(d, null, 1));
  console.log(
    "merged",
    rows.length,
    "rows — locations now",
    d.locations.length,
    "| companies with >=1:",
    new Set(d.locations.map((l) => l.companyId)).size,
    "of",
    d.companies.length,
  );
}

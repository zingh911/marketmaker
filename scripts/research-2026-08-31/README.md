# 2026-08-31 location research

The first location pass (`../2-geocode.mjs` era) only parsed text already
sitting in `companies.json` — it placed 15 of 73 companies. This directory is
a second, real pass: four agents visited each of the 55 unplaced companies'
own websites (About/Contact/footer pages) and recorded what those pages
actually say, with the same discipline as everything else in this pipeline.

- `result0.json`–`result3.json` — one file per agent's batch, raw findings,
  every row carrying a `confidence` tier (`high`/`moderate`/`low`) and a
  `source` field quoting or citing where it came from.
- `new-locations.json` — the above merged, filtered (rows with zero signal —
  no city and no region — dropped), deduplicated to one `hq` per company, and
  geocoded. This is what `../4-merge-research.mjs` actually applies.

**Result: 42 of the 55 previously-unplaced companies gained at least one
location.** 13 remain genuinely unplaced — checked and confirmed empty, not
skipped. Two of those (Bruges, Sedona) share names with real places; both were
explicitly verified NOT to be headquartered there, so their place-name is not
being mistaken for a location signal.

**Some rows carry `low` confidence — a single aggregator, a blocked company
site, or an unresolved conflict between sources.** They are kept, not dropped,
because they are a real (if weak) finding, not a guess — but the confidence
tier is preserved into the app's `source` field so nothing downstream treats
them as equal to a page that states its own address. Read a `source` field
before trusting a `low` row for anything more than "roughly here."

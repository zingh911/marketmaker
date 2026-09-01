# Regenerating `src/data/dataset-one.ts`

`src/data/dataset-one.ts` is generated. Do not hand-edit it.

Run in order, from this directory:

```
node scripts/1-normalize.mjs       # reads the two source files, writes intermediate.json
node scripts/2-geocode.mjs         # fills lat/lng on the base 16 rows from OSM Nominatim
node scripts/4-merge-research.mjs  # merges scripts/research-2026-08-31/ (see its own README)
node scripts/3-emit.mjs            # writes ../src/data/dataset-one.ts
```

`intermediate.json` is a scratch file this pipeline writes and reads between
steps — it is gitignored and safe to delete before a fresh run.

## The coupling worth knowing about

**`1-normalize.mjs`'s source files do not live in this repo.** They are:

```
products/Origination Radar/ai-rollups/companies.json
products/Origination Radar/ai-rollups/locations.json
```

Paths are absolute and machine-specific, which means this step runs on
Harpreet's machine and nowhere else. That is deliberate for now — copying the
data in would fork it, and it is still being corrected upstream (a duplicate
and a wrong country were both fixed on 2026-08-28). It stops being acceptable
the moment the database exists: at that point the data lives in Postgres, this
generator becomes a one-off import, and the coupling goes away.

`research-2026-08-31/` has no such coupling — it is committed data, not a
pointer to another product's files.

## Rules every step here follows

- **Nothing is invented.** Every field traces to a real source: a scraped
  field, a company's own website, or a quoted third-party aggregator.
- **Null beats a guess.** A company with no findable location gets no
  coordinate. No state centroids, no inferring from a name or sector — a made-up
  point is indistinguishable from a real one once it is drawn, and counts are
  this product's entire output.
- **Region-only rows are kept**, with null lat/lng. The map lists them and does
  not pin them.
- **Confidence is preserved, not collapsed.** A `low`-confidence finding (one
  aggregator, a blocked site, a conflict between sources) is still real — it is
  kept, with the tier carried into the row's `source` text, rather than either
  discarded or presented as equal to a company's own stated address.
- Nominatim is called once per distinct place at ~1 request/second with a real
  User-Agent, per its usage policy. Do not parallelise it.

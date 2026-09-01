# Regenerating `src/data/dataset-one.ts`

`src/data/dataset-one.ts` is generated. Do not hand-edit it.

Run in order, from this directory:

```
node scripts/1-normalize.mjs   # reads the two source files, writes intermediate.json
node scripts/2-geocode.mjs     # fills lat/lng from OSM Nominatim, ~1 req/sec
node scripts/3-emit.mjs        # writes ../src/data/dataset-one.ts
```

## The coupling worth knowing about

**The source files do not live in this repo.** They are:

```
products/Origination Radar/ai-rollups/companies.json
products/Origination Radar/ai-rollups/locations.json
```

Paths are absolute and machine-specific, which means these scripts run on
Harpreet's machine and nowhere else. That is deliberate for now — copying the
data in would fork it, and it is still being corrected upstream (a duplicate
and a wrong country were both fixed on 2026-08-28). It stops being acceptable
the moment the database exists: at that point the data lives in Postgres, this
generator becomes a one-off import, and the coupling goes away.

## Rules these scripts follow

- **Nothing is invented.** Every field traces to one of the two source files.
- **Null beats a guess.** A company with no location gets no coordinate. No
  state centroids, ever — a made-up point is indistinguishable from a real one
  once it is drawn, and counts are this product's entire output.
- **Region-only rows are kept**, with null lat/lng. The map lists them and does
  not pin them.
- Nominatim is called once per distinct place at ~1 request/second with a real
  User-Agent, per its usage policy. Do not parallelise it.

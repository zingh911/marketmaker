# Company-intel pass, 2026-10-08

On 2026-10-08 Harpreet asked for the CRM view in the real app, with a
/company-intel enrichment on every lead. This directory holds that pass.

- **`batches/`** holds all 73 leads, split across 10 agents. Each entry carries the
  2026-08-24 profile from `Origination Radar/ai-rollups/companies.json` and the
  source labels (`priority`, `funding_tier`, `flags`). The labels are copied in so
  this directory has no coupling to another product's files.
- **`AGENT-BRIEF.md`** is the instruction every research agent followed. It applies
  `studio/skills/company-intel/SKILL.md` unchanged. The prior profile is only a
  lead to re-verify, and every careers page was fetched live.
- **`intel/<company_id>.json`** holds one company per file, in the exact input shape
  of the company-intel card, plus `company_id`, `name_in_list`, `identity_note`
  and `sources`.

To rebuild `src/data/intel.ts`, run this from `app/`:

```
node scripts/5-emit-intel.mjs
```

If a lead has no file in `intel/`, it keeps its 2026-08-24 profile, and the app
shows that it is the older pass. Passes are never merged field by field, because
each record is one dated read, whole.

## Re-running it for one company

Run `/company-intel <name>`. Then save the card object as
`intel/<company_id>.json` with the four extra keys and re-run the generator. A
newer read should go in a new dated directory, not overwrite this one, once the
`company_intel` table (`db/migrations/0003_company_intel.sql.PENDING`) exists to
hold history.

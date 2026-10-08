# Company-intel enrichment pass, 2026-10-08: brief for each research agent

You are running the **company-intel** method on a batch of companies for MarketMaker.
The method is defined in `~/.claude/skills/company-intel/SKILL.md`. Read it first and
follow it exactly: identify → research → fill the profile → card fields.

## Input

Your batch file is `scripts/research-2026-10-08/batches/batch-N.json`, relative to
`products/MarketMaker/app/`. Each entry holds:

- `company_id` (keep it verbatim), `name`, `website`, `known_hq`, `sector`
- `funding_tier` and `priority` (source labels; don't change them)
- `flags`
- `prior_enrichment_2026_08_24`: a profile from an earlier pass, six weeks old.

Treat the prior enrichment as **leads to re-verify**, not as fact. Keep a prior fact
only if a source you checked today still supports it. If a prior fact no longer
holds (someone left, a new round, a new acquisition), use today's fact and add a
caveat. It may be null, as for Resolve Pain Solutions.

## Output: one file per company

Write `scripts/research-2026-10-08/intel/<company_id>.json`. Each file is exactly the
input object of `mcp__company-intel-pane__show_company_profile`, plus four extra keys:

```json
{
  "company_id": "...",          // verbatim from the batch
  "name_in_list": "...",        // verbatim from the batch
  "identity_note": "...",       // which company you matched and why; name collisions
  "sources": ["https://..."],   // every URL you actually relied on

  "profile": { "name": ..., "description": ..., "website": ..., "location": ...,
               "year_founded": ..., "founder": ..., "founder_linkedin": ...,
               "founder_email": ..., "funding_detail": ..., "headcount": ...,
               "past_completed_deals": ..., "open_role": ..., "contact_path": ... },
  "verdict": { "kind": "buyer|target|role_open|watch", "headline": "...", "detail": "..." },
  "tagline": "Sector · HQ city",
  "description": "...",
  "stats": [{ "value": "...", "label": "...", "caveat": false }],
  "headlines": [...], "ownership": [...], "deals": [...], "footprint": {...},
  "competitors": [...], "best_contact": {...}, "people": [...],
  "none_found": [...], "caveats": [...],
  "verified_on": "2026-10-08",
  "verified_note": "careers page live | careers page blocked (403) | secondary sources only"
}
```

- Every profile key is present, with `null` where nothing credible exists.
- Most of these companies are roll-up acquirers, so `verdict.kind` is usually `buyer`
  or `watch`. Use `role_open` only for a live corp-dev or M&A role that you saw on the
  live careers page today. Omit `proof` unless the verdict is `target`.
- `open_role` must use one of the skill's four exact shapes, dated `2026-10-08`, and
  must come from fetching the live careers page today. If the page is blocked or
  JS-only, say so. Never pass off a search snippet as a live read.
- `founder_email`: only an address published somewhere you can cite. Never
  pattern-generate one. Usually null.
- The `footprint` codes are US state codes. A non-US company leaves `hq` out and says
  so in `notes`.

## Rules

- **Nothing invented.** Null beats a guess. A wrong confident answer is worse than a
  gap, because the reader can't tell the two apart later.
- **Generic names collide** (Gain, Pillar, Loop, Kim, Modus, Ellis, Corgi, Roofer…).
  Confirm sector and stage against the batch entry. If you can't tell the candidates
  apart, leave the profile thin and explain why in `identity_note`.
- After each company's file is written and its facts are verified, call
  `mcp__company-intel-pane__show_company_profile` once for that company, passing the
  same object without the four extra keys. If the tool isn't available, skip the call.
- Write only inside `scripts/research-2026-10-08/intel/`. Don't edit any other file,
  and don't run git.
- Validate each file with `python3 -m json.tool <file>` after writing it.

## When you finish

Reply with one line per company in this format:
`<name>: <verdict.kind> · <n> of 13 profile fields filled · <verified_note>`

Then list anything you couldn't resolve.

"use client";

/**
 * The CRM view: every lead in one place, in list mode or map mode, with the
 * /company-intel profile in a drawer that is the same in both.
 *
 * Built to the CRM canvas (claude.ai design, 2026-10-08). The table is for
 * scanning and sorting; the drawer is where the dated text lives. Every label
 * the table shows that is DERIVED (hiring signal, intel score, a short
 * headcount) sits next to the stored text it came from in the drawer, so a
 * tier is never mistaken for the read.
 */

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CompanyIntel,
  CompanyWithLocations,
  IntelPerson,
  MapPoint,
  Source,
} from "@/lib/types";
import {
  PROFILE_FIELDS,
  SIGNALS,
  type Signal,
  foundedYear,
  headcountShort,
  hiringSignal,
  intelScore,
} from "@/lib/intel";

const MarketMap = dynamic(() => import("@/components/MarketMap"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        color: "var(--muted-foreground)",
        fontSize: 13,
      }}
    >
      Loading map&hellip;
    </div>
  ),
});

type View = "list" | "map";
type Filter = "all" | "priority" | "signal" | "buyer" | "nopin";
type SortKey = "name" | "sector" | "hq" | "stage" | "headcount" | "signal" | "call" | "map" | "intel";

/** Same box as MarketMap's soft-lock. Used only to say "outside this view". */
const NA = { s: 5, w: -172, n: 75, e: -48 };
const inNA = (p: MapPoint) => p.lat >= NA.s && p.lat <= NA.n && p.lng >= NA.w && p.lng <= NA.e;

/** Funding tiers, most to least mature, as the source buckets them. */
const STAGE_ORDER = ["PE Growth / Series C-D", "Series B", "Series A", "Seed", "Pre-seed"];

const VERDICTS: Record<string, { label: string; color: string }> = {
  buyer: { label: "BUYER", color: "#a98bf5" },
  role_open: { label: "ROLE OPEN", color: "#a98bf5" },
  target: { label: "TARGET", color: "#4bb0c4" },
  watch: { label: "WATCH", color: "#9d9daa" },
};

interface Props {
  marketName: string;
  companies: CompanyWithLocations[];
  points: MapPoint[];
  intel: Record<string, CompanyIntel>;
  source: Source;
  unlocatedRegions: Record<string, string[]>;
  allRegions: Record<string, string[]>;
  initialView: View;
  initialSelected: string | null;
}

interface RowData {
  c: CompanyWithLocations;
  intel: CompanyIntel | undefined;
  signal: Signal;
  score: number;
  hq: { text: string; muted: boolean };
  mapState: "pinned" | "outside" | "nopin";
  hc: { short: string; disputed: boolean } | null;
}

export default function Crm({
  marketName,
  companies,
  points,
  intel,
  source,
  unlocatedRegions,
  allRegions,
  initialView,
  initialSelected,
}: Props) {
  const [view, setView] = useState<View>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelected);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  // Keep the URL shareable: ?view=map&c=<id>. replaceState, not navigation —
  // this is view state, not a new page.
  useEffect(() => {
    const u = new URL(window.location.href);
    if (view === "map") u.searchParams.set("view", "map");
    else u.searchParams.delete("view");
    if (selectedId) u.searchParams.set("c", selectedId);
    else u.searchParams.delete("c");
    window.history.replaceState(null, "", u.toString());
  }, [view, selectedId]);

  const pointsByCompany = useMemo(() => {
    const m = new Map<string, MapPoint[]>();
    for (const p of points) {
      const l = m.get(p.companyId);
      if (l) l.push(p);
      else m.set(p.companyId, [p]);
    }
    return m;
  }, [points]);

  const rows: RowData[] = useMemo(
    () =>
      companies.map((c) => {
        const i = intel[c.id];
        const pts = pointsByCompany.get(c.id) ?? [];
        const mapState: RowData["mapState"] =
          pts.length === 0 ? "nopin" : pts.some(inNA) ? "pinned" : "outside";
        return {
          c,
          intel: i,
          signal: hiringSignal(i),
          score: intelScore(i),
          hq: hqText(c, allRegions[c.id] ?? []),
          mapState,
          hc: headcountShort(i?.profile.headcount ?? c.employeesEst),
        };
      }),
    [companies, intel, pointsByCompany, allRegions],
  );

  const counts = useMemo(() => {
    const pinned = rows.filter((r) => r.mapState !== "nopin").length;
    const fullPass = rows.filter((r) => r.intel?.full).length;
    return { total: rows.length, pinned, nopin: rows.length - pinned, fullPass };
  }, [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (filter === "priority" && r.intel?.priority !== "priority") return false;
      if (filter === "signal" && r.signal !== "role_open" && r.signal !== "mna_scope") return false;
      if (filter === "buyer" && r.intel?.verdict?.kind !== "buyer") return false;
      if (filter === "nopin" && r.mapState !== "nopin") return false;
      if (!q) return true;
      return [r.c.name, r.c.sector, r.c.domain, r.hq.text, r.intel?.profile.founder]
        .filter(Boolean)
        .some((s) => s!.toLowerCase().includes(q));
    });
    const cmp = comparator(sort.key);
    return out.sort((a, b) => cmp(a, b) * sort.dir || a.c.name.localeCompare(b.c.name));
  }, [rows, filter, query, sort]);

  const visibleIds = useMemo(() => new Set(visible.map((r) => r.c.id)), [visible]);
  const visiblePoints = useMemo(
    () => points.filter((p) => visibleIds.has(p.companyId)),
    [points, visibleIds],
  );
  const outsideNames = useMemo(
    () => visible.filter((r) => r.mapState === "outside").map((r) => r.c.name),
    [visible],
  );

  const noPinCount = visible.filter((r) => r.mapState === "nopin").length;

  const selected = rows.find((r) => r.c.id === selectedId) ?? null;

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "intel" ? -1 : 1 }));
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <Header marketName={marketName} source={source} />

      <div className="crm-toolbar">
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: "-0.01em" }}>Companies</h1>
          <span className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{marketName}</span>
        </div>

        <div role="group" aria-label="View mode" className="seg-group">
          <button className="seg" aria-pressed={view === "list"} onClick={() => setView("list")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
            </svg>
            List
          </button>
          <button className="seg" aria-pressed={view === "map"} onClick={() => setView("map")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 4L3 6.5v13L9 17l6 3 6-2.5v-13L15 7z" />
              <path d="M9 4v13M15 7v13" />
            </svg>
            Map
          </button>
        </div>

        <div role="group" aria-label="Filters" style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {(
            [
              ["all", "All"],
              ["priority", "Priority"],
              ["signal", "Corp-dev signal"],
              ["buyer", "Active buyers"],
              ["nopin", "No pin"],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
              {label}
            </button>
          ))}
        </div>

        <input
          className="input"
          type="search"
          aria-label="Filter companies by name, sector, place or founder"
          placeholder="Filter by name, sector, place or founder"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: "1 1 200px", maxWidth: 320, marginLeft: "auto", height: 32, fontSize: 13 }}
        />

        <div className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>
          {counts.total} companies · {counts.pinned} on map · {counts.nopin} no pin ·{" "}
          <span title="Leads carrying the full /company-intel pass of 2026-10-08. The rest show the earlier 2026-08-24 profile.">
            {counts.fullPass}/{counts.total} intel 2026-10-08
          </span>
        </div>
      </div>

      <div className="crm-body">
        <div className="crm-main">
          {view === "list" ? (
            <ListView rows={visible} total={counts.total} selectedId={selectedId} onSelect={setSelectedId} sort={sort} onSort={toggleSort} />
          ) : (
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              <Rail rows={visible} total={counts.total} selectedId={selectedId} onSelect={setSelectedId} />
              <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
                <MarketMap points={visiblePoints} selectedCompanyId={selectedId} onSelect={setSelectedId} rightGutter={56} />
                <div className="map-notes">
                  <span className="map-note">Soft-locked to North America</span>
                  {outsideNames.length > 0 && (
                    <span className="map-note">Outside this view: {outsideNames.join(", ")}</span>
                  )}
                  {noPinCount > 0 && (
                    <span className="map-note">
                      {noPinCount} in this filter {noPinCount === 1 ? "has" : "have"} no pin, so {noPinCount === 1 ? "it is" : "they are"} listed, not drawn
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {selected && (
          <Drawer
            row={selected}
            unlocated={unlocatedRegions[selected.c.id] ?? []}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function hqText(c: CompanyWithLocations, regions: string[]): { text: string; muted: boolean } {
  const hq = c.locations.find((l) => l.kind === "hq");
  if (hq) return { text: placeName(hq.city, hq.region, hq.country), muted: false };
  const sites = c.locations.filter((l) => l.lat !== null);
  if (sites.length > 0) return { text: `${sites.length} site${sites.length === 1 ? "" : "s"} · no HQ`, muted: true };
  if (c.city || c.region) return { text: placeName(c.city, c.region, c.country), muted: false };
  if (regions.length > 0) return { text: `${regions.join(" ")} · no town`, muted: true };
  return { text: "not on file", muted: true };
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function placeName(city: string | null, region: string | null, country: string | null) {
  const tail = country && !["US", "USA", "CA", "Canada"].includes(country) ? country : region;
  return [city, tail].filter(Boolean).join(", ") || "not on file";
}

function comparator(key: SortKey): (a: RowData, b: RowData) => number {
  const stage = (r: RowData) => {
    const i = STAGE_ORDER.indexOf(r.intel?.fundingTier ?? "");
    return i === -1 ? 99 : i;
  };
  const num = (r: RowData) => {
    const n = r.hc ? parseInt(r.hc.short.replace(/[^\d]/g, "").slice(0, 7), 10) : NaN;
    return Number.isNaN(n) ? -1 : n;
  };
  const callRank = (r: RowData) => ["role_open", "buyer", "target", "watch"].indexOf(r.intel?.verdict?.kind ?? "") >>> 0;
  const str = (a: string, b: string) => a.localeCompare(b);
  switch (key) {
    case "name":
      return (a, b) => str(a.c.name, b.c.name);
    case "sector":
      return (a, b) => str(a.c.sector ?? "~", b.c.sector ?? "~");
    case "hq":
      return (a, b) => Number(a.hq.muted) - Number(b.hq.muted) || str(a.hq.text, b.hq.text);
    case "stage":
      return (a, b) => stage(a) - stage(b);
    case "headcount":
      return (a, b) => num(b) - num(a);
    case "signal":
      return (a, b) => SIGNALS[a.signal].rank - SIGNALS[b.signal].rank;
    case "call":
      return (a, b) => callRank(a) - callRank(b);
    case "map":
      return (a, b) => ["pinned", "outside", "nopin"].indexOf(a.mapState) - ["pinned", "outside", "nopin"].indexOf(b.mapState);
    case "intel":
      return (a, b) => a.score - b.score;
  }
}

/* -------------------------------------------------------------------------- */

function Header({ marketName, source }: { marketName: string; source: Source }) {
  return (
    <header
      style={{
        height: 56,
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
        background: "var(--card)",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div style={{ width: 22, height: 22, borderRadius: 6, background: "var(--primary)" }} />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>MarketMaker</span>
      </div>

      {/* Work order 7. Drawn, disabled, and labelled with why. */}
      <div
        className="ghost hide-narrow"
        style={{
          flex: 1,
          maxWidth: 620,
          height: 36,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 9,
          fontSize: 13,
        }}
        title="Natural-language search is work order 7. It unlocks after a dealmaker reacts to the map."
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        Natural-language search &mdash; work order 7, not built in phase 1
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <span className="badge badge-accent hide-narrow">{marketName.toUpperCase()}</span>
        <span
          className="badge"
          title={
            source.name === "postgres"
              ? "Reading Postgres."
              : "No database connected yet — reading the real records held in the repo. Never fabricated rows."
          }
        >
          {source.name === "postgres" ? "DB" : "NO DB"}
          <span className="hide-narrow">&nbsp;&middot; {source.detail}</span>
        </span>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: "name", label: "Company" },
  { key: "sector", label: "Sector" },
  { key: "hq", label: "HQ" },
  { key: "stage", label: "Stage", title: "Funding tier, as ai-rollup.fyi buckets it" },
  { key: "headcount", label: "Headcount" },
  { key: "signal", label: "Hiring signal", title: "Tiered from the dated careers-page read. The read itself is in the drawer." },
  { key: "call", label: "Call", title: "The company-intel verdict. Blank until the 2026-10-08 pass has run on this lead." },
  { key: "map", label: "Map" },
  { key: "intel", label: "Intel", title: "Profile fields filled, of 12" },
];

function ListView({
  rows,
  total,
  selectedId,
  onSelect,
  sort,
  onSort,
}: {
  rows: RowData[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
}) {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
      <table className="crm-table">
        <thead>
          <tr>
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                title={col.title}
                aria-sort={sort.key === col.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button className="th-btn" onClick={() => onSort(col.key)}>
                  {col.label}
                  <span aria-hidden="true" style={{ opacity: sort.key === col.key ? 1 : 0 }}>
                    {sort.dir === 1 ? "↑" : "↓"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const sig = SIGNALS[r.signal];
            const v = r.intel?.verdict ? VERDICTS[r.intel.verdict.kind] : null;
            return (
              <tr
                key={r.c.id}
                tabIndex={0}
                aria-selected={r.c.id === selectedId}
                onClick={() => onSelect(r.c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(r.c.id);
                  }
                }}
              >
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 500 }}>
                    <span>{r.c.name}</span>
                    {r.intel?.priority === "priority" && <span className="badge badge-accent badge-est">PRIORITY</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                    {r.c.domain ?? hostOf(r.intel?.profile.website) ?? "no website on file"}
                  </div>
                </td>
                <td style={{ color: "#cfcfd8" }}>{r.c.sector ?? "—"}</td>
                <td style={{ color: r.hq.muted ? "var(--muted-foreground)" : undefined }}>{r.hq.text}</td>
                <td className="nowrap">{r.intel?.fundingTier ?? "—"}</td>
                <td className="nowrap">
                  {r.hc ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      <span className="mono">{r.hc.short}</span>
                      <span className="badge badge-est" title={r.hc.disputed ? "Sources disagree. Both figures are in the drawer." : "An estimate or band, not a count."}>
                        {r.hc.disputed ? "disputed" : "est"}
                      </span>
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted-foreground)" }}>—</span>
                  )}
                </td>
                <td className="nowrap" title={sig.title}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: sig.color, flexShrink: 0 }} />
                    <span className="mono" style={{ fontSize: 11, color: sig.color }}>{sig.label}</span>
                  </span>
                </td>
                <td>
                  {v ? (
                    <span className="mono" style={{ fontSize: 11, color: v.color }} title={r.intel?.verdict?.headline}>
                      {v.label}
                    </span>
                  ) : (
                    <span className="mono" style={{ fontSize: 11, color: "#6b6b78" }} title="The full company-intel pass has not run on this lead yet.">
                      pending
                    </span>
                  )}
                </td>
                <td className="mono" style={{ fontSize: 11, color: r.mapState === "pinned" ? "var(--primary)" : "var(--muted-foreground)" }}>
                  {r.mapState === "pinned" ? "pinned" : r.mapState === "outside" ? "outside NA" : "no pin"}
                </td>
                <td>
                  <ScoreBar score={r.score} full={!!r.intel?.full} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="mono" style={{ padding: "14px 16px", fontSize: 12, color: "var(--muted-foreground)" }}>
        Showing {rows.length} of {total}
        {rows.length === 0 && " · nothing matches this filter"}
      </div>
    </div>
  );
}

function ScoreBar({ score, full }: { score: number; full: boolean }) {
  return (
    <span
      style={{ display: "inline-flex", alignItems: "center", gap: 7 }}
      title={`${score} of 12 profile fields filled · ${full ? "2026-10-08 pass" : "2026-08-24 pass"}`}
    >
      <span style={{ display: "inline-flex", gap: 2 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: 10,
              borderRadius: 1,
              background: i < score ? (full ? "var(--primary)" : "var(--acc-muted)") : "var(--muted)",
            }}
          />
        ))}
      </span>
      <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
        {score}
      </span>
    </span>
  );
}

function Rail({
  rows,
  total,
  selectedId,
  onSelect,
}: {
  rows: RowData[];
  total: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="crm-rail">
      {rows.map((r) => {
        const sig = SIGNALS[r.signal];
        return (
          <button key={r.c.id} className="rail-item" aria-pressed={r.c.id === selectedId} onClick={() => onSelect(r.c.id)}>
            <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>{r.c.name}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span title={sig.label} style={{ width: 7, height: 7, borderRadius: 999, background: sig.color }} />
                <span className="mono" style={{ fontSize: 10, color: r.mapState === "pinned" ? "var(--primary)" : "#6b6b78" }}>
                  {r.mapState === "pinned" ? "pinned" : r.mapState === "outside" ? "outside" : "no pin"}
                </span>
              </span>
            </span>
            <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              {[r.c.sector, r.hq.text].filter(Boolean).join(" · ")}
            </span>
          </button>
        );
      })}
      <div className="mono" style={{ padding: 12, fontSize: 11, color: "var(--muted-foreground)" }}>
        Showing {rows.length} of {total}
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------- */
/* The drawer: one lead's /company-intel profile.                              */
/* -------------------------------------------------------------------------- */

function Drawer({
  row,
  unlocated,
  onClose,
}: {
  row: RowData;
  unlocated: string[];
  onClose: () => void;
}) {
  const { c, intel, signal, score } = row;
  const p = intel?.profile;
  const sig = SIGNALS[signal];
  const full = !!intel?.full;
  const located = c.locations.filter((l) => l.lat !== null && l.lng !== null);
  const v = intel?.verdict ? VERDICTS[intel.verdict.kind] : null;

  /** A card section's empty state: "none found" only if it was searched. */
  const empty = (section: string) =>
    intel?.noneFound.includes(section) ? "None found" : "Not checked";

  return (
    <aside className="crm-drawer" aria-label={`${c.name} profile`}>
      <div style={{ display: "flex", flexDirection: "column", gap: 16, padding: "18px 18px 24px" }}>
        {/* Identity */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", lineHeight: 1.2 }}>{c.name}</div>
            <button className="btn btn-sm" onClick={onClose} aria-label="Close profile" style={{ height: 28, padding: "0 8px" }}>
              ✕
            </button>
          </div>
          {!c.website && p?.website && (
            <a href={p.website} target="_blank" rel="noreferrer noopener" className="mono" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>
              {hostOf(p.website)}
            </a>
          )}
          {c.website && (
            <a href={c.website} target="_blank" rel="noreferrer noopener" className="mono" style={{ fontSize: 12, color: "var(--primary)", textDecoration: "none" }}>
              {c.domain}
            </a>
          )}
          {intel?.tagline && <div style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{intel.tagline}</div>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {c.sector && <span className="badge">{c.sector}</span>}
            {intel?.fundingTier && <span className="badge">{intel.fundingTier}</span>}
            {intel?.priority === "priority" && <span className="badge badge-accent">PRIORITY</span>}
            <span className="badge">{row.mapState === "pinned" ? "pinned" : row.mapState === "outside" ? "outside NA view" : "no pin"}</span>
          </div>
        </div>

        {/* Verdict */}
        {full && intel?.verdict && v ? (
          <div style={{ padding: 12, borderRadius: 8, border: "1px solid var(--acc-border)", background: "var(--acc-bg)", display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span className="label" style={{ color: v.color }}>The call</span>
              <span className="mono" style={{ fontSize: 11, color: v.color }}>{v.label}</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.35 }}>{intel.verdict.headline}</div>
            {intel.verdict.detail && <div style={{ fontSize: 12, lineHeight: 1.5, color: "#b4b4bf" }}>{intel.verdict.detail}</div>}
          </div>
        ) : (
          <div className="ghost" style={{ padding: 11, borderRadius: 8, fontSize: 12, lineHeight: 1.5 }}>
            {p
              ? "The full /company-intel pass has not reached this lead yet. Showing the earlier profile from 2026-08-24, not re-verified."
              : "No company-intel on file for this lead yet. The full pass will fill it."}
          </div>
        )}

        {(intel?.description || p?.description) && (
          <div style={{ fontSize: 13, lineHeight: 1.5, color: "#cfcfd8" }}>{intel?.description ?? p?.description}</div>
        )}

        {intel && intel.stats.length > 0 && (
          <div style={{ display: "flex", gap: 8 }}>
            {intel.stats.slice(0, 4).map((s, i) => (
              <div key={i} style={{ flex: 1, minWidth: 0, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--border)" }}>
                <div className="mono" style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.2, overflowWrap: "anywhere" }}>
                  {s.value}
                  {s.caveat && <span style={{ color: "var(--muted-foreground)" }} title="Estimate, or sources disagree">*</span>}
                </div>
                <div className="label" style={{ fontSize: 10, marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Completeness */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="label">Intel on file</span>
            <span className="mono" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
              {score}/{PROFILE_FIELDS.length} fields
            </span>
          </div>
          <div style={{ display: "flex", gap: 3 }}>
            {PROFILE_FIELDS.map((k) => (
              <div
                key={k}
                title={`${k.replace(/_/g, " ")}: ${p?.[k] ? "on file" : "null"}`}
                style={{ flex: 1, height: 5, borderRadius: 2, background: p?.[k] ? "var(--primary)" : "var(--muted)" }}
              />
            ))}
          </div>
        </div>

        {/* Hiring signal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 7, padding: 12, borderRadius: 8, border: `1px solid ${sig.border}`, background: sig.bg }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="label" style={{ color: sig.color }}>Hiring signal</span>
            <span className="mono" style={{ fontSize: 11, color: sig.color }} title={sig.title}>{sig.label}</span>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            {p?.open_role ? <Linkified text={p.open_role} /> : <span style={{ color: "var(--muted-foreground)" }}>No careers-page read on file.</span>}
          </div>
          <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
            Careers page read · {intel?.verifiedOn ?? "never"}
            {intel?.verifiedNote ? ` · ${intel.verifiedNote}` : ""}
          </div>
        </div>

        {/* Facts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Fact k="HQ" v={p?.location ?? row.hq.text} />
          <Fact k="Founded" v={foundedYear(p?.year_founded ?? null) ?? p?.year_founded ?? (c.yearFounded ? String(c.yearFounded) : null)} />
          <Fact k="Headcount" v={p?.headcount ?? c.employeesEst} badge={row.hc ? (row.hc.disputed ? "disputed" : "est") : undefined} />
          <Fact
            k="Founders"
            v={p?.founder}
            extra={p?.founder_linkedin ? <a className="badge" href={p.founder_linkedin} target="_blank" rel="noreferrer noopener">LinkedIn</a> : undefined}
          />
          <Fact k="Funding" v={p?.funding_detail} />
          <Fact k="Owner" v={c.ownerName} />
          <Fact k="Founder email" v={p?.founder_email} missing="Not on file. Only a published address is ever stored." />
          <Fact k="Contact path" v={p?.contact_path} />
        </div>

        {full && intel && (
          <>
            <Section title="Lately" right="last 6 months">
              {intel.headlines.length > 0 ? (
                intel.headlines.map((h, i) => (
                  <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ fontSize: 13, lineHeight: 1.45 }}>{h.text}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {h.unconfirmed ? "date unconfirmed" : h.date ?? "undated"}
                      {h.source && (
                        <>
                          {" · "}
                          <SourceLink href={h.source} />
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <Empty text={empty("headlines")} />
              )}
            </Section>

            <Section title="Who to call">
              {intel.bestContact ? <Person p={intel.bestContact} best /> : null}
              {intel.people.map((x, i) => <Person key={i} p={x} />)}
              {!intel.bestContact && intel.people.length === 0 && <Empty text={empty("people")} />}
            </Section>

            <Section title="Ownership">
              {intel.ownership.length > 0 ? (
                intel.ownership.map((o, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13, opacity: o.is_former ? 0.6 : 1 }}>
                    <span style={{ fontWeight: o.is_this ? 500 : 400 }}>
                      {o.entity}
                      {o.is_former && <span className="mono" style={{ fontSize: 10, color: "var(--muted-foreground)" }}> · former</span>}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "right" }}>
                      {[o.detail, o.since].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                ))
              ) : (
                <Empty text={empty("ownership")} />
              )}
            </Section>
          </>
        )}

        <Section title="Deal history" right={full && intel && intel.deals.length > 0 ? `${intel.deals.length} with a date` : p?.past_completed_deals ? "from research text" : undefined}>
          {full && intel && intel.deals.length > 0 ? (
            intel.deals.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                <span>
                  {d.name}
                  {d.place && <span style={{ color: "var(--muted-foreground)" }}> · {d.place}</span>}
                </span>
                <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{d.date ?? "—"}</span>
              </div>
            ))
          ) : p?.past_completed_deals ? (
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
              <Linkified text={p.past_completed_deals} />
            </div>
          ) : (
            <Empty text={full ? empty("deals") : "None on file"} />
          )}
        </Section>

        <Section title="Footprint" right={located.length > 0 ? `${located.length} located` : undefined}>
          {located.map((l) => (
            <div key={l.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
              <span>{placeName(l.city, l.region, l.country)}</span>
              <span style={{ display: "flex", gap: 5 }}>
                {l.kind === "hq" && <span className="badge badge-accent badge-est">HQ</span>}
                <span className="badge badge-est" title={l.source ?? undefined}>{confidence(l.source)}</span>
              </span>
            </div>
          ))}
          {unlocated.length > 0 && (
            <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--muted-foreground)" }}>
              Present in <span style={{ color: "var(--foreground)" }}>{unlocated.join(", ")}</span>. The source names the state and no town, so there is no pin.
            </div>
          )}
          {full && intel?.footprint && (
            <StateLine fp={intel.footprint} />
          )}
          {located.length === 0 && unlocated.length === 0 && !(full && intel?.footprint) && <Empty text="No location on file. None is ever inferred." />}
        </Section>

        {full && intel && (
          <Section title="Competitors">
            {intel.competitors.length > 0 ? (
              intel.competitors.map((x, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 13 }}>
                    <span style={{ fontWeight: 500 }}>
                      {x.name}
                      {x.is_acquired && <span className="mono" style={{ fontSize: 10, color: "#4bb0c4" }}> · acquired</span>}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{x.owner ?? "not checked"}</span>
                  </div>
                  {x.note && <div style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>{x.note}</div>}
                </div>
              ))
            ) : (
              <Empty text={empty("competitors")} />
            )}
          </Section>
        )}

        {intel && intel.flags.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 5, padding: 11, borderRadius: 8, border: "1px solid var(--border)", background: "var(--muted)" }}>
            <span className="label">Source note</span>
            {intel.flags.map((f, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "#cfcfd8" }}>{f}</div>
            ))}
          </div>
        )}

        {full && intel && (intel.caveats.length > 0 || intel.identityNote) && (
          <Section title="Caveats">
            {intel.identityNote && <div style={{ fontSize: 12, lineHeight: 1.5, color: "#cfcfd8" }}>Identity: {intel.identityNote}</div>}
            {intel.caveats.map((x, i) => (
              <div key={i} style={{ fontSize: 12, lineHeight: 1.5, color: "#cfcfd8" }}>{x}</div>
            ))}
          </Section>
        )}

        {full && intel && intel.sources.length > 0 && (
          <details>
            <summary className="label" style={{ cursor: "pointer" }}>Sources · {intel.sources.length}</summary>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
              {intel.sources.map((s, i) => (
                <SourceLink key={i} href={s} />
              ))}
            </div>
          </details>
        )}

        <div className="mono" style={{ fontSize: 11, lineHeight: 1.6, color: "var(--muted-foreground)", paddingTop: 12, borderTop: "1px solid var(--border)" }}>
          {intel
            ? `/company-intel · ${full ? "full pass" : "profile-only pass"} · verified ${intel.verifiedOn}. The signal tier is derived from the dated read; the read is what is stored.`
            : "No company-intel record for this lead."}
        </div>
      </div>
    </aside>
  );
}

function confidence(source: string | null): string {
  const s = source?.toLowerCase() ?? "";
  if (/\blow\b/.test(s)) return "low";
  if (/\bmedium\b/.test(s)) return "medium";
  if (/\bhigh\b/.test(s)) return "high";
  return "source";
}

function StateLine({ fp }: { fp: NonNullable<CompanyIntel["footprint"]> }) {
  const parts: [string, string[]][] = [
    ["HQ", fp.hq ? [fp.hq] : []],
    ["Bought in", fp.bought ?? []],
    ["Offices", fp.branch ?? []],
    ["Customers", fp.customer ?? []],
  ];
  const shown = parts.filter(([, s]) => s.length > 0);
  if (shown.length === 0 && !(fp.notes?.length)) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 4 }}>
      {shown.map(([k, s]) => (
        <div key={k} style={{ display: "flex", gap: 8, fontSize: 12 }}>
          <span className="label" style={{ width: 72, flexShrink: 0 }}>{k}</span>
          <span className="mono">{[...new Set(s)].join(" ")}</span>
        </div>
      ))}
      {fp.notes?.map((n, i) => (
        <div key={i} style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.45 }}>
          {n.state ? `${n.state}: ` : ""}
          {n.text}
        </div>
      ))}
      <div className="mono" style={{ fontSize: 10, color: "#6b6b78" }}>State codes from the intel pass; not pinned.</div>
    </div>
  );
}

function Person({ p, best }: { p: IntelPerson; best?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: best ? 10 : 0, borderRadius: 8, border: best ? "1px solid var(--border)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>
          {p.name}
          {best && <span className="mono" style={{ fontSize: 10, color: "var(--primary)" }}> · best contact</span>}
        </span>
        {p.linkedin && (
          <a className="badge" href={p.linkedin} target="_blank" rel="noreferrer noopener">LinkedIn</a>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
        {[p.title, p.entity].filter(Boolean).join(" · ")}
        {p.caveat && " · role not re-verified"}
      </div>
      {p.why && <div style={{ fontSize: 12, color: "#b4b4bf", lineHeight: 1.45 }}>{p.why}</div>}
    </div>
  );
}

function Fact({
  k,
  v,
  badge,
  extra,
  missing,
}: {
  k: string;
  v?: string | null;
  badge?: string;
  extra?: React.ReactNode;
  missing?: string;
}) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", columnGap: 10, alignItems: "baseline" }}>
      <span className="label">{k}</span>
      <span style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 6, minWidth: 0 }}>
        {v ? (
          <span style={{ fontSize: 13, lineHeight: 1.45, minWidth: 0, overflowWrap: "anywhere" }}>
            <Linkified text={v} />
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "var(--muted-foreground)" }} title={missing}>
            {missing ? "Not on file" : "—"}
          </span>
        )}
        {v && badge && <span className="badge badge-est">{badge}</span>}
        {extra}
      </span>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 14, borderTop: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span className="label">{title}</span>
        {right && <span className="mono" style={{ fontSize: 11, color: "var(--muted-foreground)" }}>{right}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>{text}</div>;
}

function SourceLink({ href }: { href: string }) {
  if (!/^https?:\/\//.test(href)) return <span className="mono" style={{ fontSize: 11 }}>{href}</span>;
  let host = href;
  try {
    host = new URL(href).host.replace(/^www\./, "");
  } catch {
    /* keep raw */
  }
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className="mono" style={{ fontSize: 11, color: "var(--primary)", textDecoration: "none", overflowWrap: "anywhere" }}>
      {host}
    </a>
  );
}

/** Research text carries bare URLs. Make them links; leave every word as written. */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s),;]+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer noopener" style={{ color: "var(--primary)", overflowWrap: "anywhere" }}>
            {part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

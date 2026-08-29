"use client";

/**
 * The interface, built to mockup/Phase1.dc.html.
 *
 * Header + industry panel + map + floating company card. The search bar is
 * drawn greyed out and LABELLED, exactly as the mockup does it, because natural
 * language search is work order 7 and RULINGS.md says do not start it. A
 * disabled control that says why beats a missing one that leaves the scope
 * implicit.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { CompanyWithLocations, MapPoint, Source } from "@/lib/types";

// Leaflet touches `window` at import time.
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

interface Props {
  marketName: string;
  companies: CompanyWithLocations[];
  points: MapPoint[];
  source: Source;
  /** company id → states known but not located. Computed server-side. */
  unlocatedRegions: Record<string, string[]>;
  /** company id → every state touched. */
  allRegions: Record<string, string[]>;
}

export default function Workspace({
  marketName,
  companies,
  points,
  source,
  unlocatedRegions,
  allRegions,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    companies[0]?.id ?? null,
  );

  const selected = useMemo(
    () => companies.find((c) => c.id === selectedId) ?? null,
    [companies, selectedId],
  );

  const placeable = useMemo(
    () => new Set(points.map((p) => p.companyId)).size,
    [points],
  );

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <Header marketName={marketName} source={source} />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <IndustryPanel
          marketName={marketName}
          companies={companies}
          selectedId={selectedId}
          onSelect={setSelectedId}
          placeable={placeable}
          allRegions={allRegions}
        />

        <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
          <MarketMap
            points={points}
            selectedCompanyId={selectedId}
            onSelect={setSelectedId}
          />

          {selected && (
            <CompanyCard
              company={selected}
              unlocated={unlocatedRegions[selected.id] ?? []}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Header({
  marketName,
  source,
}: {
  marketName: string;
  source: Source;
}) {
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
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            background: "var(--primary)",
          }}
        />
        <span style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.01em" }}>
          MarketMaker
        </span>
      </div>

      {/* Work order 7. Drawn, disabled, and labelled with why. */}
      <div
        className="row ghost"
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
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        Natural-language search &mdash; work order 7, not built in phase 1
      </div>

      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <span className="badge badge-accent">{marketName.toUpperCase()}</span>
        <span
          className="badge"
          title={
            source.name === "postgres"
              ? "Reading Postgres."
              : "No database connected yet — reading the real records held in the repo. Never fabricated rows."
          }
        >
          {source.name === "postgres" ? "DB" : "NO DB"} &middot; {source.detail}
        </span>
      </div>
    </header>
  );
}

/* -------------------------------------------------------------------------- */

function IndustryPanel({
  marketName,
  companies,
  selectedId,
  onSelect,
  placeable,
  allRegions,
}: {
  marketName: string;
  companies: CompanyWithLocations[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  placeable: number;
  allRegions: Record<string, string[]>;
}) {
  const unplaceable = companies.length - placeable;

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        borderRight: "1px solid var(--border)",
        background: "var(--card)",
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <div>
        <div className="label">Market</div>
        <h1
          style={{
            margin: "4px 0 0",
            fontSize: 21,
            fontWeight: 500,
            letterSpacing: "-0.01em",
          }}
        >
          {marketName}
        </h1>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Stat label="Companies" value={String(companies.length)} />
        <Stat label="On the map" value={String(placeable)} />
      </div>

      {/*
        The honest state of the data, stated rather than hidden. A map that
        silently drops rows it cannot place under-reports the market, which is
        the one thing this product must never do.
      */}
      {unplaceable > 0 && (
        <div
          style={{
            padding: 11,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--muted)",
            display: "flex",
            flexDirection: "column",
            gap: 5,
          }}
        >
          <div className="label">Not yet placeable</div>
          <div style={{ fontSize: 13, lineHeight: 1.45 }}>
            <strong>{unplaceable}</strong> of {companies.length}{" "}
            {unplaceable === 1 ? "company has" : "companies have"} no location
            on file, so {unplaceable === 1 ? "it is" : "they are"} listed but
            not pinned.
          </div>
          <div
            className="mono"
            style={{ fontSize: 11, color: "var(--muted-foreground)" }}
          >
            No coordinate is ever inferred.
          </div>
        </div>
      )}

      <div>
        <div className="label" style={{ marginBottom: 7 }}>
          Companies
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {companies.map((c) => {
            const active = c.id === selectedId;
            const regions = allRegions[c.id] ?? [];
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                style={{
                  textAlign: "left",
                  padding: "9px 11px",
                  borderRadius: 8,
                  cursor: "pointer",
                  border: `1px solid ${
                    active ? "var(--acc-border)" : "var(--border)"
                  }`,
                  background: active ? "var(--acc-bg)" : "transparent",
                  color: "inherit",
                  font: "inherit",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500 }}>{c.name}</span>
                <span
                  className="mono"
                  style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                >
                  {regions.length > 0
                    ? `${regions.length} ${
                        regions.length === 1 ? "state" : "states"
                      } · ${regions.join(" ")}`
                    : "no location on file"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        padding: "9px 11px",
        borderRadius: 8,
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="mono"
        style={{ fontSize: 20, fontWeight: 500, lineHeight: 1.1 }}
      >
        {value}
      </div>
      <div className="label" style={{ marginTop: 2 }}>
        {label}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CompanyCard({
  company,
  unlocated,
}: {
  company: CompanyWithLocations;
  unlocated: string[];
}) {
  const located = company.locations.filter(
    (l) => l.lat !== null && l.lng !== null,
  );

  return (
    <div
      className="card"
      style={{
        position: "absolute",
        right: 24,
        top: 18,
        width: 300,
        maxHeight: "calc(100% - 36px)",
        overflowY: "auto",
        padding: 14,
        display: "flex",
        flexDirection: "column",
        gap: 11,
        boxShadow: "0 8px 28px rgba(0,0,0,0.4)",
        zIndex: 500,
      }}
    >
      <div>
        <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25 }}>
          {company.name}
        </div>
        {company.website && (
          <a
            href={company.website}
            target="_blank"
            rel="noreferrer noopener"
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--primary)",
              textDecoration: "none",
            }}
          >
            {company.domain}
          </a>
        )}
      </div>

      <Fact k="HQ" v={[company.city, company.region].filter(Boolean).join(", ")} />
      <Fact k="Year founded" v={company.yearFounded?.toString()} note="platform" />
      <Fact k="Sponsor" v={company.ownerName} />
      <Fact k="Headcount" v={company.employeesEst} est />

      {located.length > 0 && (
        <Block title={`Footprint · ${located.length} located`}>
          {located.map((l) => (
            <Row
              key={l.id}
              left={[l.city, l.region].filter(Boolean).join(", ")}
              right={l.kind === "hq" ? "HQ" : ""}
            />
          ))}
        </Block>
      )}

      {/*
        Known-present, not-located. These are shown as text and never as pins.
        Dropping them under-reports the footprint; centroiding them over-reports
        our own precision. Listing them is the only honest option.
      */}
      {unlocated.length > 0 && (
        <Block title="Present, not located">
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.45,
              color: "var(--muted-foreground)",
            }}
          >
            Operates in{" "}
            <span style={{ color: "var(--foreground)" }}>
              {unlocated.join(", ")}
            </span>
            . The source names the state and no town, so there is no pin.
          </div>
        </Block>
      )}

      {company.notes && (
        <Block title="Notes">
          <div style={{ fontSize: 12, lineHeight: 1.45 }}>{company.notes}</div>
        </Block>
      )}

      <div
        className="mono"
        style={{
          fontSize: 11,
          color: "var(--muted-foreground)",
          borderTop: "1px solid var(--border)",
          paddingTop: 8,
        }}
      >
        {company.lastVerified
          ? `Verified ${company.lastVerified.slice(0, 10)}`
          : "Never re-verified"}
      </div>
    </div>
  );
}

function Fact({
  k,
  v,
  note,
  est,
}: {
  k: string;
  v?: string | null;
  note?: string;
  est?: boolean;
}) {
  if (!v) return null;
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span className="label">{k}</span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ fontSize: 13 }}>{v}</span>
        {note && (
          <span className="badge badge-est" title="From the source record">
            {note}
          </span>
        )}
        {/* Decision 4 on screen: an estimate is marked, never printed as fact. */}
        {est && (
          <span
            className="badge badge-est"
            title="Self-reported band, flagged by the source as probably undercounting."
          >
            est
          </span>
        )}
      </span>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        paddingTop: 9,
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="label">{title}</div>
      {children}
    </div>
  );
}

function Row({ left, right }: { left: string; right?: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        fontSize: 12,
      }}
    >
      <span>{left}</span>
      {right && (
        <span className="mono" style={{ color: "var(--primary)", fontSize: 11 }}>
          {right}
        </span>
      )}
    </div>
  );
}

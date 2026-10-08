/**
 * The one page: the CRM view of a market, in list mode or map mode.
 *
 * A server component that asks the repository for rows and hands them to the
 * client. Note what it does NOT do: it never imports src/data, never reads a
 * file, never knows which adapter answered. Search (work order 7) slots in
 * right here — it decides which market id to ask for, and nothing below this
 * line changes.
 */

import Crm from "@/components/Crm";
import {
  activeSource,
  allRegions,
  getCompanies,
  getIntel,
  getMarket,
  regionsWithoutPoints,
  toMapPoints,
} from "@/lib/repository";

// Phase 1 has one market. This is the only place its name is written down, and
// it is a lookup key — not a file path, not a hardcoded dataset.
const MARKET = "AI-native roll-ups";

export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; c?: string }>;
}) {
  const params = await searchParams;
  const market = await getMarket(MARKET);

  if (!market) {
    return (
      <main style={{ padding: 48 }}>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>No market loaded</h1>
        <p style={{ color: "var(--muted-foreground)", fontSize: 14 }}>
          The database is connected but holds no market called “{MARKET}”. Run
          the migrations and the seed, or unset DATABASE_URL to read the records
          held in the repo.
        </p>
      </main>
    );
  }

  const companies = await getCompanies(market.id);
  const points = toMapPoints(companies);
  const intel = await getIntel(companies.map((c) => c.id));

  const unlocatedRegions: Record<string, string[]> = {};
  const regions: Record<string, string[]> = {};
  for (const c of companies) {
    unlocatedRegions[c.id] = regionsWithoutPoints(c);
    regions[c.id] = allRegions(c);
  }

  return (
    <Crm
      marketName={market.canonicalName}
      companies={companies}
      points={points}
      intel={intel}
      source={activeSource()}
      unlocatedRegions={unlocatedRegions}
      allRegions={regions}
      initialView={params.view === "map" ? "map" : "list"}
      initialSelected={
        companies.some((c) => c.id === params.c) ? params.c! : null
      }
    />
  );
}

/**
 * Reads derived from a company-intel record. Pure functions; no data access.
 *
 * The stored thing is always the dated text the research wrote. Everything
 * here is a label computed from it, for sorting and scanning a table. Where a
 * label is derived, the drawer shows the text it came from next to it.
 */

import type { CompanyIntel, IntelProfile } from "@/lib/types";

export type Signal = "role_open" | "mna_scope" | "hiring" | "not_hiring" | "no_page" | "unread";

export const SIGNALS: Record<Signal, { label: string; color: string; border: string; bg: string; rank: number; title: string }> = {
  role_open: { label: "CORP-DEV OPEN", color: "#a98bf5", border: "#43395d", bg: "#252131", rank: 0, title: "A named corp-dev or M&A role is open on the live careers page." },
  mna_scope: { label: "M&A IN SCOPE", color: "#4bb0c4", border: "#2c4a52", bg: "#16262b", rank: 1, title: "No corp-dev title, but an open role's scope names M&A or acquisitions." },
  hiring: { label: "HIRING", color: "#cfcfd8", border: "#3a3a42", bg: "#232329", rank: 2, title: "No corp-dev role; hiring elsewhere. A momentum signal." },
  not_hiring: { label: "NOT HIRING", color: "#8a8a96", border: "#2e2e34", bg: "#1e1e22", rank: 3, title: "The careers page loaded and nothing is posted." },
  no_page: { label: "NO PAGE", color: "#8a8a96", border: "#2e2e34", bg: "#1e1e22", rank: 4, title: "No public careers page found, or it would not load." },
  unread: { label: "UNREAD", color: "#6b6b78", border: "#2e2e34", bg: "#1e1e22", rank: 5, title: "No careers-page read on file." },
};

const MNA = /\b(corporate development|corp[- ]?dev|m&a|mergers|acquisitions?)\b/i;

/** Tier the dated careers-page read. The read itself is what is stored. */
export function hiringSignal(intel: CompanyIntel | undefined): Signal {
  if (!intel) return "unread";
  if (intel.verdict?.kind === "role_open") return "role_open";
  const t = intel.profile.open_role?.trim();
  if (!t) return "unread";
  if (/^no public careers page/i.test(t) || /\b(403|blocked|would not load|wouldn't load|js-only|could not load)\b/i.test(t)) return "no_page";
  if (/^no open roles/i.test(t)) return "not_hiring";
  if (/^no corp[- ]?dev/i.test(t)) {
    // "No corp-dev roles; hiring X" — but a role whose scope names M&A counts.
    const rest = t.replace(/^no corp[- ]?dev[^;.]*[;.]/i, "");
    return MNA.test(rest) ? "mna_scope" : "hiring";
  }
  return MNA.test(t) && /\bopen\b/i.test(t) ? "role_open" : "hiring";
}

export const PROFILE_FIELDS: (keyof IntelProfile)[] = [
  "description", "website", "location", "year_founded", "founder",
  "founder_linkedin", "founder_email", "funding_detail", "headcount",
  "past_completed_deals", "open_role", "contact_path",
];

/** How many of the 12 researchable profile fields are filled (name excluded). */
export function intelScore(intel: CompanyIntel | undefined): number {
  if (!intel) return 0;
  return PROFILE_FIELDS.filter((k) => intel.profile[k]).length;
}

/**
 * A short headcount for a table cell, or null when the stored text is not a
 * single figure. `disputed` is set when the text says sources disagree — the
 * full text is in the drawer, never averaged into one number.
 */
export function headcountShort(text: string | null): { short: string; disputed: boolean } | null {
  if (!text) return null;
  const disputed = /\b(vary|varies|disagree|conflict|vs\.?|versus)\b/i.test(text);
  const m = text.match(/~?\s?\d[\d,]*(?:\s?[-–]\s?\d[\d,]*)?\+?/);
  if (!m) return null;
  return { short: m[0].replace(/\s/g, ""), disputed };
}

/** Year founded, from the profile string. */
export function foundedYear(text: string | null): string | null {
  const m = text?.match(/\b(18|19|20)\d{2}\b/);
  return m ? m[0] : null;
}

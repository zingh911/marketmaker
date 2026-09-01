"use client";

/**
 * The map.
 *
 * Leaflet over OpenStreetMap tiles — a real tile layer with real boundaries,
 * place labels and urban shading. RULINGS.md 2026-08-28: nobody hand-draws
 * geography. This component owns the pins on top and nothing else.
 *
 * It knows nothing about any industry. It takes points and draws them. That is
 * the whole contract — HANDOFF.md, "The map knows nothing about any industry".
 */

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import type { MapPoint } from "@/lib/types";

interface Props {
  points: MapPoint[];
  selectedCompanyId: string | null;
  onSelect: (companyId: string) => void;
}

// Continental US. Where the map opens when there is nothing to fit to.
const US_CENTER: [number, number] = [39.5, -96];
const US_ZOOM = 4;

/** The floating company card covers roughly this much of the right edge. */
const CARD_GUTTER = 350;

/**
 * Soft-lock to North America.
 *
 * Soft, not hard: viscosity below 1 lets you drag past the edge and springs you
 * back rather than refusing the gesture. The dataset is a US/Canada slice, so
 * drifting into the mid-Atlantic wastes the user's time — but a hard wall feels
 * broken when it fires, and one company in the list turned out to be Polish, so
 * this boundary must not be load-bearing.
 */
const NA_BOUNDS: [[number, number], [number, number]] = [
  [5, -172],
  [75, -48],
];
const NA_VISCOSITY = 0.6;
const NA_MIN_ZOOM = 3;

export default function MarketMap({
  points,
  selectedCompanyId,
  onSelect,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const resizeObsRef = useRef<ResizeObserver | null>(null);

  // Latest props, readable from callbacks that were created once.
  const pointsRef = useRef(points);
  pointsRef.current = points;
  const selectedRef = useRef(selectedCompanyId);
  selectedRef.current = selectedCompanyId;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  /**
   * Once the user has panned or zoomed, stop moving the map under them.
   * Auto-fit is a courtesy on arrival, not a behaviour that fights the user.
   */
  const userMovedRef = useRef(false);
  /** True only while a programmatic fit is in flight. */
  const fittingRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      const container = containerRef.current;
      if (cancelled || !container || mapRef.current) return;

      const map = L.map(container, {
        center: US_CENTER,
        zoom: US_ZOOM,
        zoomControl: true,
        attributionControl: true,
        maxBounds: NA_BOUNDS,
        maxBoundsViscosity: NA_VISCOSITY,
        minZoom: NA_MIN_ZOOM,
      });

      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);

      // Any movement the app did not initiate is the user's. `movestart` fires
      // for programmatic moves too, so the fit brackets itself with a flag
      // rather than this listener trying to guess which input caused it —
      // that way drag, wheel, double-click, keyboard and box-zoom are all
      // covered without enumerating them.
      map.on("movestart", () => {
        if (!fittingRef.current) userMovedRef.current = true;
      });

      mapRef.current = map;

      /**
       * Re-fit on every container resize.
       *
       * This is the fix for a real bug that shipped once: the map is inside a
       * flex layout, Leaflet caches the container size when the map is created,
       * and at that moment the box has not been sized yet. fitBounds then
       * computes a centre for the wrong rectangle and every pin lands
       * off-frame. invalidateSize alone was not enough — it corrects the size
       * but keeps the already-wrong centre, so the fit has to run again after.
       */
      const ro = new ResizeObserver(() => scheduleFit());
      ro.observe(container);
      resizeObsRef.current = ro;

      redraw();
    })();

    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // Mount once; prop changes are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedCompanyId]);

  /** Coalesce fit requests to one per frame — ResizeObserver fires in bursts. */
  function scheduleFit() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      void fit();
    });
  }

  async function fit() {
    const map = mapRef.current;
    if (!map) return;
    const pts = pointsRef.current;

    // Always correct the cached size, even when there is nothing to fit to.
    map.invalidateSize({ animate: false });
    if (pts.length === 0 || userMovedRef.current) return;

    /**
     * Fit to the North America points only, not every point.
     *
     * The dataset is not all North American — a handful of real HQs (Warsaw,
     * Kraków, Chennai, Bengaluru) sit far outside NA_BOUNDS. A bbox spanning
     * all of them forces a near-whole-world zoom, which then fights the soft
     * lock: minZoom cannot go low enough to show that bbox, so the resulting
     * view was neither the wide shot nor the NA shot, and pins ended up
     * outside the viewport entirely. Those pins still render and are
     * reachable by panning — the soft lock allows drift — they just do not
     * get to set the default view for 72 mostly-NA companies.
     */
    const inNA = pts.filter(
      (p) =>
        p.lat >= NA_BOUNDS[0][0] &&
        p.lat <= NA_BOUNDS[1][0] &&
        p.lng >= NA_BOUNDS[0][1] &&
        p.lng <= NA_BOUNDS[1][1],
    );
    const fitTo = inNA.length > 0 ? inNA : pts;

    const L = (await import("leaflet")).default;
    const bounds = L.latLngBounds(fitTo.map((p) => [p.lat, p.lng]));

    fittingRef.current = true;
    try {
      map.fitBounds(bounds, {
        // Asymmetric on purpose: the company card floats over the right edge.
        paddingTopLeft: [56, 56],
        paddingBottomRight: [CARD_GUTTER, 56],
        maxZoom: 7,
        animate: false,
      });
    } finally {
      fittingRef.current = false;
    }
  }

  async function redraw() {
    const map = mapRef.current;
    if (!map) return;
    const L = (await import("leaflet")).default;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const p of pointsRef.current) {
      const isSelected = p.companyId === selectedRef.current;
      const isHq = p.kind === "hq";
      const size = isHq ? 15 : 11;

      const icon = L.divIcon({
        className: "mm-pin",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        html: `<div style="
          width:${size}px;height:${size}px;border-radius:50%;
          background:${isHq ? "#a98bf5" : "rgba(169,139,245,0.55)"};
          border:${isSelected ? "2px solid #f0f0f3" : "1.5px solid #131316"};
          box-shadow:0 0 0 ${isSelected ? 5 : 3}px rgba(169,139,245,0.18);
        "></div>`,
      });

      const marker = L.marker([p.lat, p.lng], {
        icon,
        title: `${p.companyName} — ${p.label}`,
      })
        .addTo(map)
        .on("click", () => onSelectRef.current(p.companyId));

      marker.bindTooltip(
        `<strong>${escapeHtml(p.companyName)}</strong><br>${escapeHtml(
          p.label,
        )}${isHq ? " &middot; HQ" : ""}`,
        { direction: "top", offset: [0, -size / 2] },
      );

      markersRef.current.push(marker);
    }

    scheduleFit();
  }

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label="Map of the market"
    />
  );
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c]!,
  );
}

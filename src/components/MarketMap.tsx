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

/** The floating company card covers this much of the right edge. */
const CARD_GUTTER = 350;

/**
 * Soft-lock to North America.
 *
 * Soft, not hard: viscosity below 1 lets you drag past the edge and springs
 * you back, rather than refusing the gesture. The dataset is a US/Canada
 * slice, so letting someone drift into the mid-Atlantic wastes their time —
 * but a hard wall is the kind of thing that feels broken when it fires, and
 * one company in the list (Jutro Medical) turned out to be Polish, so the
 * boundary should not be load-bearing.
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
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, {
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

      mapRef.current = map;

      const ro = new ResizeObserver(() => {
        map.invalidateSize({ animate: false });
      });
      ro.observe(containerRef.current);
      resizeObsRef.current = ro;

      draw();
    })();

    return () => {
      cancelled = true;
      resizeObsRef.current?.disconnect();
      resizeObsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
    // Mount once. Point updates are handled by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw pins whenever the rows change or the selection moves.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, selectedCompanyId]);

  async function draw() {
    const map = mapRef.current;
    if (!map) return;
    const L = (await import("leaflet")).default;

    for (const m of markersRef.current) m.remove();
    markersRef.current = [];

    for (const p of points) {
      const isSelected = p.companyId === selectedCompanyId;
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

    if (points.length > 0) {
      // The container is laid out by flexbox and Leaflet cached its size at
      // creation. Without this the first fit measures the wrong box and pins
      // land off-frame.
      map.invalidateSize({ animate: false });

      const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
      // Asymmetric on purpose: the company card floats over the right ~330px.
      map.fitBounds(bounds, {
        paddingTopLeft: [56, 56],
        paddingBottomRight: [CARD_GUTTER, 56],
        maxZoom: 7,
        animate: false,
      });
    }
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

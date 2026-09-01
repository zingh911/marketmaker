import { readFileSync, writeFileSync } from "node:fs";
const d = JSON.parse(readFileSync("intermediate.json", "utf8"));

const UA = "MarketMaker/0.1 (Heavyweight Studios; https://github.com/zingh911/marketmaker)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One query per distinct place, not per row.
const keyOf = (l) => `${l.city}|${l.region}|${l.country}`;
const wanted = new Map();
for (const l of d.locations) if (l.city && l.lat === null) wanted.set(keyOf(l), l);

const results = {};
for (const [key, l] of wanted) {
  const q = [l.city, l.region, l.country === "US" ? "USA" : l.country].filter(Boolean).join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en" } });
    if (!res.ok) { console.log(`HTTP ${res.status}  ${q}`); results[key] = null; }
    else {
      const j = await res.json();
      if (j.length === 0) { console.log(`NO MATCH   ${q}`); results[key] = null; }
      else {
        results[key] = { lat: Number(j[0].lat), lng: Number(j[0].lon), display: j[0].display_name };
        console.log(`ok  ${q}  ->  ${j[0].lat}, ${j[0].lon}`);
      }
    }
  } catch (e) {
    console.log(`ERROR      ${q}  ${e.message}`);
    results[key] = null;
  }
  await sleep(1100); // Nominatim: ~1 req/sec. Do not parallelise.
}

let filled = 0, left = 0;
for (const l of d.locations) {
  if (!l.city || l.lat !== null) continue;
  const r = results[keyOf(l)];
  if (r) { l.lat = r.lat; l.lng = r.lng; l.geocodedFrom = r.display; filled++; }
  else left++;
}
console.log(`\nfilled ${filled}, still unlocated ${left}`);
writeFileSync("intermediate.json", JSON.stringify(d, null, 1));

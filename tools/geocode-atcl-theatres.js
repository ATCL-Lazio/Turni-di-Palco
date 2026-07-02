#!/usr/bin/env node
/**
 * Geocode the real ATCL circuit theaters via OpenStreetMap Nominatim.
 *
 * Provenance/audit tool for the coordinates seeded into `public.theatres`
 * (migration 20260702110000_seed_atcl_theatres_geodata.sql). Reads the
 * canonical venue names/cities from the narrative theater scenes, resolves
 * real coordinates from OpenStreetMap, validates they fall inside Lazio, and
 * prints a JSON array. Deterministic and source-grounded (no hand-entered
 * coordinates).
 *
 * Usage:
 *   node tools/geocode-atcl-theatres.js            # print JSON to stdout
 *   node tools/geocode-atcl-theatres.js > out.json
 *
 * Data © OpenStreetMap contributors (ODbL). Respects the Nominatim usage
 * policy: single-threaded, 1 request/second, descriptive User-Agent.
 */
const fs = require('fs');
const path = require('path');

const THEATERS_DIR = path.join(
  __dirname,
  '..',
  'apps',
  'mobile',
  'src',
  'data',
  'narrative',
  'theaters'
);

const USER_AGENT =
  'TurniDiPalco/1.0 (ATCL theatre geocoding; https://turni-di-palco.vercel.app)';

// Generous Lazio bounding box used to reject cross-region mismatches.
const LAZIO = { latMin: 40.7, latMax: 42.95, lonMin: 11.35, lonMax: 14.15 };

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const inLazio = (lat, lon) =>
  lat >= LAZIO.latMin && lat <= LAZIO.latMax && lon >= LAZIO.lonMin && lon <= LAZIO.lonMax;

const townOf = (entry) => {
  const a = entry.address || {};
  return a.city || a.town || a.village || a.municipality || a.hamlet || '';
};

async function nominatim(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?' +
    new URLSearchParams({ q: `${query}, Italia`, format: 'json', limit: '3', addressdetails: '1' });
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  return res.json();
}

function pick(results, city) {
  const cityL = city.toLowerCase();
  const inBox = results.filter((e) => inLazio(Number(e.lat), Number(e.lon)));
  const byTown = inBox.find(
    (e) => townOf(e).toLowerCase().includes(cityL) || (e.display_name || '').toLowerCase().includes(cityL)
  );
  return byTown || inBox[0] || null;
}

function loadTheaters() {
  return fs
    .readdirSync(THEATERS_DIR)
    .filter((f) => f.endsWith('.json') && !f.startsWith('README'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(THEATERS_DIR, f), 'utf8')))
    .filter((d) => d && d.theatre && d.city)
    .map((d) => ({ id: d.id, name: d.theatre, city: d.city }))
    .sort((a, b) => a.city.localeCompare(b.city));
}

async function geocode(theater) {
  const variants = [
    `${theater.name}, ${theater.city}`,
    `${theater.name} ${theater.city}`,
    `Teatro, ${theater.city}`,
  ];
  for (const q of variants) {
    let results = [];
    try {
      results = await nominatim(q);
    } catch (err) {
      results = [];
    }
    await sleep(1100); // Nominatim: max 1 req/s
    const chosen = pick(results, theater.city);
    if (chosen) {
      const isVenue = ['amenity', 'tourism', 'building', 'leisure', 'historic'].includes(chosen.class);
      const townMatch = townOf(chosen).toLowerCase().includes(theater.city.toLowerCase());
      if (isVenue || townMatch || q === variants[variants.length - 1]) {
        return {
          id: theater.id,
          name: theater.name,
          city: theater.city,
          latitude: Number(Number(chosen.lat).toFixed(6)),
          longitude: Number(Number(chosen.lon).toFixed(6)),
          osmClass: `${chosen.class}/${chosen.type}`,
          isVenue,
          townMatch,
          matched: (chosen.display_name || '').slice(0, 120),
        };
      }
    }
  }
  // Fallback: comune centroid (flagged low-precision).
  let results = [];
  try {
    results = await nominatim(`${theater.city}, Lazio`);
  } catch (err) {
    results = [];
  }
  await sleep(1100);
  const chosen = pick(results, theater.city);
  return chosen
    ? {
        id: theater.id,
        name: theater.name,
        city: theater.city,
        latitude: Number(Number(chosen.lat).toFixed(6)),
        longitude: Number(Number(chosen.lon).toFixed(6)),
        osmClass: 'centroid',
        isVenue: false,
        townMatch: true,
        matched: 'CENTROID: ' + (chosen.display_name || '').slice(0, 110),
      }
    : { id: theater.id, name: theater.name, city: theater.city, latitude: null, longitude: null, osmClass: 'unresolved', isVenue: false, townMatch: false, matched: 'UNRESOLVED' };
}

async function run() {
  const theaters = loadTheaters();
  const out = [];
  for (const t of theaters) {
    const r = await geocode(t);
    out.push(r);
    const flag = r.isVenue && r.townMatch ? 'OK' : r.latitude ? '~~' : 'XX';
    process.stderr.write(`${flag} ${r.city.padEnd(18)} ${String(r.latitude)},${String(r.longitude)} [${r.osmClass}]\n`);
  }
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  const resolved = out.filter((r) => r.latitude != null).length;
  process.stderr.write(`\nResolved ${resolved}/${out.length}\n`);
}

run().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});

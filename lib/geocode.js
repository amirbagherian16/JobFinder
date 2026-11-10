'use strict';
// Build-time geocoding of employer street addresses via OpenStreetMap Nominatim (public, no key).
// Policy: identify the client, max ~1 request/second. Only employer (business) addresses are sent, never personal data.
const { haversineMiles } = require('./geo');
const UA = 'JobFinder-build/1.0 (+https://github.com/amirbagherian16/JobFinder)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function geocode(address, { fetchImpl = fetch, delayMs = 1100 } = {}) {
  await sleep(delayMs);
  const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=' + encodeURIComponent(address);
  const res = await fetchImpl(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const [hit] = await res.json();
  return hit ? { lat: +hit.lat, lon: +hit.lon, name: hit.display_name } : null;
}

// Accept a geocoded point only if it lands near where we expect (guards against wrong-city matches).
const plausible = (pt, ref, maxMiles = 35) => !!pt && !!ref && haversineMiles(pt.lat, pt.lon, ref.lat, ref.lon) <= maxMiles;

module.exports = { geocode, plausible };

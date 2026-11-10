'use strict';
const path = require('path');
const places = require(path.join('..', 'public', 'data', 'places.json'));

const STATE_BY_NAME = Object.fromEntries(Object.entries(places.states).map(([abbr, [name]]) => [name.toLowerCase(), abbr]));
const CITY_INDEX = new Map(places.cities.map(([c, s, lat, lon]) => [`${c.toLowerCase()}|${s}`, { city: c, state: s, lat, lon }]));

function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8, rad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toStateAbbr(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (/^[A-Za-z]{2}$/.test(t) && places.states[t.toUpperCase()]) return t.toUpperCase();
  return STATE_BY_NAME[t.toLowerCase()] || null;
}

// "San Antonio, TX" / "San Antonio, Texas" / "Bethesda, MD, United States" -> {city,state,lat,lon}
function resolveLocation(str) {
  if (!str) return null;
  const parts = String(str).split(/[,;|]/).map((x) => x.trim()).filter(Boolean);
  let state = null, city = null;
  for (const part of parts) {
    const st = toStateAbbr(part.replace(/\s+\d{5}(-\d{4})?$/, ''));
    if (st && !state) state = st;
  }
  if (parts.length) city = parts[0];
  if (city && state) {
    const hit = CITY_INDEX.get(`${city.toLowerCase()}|${state}`);
    if (hit) return { ...hit };
  }
  if (state) {
    const [, lat, lon] = places.states[state];
    return { city: city && toStateAbbr(city) !== state ? city : null, state, lat, lon, approx: true };
  }
  return null;
}

module.exports = { haversineMiles, resolveLocation, toStateAbbr, places };

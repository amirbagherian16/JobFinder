'use strict';
const crypto = require('crypto');
const { score } = require('./relevance');
const { resolveLocation, toStateAbbr } = require('./geo');

const stripHtml = (s) => String(s || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

function yearly(min, max, period) {
  const p = String(period || 'year').toLowerCase();
  let k = 1;
  if (p.startsWith('h')) k = 2080; else if (p.startsWith('m')) k = 12; else if (p.startsWith('w')) k = 52; else if (p.startsWith('b')) k = 26; else if (p.startsWith('d')) k = 260;
  const f = (v) => (v == null || v === '' || isNaN(+v) ? null : Math.round(+v * k));
  let lo = f(min), hi = f(max);
  if (lo == null && hi == null) return [null, null];
  if (lo == null) lo = hi; if (hi == null) hi = lo;
  // Sanity bounds: ignore obviously bogus figures
  if (lo < 20000 || hi > 700000 || lo > hi) return [null, null];
  return [lo, hi];
}

function mapType(raw, title) {
  const t = `${raw || ''} ${title || ''}`.toLowerCase();
  if (/post-?doc/.test(t)) return 'Postdoc';
  if (/intern/.test(t)) return 'Internship';
  if (/part[\s_-]?time|parttime/.test(t)) return 'Part-time';
  if (/contract|contractor/.test(t)) return 'Contract';
  if (/temp/.test(t)) return 'Temporary';
  if (/full[\s_-]?time|fulltime|permanent/.test(t)) return 'Full-time';
  return 'Full-time';
}

function sectorOf(company, source) {
  const c = (company || '').toLowerCase();
  if (source === 'usajobs' || /department of|u\.?s\.? army|national institutes|veterans|navy|air force|national lab/.test(c)) return 'Government';
  if (/universit|college|school of medicine|health science|institute of tech/.test(c)) return 'Academic';
  return 'Industry';
}

const CITIZEN_RE = /u\.?s\.? citizen(ship)?( is)? (required|only)|must be a u\.?s\.? citizen|citizenship required|security clearance|itar|export[- ]controlled/i;

const TEACH_RE = /\b(tutor|tutoring|adjunct|lecturer|instructor|teaching|teacher|professor of practice|math faculty)\b/i;

function finalize(j) {
  const [salaryMin, salaryMax] = [j.salaryMin ?? null, j.salaryMax ?? null];
  const description = stripHtml(j.description).slice(0, 1400);
  const rel = score({ title: j.title, description, tags: j.tags });
  const id = j.id || crypto.createHash('sha1').update([j.title, j.company, j.city, j.source].join('|')).digest('hex').slice(0, 16);
  return {
    id: String(id), kind: j.kind || 'posting', title: stripHtml(j.title), company: stripHtml(j.company),
    city: j.city || null, state: j.state || null, lat: j.lat ?? null, lon: j.lon ?? null, remote: !!j.remote,
    type: j.type || 'Full-time', sector: j.sector || sectorOf(j.company, j.source),
    salaryMin, salaryMax, posted: j.posted || null, url: j.url, source: j.source || 'unknown', via: j.via || null,
    description, precise: !!j.precise, // true = coordinates came from the source; false = city/state centre
    citizenshipRequired: j.citizenshipRequired ?? CITIZEN_RE.test(`${j.title} ${description}`),
    relevance: rel.score, matched: rel.matched, links: j.links || null,
    track: j.track || (TEACH_RE.test(j.title || '') ? 'teaching' : 'research'),
  };
}

function withLocation(j, locString) {
  if (j.lat != null && j.lon != null) { j.state = toStateAbbr(j.state) || j.state; if (j.precise == null) j.precise = true; return j; }
  const r = resolveLocation(locString || `${j.city || ''}, ${j.state || ''}`);
  if (r) { j.city = j.city || r.city; j.state = r.state; if (!r.approx) { j.lat = r.lat; j.lon = r.lon; } else { j.lat = r.lat; j.lon = r.lon; j.approxLocation = true; } }
  return j;
}

function dedupe(jobs) {
  const best = new Map();
  for (const j of jobs) {
    const key = [j.title, j.company, j.city || j.state || ''].join('|').toLowerCase().replace(/\s+/g, ' ');
    const cur = best.get(key);
    if (!cur || (j.salaryMin != null && cur.salaryMin == null)) best.set(key, j);
  }
  return [...best.values()];
}

module.exports = { stripHtml, yearly, mapType, sectorOf, finalize, withLocation, dedupe, CITIZEN_RE };

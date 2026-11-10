'use strict';
// Builds public/data/jobs.json from: curated employer leads + every live provider whose credentials are set.
const fs = require('fs'), path = require('path');
const profile = require('../data/profile.json');
const { employers } = require('../data/employers.json');
const { finalize, withLocation, dedupe } = require('../lib/normalize');
const links = require('../lib/links');
const { geocode, plausible } = require('../lib/geocode');
const { resolveLocation } = require('../lib/geo');

const providers = [require('../lib/providers/adzuna'), require('../lib/providers/usajobs'), require('../lib/providers/jsearch'), require('../lib/providers/boards'), require('../lib/providers/careers')];
const MIN_LIVE_RELEVANCE = Number(process.env.MIN_RELEVANCE || 18);
const OUT = path.join(__dirname, '..', 'public', 'data', 'jobs.json');

// Tiered, build-time location lookup. Returns { lat, lon, exact, note } or null.
//  1) street address  2) "<org> <city>"  3) known nearby area (approximate, flagged with a note)
async function locateLead(e, geo = geocode, log = () => {}) {
  const ref = resolveLocation(`${e.city}, ${e.state}`);
  const short = e.org.replace(/\s*\(.*\)/, '');
  const tiers = [[e.address, true], [`${short}, ${e.city}, ${e.state}`, true], [e.area, false]].filter(([q]) => q);
  for (const [q, exact] of [...new Map(tiers.map((t) => [t[0], t])).values()]) {
    try {
      const pt = await geo(q);
      if (plausible(pt, ref)) { log(`  ${exact ? 'geocoded' : 'approximate (area)'}: ${e.org} <- "${q}"`); return { lat: pt.lat, lon: pt.lon, exact, note: exact ? null : e.areaNote || `Near ${q}` }; }
    } catch (err) { log(`  geocode error for ${e.org}: ${err.message}`); }
  }
  log(`  NO EXACT LOCATION for ${e.org}: add/fix "address" in data/employers.json`);
  return null;
}

async function buildLeads(log = () => {}, geo = geocode) {
  const out = [];
  for (const e of employers) {
    let exact = false, note = null;
    if ((e.address || e.area) && !process.env.NO_GEOCODE && process.env.npm_lifecycle_event !== 'postinstall') {
      const r = await locateLead(e, geo, log);
      if (r) { e.lat = r.lat; e.lon = r.lon; exact = r.exact; note = r.note; }
    }
    out.push(makeLead({ ...e, locationNote: note }, exact));
  }
  return out;
}

function makeLead(e, exact) {
  {
    const q = `${e.org.replace(/\s*\(.*\)/, '')} ${e.terms.split(' ').slice(0, 2).join(' ')}`;
    const loc = `${e.city}, ${e.state}`;
    return finalize(withLocation({
      id: 'lead-' + e.org.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), kind: 'lead', title: e.title, company: e.org, city: e.city, state: e.state,
      lat: e.lat ?? null, lon: e.lon ?? null, precise: exact, locationNote: e.locationNote, sector: e.sector, type: e.type || 'Full-time', remote: !!e.remote, track: e.track, url: e.url, description: e.focus, tags: e.terms.split(' '), source: 'curated', citizenshipRequired: e.cit,
      links: { linkedin: links.linkedin(q, loc), indeed: links.indeed(q, loc), google: links.google(q, loc) },
    }, loc));
  }
}

async function main() {
  const log = (m) => console.log(m);
  log('- geocoding employer addresses (OpenStreetMap)...');
  const leads = await buildLeads(log);
  const live = [];
  const sources = { curated: leads.length };
  for (const p of providers) {
    if (!p.enabled()) { log(`- ${p.name}: skipped (no credentials/config)`); continue; }
    log(`- ${p.name}: fetching...`);
    try {
      const got = await p.fetchJobs({ queries: profile.searchQueries, home: profile.home, log, orgs: employers.map((e) => e.org.replace(/\s*\(.*\)/, '')), leads: employers });
      const kept = got.filter((j) => j.url && j.relevance >= MIN_LIVE_RELEVANCE);
      sources[p.name] = kept.length;
      live.push(...kept);
      log(`  ${got.length} fetched, ${kept.length} relevant`);
    } catch (e) { log(`  ${p.name} failed: ${e.message}`); }
  }
  const jobs = dedupe([...live, ...leads]);
  // A live posting at an org we also list as a lead supersedes nothing: both stay, the UI labels them.
  const out = { generatedAt: new Date().toISOString(), home: profile.home, defaultRadiusMiles: profile.defaultRadiusMiles, searchQueries: profile.searchQueries, sources, jobs };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out));
  const unresolved = jobs.filter((j) => j.lat == null && !j.remote).length;
  log(`Wrote ${jobs.length} jobs (${live.length} live, ${leads.length} leads, ${unresolved} without coordinates) -> ${path.relative(process.cwd(), OUT)}`);
}
if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });
module.exports = { buildLeads, locateLead, main };

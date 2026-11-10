'use strict';
// Builds public/data/jobs.json from: curated employer leads + every live provider whose credentials are set.
const fs = require('fs'), path = require('path');
const profile = require('../data/profile.json');
const { employers } = require('../data/employers.json');
const { finalize, withLocation, dedupe } = require('../lib/normalize');
const links = require('../lib/links');

const providers = [require('../lib/providers/adzuna'), require('../lib/providers/usajobs'), require('../lib/providers/jsearch'), require('../lib/providers/boards')];
const MIN_LIVE_RELEVANCE = Number(process.env.MIN_RELEVANCE || 18);
const OUT = path.join(__dirname, '..', 'public', 'data', 'jobs.json');

function buildLeads() {
  return employers.map((e) => {
    const q = `${e.org.replace(/\s*\(.*\)/, '')} ${e.terms.split(' ').slice(0, 2).join(' ')}`;
    const loc = `${e.city}, ${e.state}`;
    return finalize(withLocation({
      id: 'lead-' + e.org.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), kind: 'lead', title: e.title, company: e.org, city: e.city, state: e.state,
      sector: e.sector, type: 'Full-time', url: e.url, description: e.focus, tags: e.terms.split(' '), source: 'curated', citizenshipRequired: e.cit,
      links: { linkedin: links.linkedin(q, loc), indeed: links.indeed(q, loc), google: links.google(q, loc) },
    }, loc));
  });
}

async function main() {
  const log = (m) => console.log(m);
  const leads = buildLeads();
  const live = [];
  const sources = { curated: leads.length };
  for (const p of providers) {
    if (!p.enabled()) { log(`- ${p.name}: skipped (no credentials/config)`); continue; }
    log(`- ${p.name}: fetching...`);
    try {
      const got = await p.fetchJobs({ queries: profile.searchQueries, home: profile.home, log, orgs: employers.map((e) => e.org.replace(/\s*\(.*\)/, '')) });
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
module.exports = { buildLeads, main };

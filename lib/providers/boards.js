'use strict';
// Public, key-free company job boards (Greenhouse + Lever). Add company slugs to data/boards.json.
// Slugs that don't exist are skipped with a log line.
const fs = require('fs'), path = require('path');
const { getJson } = require('../http');
const { finalize, withLocation, mapType } = require('../normalize');

function loadBoards() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'boards.json'), 'utf8')); } catch { return { greenhouse: [], lever: [] }; }
}
const enabled = () => true; // key-free: also auto-discovers each curated employer's public Greenhouse board

const STOP = new Set(['the', 'of', 'inc', 'corporation', 'company', 'laboratory', 'laboratories', 'national', 'university', 'institute', 'research', 'center', 'for', 'and', 'us', 'u.s.']);
const words = (s) => String(s).toLowerCase().replace(/\(.*?\)/g, ' ').split(/[^a-z0-9]+/).filter((w) => w && !STOP.has(w));
// Candidate board slugs for an organization name, e.g. "Quanterix" -> ["quanterix"]; "General Motors" -> ["generalmotors","gm"...]
function slugCandidates(org) {
  const w = words(org); if (!w.length) return [];
  return [...new Set([w.join(''), w[0], w.slice(0, 2).join('')])].filter((x) => x.length >= 3);
}
// Accept a discovered board only if its published name clearly matches the org (avoids slug collisions with other companies).
function boardNameMatches(org, boardName) {
  const a = words(org), b = words(boardName);
  // every significant word of the org must appear in the board name ("Air" must NOT match "Air Force Research Laboratory ...")
  return a.length > 0 && b.length > 0 && a.every((w) => b.includes(w));
}
async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (i < items.length) { const it = items[i++]; out.push(await fn(it)); } }));
  return out;
}
async function discoverGreenhouse(orgs, log) {
  const found = [];
  await pool(orgs, 6, async (org) => {
    for (const slug of slugCandidates(org)) {
      try {
        const b = await getJson(`https://boards-api.greenhouse.io/v1/boards/${slug}`, { timeoutMs: 8000 });
        if (b?.name && boardNameMatches(org, b.name)) { found.push({ slug, org }); log(`  discovered greenhouse board "${slug}" for ${org}`); return; }
      } catch { /* 404 = no board with that slug */ }
    }
  });
  return found;
}

function normalizeGreenhouse(r, company) {
  const loc = r.location?.name || '';
  return finalize(withLocation({
    id: 'gh-' + r.id, title: r.title, company, type: mapType('', r.title), posted: r.updated_at || r.first_published || null,
    url: r.absolute_url, description: r.content, source: 'greenhouse', remote: /remote/i.test(loc),
  }, loc));
}
function normalizeLever(r, company) {
  const loc = r.categories?.location || '';
  return finalize(withLocation({
    id: 'lv-' + r.id, title: r.text, company, type: mapType(r.categories?.commitment, r.text), posted: r.createdAt ? new Date(r.createdAt).toISOString() : null,
    url: r.hostedUrl, description: r.descriptionPlain, source: 'lever', remote: /remote/i.test(`${loc} ${r.workplaceType || ''}`),
  }, loc));
}

async function fetchJobs({ log = console.log, orgs = [] }) {
  const b = loadBoards(), out = [];
  const ghTargets = (b.greenhouse || []).map((slug) => ({ slug, org: slug }));
  const known = new Set(ghTargets.map((t) => t.slug));
  for (const d of await discoverGreenhouse(orgs, log)) if (!known.has(d.slug)) ghTargets.push(d);
  for (const { slug, org } of ghTargets) {
    try {
      const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
      out.push(...(d.jobs || []).map((r) => normalizeGreenhouse(r, org)));
    } catch (e) { log(`  greenhouse ${slug}: ${e.message}`); }
  }
  for (const slug of b.lever || []) {
    try {
      const d = await getJson(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
      out.push(...(Array.isArray(d) ? d : []).map((r) => normalizeLever(r, slug)));
    } catch (e) { log(`  lever ${slug}: ${e.message}`); }
  }
  return out;
}
module.exports = { name: 'boards', enabled, fetchJobs, normalizeGreenhouse, normalizeLever, slugCandidates, boardNameMatches };

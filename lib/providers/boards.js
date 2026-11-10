'use strict';
// Public, key-free company job boards (Greenhouse + Lever). Add company slugs to data/boards.json.
// Slugs that don't exist are skipped with a log line.
const fs = require('fs'), path = require('path');
const { getJson } = require('../http');
const { finalize, withLocation, mapType } = require('../normalize');

function loadBoards() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'data', 'boards.json'), 'utf8')); } catch { return { greenhouse: [], lever: [] }; }
}
const enabled = () => { const b = loadBoards(); return (b.greenhouse?.length || 0) + (b.lever?.length || 0) > 0; };

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

async function fetchJobs({ log = console.log }) {
  const b = loadBoards(), out = [];
  for (const slug of b.greenhouse || []) {
    try {
      const d = await getJson(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(slug)}/jobs?content=true`);
      out.push(...(d.jobs || []).map((r) => normalizeGreenhouse(r, slug)));
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
module.exports = { name: 'boards', enabled, fetchJobs, normalizeGreenhouse, normalizeLever };

'use strict';
// Scores a job (0-100) against data/profile.json and reports which terms matched.
const profile = require('../data/profile.json');

const esc = (t) => t.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
const reCache = new Map();
// Leading word boundary always; trailing boundary too for short acronyms (so "fea" != "feature", "mri" != "primary").
function has(text, term) {
  let re = reCache.get(term);
  if (!re) { re = new RegExp('(^|[^a-z0-9])' + esc(term) + (term.length <= 4 ? '($|[^a-z0-9])' : ''), 'i'); reCache.set(term, re); }
  return re.test(text);
}

function score(job, p = profile) {
  const title = (job.title || '').toLowerCase();
  const body = ((job.description || '') + ' ' + (job.tags || []).join(' ')).toLowerCase();
  const text = title + ' ' + body;
  let raw = 0;
  const matched = [];
  const seen = new Set();
  for (const [term, w] of p.strongTerms) {
    if (seen.has(term)) continue;
    const inTitle = has(title, term);
    const inBody = has(body, term);
    if (!inTitle && !inBody) continue;
    seen.add(term);
    raw += inTitle ? w * 2 : w;
    matched.push(term);
  }
  for (const t of p.titleBoostTerms) if (title.includes(t)) raw += 3;
  if (p.phdTerms.some((t) => text.includes(t))) raw += 6;
  for (const [t, w] of p.softPenaltyTerms) if (title.includes(t)) raw += w;
  let s = 100 * (1 - Math.exp(-Math.max(raw, 0) / 38));
  if (p.negativeTitleTerms.some((t) => (title + ' ').includes(t))) s *= 0.35;
  return { score: Math.round(Math.min(100, s)), matched: matched.slice(0, 8) };
}

module.exports = { score };

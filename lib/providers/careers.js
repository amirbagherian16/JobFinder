'use strict';
// Key-free crawler: reads employers' PUBLIC careers pages and extracts schema.org JobPosting JSON-LD
// (the same structured data Google Jobs reads). Respects robots.txt, identifies itself, rate-limits, and only
// keeps real postings (title + the ad's own URL). Sites that render listings with JavaScript yield nothing.
const { finalize, withLocation, mapType, yearly } = require('../normalize');
const UA = 'JobFinder-crawler/1.0 (+https://github.com/amirbagherian16/JobFinder; personal job search)';
const MAX_MS = Number(process.env.CAREERS_MAX_MS || 240000);
const PER_ORG_FETCHES = 24, LIST_PAGES = 6, JOB_LINKS = 16, DELAY_MS = 350;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const enabled = () => !process.env.NO_CRAWL && process.env.npm_lifecycle_event !== 'postinstall';

// ---------- pure helpers (unit-tested) ----------
function robotsAllows(txt, pathname) {
  let applies = false, any = false; const dis = [], allow = [];
  for (const raw of String(txt || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'user-agent') { applies = v === '*' || /jobfinder/i.test(v); any ||= applies; }
    else if (applies && k === 'disallow' && v) dis.push(v);
    else if (applies && k === 'allow' && v) allow.push(v);
  }
  const longest = (arr) => arr.filter((p) => pathname.startsWith(p.replace(/\*.*$/, ''))).reduce((n, p) => Math.max(n, p.length), -1);
  return longest(allow) >= longest(dis);
}
function jsonLdBlocks(html) {
  const out = []; const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi; let m;
  while ((m = re.exec(html))) { try { out.push(JSON.parse(m[1].trim())); } catch { /* ignore malformed block */ } }
  return out;
}
function flatten(node, acc = []) {
  if (Array.isArray(node)) node.forEach((n) => flatten(n, acc));
  else if (node && typeof node === 'object') { acc.push(node); if (node['@graph']) flatten(node['@graph'], acc); if (node.itemListElement) flatten(node.itemListElement, acc); if (node.item) flatten(node.item, acc); }
  return acc;
}
const isJob = (n) => [].concat(n['@type'] || []).some((t) => String(t).toLowerCase() === 'jobposting');
function parseJobPostings(html, pageUrl) {
  return flatten(jsonLdBlocks(html)).filter(isJob).filter((n) => n.title).map((n) => ({ ...n, __page: pageUrl }));
}
function extractLinks(html, baseUrl) {
  const out = new Set(); const re = /<a\s[^>]*href=["']([^"'#]+)["']/gi; let m;
  while ((m = re.exec(html))) { try { const u = new URL(m[1].replace(/&amp;/g, '&'), baseUrl); if (/^https?:$/.test(u.protocol) && !/\.(pdf|png|jpe?g|gif|svg|css|js|zip|docx?)$/i.test(u.pathname)) out.add(u.href); } catch { /* bad href */ } }
  return [...out];
}
const LIST_RE = /(search|openings|opportunit|current-?jobs|jobs|careers|join|work-?(with|for)-?us|employment|vacanc)/i;
const JOB_RE = /(job|position|posting|requisition|req[-_]?\d|opening|vacanc|\/p\/|\/o\/|apply)/i;
const first = (v) => (Array.isArray(v) ? v[0] : v);
function toJob(n, org) {
  const loc = first(n.jobLocation) || {}; const addr = loc.address || {}; const geo = loc.geo || {};
  const sal = n.baseSalary?.value || {}; const unit = sal.unitText || 'YEAR';
  const [salaryMin, salaryMax] = yearly(sal.minValue ?? sal.value, sal.maxValue ?? sal.value, unit);
  const url = typeof n.url === 'string' && /^https?:/.test(n.url) ? n.url : n.__page;
  const remote = /TELECOMMUTE/i.test(n.jobLocationType || '');
  const j = {
    id: 'cr-' + Buffer.from(url).toString('base64').slice(-18), title: n.title, company: org.org, city: addr.addressLocality || null,
    state: typeof addr.addressRegion === 'string' ? addr.addressRegion : null, lat: geo.latitude ? +geo.latitude : null, lon: geo.longitude ? +geo.longitude : null,
    type: mapType([].concat(n.employmentType || []).join(' '), n.title), salaryMin, salaryMax, posted: n.datePosted || null, url,
    description: n.description || '', source: 'careers', remote, sector: org.sector,
  };
  if (!j.city && !j.state && !remote) { j.city = org.city; j.state = org.state; }
  return finalize(withLocation(j, `${j.city || ''}, ${j.state || ''}`));
}

// ---------- crawling ----------
async function get(url, timeoutMs = 12000) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
  try { const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' }, signal: ctl.signal, redirect: 'follow' });
    if (!r.ok || !/html|xml/i.test(r.headers.get('content-type') || '')) return null; return { html: (await r.text()).slice(0, 2_000_000), url: r.url };
  } catch { return null; } finally { clearTimeout(t); }
}
async function crawlOrg(org, deadline, log) {
  const origin = new URL(org.url).origin; let robots = '';
  try { const r = await fetch(origin + '/robots.txt', { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8000) }); if (r.ok) robots = await r.text(); } catch { /* none */ }
  const seen = new Set(), found = new Map(); let fetched = 0;
  const visit = async (url) => {
    if (seen.has(url) || fetched >= PER_ORG_FETCHES || Date.now() > deadline) return null;
    seen.add(url); if (!robotsAllows(robots, new URL(url).pathname)) return null;
    fetched++; await sleep(DELAY_MS); const page = await get(url); if (!page) return null;
    for (const n of parseJobPostings(page.html, page.url)) { try { const j = toJob(n, org); found.set(j.url, j); } catch { /* skip bad posting */ } }
    return page;
  };
  const land = await visit(org.url); if (!land) return { jobs: [], note: 'unreachable or blocked' };
  const host = new URL(land.url).hostname.replace(/^www\./, ''); const sameSite = (u) => new URL(u).hostname.replace(/^www\./, '').endsWith(host.split('.').slice(-2).join('.'));
  const links = extractLinks(land.html, land.url).filter(sameSite);
  const lists = links.filter((u) => LIST_RE.test(new URL(u).pathname + new URL(u).search)).slice(0, LIST_PAGES);
  const jobLinks = new Set(links.filter((u) => JOB_RE.test(new URL(u).pathname)).slice(0, JOB_LINKS));
  for (const u of lists) { const p = await visit(u); if (p) extractLinks(p.html, p.url).filter(sameSite).filter((x) => JOB_RE.test(new URL(x).pathname)).slice(0, JOB_LINKS).forEach((x) => jobLinks.add(x)); }
  for (const u of [...jobLinks].slice(0, JOB_LINKS * 2)) await visit(u);
  return { jobs: [...found.values()], note: found.size ? '' : 'no JobPosting data (likely JavaScript-rendered or login-gated)' };
}

async function fetchJobs({ leads = [], log = console.log }) {
  const deadline = Date.now() + MAX_MS, out = []; let i = 0;
  const worker = async () => { while (i < leads.length && Date.now() < deadline) {
    const org = leads[i++]; if (!/^https?:/.test(org.url || '') || /usajobs\.gov/.test(org.url)) continue;
    try { const { jobs, note } = await crawlOrg(org, deadline, log); out.push(...jobs); log(`  crawl ${org.org}: ${jobs.length} postings${note ? ' (' + note + ')' : ''}`); } catch (e) { log(`  crawl ${org.org}: error ${e.message}`); }
  } };
  await Promise.all([worker(), worker(), worker()]);
  return out;
}
module.exports = { name: 'careers', enabled, fetchJobs, robotsAllows, parseJobPostings, extractLinks, toJob };

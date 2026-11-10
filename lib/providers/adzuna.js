'use strict';
// Adzuna aggregates many boards (incl. Indeed-type listings). Free key: https://developer.adzuna.com
// Env: ADZUNA_APP_ID, ADZUNA_APP_KEY
const { getJson } = require('../http');
const { finalize, withLocation, mapType } = require('../normalize');

const enabled = () => !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY);

function normalize(r) {
  const area = r.location?.area || []; // ["US","Texas","Bexar County","San Antonio"]
  const j = {
    id: 'adz-' + r.id, title: r.title, company: r.company?.display_name || 'Unknown',
    lat: r.latitude ?? null, lon: r.longitude ?? null, city: area.length > 3 ? area[area.length - 1] : null, state: area[1] || null,
    type: mapType(`${r.contract_time || ''} ${r.contract_type || ''}`, r.title),
    salaryMin: r.salary_is_predicted === '1' || r.salary_is_predicted === 1 ? null : (r.salary_min ? Math.round(r.salary_min) : null),
    salaryMax: r.salary_is_predicted === '1' || r.salary_is_predicted === 1 ? null : (r.salary_max ? Math.round(r.salary_max) : null),
    posted: r.created || null, url: r.redirect_url, description: r.description, source: 'adzuna',
    remote: /remote/i.test(`${r.title} ${r.location?.display_name}`),
  };
  return finalize(withLocation(j, r.location?.display_name));
}

async function fetchJobs({ queries, home, radiusMiles = 300, log = console.log }) {
  const out = [];
  for (const q of queries) {
    const params = new URLSearchParams({
      app_id: process.env.ADZUNA_APP_ID, app_key: process.env.ADZUNA_APP_KEY, results_per_page: '50',
      what: q, where: `${home.city}, ${home.state}`, distance: String(Math.round(radiusMiles * 1.609)), sort_by: 'date', max_days_old: '45',
    });
    try {
      const data = await getJson(`https://api.adzuna.com/v1/api/jobs/us/search/1?${params}`);
      out.push(...(data.results || []).map(normalize));
    } catch (e) { log(`  adzuna "${q}": ${e.message}`); }
  }
  return out;
}
module.exports = { name: 'adzuna', enabled, fetchJobs, normalize };

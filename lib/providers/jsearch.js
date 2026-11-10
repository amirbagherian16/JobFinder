'use strict';
// JSearch (RapidAPI) aggregates Google for Jobs => LinkedIn, Indeed, Glassdoor, ZipRecruiter, company sites.
// Env: RAPIDAPI_KEY   (https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
const { getJson } = require('../http');
const { finalize, withLocation, mapType, yearly } = require('../normalize');

const enabled = () => !!process.env.RAPIDAPI_KEY;

function normalize(r) {
  const [salaryMin, salaryMax] = yearly(r.job_min_salary, r.job_max_salary, r.job_salary_period || 'year');
  const j = {
    id: 'js-' + r.job_id, title: r.job_title, company: r.employer_name || 'Unknown',
    lat: r.job_latitude ?? null, lon: r.job_longitude ?? null, city: r.job_city || null, state: r.job_state || null,
    type: mapType(r.job_employment_type, r.job_title), salaryMin, salaryMax,
    posted: r.job_posted_at_datetime_utc || null, url: r.job_apply_link, description: r.job_description,
    source: 'jsearch', via: r.job_publisher || null, remote: !!r.job_is_remote,
  };
  return finalize(withLocation(j, `${r.job_city || ''}, ${r.job_state || ''}`));
}

async function fetchJobs({ queries, home, log = console.log }) {
  const out = [];
  for (const q of queries) {
    const params = new URLSearchParams({ query: `${q} in United States`, page: '1', num_pages: '2', date_posted: 'month', country: 'us' });
    try {
      const data = await getJson(`https://jsearch.p.rapidapi.com/search?${params}`, {
        headers: { 'X-RapidAPI-Key': process.env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'jsearch.p.rapidapi.com' },
      });
      out.push(...(data.data || []).map(normalize));
    } catch (e) { log(`  jsearch "${q}": ${e.message}`); }
  }
  return out;
}
module.exports = { name: 'jsearch', enabled, fetchJobs, normalize };

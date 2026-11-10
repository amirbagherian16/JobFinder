'use strict';
// USAJOBS (federal: NIH, FDA, DoD labs, VA, NASA ...). Free key: https://developer.usajobs.gov
// Env: USAJOBS_API_KEY, USAJOBS_EMAIL
const { getJson } = require('../http');
const { finalize, withLocation, mapType, yearly } = require('../normalize');

const enabled = () => !!(process.env.USAJOBS_API_KEY && process.env.USAJOBS_EMAIL);

function normalize(item) {
  const d = item.MatchedObjectDescriptor || {};
  const loc = (d.PositionLocation || [])[0] || {};
  const rem = (d.PositionRemuneration || [])[0] || {};
  const det = d.UserArea?.Details || {};
  const [salaryMin, salaryMax] = yearly(rem.MinimumRange, rem.MaximumRange, rem.RateIntervalCode === 'Per Hour' ? 'hour' : 'year');
  const j = {
    id: 'usa-' + (item.MatchedObjectId || d.PositionID), title: d.PositionTitle, company: d.OrganizationName + (d.DepartmentName ? ` (${d.DepartmentName})` : ''),
    lat: loc.Latitude ?? null, lon: loc.Longitude ?? null, city: loc.CityName || null, state: loc.CountrySubDivisionCode || null,
    type: mapType((d.PositionSchedule || []).map((s) => s.Name).join(' '), d.PositionTitle),
    salaryMin, salaryMax, posted: d.PublicationStartDate || null, url: d.PositionURI,
    description: [d.QualificationSummary, det.JobSummary].filter(Boolean).join(' '), source: 'usajobs', sector: 'Government',
    remote: /remote|telework/i.test(`${d.PositionTitle} ${loc.LocationName}`) && /remote/i.test(det.RemoteIndicator || loc.LocationName || ''),
    citizenshipRequired: true, // federal posts are U.S.-citizen-only unless the notice says otherwise
  };
  if (/(non-?citizens?|open to non-citizens)/i.test(det.WhoMayApply?.Name || '')) j.citizenshipRequired = false;
  return finalize(withLocation(j, loc.LocationName));
}

async function fetchJobs({ queries, home, radiusMiles = 300, log = console.log }) {
  const out = [];
  const headers = { Host: 'data.usajobs.gov', 'User-Agent': process.env.USAJOBS_EMAIL, 'Authorization-Key': process.env.USAJOBS_API_KEY };
  for (const q of queries) {
    const params = new URLSearchParams({ Keyword: q, ResultsPerPage: '50', DatePosted: '45', SortField: 'opendate', SortDirection: 'desc' });
    try {
      const data = await getJson(`https://data.usajobs.gov/api/search?${params}`, { headers });
      out.push(...(data.SearchResult?.SearchResultItems || []).map(normalize));
    } catch (e) { log(`  usajobs "${q}": ${e.message}`); }
  }
  return out;
}
module.exports = { name: 'usajobs', enabled, fetchJobs, normalize };

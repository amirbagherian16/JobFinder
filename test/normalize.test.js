'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { yearly, mapType, finalize, dedupe, withLocation } = require('../lib/normalize');
const { resolveLocation, haversineMiles } = require('../lib/geo');
const { score } = require('../lib/relevance');
const adzuna = require('../lib/providers/adzuna'), usajobs = require('../lib/providers/usajobs'), jsearch = require('../lib/providers/jsearch'), boards = require('../lib/providers/boards');

test('yearly salary conversion and sanity bounds', () => {
  assert.deepEqual(yearly(50, 60, 'HOUR'), [104000, 124800]);
  assert.deepEqual(yearly(90000, 110000, 'year'), [90000, 110000]);
  assert.deepEqual(yearly(7000, 9000, 'month'), [84000, 108000]);
  assert.deepEqual(yearly(5, 9, 'year'), [null, null]);
  assert.deepEqual(yearly(null, null), [null, null]);
});
test('employment type mapping', () => {
  assert.equal(mapType('FULLTIME', 'x'), 'Full-time'); assert.equal(mapType('PARTTIME', 'x'), 'Part-time');
  assert.equal(mapType('CONTRACTOR', 'x'), 'Contract'); assert.equal(mapType('', 'Postdoctoral Fellow'), 'Postdoc'); assert.equal(mapType('INTERN', 'x'), 'Internship');
});
test('geo: resolves city/state and distances', () => {
  const r = resolveLocation('San Antonio, TX'); assert.equal(r.state, 'TX'); assert.ok(Math.abs(r.lat - 29.42) < 0.1);
  assert.equal(resolveLocation('Bethesda, Maryland, United States').state, 'MD');
  assert.equal(resolveLocation('Smallville, KS').approx, true);
  assert.equal(resolveLocation('nowhere'), null);
  const d = haversineMiles(29.4241, -98.4936, 30.2672, -97.7431); assert.ok(d > 70 && d < 85, `SA-Austin ${d}`);
});
test('relevance: field-specific jobs outrank unrelated ones; word boundaries', () => {
  const a = score({ title: 'Research Scientist, Traumatic Brain Injury Modeling', description: 'PhD. LS-DYNA finite element head models, MRI segmentation' });
  const b = score({ title: 'Software Engineer', description: 'primary feature of our product' });
  const c = score({ title: 'ICU Nurse', description: 'brain injury patients' });
  assert.ok(a.score > 70); assert.ok(b.score < 15); assert.ok(c.score < 15); assert.deepEqual(b.matched, []);
});
test('adzuna normalize', () => {
  const j = adzuna.normalize({ id: '1', title: 'Biomechanics Engineer (finite element)', company: { display_name: 'Acme' }, location: { display_name: 'San Antonio, Texas', area: ['US', 'Texas', 'Bexar County', 'San Antonio'] }, latitude: 29.4, longitude: -98.5, salary_min: 90000, salary_max: 120000, salary_is_predicted: '0', created: '2026-11-01T00:00:00Z', redirect_url: 'https://x.test/1', description: 'Injury biomechanics', contract_time: 'full_time' });
  assert.equal(j.state, 'TX'); assert.equal(j.salaryMin, 90000); assert.equal(j.type, 'Full-time'); assert.equal(j.source, 'adzuna');
  const p = adzuna.normalize({ id: '2', title: 'x', company: {}, location: { area: ['US', 'Texas'] }, salary_min: 1, salary_max: 2, salary_is_predicted: '1', redirect_url: 'https://x.test' });
  assert.equal(p.salaryMin, null, 'predicted salaries are discarded');
});
test('usajobs normalize', () => {
  const j = usajobs.normalize({ MatchedObjectId: '123', MatchedObjectDescriptor: { PositionTitle: 'Research Biomedical Engineer', OrganizationName: 'Army Institute of Surgical Research', DepartmentName: 'Department of the Army', PositionURI: 'https://www.usajobs.gov/job/123', PositionLocation: [{ LocationName: 'San Antonio, Texas', CityName: 'San Antonio', CountrySubDivisionCode: 'Texas', Latitude: 29.46, Longitude: -98.43 }], PositionRemuneration: [{ MinimumRange: '99172', MaximumRange: '128935', RateIntervalCode: 'Per Year' }], PositionSchedule: [{ Name: 'Full-time' }], PublicationStartDate: '2026-11-03', QualificationSummary: 'TBI modeling', UserArea: { Details: { JobSummary: 'traumatic brain injury' } } } });
  assert.equal(j.state, 'TX'); assert.equal(j.salaryMax, 128935); assert.equal(j.citizenshipRequired, true); assert.equal(j.sector, 'Government');
});
test('jsearch normalize (hourly pay, remote)', () => {
  const j = jsearch.normalize({ job_id: 'abc', job_title: 'ML Scientist, medical image segmentation', employer_name: 'Co', job_city: 'Austin', job_state: 'TX', job_min_salary: 60, job_max_salary: 70, job_salary_period: 'HOUR', job_employment_type: 'CONTRACTOR', job_apply_link: 'https://x.test', job_is_remote: false, job_publisher: 'LinkedIn', job_description: 'machine learning' });
  assert.equal(j.salaryMin, 124800); assert.equal(j.type, 'Contract'); assert.equal(j.via, 'LinkedIn'); assert.ok(j.lat);
});
test('greenhouse + lever normalize', () => {
  const g = boards.normalizeGreenhouse({ id: 7, title: 'Scientist, TBI', location: { name: 'Billerica, MA' }, absolute_url: 'https://x.test', content: '&lt;p&gt;traumatic brain injury&lt;/p&gt;' }, 'quanterix');
  assert.equal(g.state, 'MA'); assert.ok(g.relevance > 30);
  const l = boards.normalizeLever({ id: 'u', text: 'Remote ML Engineer', categories: { location: 'Remote - US', commitment: 'Full-time' }, hostedUrl: 'https://x.test', createdAt: 1762000000000, descriptionPlain: 'x' }, 'co');
  assert.equal(l.remote, true);
});
test('finalize strips HTML and detects citizenship wording; dedupe keeps salary', () => {
  const f = finalize({ title: 'T', company: 'C', url: 'https://x', description: '<b>U.S. citizenship required</b>' });
  assert.equal(f.citizenshipRequired, true); assert.ok(!f.description.includes('<'));
  const a = finalize({ title: 'Eng', company: 'Co', city: 'Austin', url: 'https://a' }), b = finalize({ title: 'Eng', company: 'Co', city: 'Austin', url: 'https://b', salaryMin: 100000, salaryMax: 120000 });
  assert.equal(dedupe([a, b]).length, 1); assert.equal(dedupe([a, b])[0].salaryMin, 100000);
});
test('board discovery: slug candidates and name matching', () => {
  assert.ok(boards.slugCandidates('Quanterix').includes('quanterix'));
  assert.ok(boards.slugCandidates('General Motors').includes('generalmotors'));
  assert.equal(boards.boardNameMatches('Quanterix', 'Quanterix Corporation'), true);
  assert.equal(boards.boardNameMatches('Ford Motor Company', 'Ford Foundation'), false);
  assert.equal(boards.boardNameMatches('Ford Motor Company', 'Ford Motor'), true);
  assert.equal(boards.boardNameMatches('Exponent', 'Spotify'), false);
  assert.equal(boards.boardNameMatches('Air Force Research Laboratory, 711th Human Performance Wing', 'Air'), false);
});
test('track detection and teaching relevance', () => {
  assert.equal(finalize({ title: 'Part-time Math Tutor (Algebra, Calculus)', company: 'X', url: 'https://x' }).track, 'teaching');
  assert.equal(finalize({ title: 'Research Scientist, TBI', company: 'X', url: 'https://x' }).track, 'research');
  assert.ok(finalize({ title: 'Adjunct Instructor, Engineering Analysis', company: 'X', url: 'https://x', description: 'algebra, mathematics' }).relevance > 40);
});
test('precision flag: API coordinates are precise, city lookups are not', () => {
  assert.equal(finalize(withLocation({ title: 'x', company: 'c', url: 'https://x', lat: 29.5, lon: -98.6 }, 'x')).precise, true);
  assert.equal(finalize(withLocation({ title: 'x', company: 'c', url: 'https://x' }, 'San Antonio, TX')).precise, false);
});
test('geocode: parses Nominatim result and rejects implausible matches', async () => {
  const { geocode, plausible } = require('../lib/geocode');
  const fake = async () => ({ ok: true, json: async () => [{ lat: '29.4449', lon: '-98.6293', display_name: 'SwRI' }] });
  const pt = await geocode('6220 Culebra Rd, San Antonio, TX', { fetchImpl: fake, delayMs: 0 });
  assert.ok(Math.abs(pt.lat - 29.4449) < 1e-6);
  const sa = resolveLocation('San Antonio, TX');
  assert.equal(plausible(pt, sa), true);
  assert.equal(plausible({ lat: 40.7, lon: -74 }, sa), false); // wrong city (New York)
  assert.equal(await geocode('nowhere', { fetchImpl: async () => ({ ok: true, json: async () => [] }), delayMs: 0 }), null);
});
test('careers crawler: JSON-LD parsing, link extraction, robots.txt', () => {
  const careers = require('../lib/providers/careers');
  const html = `<html><a href="/jobs/123-biomechanics-scientist">x</a><a href="https://other.test/a.pdf">p</a>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Research Scientist, TBI Biomechanics","url":"https://careers.example.org/jobs/123","datePosted":"2026-11-01",
    "employmentType":"FULL_TIME","hiringOrganization":{"name":"Example"},"jobLocation":{"address":{"addressLocality":"San Antonio","addressRegion":"TX"}},
    "baseSalary":{"value":{"minValue":95000,"maxValue":120000,"unitText":"YEAR"}},"description":"<p>PhD, finite element, traumatic brain injury</p>"}</script>
    <script type="application/ld+json">{"@graph":[{"@type":"Organization"},{"@type":["JobPosting"],"title":"Math Tutor","url":"https://careers.example.org/jobs/9"}]}</script>
    <script type="application/ld+json">{bad json</script></html>`;
  const posts = careers.parseJobPostings(html, 'https://careers.example.org/jobs');
  assert.equal(posts.length, 2);
  const j = careers.toJob(posts[0], { org: 'Example Org', sector: 'Industry', city: 'San Antonio', state: 'TX' });
  assert.equal(j.url, 'https://careers.example.org/jobs/123'); assert.equal(j.salaryMin, 95000); assert.equal(j.state, 'TX'); assert.equal(j.source, 'careers'); assert.ok(j.relevance > 40);
  const links = careers.extractLinks(html, 'https://careers.example.org/');
  assert.deepEqual(links, ['https://careers.example.org/jobs/123-biomechanics-scientist']);
  assert.equal(careers.robotsAllows('User-agent: *\nDisallow: /private\n', '/private/x'), false);
  assert.equal(careers.robotsAllows('User-agent: *\nDisallow: /private\nAllow: /private/ok\n', '/private/ok/1'), true);
  assert.equal(careers.robotsAllows('User-agent: *\nDisallow:\n', '/jobs'), true);
});
test('lead location tiers: address -> name -> nearby area (flagged approximate)', async () => {
  const { locateLead } = require('../scripts/fetch-jobs');
  const sa = { lat: 29.55, lon: -98.60 };
  const e = { org: 'Acme Corp', city: 'San Antonio', state: 'TX', address: '1 Main St, San Antonio, TX', area: 'De Zavala Rd, San Antonio, TX', areaNote: 'Near De Zavala Rd' };
  const tried = [];
  const onlyArea = async (q) => { tried.push(q); return q.startsWith('De Zavala') ? sa : null; };
  const r = await locateLead(e, onlyArea);
  assert.deepEqual(tried, ['1 Main St, San Antonio, TX', 'Acme Corp, San Antonio, TX', 'De Zavala Rd, San Antonio, TX']);
  assert.equal(r.exact, false); assert.equal(r.note, 'Near De Zavala Rd');
  const byAddr = await locateLead(e, async (q) => (q.startsWith('1 Main') ? sa : null)); assert.equal(byAddr.exact, true); assert.equal(byAddr.note, null);
  assert.equal(await locateLead(e, async () => null), null);
  assert.equal(await locateLead(e, async () => ({ lat: 40.7, lon: -74 })), null, 'wrong-city match rejected');
});

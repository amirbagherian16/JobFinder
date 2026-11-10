(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const ANY_RADIUS = 610;
const TYPES = ['Full-time', 'Part-time', 'Contract', 'Postdoc', 'Internship', 'Temporary'];
const SECTORS = ['Industry', 'Government', 'Academic'];
const TRACKS = ['Research', 'Teaching & tutoring'];
const trackOf = (j) => (j.track === 'teaching' ? 'Teaching & tutoring' : 'Research');
const PAGE = 40;
const DEFAULTS = () => ({ q: '', salMin: '', salMax: '', salUnlisted: true, radius: 100, remoteOk: true, states: [], cities: [], types: [...TYPES], sectors: [...SECTORS], tracks: [...TRACKS],
  showPostings: true, showLeads: true, hideCit: false, minRel: 0, posted: 0, sort: 'relevance' });

let DATA = null, PLACES = null, home = null, F = DEFAULTS(), shown = PAGE, activeId = null;
let map, cluster, homeMarker, radiusCircle, markers = new Map(), fitTimer;

// ---------- utils ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : '#'; } catch { return '#'; } };
const miles = (a, b, c, d) => { const r = (x) => x * Math.PI / 180, h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2; return 7917.6 * Math.asin(Math.sqrt(h)); };
const kfmt = (n) => '$' + (n >= 1000 ? Math.round(n / 1000) + 'k' : n);
const salaryText = (j) => j.salaryMin == null ? null : (j.salaryMax !== j.salaryMin ? `${kfmt(j.salaryMin)}–${kfmt(j.salaryMax)}` : kfmt(j.salaryMin)) + '/yr';
const salaryMid = (j) => j.salaryMin == null ? null : (j.salaryMin + (j.salaryMax ?? j.salaryMin)) / 2;
const ageDays = (j) => j.posted ? (Date.now() - new Date(j.posted).getTime()) / 864e5 : null;
const ago = (j) => { const d = ageDays(j); if (d == null) return null; if (d < 1) return 'today'; if (d < 2) return '1 day ago'; if (d < 31) return Math.floor(d) + ' days ago'; return Math.floor(d / 30) + ' mo ago'; };
const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const relClass = (s) => s >= 70 ? 'hi' : s >= 45 ? 'mid' : 'lo';

// ---------- load ----------
async function boot() {
  try {
    const [jobs, places] = await Promise.all([fetch('data/jobs.json', { cache: 'no-cache' }).then((r) => r.json()), fetch('data/places.json').then((r) => r.json())]);
    DATA = jobs; PLACES = places;
  } catch (e) { $('#updated').textContent = 'Could not load job data'; $('#list').innerHTML = '<li class="empty">Could not load data/jobs.json. Run <code>npm run fetch</code> and reload.</li>'; return; }
  const saved = store.get('jf.filters');
  F = Object.assign(DEFAULTS(), saved || {}, saved ? {} : { radius: DATA.defaultRadiusMiles || 100 });
  home = store.get('jf.home') || { ...DATA.home, label: `${DATA.home.city}, ${DATA.home.state}` };
  const live = DATA.jobs.filter((j) => j.kind === 'posting').length;
  $('#updated').textContent = `${live} live postings · ${DATA.jobs.length - live} employer leads · updated ${new Date(DATA.generatedAt).toLocaleDateString()}`;
  initMap(); initControls(); initWebSearch(); syncControls(); update(true);
}

// ---------- controls ----------
function chipGroup(box, values, key) {
  box.innerHTML = values.map((v) => `<button type="button" class="chip" data-v="${esc(v)}" aria-pressed="false">${esc(v)}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const s = new Set(F[key]); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); F[key] = [...s]; syncControls(); update(true);
  });
}
function multiSelect(root, label, key, options) {
  root.innerHTML = `<button type="button" aria-haspopup="listbox" aria-expanded="false"><span class="lbl"></span><span aria-hidden="true">▾</span></button>
    <div class="ms-pop" hidden><input type="search" placeholder="Search ${esc(label.toLowerCase())}…" aria-label="Search ${esc(label.toLowerCase())}"><div class="ms-list" role="listbox" aria-multiselectable="true"></div><button type="button" class="ghost ms-clear">Clear</button></div>`;
  const btn = $('button', root), pop = $('.ms-pop', root), list = $('.ms-list', root), search = $('input', pop);
  const render = () => {
    const q = search.value.trim().toLowerCase(), sel = new Set(F[key]);
    list.innerHTML = options().filter((o) => !q || o.label.toLowerCase().includes(q)).map((o) =>
      `<label><input type="checkbox" value="${esc(o.value)}" ${sel.has(o.value) ? 'checked' : ''}> ${esc(o.label)}<small>${o.count ?? ''}</small></label>`).join('') || '<div class="muted" style="padding:6px">No matches</div>';
  };
  const setLabel = () => { $('.lbl', root).textContent = F[key].length ? `${label}: ${F[key].length} selected` : `${label}: any`; };
  root._refresh = () => { setLabel(); render(); };
  btn.addEventListener('click', () => { const open = pop.hidden; pop.hidden = !open; btn.setAttribute('aria-expanded', open); if (open) { search.value = ''; render(); search.focus({ preventScroll: true }); } });
  search.addEventListener('input', render);
  list.addEventListener('change', (e) => {
    const s = new Set(F[key]); e.target.checked ? s.add(e.target.value) : s.delete(e.target.value); F[key] = [...s];
    if (F.states.length || F.cities.length) F.radius = ANY_RADIUS; // choosing places overrides the distance limit
    syncControls(); update(true);
  });
  $('.ms-clear', root).addEventListener('click', () => { F[key] = []; syncControls(); update(true); });
  document.addEventListener('click', (e) => { if (!root.contains(e.target)) { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); } });
}
function initControls() {
  chipGroup($('#trackBox'), TRACKS, 'tracks'); chipGroup($('#typeBox'), TYPES, 'types'); chipGroup($('#sectorBox'), SECTORS, 'sectors');
  const stateCount = {}, cityCount = {};
  DATA.jobs.forEach((j) => { if (j.state) stateCount[j.state] = (stateCount[j.state] || 0) + 1; if (j.city && j.state && !j.approxLocation) { const k = `${j.city}, ${j.state}`; cityCount[k] = (cityCount[k] || 0) + 1; } });
  multiSelect($('#stateMs'), 'States', 'states', () => Object.entries(PLACES.states).map(([ab, [name]]) => ({ value: ab, label: `${name} (${ab})`, count: stateCount[ab] || '' })).sort((a, b) => (stateCount[b.value] || 0) - (stateCount[a.value] || 0) || a.label.localeCompare(b.label)));
  multiSelect($('#cityMs'), 'Cities', 'cities', () => { const all = new Set([...Object.keys(cityCount), ...PLACES.cities.map(([c, s]) => `${c}, ${s}`)]); return [...all].map((v) => ({ value: v, label: v, count: cityCount[v] || '' })).sort((a, b) => (cityCount[b.value] || 0) - (cityCount[a.value] || 0) || a.label.localeCompare(b.label)); });
  const bind = (id, key, ev = 'input', conv = (x) => x) => $(id).addEventListener(ev, (e) => { F[key] = conv(e.target.type === 'checkbox' ? e.target.checked : e.target.value); update(true); syncControls(false); });
  bind('#q', 'q'); bind('#salMin', 'salMin'); bind('#salMax', 'salMax'); bind('#salUnlisted', 'salUnlisted', 'change'); bind('#remoteOk', 'remoteOk', 'change');
  bind('#radius', 'radius', 'input', Number); bind('#minRel', 'minRel', 'input', Number); bind('#posted', 'posted', 'change', Number);
  bind('#showPostings', 'showPostings', 'change'); bind('#showLeads', 'showLeads', 'change'); bind('#hideCit', 'hideCit', 'change');
  bind('#sort', 'sort', 'change');
  $('#reset').addEventListener('click', () => { F = Object.assign(DEFAULTS(), { radius: DATA.defaultRadiusMiles || 100, sort: F.sort }); syncControls(); update(true); });

  // home location
  $('#placeList').innerHTML = PLACES.cities.map(([c, s]) => `<option value="${esc(c)}, ${s}">`).join('');
  $('#homeInput').addEventListener('change', (e) => {
    const m = e.target.value.trim().toLowerCase();
    const hit = PLACES.cities.find(([c, s]) => `${c}, ${s}`.toLowerCase() === m) || PLACES.cities.find(([c]) => c.toLowerCase() === m);
    if (hit) setHome({ city: hit[0], state: hit[1], lat: hit[2], lon: hit[3], label: `${hit[0]}, ${hit[1]}`, precise: false });
    else e.target.value = home.label;
  });
  $('#geoBtn').addEventListener('click', () => {
    if (!navigator.geolocation) return alert('Geolocation is not available in this browser.');
    navigator.geolocation.getCurrentPosition((p) => setHome({ lat: p.coords.latitude, lon: p.coords.longitude, label: 'My location', precise: true }), () => alert('Could not get your location. Type a city instead.'), { timeout: 8000 });
  });

  // exact home address (geocoded in the browser; stored only in localStorage)
  let found = null;
  const dlg = $('#addrDlg'), res = $('#addrResult'), use = $('#addrUse');
  $('#addrBtn').addEventListener('click', () => { res.textContent = home.precise ? `Currently: ${home.label}` : ''; use.disabled = true; found = null; dlg.showModal(); $('#addrInput').focus(); });
  $('#addrInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#addrFind').click(); } });
  $('#addrFind').addEventListener('click', async () => {
    const raw = $('#addrInput').value.trim(); if (!raw) return;
    use.disabled = true; found = null; res.textContent = 'Looking up…';
    const ll = raw.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);
    if (ll) { found = { lat: +ll[1], lon: +ll[2], label: 'My location' }; res.textContent = `Using coordinates ${ll[1]}, ${ll[2]}`; use.disabled = false; return; }
    const q = raw.replace(/\b(apt|apartment|unit|suite|ste|#)\.?\s*[\w-]+/ig, '').replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').trim();
    try {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&addressdetails=1&q=' + encodeURIComponent(q), { headers: { Accept: 'application/json' } });
      const [hit] = await r.json();
      if (!hit) { res.textContent = 'No match. Try “street, city, ST ZIP”, or paste coordinates as “lat, lon” (right-click your spot in Google Maps).'; return; }
      const exact = hit.address?.house_number != null;
      found = { lat: +hit.lat, lon: +hit.lon, label: 'My address' };
      res.textContent = `${exact ? 'Exact building' : 'Street-level match (building number not found)'}: ${hit.display_name}`; use.disabled = false;
    } catch { res.textContent = 'Could not reach the address lookup. Paste coordinates as “lat, lon” instead.'; }
  });
  use.addEventListener('click', () => { if (found) { setHome({ ...found, precise: true }); dlg.close(); } });

  // mobile navigation
  document.querySelectorAll('.tab[data-view]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#openFilters').addEventListener('click', () => document.body.classList.add('filters-open'));
  const closeSheet = () => document.body.classList.remove('filters-open');
  $('#closeFilters').addEventListener('click', closeSheet); $('#applyFilters').addEventListener('click', closeSheet);
  $('#more').addEventListener('click', () => { shown += PAGE; renderList(); });
}
function setView(v) {
  document.body.dataset.view = v;
  document.querySelectorAll('.tab[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'map') setTimeout(() => { map.invalidateSize(); fit(); }, 60);
}
function setHome(h) { home = h; store.set('jf.home', h); syncControls(); updateHomeMarker(); update(true); }
function syncControls(full = true) {
  if (full) {
    $('#q').value = F.q; $('#salMin').value = F.salMin; $('#salMax').value = F.salMax; $('#salUnlisted').checked = F.salUnlisted; $('#remoteOk').checked = F.remoteOk;
    $('#radius').value = F.radius; $('#minRel').value = F.minRel; $('#posted').value = F.posted; $('#sort').value = F.sort;
    $('#showPostings').checked = F.showPostings; $('#showLeads').checked = F.showLeads; $('#hideCit').checked = F.hideCit;
    $('#homeInput').value = home.label;
    document.querySelectorAll('#trackBox .chip').forEach((b) => b.setAttribute('aria-pressed', F.tracks.includes(b.dataset.v)));
    document.querySelectorAll('#typeBox .chip').forEach((b) => b.setAttribute('aria-pressed', F.types.includes(b.dataset.v)));
    document.querySelectorAll('#sectorBox .chip').forEach((b) => b.setAttribute('aria-pressed', F.sectors.includes(b.dataset.v)));
    $('#stateMs')._refresh(); $('#cityMs')._refresh();
  } else { /* keep focus in place while typing; only outputs */ }
  $('#radius').value = F.radius;
  $('#radiusOut').textContent = F.radius >= ANY_RADIUS ? 'Any' : `${F.radius} mi`;
  $('#minRelOut').textContent = F.minRel ? `≥ ${F.minRel}` : 'Any';
  $('#radiusHint').textContent = F.radius >= ANY_RADIUS ? (F.states.length || F.cities.length ? 'Distance limit is off while states/cities are selected. Drag left to re-enable.' : 'No distance limit.') : `Within ${F.radius} straight-line miles of ${home.label}${home.precise ? '' : ' (city centre; tap 🏠 to set your exact address)'}.`;
  $('#stateMs')._refresh?.(); $('#cityMs')._refresh?.();
}

// ---------- filtering + sorting ----------
function withDistance(j) { return j.lat != null && !j.remote ? miles(home.lat, home.lon, j.lat, j.lon) : null; }
function compute() {
  const q = F.q.trim().toLowerCase(), sMin = F.salMin === '' ? null : +F.salMin, sMax = F.salMax === '' ? null : +F.salMax;
  const cities = new Set(F.cities), states = new Set(F.states);
  let rows = DATA.jobs.map((j) => ({ j, d: withDistance(j) }));
  rows = rows.filter(({ j, d }) => {
    if (j.kind === 'lead' ? !F.showLeads : !F.showPostings) return false;
    if (!F.types.includes(j.type) || !F.sectors.includes(j.sector) || !F.tracks.includes(trackOf(j))) return false;
    if (F.hideCit && j.citizenshipRequired) return false;
    if (j.relevance < F.minRel) return false;
    if (q && !`${j.title} ${j.company} ${j.city || ''} ${j.description} ${j.matched.join(' ')}`.toLowerCase().includes(q)) return false;
    if (F.posted) { const a = ageDays(j); if (a == null || a > F.posted) return false; }
    // salary
    if (sMin != null || sMax != null) {
      if (j.salaryMin == null) { if (!F.salUnlisted) return false; }
      else if ((sMin != null && (j.salaryMax ?? j.salaryMin) < sMin) || (sMax != null && j.salaryMin > sMax)) return false;
    } else if (!F.salUnlisted && j.salaryMin == null) return false;
    // place
    if (states.size && !states.has(j.state) && !(j.remote && F.remoteOk)) return false;
    if (cities.size && !cities.has(`${j.city}, ${j.state}`) && !(j.remote && F.remoteOk)) return false;
    if (j.remote) return F.remoteOk;
    if (F.radius < ANY_RADIUS) return d != null && d <= F.radius;
    return true;
  });
  const nl = (v, dir) => (a, b) => (v(a) == null) - (v(b) == null) || (v(a) == null ? 0 : dir * (v(a) - v(b)));
  const rel = (a, b) => b.j.relevance - a.j.relevance;
  const cmp = {
    relevance: rel,
    recent: (a, b) => nl((x) => x.j.posted ? Date.parse(x.j.posted) : null, -1)(a, b) || rel(a, b),
    distance: (a, b) => nl((x) => x.d, 1)(a, b) || rel(a, b),
    salaryDesc: (a, b) => nl((x) => salaryMid(x.j), -1)(a, b) || rel(a, b),
    salaryAsc: (a, b) => nl((x) => salaryMid(x.j), 1)(a, b) || rel(a, b),
  }[F.sort];
  return rows.sort(cmp);
}

let rows = [];
function update(resetPaging) {
  if (resetPaging) shown = PAGE;
  rows = compute(); store.set('jf.filters', F);
  const n = rows.length;
  $('#count').textContent = `${n} job${n === 1 ? '' : 's'}`; $('#countBtn').textContent = n;
  const unlisted = rows.filter((r) => r.j.salaryMin == null).length;
  $('#sub').textContent = n ? ` · ${n - unlisted} with salary listed` : '';
  const active = countActive(); const fb = $('#fbadge'); fb.hidden = !active; fb.textContent = active;
  const noteBits = [];
  if (F.sort === 'recent' && rows.some((r) => !r.j.posted)) noteBits.push('Employer leads have no posting date, so they sort after dated postings.');
  if (F.sort.startsWith('salary') && rows.some((r) => r.j.salaryMin == null)) noteBits.push('Jobs without a listed salary are placed last.');
  const nb = $('#notice'); nb.hidden = !noteBits.length; nb.textContent = noteBits.join(' ');
  renderList(); renderMap();
}
function countActive() {
  const d = DEFAULTS(); let n = 0;
  if (F.q) n++; if (F.salMin !== '' || F.salMax !== '') n++; if (!F.salUnlisted) n++; if (F.radius !== (DATA.defaultRadiusMiles || 100)) n++;
  if (F.states.length) n++; if (F.cities.length) n++; if (F.types.length !== TYPES.length) n++; if (F.sectors.length !== SECTORS.length) n++; if (F.tracks.length !== TRACKS.length) n++;
  if (!F.showPostings || !F.showLeads) n++; if (F.hideCit) n++; if (F.minRel) n++; if (F.posted) n++; if (!F.remoteOk) n++;
  return n;
}

// ---------- list ----------
// Google Maps directions from the saved home to the job: exact coords when the source gave them, otherwise the employer's name + city.
function dirUrl(j) {
  const dest = j.precise && j.lat != null ? `${j.lat},${j.lon}` : `${j.company.replace(/\s*\(.*?\)/g, '')} ${j.city || ''} ${j.state || ''}`.trim();
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(home.lat + ',' + home.lon)}&destination=${encodeURIComponent(dest)}&travelmode=driving`;
}
function cardHtml({ j, d }) {
  const sal = salaryText(j), when = ago(j);
  const loc = j.remote ? 'Remote' : [j.city, j.state].filter(Boolean).join(', ') || 'Location not specified';
  const links = j.links;
  return `<li class="card ${j.id === activeId ? 'active' : ''}" data-id="${esc(j.id)}">
    <h3>${esc(j.title)}</h3><div class="org">${esc(j.company)}${j.via ? ` · via ${esc(j.via)}` : ''}</div>
    <div class="meta"><span>📍 ${esc(loc)}${j.approxLocation ? ' (approx.)' : ''}</span>${d != null ? `<span title="Straight-line distance${j.precise ? '' : ' to the centre of ' + (j.city || 'the area') + ' (exact address unknown)'}"><b>${j.precise ? '' : '~'}${d < 1 ? '<1' : Math.round(d)} mi</b> straight-line</span>` : ''}
      <span>${sal ? `💰 <b>${esc(sal)}</b>` : 'Salary not listed'}</span><span>${esc(j.type)}</span>${when ? `<span>🕒 ${esc(when)}</span>` : ''}</div>
    <div class="tags">${j.kind === 'lead' ? '<span class="tag lead" title="Organization that works in your field. Open positions are not verified.">Employer lead</span>' : ''}
      <span class="tag">${esc(j.sector)}</span>${j.track === 'teaching' ? '<span class="tag">Teaching &amp; tutoring</span>' : ''}${j.citizenshipRequired ? '<span class="tag warn">U.S. citizenship may be required</span>' : ''}${j.remote ? '<span class="tag">Remote</span>' : ''}
      ${j.matched.slice(0, 4).map((m) => `<span class="tag">${esc(m)}</span>`).join('')}</div>
    <div class="rel" title="How closely this matches your resume"><span>Match ${j.relevance}</span><div class="bar"><i style="width:${j.relevance}%"></i></div></div>
    <p class="desc">${esc(j.description)}</p>
    <div class="actions">${links
        ? `<a class="main" href="${esc(links.google)}" target="_blank" rel="noopener noreferrer" title="Opens current job ads from this employer">See open jobs</a><a href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener noreferrer">Careers page</a><a href="${esc(links.linkedin)}" target="_blank" rel="noopener noreferrer">LinkedIn</a><a href="${esc(links.indeed)}" target="_blank" rel="noopener noreferrer">Indeed</a>`
        : `<a class="main" href="${esc(safeUrl(j.url))}" target="_blank" rel="noopener noreferrer">View job posting</a>`}
      ${j.lat != null && !j.remote ? '<button type="button" data-act="map">Show on map</button>' : ''}${j.remote ? '' : `<a href="${esc(dirUrl(j))}" target="_blank" rel="noopener noreferrer">Directions</a>`}</div></li>`;
}
function renderList() {
  const list = $('#list');
  if (!rows.length) { list.innerHTML = '<li class="empty"><strong>No jobs match these filters.</strong><br>Try a larger distance, a lower minimum salary, or Reset filters.</li>'; $('#more').hidden = true; return; }
  list.innerHTML = rows.slice(0, shown).map(cardHtml).join('');
  $('#more').hidden = rows.length <= shown; $('#more').textContent = `Show more (${rows.length - shown} left)`;
}
$('#list').addEventListener('click', (e) => {
  const li = e.target.closest('.card'); if (!li) return;
  if (e.target.closest('a')) return;
  focusJob(li.dataset.id, true);
});

// ---------- map ----------
function initMap() {
  map = L.map('map', { zoomControl: true, worldCopyJump: false }).setView([39.5, -98.35], 4);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  cluster = L.markerClusterGroup({ maxClusterRadius: 38, showCoverageOnHover: false, spiderfyOnMaxZoom: true });
  map.addLayer(cluster); updateHomeMarker();
}
function updateHomeMarker() {
  if (homeMarker) map.removeLayer(homeMarker);
  homeMarker = L.marker([home.lat, home.lon], { icon: L.divIcon({ className: '', html: '<div class="pin home"><span>⌂</span></div>', iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000, title: 'Home: ' + home.label }).addTo(map);
}
function popupHtml({ j, d }) {
  const sal = salaryText(j);
  return `<h4>${esc(j.title)}</h4><div class="pm"><b>${esc(j.company)}</b></div><div class="pm">${esc([j.city, j.state].filter(Boolean).join(', '))}${d != null ? ` · ${j.precise ? '' : '~'}${Math.round(d)} mi` : ''}</div>${j.precise ? '' : '<div class="pm"><i>Approximate pin: exact street address not found</i></div>'}
    <div class="pm">${sal ? esc(sal) : 'Salary not listed'} · ${esc(j.type)} · Match ${j.relevance}</div>${j.kind === 'lead' ? '<div class="pm"><i>Employer lead: the button opens their current job ads</i></div>' : ''}
    <a class="go" href="${esc(j.links ? j.links.google : safeUrl(j.url))}" target="_blank" rel="noopener noreferrer">${j.kind === 'lead' ? 'See open jobs' : 'View job posting'}</a><button class="sc" type="button" data-sc="${esc(j.id)}">Show in list</button>`;
}
function renderMap() {
  cluster.clearLayers(); markers.clear();
  if (radiusCircle) { map.removeLayer(radiusCircle); radiusCircle = null; }
  if (F.radius < ANY_RADIUS) radiusCircle = L.circle([home.lat, home.lon], { radius: F.radius * 1609.34, color: '#0f766e', weight: 1.5, fillOpacity: 0.05, interactive: false }).addTo(map);
  let remote = 0, unlocated = 0;
  const ms = [];
  for (const r of rows) {
    const j = r.j;
    if (j.remote) { remote++; continue; }
    if (j.lat == null) { unlocated++; continue; }
    const m = L.marker([j.lat, j.lon], { icon: L.divIcon({ className: '', html: `<div class="pin ${relClass(j.relevance)} ${j.kind === 'lead' ? 'lead' : ''}"><span>${j.relevance}</span></div>`, iconSize: [32, 32], iconAnchor: [16, 30], popupAnchor: [0, -28] }), title: `${j.title} · ${j.company}` });
    m.bindPopup(() => popupHtml(r), { maxWidth: 280 });
    m.on('click', () => { activeId = j.id; markActive(false); setTimeout(() => highlightPin(m), 0); });
    m.on('popupclose', () => { if (selPin && m._icon?.contains(selPin)) { selPin.classList.remove('sel'); selPin = null; } });
    markers.set(j.id, m); ms.push(m);
  }
  cluster.addLayers(ms);
  const note = $('#mapNote'), bits = [];
  if (remote) bits.push(`${remote} remote job${remote > 1 ? 's' : ''} not shown on map`);
  if (unlocated) bits.push(`${unlocated} without a map location`);
  bits.push('Pin number = resume match · dashed pin = employer lead');
  note.textContent = bits.join(' · '); note.hidden = false;
  clearTimeout(fitTimer); fitTimer = setTimeout(fit, 120);
}
function fit() {
  if (!map || $('#map').offsetParent === null) return;
  const pts = [...markers.values()].map((m) => m.getLatLng());
  if (F.radius < ANY_RADIUS) pts.push(...radiusCircle.getBounds().isValid() ? [radiusCircle.getBounds().getNorthEast(), radiusCircle.getBounds().getSouthWest()] : []);
  if (!pts.length) { map.setView([home.lat, home.lon], 7); return; }
  map.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 11, animate: false });
}
document.addEventListener('click', (e) => { const b = e.target.closest('[data-sc]'); if (b) { setView('list'); focusJob(b.dataset.sc, false); } });
function markActive(scroll) {
  document.querySelectorAll('.card.active').forEach((c) => c.classList.remove('active'));
  const li = [...document.querySelectorAll('.card')].find((c) => c.dataset.id === activeId);
  if (li) { li.classList.add('active'); if (scroll) li.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}
let selPin = null;
function highlightPin(m) {
  selPin?.classList.remove('sel'); selPin = m?._icon?.querySelector('.pin') || null; selPin?.classList.add('sel');
}
function focusJob(id, openMap) {
  activeId = id;
  const idx = rows.findIndex((r) => r.j.id === id);
  if (idx >= shown) { shown = idx + PAGE; renderList(); }
  markActive(!openMap);
  if (!openMap) return;
  const m = markers.get(id), row = rows[idx];
  if (!m) { // remote or no coordinates: nothing to pin
    const note = $('#mapNote'); note.textContent = row?.j.remote ? 'This job is remote, so it has no map location.' : 'This job has no map location.'; note.hidden = false;
    return;
  }
  if (getComputedStyle($('.mapwrap')).display === 'none') setView('map');
  setTimeout(() => {
    map.invalidateSize();
    map.setView(m.getLatLng(), Math.max(map.getZoom(), 12), { animate: false });
    cluster.zoomToShowLayer(m, () => { m.openPopup(); setTimeout(() => highlightPin(m), 0); });
  }, 80);
}

// ---------- web search deep links ----------
function initWebSearch() {
  const sel = $('#wsQuery'); sel.innerHTML = (DATA.searchQueries || []).map((q) => `<option>${esc(q)}</option>`).join('');
  const go = () => {
    const q = encodeURIComponent(sel.value), loc = $('#wsWhere').value === 'home' ? `${home.city || ''}${home.state ? ', ' + home.state : ''}`.replace(/^, /, '') : 'United States';
    const l = encodeURIComponent(loc || 'United States');
    $('#wsLi').href = `https://www.linkedin.com/jobs/search/?keywords=${q}&location=${l}&sortBy=DD`;
    $('#wsIn').href = `https://www.indeed.com/jobs?q=${q}&l=${l}&sort=date`;
    $('#wsGo').href = `https://www.google.com/search?q=${encodeURIComponent(sel.value + ' jobs ' + loc)}&ibp=htl;jobs`;
  };
  sel.addEventListener('change', go); $('#wsWhere').addEventListener('change', go); $('#homeInput').addEventListener('change', go); go();
}

boot();
})();

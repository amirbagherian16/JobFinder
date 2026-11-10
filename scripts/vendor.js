// Copies Leaflet + MarkerCluster into public/vendor so the site is self-hosted (no CDN needed).
const fs = require('fs'), path = require('path');
const out = path.join(__dirname, '..', 'public', 'vendor');
const nm = path.join(__dirname, '..', 'node_modules');
fs.mkdirSync(path.join(out, 'images'), { recursive: true });
const copy = (from, to) => fs.copyFileSync(path.join(nm, from), path.join(out, to));
copy('leaflet/dist/leaflet.js', 'leaflet.js');
copy('leaflet/dist/leaflet.css', 'leaflet.css');
for (const f of fs.readdirSync(path.join(nm, 'leaflet/dist/images'))) copy('leaflet/dist/images/' + f, 'images/' + f);
copy('leaflet.markercluster/dist/leaflet.markercluster.js', 'leaflet.markercluster.js');
copy('leaflet.markercluster/dist/MarkerCluster.css', 'MarkerCluster.css');
copy('leaflet.markercluster/dist/MarkerCluster.Default.css', 'MarkerCluster.Default.css');
console.log('vendored to', out);

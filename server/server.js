'use strict';
// Zero-dependency static server. If API credentials are set, it refreshes public/data/jobs.json every REFRESH_HOURS.
const http = require('http'), fs = require('fs'), path = require('path');
const { main: refresh } = require('../scripts/fetch-jobs');
const ROOT = path.join(__dirname, '..', 'public');
const PORT = Number(process.env.PORT) || 3000;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  if (p.endsWith(path.sep) || p === '.') p = path.join(p, 'index.html');
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end('Forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      'Cache-Control': file.endsWith('jobs.json') ? 'no-cache' : 'public, max-age=3600',
    }).end(buf);
  });
});
server.listen(PORT, () => console.log(`JobFinder running at http://localhost:${PORT}`));

const hours = Number(process.env.REFRESH_HOURS || 6);
const hasKeys = process.env.ADZUNA_APP_ID || process.env.USAJOBS_API_KEY || process.env.RAPIDAPI_KEY;
if (hasKeys) {
  const run = () => refresh().catch((e) => console.error('refresh failed:', e.message));
  run(); setInterval(run, hours * 3600e3).unref();
}

'use strict';
async function getJson(url, { headers = {}, timeoutMs = 20000 } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json', ...headers }, signal: ctl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${new URL(url).host}`);
    return await res.json();
  } finally { clearTimeout(t); }
}
module.exports = { getJson };

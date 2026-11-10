'use strict';
const enc = encodeURIComponent;
// Deep links into sites that forbid scraping: we hand the user a pre-filled search instead.
const linkedin = (q, loc) => `https://www.linkedin.com/jobs/search/?keywords=${enc(q)}${loc ? `&location=${enc(loc)}` : ''}&sortBy=DD`;
const indeed = (q, loc) => `https://www.indeed.com/jobs?q=${enc(q)}${loc ? `&l=${enc(loc)}` : ''}&sort=date`;
const google = (q, loc) => `https://www.google.com/search?q=${enc(`${q} jobs${loc ? ' ' + loc : ''}`)}&ibp=htl;jobs`;
module.exports = { linkedin, indeed, google };

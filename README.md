# JobFinder: TBI / injury-biomechanics job search

A responsive web app (desktop + mobile) that finds jobs matched to a **PhD in biomedical engineering, TBI biomechanics, finite-element modeling (LS-DYNA), and ML/image-segmentation** profile, built from the resume in this project.

## Features
- **Sort:** most relevant · most recent · distance · income high→low · income low→high (unlisted salaries always sort last)
- **Filter:** yearly income range · distance from home (default 100 mi from San Antonio, TX) · states and cities · job type (full-time, part-time, contract, postdoc, internship, temporary) · sector · relevance · posted-within · remote · hide "U.S. citizenship required"
- **Map:** every job is a clickable pin (number = resume match; clustered; popup with link). Click a card's *Show on map* or a pin's *Show in list* to jump between them.
- **Relevance score (0–100)** with the matched terms shown on each card, driven by `data/profile.json`.
- Mobile: bottom tabs (List / Map / Filters) and a full-screen filter sheet.

## Where the jobs come from (and what is *not* possible)
LinkedIn and Indeed forbid scraping and block it, so this project does **not** scrape them. Instead:

| Source | How | Needs |
|---|---|---|
| **JSearch (RapidAPI)**: Google for Jobs, which includes LinkedIn, Indeed, Glassdoor, ZipRecruiter | `lib/providers/jsearch.js` | `RAPIDAPI_KEY` |
| **Adzuna**: large multi-board aggregator | `lib/providers/adzuna.js` | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` (free) |
| **USAJOBS**: NIH, FDA, DoD labs, NASA… | `lib/providers/usajobs.js` | `USAJOBS_API_KEY`, `USAJOBS_EMAIL` (free) |
| **Greenhouse / Lever** company boards | `lib/providers/boards.js` | add slugs to `data/boards.json` (no key) |
| **Employer leads** (34 curated organizations in your field) | `data/employers.json` | nothing |
| **LinkedIn / Indeed / Google Jobs deep links** | pre-filled search buttons on every lead and in the list header | nothing |

**Employer leads are not job postings.** They are real organizations that work in TBI / biomechanics / modeling / medical-image AI, labeled *Employer lead*, with a careers-page link and one-click LinkedIn/Indeed/Google searches for that employer. Open positions are not verified, and salary/date are unknown. Turn them off with the *Listing* filter once live sources are configured.

## Run it
```bash
npm install              # installs Leaflet and builds the data files (postinstall)
npm test                 # unit tests for the normalizers/scoring/geo
npm run fetch            # builds public/data/jobs.json (leads + any live sources with keys)
npm start                # http://localhost:3000  (auto-refreshes every 6 h if API keys are set)
```
Keys go in environment variables (never in the repo):
```bash
RAPIDAPI_KEY=... ADZUNA_APP_ID=... ADZUNA_APP_KEY=... USAJOBS_API_KEY=... USAJOBS_EMAIL=you@example.com npm start
```

## Deploy free on GitHub Pages
1. Repo → *Settings → Pages → Source: GitHub Actions*.
2. Repo → *Settings → Secrets and variables → Actions*: add any of the keys above.
3. `.github/workflows/pages.yml` rebuilds `jobs.json` daily and on every push to `main`, and deploys `public/`.

## Customizing
- `data/profile.json`: home location, default radius, weighted keywords, negative title terms, and the search queries sent to the APIs.
- `data/employers.json`: add or remove leads. `data/boards.json`: company board slugs.
- `scripts/make-places.js`: the built-in city/state gazetteer used for distance and the city filter. Cities not in it fall back to the state centroid and are labeled *approx.*

## Layout
```
public/        static site (index.html, app.js, styles.css, vendored Leaflet, data/*.json)
lib/           relevance scoring, geo, normalization, providers
scripts/       fetch-jobs.js, make-places.js, vendor.js
server/        zero-dependency static server + periodic refresh
test/          node:test unit tests
```
Map tiles © OpenStreetMap contributors.

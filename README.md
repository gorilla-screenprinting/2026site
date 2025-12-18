# Gorilla Blanks Site

Single-page catalog/search site backed by Netlify Functions and vendor indexes.

## How it works
- Frontend: `index.html`, `main.js`, `styles.css` (vanilla JS). Sections are wired up from `main.js`.
- Serverless: `netlify/functions/`
  - `catalog-search`: talks to S&S live API and local indexes for search/pricing.
  - `catalog-meta`: exposes brand/category metadata from the local S&S index.
  - `google-reviews`: pulls reviews for the Reviews section.
- Catalog data: lives in `catalog-data/` (see `catalog-data/README.md` for details, build steps, and exclusions).

## Dev setup
1) Install deps: `npm install`
2) Run dev server: `npx -y netlify-cli@latest dev`
   - Ensure `catalog-data/ss-style-index.json` exists (run `npm run build:ss-index` with env creds) or the search won’t populate.
   - Optional: build SanMar index if using that data (`npm run build:sanmar-index` with `catalog-data/SanMar_SDL_DS.csv` present).
3) Environment: set `VENDOR_USERNAME`/`VENDOR_PASSWORD` (S&S API) in `.env` or your shell for S&S index builds.

## Key scripts
- `npm run build:ss-index` — build S&S style index (writes `catalog-data/ss-style-index.json`).
- `npm run build:sanmar-index` — build SanMar index from `catalog-data/SanMar_SDL_DS.csv` (writes `catalog-data/sanmar-index.json`).

## Notes
- Netlify includes `catalog-data/ss-style-index.json` in the function bundle (see `netlify.toml`).
- Catalog search returns combined results from live S&S + S&S index + SanMar static index (when present).
- Category exclusions are documented in `catalog-data/README.md` for both S&S and SanMar (easy to adjust later).

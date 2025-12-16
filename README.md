# Gorilla Blanks Catalog

Single-page site with Netlify Functions-backed catalog search using the S&S API and a local style index for fast partial lookups.

## Structure
- `index.html`, `main.js`, `styles.css` — frontend.
- `netlify/functions/` — serverless functions (`catalog-search`, `catalog-meta`).
- `notes/ss-style-index.json` — local style index (brand/styleName/baseCategory/styleID/styleImage) used for partial search and dropdown options.
- `scripts/build-style-index.js` — builds the local index from the S&S API (filtered categories).
- `.github/workflows/update-ss-index.yml` — monthly GitHub Action to rebuild the index (uses repo secrets).
- `assets/`, `embedded/` — static assets and embeds.

## Search flows
- **SKU/numeric queries**: search the local index by styleName contains, then fetch live pricing/images via `/V2/products` using `styleID`.
- **Brand/Style browse**: dropdowns populated from the index; results filtered by `brandName` and `baseCategory`, then priced via `/V2/products`.
- Results are sorted by highest total stock (`totalQty`) first, then relevance.

## Local index
- Build manually: `VENDOR_USERNAME=... VENDOR_PASSWORD=... npm run build:ss-index`
- File: `notes/ss-style-index.json` (filtered: excludes Accessories, Wovens, Outerwear, Knits & Layering).
- Keep it committed so Netlify Functions can read it.

## CI index updates
- Add GitHub secrets: `VENDOR_USERNAME`, `VENDOR_PASSWORD`.
- Workflow `.github/workflows/update-ss-index.yml` runs monthly (and on-demand) to rebuild and commit `notes/ss-style-index.json`.

## Dev
- Install deps: `npm install`
- Run dev: `npx -y netlify-cli@latest dev`
- Rebuild index if needed before dev so functions see the latest file.

## Notes
- `styleID` is required to price/fetch images from S&S `/V2/products`.
- `styleImage` in the index is used as a fallback when color images are missing.

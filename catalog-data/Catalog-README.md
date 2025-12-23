# Gorilla Blanks Catalog Data

Catalog data indices that power the Netlify Functions-backed search UI.

## Structure
- `catalog-data/ss-style-index.json` — S&S index (brand/styleName/styleID/productName/baseCategory/styleImage) used for partial search and dropdowns.
- `catalog-data/sanmar-index.json` — SanMar index built from the CSV dump, shaped to match S&S (styleID/styleName/productName/baseCategory/subcategory/styleImage/colors/sizePrices).
- `catalog-data/SanMar_SDL_DS.csv` — raw SanMar data drop (not committed).
- `scripts/build-ss-index.js` — builds the S&S index from the S&S API.
- `scripts/build-sanmar-index.js` — builds the SanMar index from `catalog-data/SanMar_SDL_DS.csv`.
- `.github/workflows/update-ss-index.yml` — monthly GitHub Action to rebuild the S&S index (uses repo secrets).

## Search flows (frontend)
- **SKU/numeric queries**: search the local index by styleName, then fetch live pricing/images via S&S `/V2/products` using `styleID`.
- **Brand/Style browse**: dropdowns populated from the index; results filtered by `brandName` and `baseCategory`, then priced via `/V2/products`.
- Results sorted by highest total stock first, then relevance.

## Build commands
- S&S: `VENDOR_USERNAME=... VENDOR_PASSWORD=... npm run build:ss-index`
  - Output: `catalog-data/ss-style-index.json`
- SanMar: `npm run build:sanmar-index`
  - Input: `catalog-data/SanMar_SDL_DS.csv`
  - Output: `catalog-data/sanmar-index.json`
   - Optional pricing overrides (shared for all vendors): set `MARKUP_TEE` / `MARKUP_HOODIE` (defaults 3.5 / 7).

## Exclusions
- S&S index excludes categories: Accessories, Wovens, Outerwear, Knits & Layering.
- SanMar index excludes categories: Caps, Personal Protection, Accessories, Outerwear, Woven Shirts, Workwear. (Infant & Toddler is kept.)

## Notes on SanMar mapping
- styleID/styleName: `STYLE#` (SanMar does not expose a separate ID).
- productName: `PRODUCT_TITLE` with the trailing SKU stripped.
- baseCategory/subcategory: from `CATEGORY_NAME` / `SUBCATEGORY_NAME` (can be remapped to S&S-like buckets if needed).
- colors: `COLOR_NAME` + `COLOR_PRODUCT_IMAGE` (fallback to `PRODUCT_IMAGE`).
- pricing: `PIECE_PRICE` treated as cost; markup applied in the builder (+3.5 tees, +7 hoodies/fleece/zip) to produce display `price`.

## Example entry: Gildan 18500

SanMar shape (raw CSV fields):
```json
{
  "STYLE#": "18500",
  "MILL": "Gildan",
  "PRODUCT_TITLE": "Gildan® - Heavy Blend Hooded Sweatshirt.  18500",
  "CATEGORY_NAME": "Sweatshirts/Fleece",
  "SUBCATEGORY_NAME": "Hoodie",
  "COLOR_NAME": "White",
  "SIZE": "S",
  "PIECE_PRICE": "14.32",
  "CASE_PRICE": "12.32",
  "PRODUCT_IMAGE": "18500.jpg",
  "COLOR_PRODUCT_IMAGE": "18500_white_model_front.jpg",
  "FRONT_FLAT_IMAGE_URL": "https://cdnm.sanmar.com/imglib/mresjpg/2019/f14/18500_white_flat_front.jpg",
  "PRODUCT_STATUS": "Regular"
}
```

S&S shape (style-level from S&S API, as stored in `ss-style-index.json`):
```json
{
  "styleID": 395,
  "brandName": "Gildan",
  "styleName": "18500",
  "productName": "Unisex Heavy Blend™ Hooded Sweatshirt",
  "baseCategory": "Fleece - Core - Hood",
  "styleImage": "Images/Style/395_fm.jpg"
}
```

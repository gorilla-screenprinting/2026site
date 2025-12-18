/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const INPUT_PATH = process.env.SANMAR_CSV || path.join(process.cwd(), 'catalog-data', 'SanMar_SDL_DS.csv');
const OUTPUT_PATH = path.join(process.cwd(), 'catalog-data', 'sanmar-index.json');

const EXCLUDED_CATEGORIES = new Set([
  'Caps',
  'Personal Protection',
  'Accessories',
  'Outerwear',
  'Woven Shirts',
  'Workwear',
]);

const { applyMarkup } = require('../pricing');

const SIZE_FALLBACK_ORDER = 999;
const SANMAR_CDN_BASE = (process.env.SANMAR_CDN_BASE || 'https://cdnm.sanmar.com/imglib/').replace(/\/+$/, '') + '/';

function resolveImage(img) {
  if (!img) return '';
  if (/^https?:\/\//i.test(img)) return img;
  return `${SANMAR_CDN_BASE}${String(img).replace(/^\/+/, '')}`;
}

function pickImage(fields) {
  let fallback = '';
  for (const val of fields) {
    const v = cleanStr(val);
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) return v;
    if (!fallback) fallback = v;
  }
  return fallback;
}

function parseCsvLine(line, headers) {
  const values = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      values.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  values.push(cur);
  if (!headers) return values;
  const obj = {};
  headers.forEach((h, idx) => {
    obj[h] = values[idx] !== undefined ? values[idx] : '';
  });
  return obj;
}

function cleanStr(val) {
  return String(val || '').trim();
}

function stripSkuFromTitle(title, sku) {
  const t = cleanStr(title);
  const s = cleanStr(sku);
  if (!t || !s) return t || s;
  const esc = s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const re = new RegExp(`\\s*[\\-–—]?\\s*${esc}\\.?$`, 'i');
  return t.replace(re, '').trim() || s;
}

function chooseTier(cat, subcat) {
  const combo = `${cat} ${subcat}`.toUpperCase();
  if (/(HOOD|HOODIE|FLEECE|SWEAT|ZIP)/.test(combo)) return 'hoodie';
  return 'tee';
}

async function build() {
  if (!fs.existsSync(INPUT_PATH)) {
    console.error(`Missing SanMar CSV at ${INPUT_PATH}`);
    process.exit(1);
  }

  console.log('Building SanMar index from', INPUT_PATH);
  const stream = fs.createReadStream(INPUT_PATH, 'utf8');
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let headers = null;
  const styles = new Map();
  let lineNum = 0;

  for await (const line of rl) {
    lineNum += 1;
    if (!headers) {
      headers = parseCsvLine(line);
      continue;
    }
    if (!line.trim()) continue;
    const row = parseCsvLine(line, headers);
    const category = cleanStr(row['CATEGORY_NAME']);
    if (EXCLUDED_CATEGORIES.has(category)) continue;

    const style = cleanStr(row['STYLE#']);
    if (!style) continue;
    const brand = cleanStr(row['MILL']);
    const subcat = cleanStr(row['SUBCATEGORY_NAME']);
    const productTitle = cleanStr(row['PRODUCT_TITLE']);
    const productName = stripSkuFromTitle(productTitle, style);

    let entry = styles.get(style);
    if (!entry) {
      const styleImg = pickImage([
        row['FRONT_FLAT_IMAGE_URL'],
        row['BACK_FLAT_IMAGE_URL'],
        row['PRODUCT_IMAGE'],
        row['FRONT_MODEL_IMAGE_URL'],
        row['BACK_MODEL_IMAGE_URL'],
      ]);
      entry = {
        styleID: style,
        brandName: brand,
        styleName: style,
        productName,
        baseCategory: category,
        subcategory: subcat,
        styleImage: resolveImage(styleImg),
        colors: new Map(),
        sizePrices: new Map(),
      };
      styles.set(style, entry);
    }

    const colorName = cleanStr(row['COLOR_NAME']);
    const colorImageRaw = pickImage([
      row['COLOR_PRODUCT_IMAGE'],
      row['COLOR_PRODUCT_IMAGE_THUMBNAIL'],
      row['FRONT_FLAT_IMAGE_URL'],
      row['BACK_FLAT_IMAGE_URL'],
      row['PRODUCT_IMAGE'],
      row['FRONT_MODEL_IMAGE_URL'],
      row['BACK_MODEL_IMAGE_URL'],
    ]);
    const colorImage = resolveImage(colorImageRaw);
    if (colorName && !entry.colors.has(colorName)) {
      entry.colors.set(colorName, { name: colorName, image: colorImage });
    }

    const size = cleanStr(row['SIZE']);
    const sizeOrderRaw = Number(row['SIZE_INDEX']);
    const sizeOrder = Number.isFinite(sizeOrderRaw) ? sizeOrderRaw : SIZE_FALLBACK_ORDER;
    const costRaw = parseFloat(row['CASE_PRICE'] || row['PIECE_PRICE']);
    const cost = Number.isFinite(costRaw) ? Number(costRaw.toFixed(2)) : null;
    const tier = chooseTier(category, subcat);
    const pricing = applyMarkup(cost, tier);

    if (size && pricing) {
      const existing = entry.sizePrices.get(size);
      // Keep the highest cost/price per size to avoid underpricing when multiple price groups exist.
      if (!existing || pricing.cost > existing.cost) {
        entry.sizePrices.set(size, { label: size, cost: pricing.cost, price: pricing.price, order: sizeOrder });
      }
    }
  }

  const out = Array.from(styles.values()).map((entry) => {
    const sizePrices = Array.from(entry.sizePrices.values()).sort(
      (a, b) => a.order - b.order || String(a.label).localeCompare(String(b.label))
    );
    sizePrices.forEach((sp) => delete sp.order);
    return {
      styleID: entry.styleID,
      brandName: entry.brandName,
      styleName: entry.styleName,
      productName: entry.productName,
      baseCategory: entry.baseCategory,
      subcategory: entry.subcategory,
      styleImage: entry.styleImage,
      colors: Array.from(entry.colors.values()),
      sizePrices,
    };
  });

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Wrote ${out.length} styles to ${OUTPUT_PATH}`);
}

build().catch((err) => {
  console.error(err);
  process.exit(1);
});

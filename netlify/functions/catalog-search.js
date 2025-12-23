exports.handler = async (event) => {
  const username = process.env.VENDOR_USERNAME;
  const password = process.env.VENDOR_PASSWORD;
  const baseUrl = process.env.VENDOR_BASE_URL || "https://api.ssactivewear.com";
  const styleIdOverride = process.env.VENDOR_HEALTH_STYLE_ID || "39"; // used as a safe fallback
  const cdnBase = (process.env.VENDOR_CDN_BASE || "https://cdn.ssactivewear.com/").replace(/\/+$/, "") + "/";
  const hasCreds = Boolean(username && password);

  const preset = "";
  const brandFilter = (event.queryStringParameters?.brand || "").trim();
  const typeFilter = (event.queryStringParameters?.type || "").trim();
  let q = (event.queryStringParameters?.q || "").trim();
  if (!q && (brandFilter || typeFilter)) {
    q = `${brandFilter} ${typeFilter}`.trim();
  }
  const isPreset = false;
  if (!q) {
    return json(400, { ok: false, error: "Missing search query (style ID or part number)" });
  }

  const auth = hasCreds ? Buffer.from(`${username}:${password}`).toString("base64") : "";
  const headers = hasCreds
    ? {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      }
    : null;

  const cleanBase = baseUrl.replace(/\/+$/, "");
  const urls = new Set();
  const variants = Array.from(
    new Set([
      q,
      q.replace(/\s+/g, ""),
      q.toUpperCase(),
      q.replace(/\s+/g, "").toUpperCase(),
    ])
  );
  const normVariants = variants.map(normalize).filter(Boolean);
  const numericQ = /^\d+$/.test(q) ? q : null;
  const normQ = normalize(q);
  const queryTokens = Array.from(new Set(q.split(/\s+/).map(normalize).filter(Boolean)));
  // Treat as SKU-style query when it contains a digit and no spaces (or only digits/letters)
  const isSkuQuery = /\d/.test(q) && !/\s/.test(q);
  const isNumericOnly = /^\d+$/.test(q);

  // Brand/style browse path: use local index, exact brand/baseCategory match, then fetch pricing
  if (!isSkuQuery && (brandFilter || typeFilter)) {
    const index = loadLocalIndex();
    const sanmar = searchSanmarIndex({ q, brand: brandFilter, type: typeFilter });
    const matchBrand = (row) => {
      if (!brandFilter) return true;
      return String(row.brandName || "").toLowerCase().trim() === brandFilter.toLowerCase().trim();
    };
    const matchType = (row) => {
      if (!typeFilter) return true;
      return String(row.baseCategory || "").toLowerCase().trim() === typeFilter.toLowerCase().trim();
    };

    const hits = index.filter((row) => matchBrand(row) && matchType(row));

    const unique = [];
    const seen = new Set();
    for (const row of hits) {
      const key = `${row.styleID || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(row);
    }

    const withPricing = hasCreds
      ? await Promise.all(
          unique.slice(0, 40).map(async (row) => {
            const tier = categoryTier(row);
            const pricing = await fetchPricing(cleanBase, headers, row.styleID, tier);
            return pricing ? { ...row, ...pricing } : row;
          })
        )
      : unique;

    const sorted = sortResults(withPricing).map(({ score, ...rest }) => rest);
    const merged = sortResults([...sorted, ...sanmar]).map(({ score, ...rest }) => rest);
    return json(200, { ok: true, count: merged.length, results: merged });
  }

  // For SKU-style queries, rely on the local index for substring matching, then fetch pricing
  if (isSkuQuery) {
    const indexHits = hasCreds ? await searchLocalIndex(q, cleanBase, headers) : searchLocalIndexLite(q);
    const sanmarHits = searchSanmarIndex({ q, brand: brandFilter, type: typeFilter });
    const merged = sortResults([...indexHits, ...sanmarHits]).map(({ score, ...rest }) => rest);
    return json(200, { ok: true, count: merged.length, results: merged });
  }

  if (isSkuQuery) {
    // SKU mode: only hit styleid/partnumber endpoints to avoid broad fuzzy matches
    if (numericQ) {
      urls.add(`${cleanBase}/V2/styles?styleid=${encodeURIComponent(q)}&limit=20&mediatype=json`);
    }
    variants.forEach((val) => {
      urls.add(`${cleanBase}/V2/styles?style=${encodeURIComponent(val)}&limit=20&mediatype=json`);
    });
  } else {
    // Non-SKU: broader searches
    if (numericQ) {
      urls.add(`${cleanBase}/V2/styles?styleid=${encodeURIComponent(q)}&limit=20&mediatype=json`);
    }
    if (brandFilter) {
      urls.add(`${cleanBase}/V2/styles?brand=${encodeURIComponent(brandFilter)}&limit=200&mediatype=json`);
      urls.add(`${cleanBase}/V2/styles?brandname=${encodeURIComponent(brandFilter)}&limit=200&mediatype=json`);
    }
    variants.forEach((val) => {
      urls.add(`${cleanBase}/V2/styles?style=${encodeURIComponent(val)}&limit=20&mediatype=json`);
    });
  }

  // As a last resort, allow a known-good style to prove connectivity (but do not merge it into results)
  const fallbackUrl = `${cleanBase}/V2/styles?styleid=${encodeURIComponent(styleIdOverride)}&limit=1&mediatype=json`;

  try {
    const fetchAll = Array.from(urls).map((url) => fetchArray(url, headers));
    const [resultsCombined, fallbackCheck] = await Promise.all([
      Promise.all(fetchAll).then((arr) => arr.flat()),
      fetchArray(fallbackUrl, headers),
    ]);

    // If even the known-good style returns nothing, assume upstream connectivity/auth issue
    if (fallbackCheck.length === 0) {
      // Fall back to local + SanMar
      const fallbackLocal = searchLocalIndexLite(q);
      const fallbackSanmar = searchSanmarIndex({ q, brand: brandFilter, type: typeFilter });
      const mergedFallback = sortResults([...fallbackLocal, ...fallbackSanmar]).map(({ score, ...rest }) => rest);
      return json(200, { ok: true, count: mergedFallback.length, results: mergedFallback });
    }

    const rawQueryLower = q.toLowerCase();
    const pool = isSkuQuery
      ? resultsCombined.filter((item) => {
          const pn = String(item.styleName || item.uniqueStyleName || item.title || "").toLowerCase();
          const sid = String(item.styleID || "").toLowerCase();
          return (pn && pn.includes(rawQueryLower)) || (sid && sid.includes(rawQueryLower));
        })
      : resultsCombined;

    const deduped = [];
    const seen = new Set();

    const scoreItem = (item) => {
      let score = 0;
      if (numericQ && String(item.styleID || "") === numericQ) score = Math.max(score, 100);
      const styleNorm = normalize(item.styleName || item.uniqueStyleName || item.title);
      if (styleNorm && normVariants.includes(styleNorm)) score = Math.max(score, 90);
      const nameNorm = normalize(productName(item));
      if (nameNorm && normVariants.includes(nameNorm)) score = Math.max(score, 80);
      if (styleNorm && normQ && styleNorm.startsWith(normQ)) score = Math.max(score, 70);

      if (queryTokens.length) {
        const haystack = normalize(
          `${productName(item) || ""} ${item.styleName || ""} ${item.uniqueStyleName || ""} ${item.title || ""} ${item.brandName || ""} ${item.baseCategory || ""} ${item.description || ""} ${item.categories || ""}`
        );
        const matches = queryTokens.filter((tok) => haystack.includes(tok)).length;
        if (matches > 0) {
          score = Math.max(score, 60 + matches * 5); // reward partial matches
        }
      }

      if (brandFilter && normalize(item.brandName) === normalize(brandFilter)) {
        score = Math.max(score, 70);
      }
      return score;
    };

    const matchesType = (item) => {
      if (!typeFilter) return true;
      const text = normalize(`${item.baseCategory || ""} ${productName(item) || ""} ${item.title || ""} ${item.styleName || ""} ${item.description || ""}`);
      const tf = normalize(typeFilter);
      const typeMap = {
        SHORTSLEEVETEE: [/T[-\s]?SHIRT/, /SHORTSLEEVE/],
        LONGSLEEVETEE: [/LONGSLEEVE/],
        PULLOVERHOODIE: [/HOOD/, /PULLOVER/],
        ZIPHOODIE: [/HOOD/, /ZIP/],
        CREWNECKFLEECE: [/CREW/],
        TOTEBAG: [/TOTE/],
      };
      const patterns = typeMap[tf] || [];
      if (!patterns.length) return true;
      return patterns.some((rx) => rx.test(text));
    };

    for (const item of pool) {
      const key = `${item.styleID || ""}-${item.styleName || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const styleIdStr = item.styleID ? String(item.styleID) : "";
      const nameNorm = normalize(productName(item));

      const score = scoreItem(item);
      if (score <= 0) continue;
      if (!isAllowedCategory(item)) continue;
      if (!matchesType(item)) continue;

      let imageUrl = null;
      if (item.styleImage) {
        imageUrl = item.styleImage.startsWith("http")
          ? item.styleImage
          : `${cdnBase}${item.styleImage.replace(/^\/+/, "")}`;
      }

      deduped.push({
        score,
        styleID: item.styleID,
        brandName: item.brandName,
        styleName: item.styleName || item.uniqueStyleName || item.title,
        productName: productName(item),
        baseCategory: item.baseCategory,
        description: item.description,
        styleImage: imageUrl,
      });
    }

    if (deduped.length === 0 && isSkuQuery) {
      // Fallback straight to local index when API returned nothing for SKU queries
      const fallback = await searchLocalIndex(q, cleanBase, headers);
      return json(200, { ok: true, count: fallback.length, results: fallback });
    }
    if (deduped.length === 0) {
      return json(200, { ok: true, count: 0, results: [] });
    }

    const filteredForSku = isSkuQuery
      ? deduped.filter((item) => {
          const idStr = item.styleID ? String(item.styleID) : "";
          const name = normalize(productName(item) || item.styleName || "");
          return (idStr && idStr.includes(normQ)) || (name && name.includes(normQ));
        })
      : deduped;

    if (isSkuQuery && filteredForSku.length === 0) {
      // Fallback: try local style index for partial matches
      const index = loadLocalIndex();
      if (index && index.length) {
        const rawQ = q.toLowerCase();
        const matches = index.filter((row) => {
          const sid = String(row.styleID || "").toLowerCase();
          const name = String(row.productName || row.styleName || "").toLowerCase();
          return (sid && sid.includes(rawQ)) || (name && name.includes(rawQ));
        });
        if (!matches.length) {
          return json(200, { ok: true, count: 0, results: [] });
        }

        // Fetch pricing for the matched styles
        const withPricingIndex = await Promise.all(
          matches.slice(0, 20).map(async (row) => {
            const tier = categoryTier(row);
            const pricing = await fetchPricing(cleanBase, headers, row.styleID, tier);
            return pricing ? { ...row, ...pricing } : row;
          })
        );

        const sortedIdx = sortResults(withPricingIndex);
        return json(200, { ok: true, count: sortedIdx.length, results: sortedIdx });
      }

      return json(200, { ok: true, count: 0, results: [] });
    }

    // Fetch pricing for top items (best-effort)
    const withPricing = await Promise.all(
      filteredForSku.slice(0, 40).map(async (item) => {
        const tier = categoryTier(item);
        const pricing = hasCreds ? await fetchPricing(cleanBase, headers, item.styleID, tier) : null;
        return pricing ? { ...item, ...pricing } : item;
      })
    );

    let trimmed = sortResults(withPricing).slice(0, 20).map(({ score, ...rest }) => rest);

    if (isSkuQuery) {
      trimmed = trimmed.filter((item) => {
        const sid = String(item.styleID || "").toLowerCase();
        const name = String(productName(item) || item.styleName || "").toLowerCase();
        return sid.includes(rawQueryLower) || (name && name.includes(rawQueryLower));
      });
    }

    const sanmarHits = searchSanmarIndex({ q, brand: brandFilter, type: typeFilter }).map(({ score, ...rest }) => rest);
    const merged = sortResults([...trimmed, ...sanmarHits]).map(({ score, ...rest }) => rest);

    return json(200, { ok: true, count: merged.length, results: merged });
  } catch (err) {
    const fallbackLocal = searchLocalIndexLite(q);
    const fallbackSanmar = searchSanmarIndex({ q, brand: brandFilter, type: typeFilter });
    const mergedFallback = sortResults([...fallbackLocal, ...fallbackSanmar]).map(({ score, ...rest }) => rest);
    return json(200, { ok: true, count: mergedFallback.length, results: mergedFallback });
  }
};

async function fetchArray(url, headers) {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    if (!Array.isArray(data)) return [];
    return data;
  } catch {
    return [];
  }
}

function json(statusCode, obj) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body: JSON.stringify(obj),
  };
}

function normalize(str) {
  return String(str || "").replace(/\s+/g, "").toUpperCase();
}

function productName(item) {
  return item.productName || item.uniqueStyleName || item.title || item.styleName || "";
}

// Optional local style index to support partial SKU lookups.
// Expected shape: [{ styleID, brandName, styleName, productName, baseCategory }]
let _localIndexCache = null;
function loadLocalIndex() {
  if (_localIndexCache !== null) return _localIndexCache;
  try {
    const fs = require("fs");
    const path = require("path");
    const idxPath = path.join(process.cwd(), "catalog-data", "ss-style-index.json");
    if (!fs.existsSync(idxPath)) {
      _localIndexCache = [];
      return _localIndexCache;
    }
    const raw = fs.readFileSync(idxPath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      _localIndexCache = data;
    } else {
      _localIndexCache = [];
    }
  } catch {
    _localIndexCache = [];
  }
  return _localIndexCache;
}
exports.loadLocalIndex = loadLocalIndex;

function searchLocalIndexLite(q) {
  const index = loadLocalIndex();
  if (!index || !index.length) return [];
  const rawQ = String(q || '').toLowerCase();
  const matches = index.filter((row) => {
    const sn = String(row.styleName || '').toLowerCase();
    const name = String(row.productName || '').toLowerCase();
    return (sn && sn.includes(rawQ)) || (name && name.includes(rawQ));
  });
  if (!matches.length) return [];
  const seen = new Set();
  const unique = [];
  for (const row of matches) {
    const key = `${row.styleID || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push({ ...row, totalQty: 0, sizePrices: [], colors: [], colorImages: [] });
  }
  return sortResults(unique);
}

let _sanmarIndexCache = null;
function loadSanmarIndex() {
  if (_sanmarIndexCache !== null) return _sanmarIndexCache;
  try {
    const fs = require("fs");
    const path = require("path");
    const idxPath = path.join(process.cwd(), "catalog-data", "sanmar-index.json");
    if (!fs.existsSync(idxPath)) {
      _sanmarIndexCache = [];
      return _sanmarIndexCache;
    }
    const raw = fs.readFileSync(idxPath, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      _sanmarIndexCache = data;
    } else {
      _sanmarIndexCache = [];
    }
  } catch {
    _sanmarIndexCache = [];
  }
  return _sanmarIndexCache;
}

async function searchLocalIndex(q, base, headers) {
  const index = loadLocalIndex();
  if (!index || !index.length) return [];
  const rawQ = String(q || '').toLowerCase();
  const matches = index.filter((row) => {
    const sn = String(row.styleName || '').toLowerCase();
    const name = String(row.productName || '').toLowerCase();
    return (sn && sn.includes(rawQ)) || (name && name.includes(rawQ));
  });
  if (!matches.length) return [];

  // Dedup by styleID
  const seen = new Set();
  const unique = [];
  for (const row of matches) {
    const key = `${row.styleID || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  const withPricing = await Promise.all(
    unique.slice(0, 20).map(async (row) => {
      const tier = categoryTier(row);
      const pricing = await fetchPricing(base, headers, row.styleID, tier);
      return pricing ? { ...row, ...pricing } : row;
    })
  );
  return sortResults(withPricing);
}

function searchSanmarIndex({ q, brand, type }) {
  return [];
  const index = loadSanmarIndex();
  if (!index || !index.length) return [];
  const rawQ = String(q || "").toLowerCase();
  const normQ = normalize(q);
  const tokens = Array.from(new Set(String(q || "").split(/\s+/).map(normalize).filter(Boolean)));
  const brandFilter = (brand || "").toLowerCase();
  const typeFilter = (type || "").trim();

  const matchesType = (item) => {
    if (!typeFilter) return true;
    const text = normalize(`${item.baseCategory || ""} ${productName(item) || ""} ${item.styleName || ""}`);
    const tf = normalize(typeFilter);
    const typeMap = {
      SHORTSLEEVETEE: [/T[-\s]?SHIRT/, /SHORTSLEEVE/],
      LONGSLEEVETEE: [/LONGSLEEVE/],
      PULLOVERHOODIE: [/HOOD/, /PULLOVER/],
      ZIPHOODIE: [/HOOD/, /ZIP/],
      CREWNECKFLEECE: [/CREW/],
      TOTEBAG: [/TOTE/],
      TANK: [/TANK/],
    };
    const patterns = typeMap[tf] || [];
    if (!patterns.length) return true;
    return patterns.some((rx) => rx.test(text));
  };

  const results = [];
  for (const item of index) {
    if (brandFilter && String(item.brandName || "").toLowerCase() !== brandFilter) continue;
    if (!matchesType(item)) continue;
    const pname = String(productName(item) || "").toLowerCase();
    const sname = String(item.styleName || "").toLowerCase();
    const hay = `${pname} ${sname}`;
    if (rawQ && !hay.includes(rawQ) && !tokens.some((t) => hay.includes(t.toLowerCase()))) {
      continue;
    }
    let score = 0;
    if (normQ && normalize(item.styleName || "") === normQ) score = Math.max(score, 90);
    if (normQ && normalize(productName(item)) === normQ) score = Math.max(score, 80);
    if (rawQ && sname.includes(rawQ)) score = Math.max(score, 75);
    if (rawQ && pname.includes(rawQ)) score = Math.max(score, 70);
    const matches = tokens.filter((t) => hay.includes(t.toLowerCase())).length;
    if (matches) score = Math.max(score, 60 + matches * 5);
    const colorImages = Array.isArray(item.colors)
      ? item.colors
          .filter((c) => c && c.image)
          .map((c) => ({ name: c.name, image: withSanmarCdn(c.image) }))
      : [];
    const styleImage = withSanmarCdn(item.styleImage);
    const groupedSizes = groupSizePrices(item.sizePrices);
    results.push({
      ...item,
      styleImage,
      colorImages,
      sizePrices: groupedSizes,
      totalQty: 0,
      score,
    });
  }
  return sortResults(results);
}

function withSanmarCdn(img) {
  if (!img) return "";
  if (/^https?:\/\//i.test(img)) return img;
  const base = (process.env.SANMAR_CDN_BASE || "https://cdnm.sanmar.com/imglib/mresjpg/2024/f12/").replace(/\/+$/, "") + "/";
  return `${base}${img.replace(/^\/+/, "")}`;
}

function groupSizePrices(prices) {
  const arr = Array.from(prices || []).filter((p) => p && Number.isFinite(p.price));
  if (!arr.length) return [];
  const ordered = arr
    .map((p) => ({ ...p, _order: sizeLabelOrder(p.label) }))
    .sort((a, b) => a._order - b._order || String(a.label).localeCompare(String(b.label)));
  const groups = [];
  let cur = null;
  for (const p of ordered) {
    const samePrice = cur && p.price === cur.price && p.cost === cur.cost && p._order === cur._lastOrder + 1;
    if (cur && samePrice) {
      cur.to = p.label;
      cur._lastOrder = p._order;
    } else {
      if (cur) groups.push(cur);
      cur = { from: p.label, to: p.label, price: p.price, cost: p.cost, _lastOrder: p._order };
    }
  }
  if (cur) groups.push(cur);
  return groups.map((g) => {
    const label = g.from === g.to ? g.from : `${g.from}-${g.to}`;
    return { label, price: g.price, cost: g.cost };
  });
}

function sortResults(arr) {
  return Array.from(arr || [])
    .filter(Boolean)
    .sort((a, b) => {
      const qtyA = a.totalQty || 0;
      const qtyB = b.totalQty || 0;
      if (qtyB !== qtyA) return qtyB - qtyA;
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      return String(productName(a) || '').localeCompare(String(productName(b) || ''));
    });
}

const ALLOW_CATEGORY_IDS = new Set([
  21, // T-Shirts
  57, // Short Sleeves
  59, // Sweatshirts
  395, // Sweatshirts & Fleece
  9, // Fleece
  36, // Hooded
  8, // Crewneck
  142, // Pullovers
  22, // Totes / Bags
  186, // Tote Bags
]);

const BAN_CATEGORY_IDS = new Set([
  11, // Headwear
  392, // Hats
  241, // Visors
  242, // Bucket Hats
  147, // Trucker Caps
  245, // Unstructured Hats
  239, // Six-Panel Hats
  238, // Five-Panel Hats
  40, // Safety
]);

const ALLOW_KEYWORDS = [
  /T[-\s]?SHIRT/i,
  /\bTEE\b/i,
  /FLEECE/i,
  /HOOD/i,
  /SWEAT/i,
  /CREW/i,
  /PULLOVER/i,
  /TOTE/i,
];

const BAN_KEYWORDS = [/HAT/i, /HEADWEAR/i, /CAP/i, /VISOR/i, /SAFETY/i];

function parseCategoryIds(item) {
  return String(item.categories || "")
    .split(",")
    .map((x) => Number.parseInt(x.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

function isAllowedCategory(item) {
  const ids = parseCategoryIds(item);
  if (ids.some((id) => BAN_CATEGORY_IDS.has(id))) return false;
  if (ids.some((id) => ALLOW_CATEGORY_IDS.has(id))) return true;

  const text = `${item.baseCategory || ""} ${item.title || ""} ${item.styleName || ""} ${item.brandName || ""}`;
  if (BAN_KEYWORDS.some((rx) => rx.test(text))) return false;
  if (ALLOW_KEYWORDS.some((rx) => rx.test(text))) return true;

  // default allow to avoid hiding valid items if tagging is incomplete
  return true;
}

const { applyMarkup, roundToNickel } = require("../../pricing");

async function fetchPricing(base, headers, styleID, tier, requireSale = false) {
  if (!styleID) return null;
  const url = `${base}/V2/products?styleid=${encodeURIComponent(styleID)}&limit=200&mediatype=json`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data.length) return null;

    const byLabel = new Map();
    const colors = new Set();
    const colorImages = new Map(); // name -> image url
    let totalQty = 0;

    const labelFor = (p) => p.sizePriceCodeName || p.sizePriceCode || p.sizeName || "Default";
    const isWhite = (p) => {
      const c = String(p.colorName || "").toLowerCase();
      return c.includes("white") || c.includes("pfd");
    };
    const rawVal = (p, field) => {
      const v = p[field];
      return typeof v === "number" ? v : Number.parseFloat(v);
    };
    const cdnBase = (process.env.VENDOR_CDN_BASE || "https://cdn.ssactivewear.com/").replace(/\/+$/, "") + "/";
    const pickImage = (p) => {
      const src =
        p.colorFrontImage ||
        p.colorOnModelFrontImage ||
        p.colorSwatchImage ||
        p.colorBackImage ||
        p.colorSideImage ||
        p.colorOnModelBackImage ||
        "";
      if (!src) return null;
      return src.startsWith("http") ? src : `${cdnBase}${src.replace(/^\/+/, "")}`;
    };

    for (const p of data) {
      if (p.colorName) {
        colors.add(p.colorName);
        const img = pickImage(p);
        if (img && !colorImages.has(p.colorName)) {
          colorImages.set(p.colorName, img);
        }
      }
      if (Array.isArray(p.warehouses)) {
        for (const w of p.warehouses) {
          const q = Number(w?.qty);
          if (Number.isFinite(q) && q > 0) {
            totalQty += q;
          }
        }
      }
      const caseCost = rawVal(p, "casePrice") ?? rawVal(p, "caseprice") ?? rawVal(p, "case_price") ?? rawVal(p, "caseQtyPrice") ?? rawVal(p, "caseqtyprice");
      const baseCost = caseCost;
      if (!Number.isFinite(baseCost) || baseCost <= 0) continue;
      if (isWhite(p)) continue; // skip white-based pricing
      const pricing = applyMarkup(baseCost, tier);
      if (!pricing) continue;
      const retail = pricing.price;
      const label = labelFor(p);

      const entry = byLabel.get(label);
      if (!entry) {
        byLabel.set(label, { price: retail, cost: pricing.cost });
      } else {
        // pick the highest non-white retail price for safety
        if (retail > entry.price) {
          entry.price = retail;
          entry.cost = pricing.cost;
        }
      }
    }

    // If skipping whites removed everything, fallback to all colors
    if (!byLabel.size) {
      for (const p of data) {
        const caseCost = rawVal(p, "casePrice") ?? rawVal(p, "caseprice") ?? rawVal(p, "case_price") ?? rawVal(p, "caseQtyPrice") ?? rawVal(p, "caseqtyprice");
        const baseCost = caseCost;
        if (!Number.isFinite(baseCost) || baseCost <= 0) continue;
        const pricing = applyMarkup(baseCost, tier);
        if (!pricing) continue;
        const retail = pricing.price;
        const label = labelFor(p);
        const entry = byLabel.get(label);
        if (!entry) {
          byLabel.set(label, { price: retail, cost: pricing.cost });
        } else {
          if (retail > entry.price) {
            entry.price = retail;
            entry.cost = pricing.cost;
          }
        }
      }
    }

    if (!byLabel.size) return null;

    const sizePrices = Array.from(byLabel.entries())
      .map(([label, v]) => ({
        label,
        price: Number(v.price.toFixed(2)),
        cost: Number(v.cost.toFixed(2)),
      }))
      .filter((sp) => Number.isFinite(sp.price) && Number.isFinite(sp.cost));

    sizePrices.sort((a, b) => sizeLabelOrder(a.label) - sizeLabelOrder(b.label) || String(a.label).localeCompare(String(b.label)));

    if (!sizePrices.length) return null;

    const lowest = sizePrices.reduce((acc, cur) => Math.min(acc, cur.price), Infinity);
    const lowestCost = sizePrices.reduce((acc, cur) => Math.min(acc, cur.cost), Infinity);

    return {
      price: Number(lowest.toFixed(2)),
      cost: Number(lowestCost.toFixed(2)),
      sizePrices,
      colors: Array.from(colors).sort(),
      colorImages: Array.from(colorImages.entries()).map(([name, image]) => ({ name, image })),
      totalQty,
    };
  } catch {
    return null;
  }
}

function categoryTier(item) {
  const text = normalize(
    `${item.baseCategory || ""} ${item.styleName || ""} ${item.title || ""}`
  );
  if (["HOOD", "HOODIE", "FLEECE", "SWEAT", "CREW", "PULLOVER"].some((w) => text.includes(w))) {
    return "hoodie";
  }
  return "tee";
}

function sizeLabelOrder(label) {
  const normalizeToken = (t) => {
    return String(t || "")
      .toUpperCase()
      .replace(/\./g, "")
      .replace(/\s+/g, "")
      .replace(/-/g, "");
  };

  const sizeValue = (tok) => {
    const aliases = {
      XXL: "2XL",
      XXXL: "3XL",
      XXXXL: "4XL",
      XXXXXL: "5XL",
      XXXXXXL: "6XL",
      XSMALL: "XS",
      SMALL: "S",
      MEDIUM: "M",
      LARGE: "L",
      "2X": "2XL",
      "3X": "3XL",
      "4X": "4XL",
      "5X": "5XL",
      "6X": "6XL",
    };
    const cleaned = normalizeToken(tok);
    const alias = aliases[cleaned] || cleaned;
    const order = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL", "6XL"];
    const idx = order.indexOf(alias);
    if (idx !== -1) return idx;
    const num = Number.parseInt(alias, 10);
    if (Number.isFinite(num)) return 100 + num;
    return 999;
  };

  const norm = String(label || "").toUpperCase().trim();
  const rangeMatch = norm.match(/^([A-Z0-9\s\.]+)\s*-\s*([A-Z0-9\s\.]+)$/);
  if (rangeMatch) {
    const startVal = sizeValue(rangeMatch[1]);
    // ranges like S-XL should show before 2XL, so nudge slightly above the start size
    return startVal + 0.4;
  }

  return sizeValue(norm);
}

const TEE_ALLOWED = null;

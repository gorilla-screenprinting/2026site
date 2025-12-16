exports.handler = async (event) => {
  const username = process.env.VENDOR_USERNAME;
  const password = process.env.VENDOR_PASSWORD;
  const baseUrl = process.env.VENDOR_BASE_URL || "https://api.ssactivewear.com";
  const styleIdOverride = process.env.VENDOR_HEALTH_STYLE_ID || "39"; // used as a safe fallback
  const cdnBase = (process.env.VENDOR_CDN_BASE || "https://cdn.ssactivewear.com/").replace(/\/+$/, "") + "/";

  if (!username || !password) {
    return json(500, { ok: false, error: "Missing VENDOR_USERNAME or VENDOR_PASSWORD" });
  }

  const preset = "";
  let q = (event.queryStringParameters?.q || "").trim();
  const isPreset = false;
  if (!q) {
    return json(400, { ok: false, error: "Missing search query (style ID or part number)" });
  }

  const auth = Buffer.from(`${username}:${password}`).toString("base64");
  const headers = {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
  };

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
  // Treat as strict SKU match only when the query contains a digit
  const isSkuQuery = /\d/.test(q);

  // Try style ID if numeric
  if (numericQ) {
    urls.add(`${cleanBase}/V2/styles?styleid=${encodeURIComponent(q)}&limit=20&mediatype=json`);
  }

  // Try part numbers (with and without spaces)
  variants.forEach((val) => {
    urls.add(`${cleanBase}/V2/styles?partnumber=${encodeURIComponent(val)}&limit=20&mediatype=json`);
  });

  // Try style code/name if supported by API
  variants.forEach((val) => {
    urls.add(`${cleanBase}/V2/styles?style=${encodeURIComponent(val)}&limit=20&mediatype=json`);
  });

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
      return json(502, { ok: false, error: "Upstream S&S API unreachable" });
    }

    const deduped = [];
    const seen = new Set();

    const scoreItem = (item) => {
      let score = 0;
      if (numericQ && String(item.styleID || "") === numericQ) score = Math.max(score, 100);
      const pnNorm = normalize(item.partNumber);
      if (pnNorm && normVariants.includes(pnNorm)) score = Math.max(score, 90);
      const nameNorm = normalize(item.styleName || item.uniqueStyleName || item.title);
      if (nameNorm && normVariants.includes(nameNorm)) score = Math.max(score, 80);

      if (queryTokens.length) {
        const haystack = normalize(
          `${item.styleName || ""} ${item.uniqueStyleName || ""} ${item.title || ""} ${item.brandName || ""} ${item.baseCategory || ""} ${item.description || ""}`
        );
        // if all tokens appear somewhere in the text, treat as a relevant fuzzy hit
        const allTokensMatch = queryTokens.every((tok) => haystack.includes(tok));
        if (allTokensMatch) score = Math.max(score, 75);
      }
      return score;
    };

    for (const item of resultsCombined) {
      const key = `${item.styleID || ""}-${item.partNumber || ""}-${item.styleName || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const score = scoreItem(item);
      if (score <= 0) continue;
      if (!isAllowedCategory(item)) continue;

      const styleIdStr = item.styleID ? String(item.styleID) : "";
      const pnNorm = normalize(item.partNumber);
      const nameNorm = normalize(item.styleName || item.uniqueStyleName || item.title);
      const matchesSku = (numericQ && styleIdStr === numericQ) || pnNorm === normQ || nameNorm === normQ;

      // If the query looks like a SKU/code, require a direct match
      if (isSkuQuery && !matchesSku) continue;

      let imageUrl = null;
      if (item.styleImage) {
        imageUrl = item.styleImage.startsWith("http")
          ? item.styleImage
          : `${cdnBase}${item.styleImage.replace(/^\/+/, "")}`;
      }

      deduped.push({
        score,
        styleID: item.styleID,
        partNumber: item.partNumber,
        brandName: item.brandName,
        styleName: item.styleName || item.uniqueStyleName || item.title,
        baseCategory: item.baseCategory,
        description: item.description,
        styleImage: imageUrl,
      });
    }

    if (deduped.length === 0) {
      return json(200, { ok: true, count: 0, results: [] });
    }

    const sorted = deduped.sort((a, b) => b.score - a.score || String(a.partNumber || "").localeCompare(String(b.partNumber || "")));
    const limited = sorted.slice(0, 20); // cap to 20 to keep pricing lookups light

    // Fetch pricing for top items (best-effort)
    const withPricing = await Promise.all(
      limited.map(async (item) => {
        const tier = categoryTier(item);
        const pricing = await fetchPricing(cleanBase, headers, item.styleID, item.partNumber, tier);
        return pricing ? { ...item, ...pricing } : item;
      })
    );

    const trimmed = withPricing
      .map(({ score, partNumber, styleID, ...rest }) => rest)
      .slice(0, 20);
    return json(200, { ok: true, count: trimmed.length, results: trimmed });
  } catch (err) {
    return json(502, { ok: false, error: String(err?.message || err) });
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

function isAllowedCategory() {
  return true;
}

async function fetchPricing(base, headers, styleID, partNumber, tier, requireSale = false) {
  const styleIdParam = styleID ? `styleid=${encodeURIComponent(styleID)}` : partNumber ? `partnumber=${encodeURIComponent(partNumber)}` : null;
  if (!styleIdParam) return null;
  const url = `${base}/V2/products?${styleIdParam}&limit=200&mediatype=json`;
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const text = await res.text();
    const data = JSON.parse(text);
    if (!Array.isArray(data) || !data.length) return null;

    const add = tier === "hoodie" ? 7 : 3.5;
    const byLabel = new Map();
    const colors = new Set();

    const labelFor = (p) => p.sizePriceCodeName || p.sizePriceCode || p.sizeName || "Default";
    const isWhite = (p) => {
      const c = String(p.colorName || "").toLowerCase();
      return c.includes("white") || c.includes("pfd");
    };
    const rawVal = (p, field) => {
      const v = p[field];
      return typeof v === "number" ? v : Number.parseFloat(v);
    };

    for (const p of data) {
      if (p.colorName) colors.add(p.colorName);
      const caseCost = rawVal(p, "casePrice") ?? rawVal(p, "caseprice") ?? rawVal(p, "case_price") ?? rawVal(p, "caseQtyPrice") ?? rawVal(p, "caseqtyprice");
      const baseCost = caseCost;
      if (!Number.isFinite(baseCost) || baseCost <= 0) continue;
      if (isWhite(p)) continue; // skip white-based pricing
      const retail = roundToNickel(baseCost + add);
      const label = labelFor(p);

      const entry = byLabel.get(label);
      if (!entry) {
        byLabel.set(label, { price: retail, cost: baseCost });
      } else {
        // pick the highest non-white retail price for safety
        if (retail > entry.price) {
          entry.price = retail;
          entry.cost = baseCost;
        }
      }
    }

    // If skipping whites removed everything, fallback to all colors
    if (!byLabel.size) {
      for (const p of data) {
        const caseCost = rawVal(p, "casePrice") ?? rawVal(p, "caseprice") ?? rawVal(p, "case_price") ?? rawVal(p, "caseQtyPrice") ?? rawVal(p, "caseqtyprice");
        const baseCost = caseCost;
        if (!Number.isFinite(baseCost) || baseCost <= 0) continue;
        const retail = roundToNickel(baseCost + add);
        const label = labelFor(p);
        const entry = byLabel.get(label);
        if (!entry) {
          byLabel.set(label, { price: retail, cost: baseCost });
        } else {
          if (retail > entry.price) {
            entry.price = retail;
            entry.cost = baseCost;
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

function roundToNickel(val) {
  if (!Number.isFinite(val)) return val;
  return Math.ceil(val * 20) / 20; // 0.05 = 1/20
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

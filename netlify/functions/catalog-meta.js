exports.handler = async () => {
  try {
    const { loadLocalIndex } = require("./catalog-search");
    const index = loadLocalIndex();
    const brands = new Set();
    const categories = new Set();
    const mapBrandToCategories = new Map();
    const mapCategoryToBrands = new Map();
    index.forEach((row) => {
      if (row.brandName) brands.add(row.brandName);
      if (row.baseCategory) categories.add(row.baseCategory);
      if (row.brandName && row.baseCategory) {
        const b = row.brandName;
        const c = row.baseCategory;
        if (!mapBrandToCategories.has(b)) mapBrandToCategories.set(b, new Set());
        mapBrandToCategories.get(b).add(c);
        if (!mapCategoryToBrands.has(c)) mapCategoryToBrands.set(c, new Set());
        mapCategoryToBrands.get(c).add(b);
      }
    });
    return {
      statusCode: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
      body: JSON.stringify({
        ok: true,
        brands: Array.from(brands).sort(),
        categories: Array.from(categories).sort(),
        brandToCategories: Object.fromEntries(
          Array.from(mapBrandToCategories.entries()).map(([b, set]) => [b, Array.from(set).sort()])
        ),
        categoryToBrands: Object.fromEntries(
          Array.from(mapCategoryToBrands.entries()).map(([c, set]) => [c, Array.from(set).sort()])
        ),
      }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ ok: false, error: String(err?.message || err) }) };
  }
};

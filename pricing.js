// Shared pricing helpers for S&S and SanMar.
const MARKUP_TEE =
  Number.isFinite(Number(process.env.MARKUP_TEE)) ? Number(process.env.MARKUP_TEE) : 3.5;
const MARKUP_HOODIE =
  Number.isFinite(Number(process.env.MARKUP_HOODIE)) ? Number(process.env.MARKUP_HOODIE) : 7;

function markupForTier(tier) {
  return tier === "hoodie" ? MARKUP_HOODIE : MARKUP_TEE;
}

function roundToNickel(val) {
  if (!Number.isFinite(val)) return val;
  return Math.ceil(val * 20) / 20; // 0.05 = 1/20
}

function applyMarkup(cost, tier) {
  if (!Number.isFinite(cost)) return null;
  const add = markupForTier(tier);
  const price = roundToNickel(cost + add);
  return {
    price: Number(price.toFixed(2)),
    cost: Number(cost.toFixed(2)),
  };
}

module.exports = {
  applyMarkup,
  roundToNickel,
  markupForTier,
};

/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Load .env manually so npm scripts don't require env export
function loadEnvFromDotenv() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) return;
    const [, key, valRaw] = match;
    if (process.env[key] !== undefined) return;
    const unquoted = valRaw.replace(/^['"]|['"]$/g, '');
    process.env[key] = unquoted;
  });
}
loadEnvFromDotenv();

const EXCLUDED_BASE_CATEGORIES = new Set([
  'Accessories',
  'Wovens',
  'Outerwear',
  'Knits & Layering',
]);

function shouldExcludeCategory(baseCategory) {
  return EXCLUDED_BASE_CATEGORIES.has(String(baseCategory || '').trim());
}

async function main() {
  const username = process.env.VENDOR_USERNAME;
  const password = process.env.VENDOR_PASSWORD;
  const baseUrl = (process.env.VENDOR_BASE_URL || 'https://api.ssactivewear.com').replace(/\/+$/, '');

  if (!username || !password) {
    console.error('Missing VENDOR_USERNAME or VENDOR_PASSWORD in env.');
    process.exit(1);
  }

  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
    Accept: 'application/json',
  };

  const limit = 500;
  let page = 1;
  const collected = [];
  const seen = new Set();

  console.log('Building style index from S&S...');
  while (true) {
    const url = `${baseUrl}/V2/styles?page=${page}&limit=${limit}&mediatype=json`;
    console.log(`Fetching page ${page}...`);
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error(`Request failed (${res.status}) ${res.statusText}`);
      break;
    }
    const data = await res.json().catch(() => null);
    if (!Array.isArray(data) || data.length === 0) {
      console.log('No more data. Stopping.');
      break;
    }

    let added = 0;
    for (const item of data) {
      const bc = item.baseCategory || '';
      if (shouldExcludeCategory(bc)) continue;
      if (seen.has(item.styleID)) continue;
      seen.add(item.styleID);
      added += 1;
      collected.push({
        styleID: item.styleID,
        brandName: item.brandName,
        styleName: item.styleName || item.uniqueStyleName || item.title,
        title: item.title || item.uniqueStyleName || item.styleName || '',
        baseCategory: bc,
        styleImage: item.styleImage,
      });
    }

    if (data.length < limit) {
      break;
    }
    if (page > 1 && added === 0) {
      console.log('No new styles found on this page, stopping.');
      break;
    }
    page += 1;
  }

  const outDir = path.join(process.cwd(), 'catalog-data');
  const outFile = path.join(outDir, 'ss-style-index.json');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outFile, JSON.stringify(collected, null, 2), 'utf8');
  console.log(`Wrote ${collected.length} entries to ${outFile}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

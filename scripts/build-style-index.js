/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

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

    for (const item of data) {
      const bc = item.baseCategory || '';
      if (shouldExcludeCategory(bc)) continue;
      collected.push({
        styleID: item.styleID,
        brandName: item.brandName,
        styleName: item.styleName || item.uniqueStyleName || item.title,
        baseCategory: bc,
        styleImage: item.styleImage,
      });
    }

    if (data.length < limit) {
      break;
    }
    page += 1;
  }

  const outDir = path.join(process.cwd(), 'notes');
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

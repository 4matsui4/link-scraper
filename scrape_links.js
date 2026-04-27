/**
 * Scrape all anchor elements pointing to a target URL across multiple pages.
 * URLs are loaded from environment variables (see .env.example).
 */
const { chromium } = require('playwright');
require('dotenv').config();

const TARGET_DOMAIN = process.env.TARGET_DOMAIN;
const SOURCE_URLS = (process.env.SOURCE_URLS || '').split(',').map(u => u.trim()).filter(Boolean);

if (!TARGET_DOMAIN || SOURCE_URLS.length === 0) {
  console.error('Error: Set TARGET_DOMAIN and SOURCE_URLS in your .env file.');
  process.exit(1);
}

async function scrapeLinks(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);

  const results = await page.evaluate((target) => {
    const found = [];

    document.querySelectorAll('a[href]').forEach(el => {
      if (el.href.includes(target)) {
        found.push({
          tag: 'a',
          id: el.id || null,
          href: el.href,
          text: el.innerText.trim().substring(0, 80),
        });
      }
    });

    document.querySelectorAll('[onclick]').forEach(el => {
      const oc = el.getAttribute('onclick');
      if (oc && oc.includes(target)) {
        found.push({
          tag: el.tagName.toLowerCase(),
          id: el.id || null,
          href: oc,
          text: el.innerText.trim().substring(0, 80),
        });
      }
    });

    return found;
  }, target);

  await browser.close();
  return results;
}

(async () => {
  const allResults = {};

  for (const url of SOURCE_URLS) {
    console.log(`\nScraping: ${url}`);
    try {
      const links = await scrapeLinks(url);
      allResults[url] = links;

      if (links.length === 0) {
        console.log('  No matching links found.');
      } else {
        console.log(`  Found ${links.length} link(s):`);
        links.forEach((l, i) => {
          console.log(`  [${i + 1}] id="${l.id}"  text="${l.text}"  href=${l.href}`);
        });
      }
    } catch (e) {
      console.error(`  Error: ${e.message}`);
    }
  }

  // Table output
  console.log('\n\n=== Summary Table ===');
  console.log('Page\tID\tText\tHref');
  for (const [url, links] of Object.entries(allResults)) {
    for (const l of links) {
      console.log(`${url}\t${l.id}\t${l.text}\t${l.href}`);
    }
  }
})();

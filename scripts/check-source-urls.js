const fs = require("fs");
const path = require("path");

const seedPath = path.join(__dirname, "..", "supabase", "migrations", "202607190001_seed_official_policies.sql");
const sql = fs.readFileSync(seedPath, "utf8");
const urls = [...new Set([...sql.matchAll(/'https:\/\/[^']+'/g)].map((match) => match[0].slice(1, -1)))];
const timeoutMs = Number(process.env.SOURCE_URL_TIMEOUT_MS || 12000);

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function checkUrl(url) {
  if (!/^https:\/\//i.test(url)) {
    fail(`${url} is not HTTPS`);
    return;
  }
  let response;
  try {
    response = await fetchWithTimeout(url, { method: "HEAD", headers: { "User-Agent": "BridgeYouthSourceCheck/1.0" } });
    if (response.status < 200 || response.status >= 400) {
      response = await fetchWithTimeout(url, { method: "GET", headers: { Range: "bytes=0-2048", "User-Agent": "BridgeYouthSourceCheck/1.0" } });
    }
  } catch (error) {
    fail(`${url} could not be reached: ${error.message}`);
    return;
  }
  if (response.status < 200 || response.status >= 400) fail(`${url} returned HTTP ${response.status}`);
}

async function main() {
  if (!urls.length) throw new Error("No HTTPS source URLs found in seed migration");
  await Promise.all(urls.map(checkUrl));
  if (process.exitCode) process.exit(process.exitCode);
  console.log(`Official source URL check passed for ${urls.length} URLs`);
}

main().catch((error) => {
  fail(error.message);
});


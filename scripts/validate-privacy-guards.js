const fs = require("fs");
const path = require("path");

const serverSource = fs.readFileSync(path.join(__dirname, "..", "lib/app-server.cjs"), "utf8");
const failures = [];

for (const snippet of [
  "function redactSensitiveText",
  "[redacted-email]",
  "[redacted-phone]",
  "[redacted-id]",
  "allowedMetadataKeys",
  "allowedEventTypes",
  "sanitizeInterestCategories",
  "Unsupported or invalid event payload",
  "Invalid JSON payload",
  "const publicFiles",
  "rejectIfRateLimited",
  "getAggregateInterestCategories",
]) {
  if (!serverSource.includes(snippet)) failures.push(`Missing privacy guard snippet: ${snippet}`);
}

if (/insertJourneyEvent\(JSON\.parse/.test(serverSource)) failures.push("Events must be sanitized before insertJourneyEvent");
const interestBlock = serverSource.slice(serverSource.indexOf('if (pathname === "/api/interest-summary"'), serverSource.indexOf('if (pathname === "/api/admin/purge-events"'));
if (!interestBlock.includes("try {") || !interestBlock.includes("Invalid JSON payload")) failures.push("Interest summary JSON parsing should be guarded");
if (!interestBlock.includes("getAggregateInterestCategories") || !interestBlock.includes("if (isProduction)")) failures.push("Production interest summaries must use server-side aggregate counts");
const eventsRouteBlock = serverSource.slice(serverSource.indexOf('if (pathname !== "/api/events") return false;'), serverSource.indexOf('async function serveStatic'));
if (!eventsRouteBlock.includes('if (request.method === "POST")') || eventsRouteBlock.includes('if (request.method === "GET")')) failures.push("Raw event reads must be disabled and event writes must remain explicit");
if (!serverSource.includes("const publicFiles = new Map") || !serverSource.includes('const filename = publicFiles.get(pathname)')) failures.push("Static files must be served from an explicit allowlist");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Privacy guard validation passed");


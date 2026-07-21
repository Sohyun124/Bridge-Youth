const fs = require("fs");
const path = require("path");

const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
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
  "getRequestedAnonymousUserId",
  "A valid anonymousUserId is required",
  "getAggregateInterestCategories",
]) {
  if (!serverSource.includes(snippet)) failures.push(`Missing privacy guard snippet: ${snippet}`);
}

if (/insertJourneyEvent\(JSON\.parse/.test(serverSource)) failures.push("Events must be sanitized before insertJourneyEvent");
const interestBlock = serverSource.slice(serverSource.indexOf('if (pathname === "/api/interest-summary"'), serverSource.indexOf('if (pathname === "/api/admin/purge-events"'));
if (!interestBlock.includes("try {") || !interestBlock.includes("Invalid JSON payload")) failures.push("Interest summary JSON parsing should be guarded");
if (!interestBlock.includes("getAggregateInterestCategories") || !interestBlock.includes("if (isProduction)")) failures.push("Production interest summaries must use server-side aggregate counts");
const eventsGetBlock = serverSource.slice(serverSource.indexOf('if (pathname !== "/api/events") return false;'), serverSource.indexOf('if (request.method === "POST") {', serverSource.indexOf('if (pathname !== "/api/events") return false;')));
if (!eventsGetBlock.includes("getRequestedAnonymousUserId") || !eventsGetBlock.includes("A valid anonymousUserId is required")) failures.push("Production raw event reads must be scoped to a valid anonymous user ID");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Privacy guard validation passed");


const baseUrl = (process.env.BRIDGE_BASE_URL || "http://localhost:4173").replace(/\/$/, "");

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function getJson(path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    fail(`${path} did not return JSON`);
  }
  if (response.status !== expectedStatus) {
    fail(`${path} returned ${response.status}, expected ${expectedStatus}: ${text}`);
  }
  return body;
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function requirePolicyFields(policy) {
  const missing = ["id", "title", "category", "provider", "region", "sourceUrl", "sourcePublishedAt", "sourceUpdatedAt", "summary", "caution"]
    .filter((field) => !policy[field]);
  if (missing.length) fail(`Policy ${policy.id || "<unknown>"} is missing: ${missing.join(", ")}`);
  if (!/^https:\/\//i.test(policy.sourceUrl || "")) fail(`Policy ${policy.id} does not use an official HTTPS source URL`);
  if (policy.applicationUrl && !/^https:\/\//i.test(policy.applicationUrl)) fail(`Policy ${policy.id} application URL must be HTTPS`);
  if (!Number.isFinite(Date.parse(policy.sourcePublishedAt))) fail(`Policy ${policy.id} has an invalid official basis date`);
  if (!Number.isFinite(Date.parse(policy.sourceUpdatedAt))) fail(`Policy ${policy.id} has an invalid source update date`);
  if (policy.deadline && new Date(policy.deadline).getTime() < Date.now()) fail(`Policy ${policy.id} is expired but returned by API`);
  if (!Array.isArray(policy.documents)) fail(`Policy ${policy.id} documents must be an array`);
  if (!policy.applicationPeriod || !["ongoing", "scheduled"].includes(policy.applicationPeriod.kind)) fail(`Policy ${policy.id} is missing a structured active application period`);
  if (policy.category === "transport") {
    if (!isFiniteNumber(policy.minAge) || !isFiniteNumber(policy.maxAge)) fail(`Transport policy ${policy.id} missing numeric age bounds`);
    if (!isFiniteNumber(policy.minMonthlyRides)) fail(`Transport policy ${policy.id} missing numeric minMonthlyRides`);
    if (!policy.type || !policy.calculationType) fail(`Transport policy ${policy.id} missing benefit type/calculationType`);
  }
}

async function main() {
  const health = await getJson("/api/health");
  if (!health.ok || health.database !== "configured") fail("Health check does not prove configured database");
  if (!health.checks?.policies || !health.checks?.journeyEvents) fail("Health check does not prove required database tables are readable");

  const transport = await getJson("/api/policies?category=transport");
  if (!Array.isArray(transport.policies) || transport.policies.length === 0) fail("No active official transport policies returned");
  transport.policies.forEach(requirePolicyFields);

  const unscopedEvents = await getJson("/api/events", 400);
  if (!/anonymousUserId/i.test(unscopedEvents.error || "")) fail("Unscoped raw event reads must be rejected");
  const events = await getJson("/api/events?anonymousUserId=anon_deploymentcheck");
  if (events.storage !== "database") fail("Events API is not backed by database storage");
  if (!Array.isArray(events.events)) fail("Events API did not return an events array");

  const categoryChecks = await Promise.all(["housing", "education", "saving"].map((category) => getJson(`/api/policies?category=${category}`)));
  categoryChecks.forEach((result, index) => {
    const category = ["housing", "education", "saving"][index];
    if (!Array.isArray(result.policies)) fail(`${category} policy response is not an array`);
    result.policies.forEach(requirePolicyFields);
  });

  console.log(`Deployment check passed for ${baseUrl}`);
}

main().catch((error) => {
  fail(error.message);
});




const fs = require("fs");
const path = require("path");

const activateSource = fs.readFileSync(path.join(__dirname, "activate-reviewed-policy.js"), "utf8");
const listSource = fs.readFileSync(path.join(__dirname, "list-review-policies.js"), "utf8");
const failures = [];

for (const snippet of [
  'row.status !== "needs_review"',
  'Expired policy cannot be activated',
  'source_url must be HTTPS',
  'source_checked_at is required',
  'SOURCE_PUBLISHED_AT must be a valid official publication or basis date',
  'APPLICATION_URL must be HTTPS when provided',
  'APPLICATION_PERIOD_JSON.kind must be ongoing or scheduled for an active policy',
  'APPLICATION_PERIOD_JSON.label must explain the official application timing',
  'reviewedBy',
  'activationMethod: "scripts/activate-reviewed-policy.js"',
  'assertReviewedText("EASY_SUMMARY"',
  'assertReviewedText("CAUTION"',
  "assertTransportStructure(finalEligibility, finalBenefit)",
  "Transport policy requires numeric minAge and maxAge",
  "fixed-pass requires numeric passCost and ddareungiAddOn",
]) {
  if (!activateSource.includes(snippet)) failures.push(`Missing activation guard: ${snippet}`);
}

for (const snippet of ['status: "eq.needs_review"', 'source_url', 'application_url', 'source_published_at', 'source_checked_at', 'application_period', 'currentSummary', 'currentCaution']) {
  if (!listSource.includes(snippet)) failures.push(`Missing review list field/filter: ${snippet}`);
}

if (!activateSource.includes("assertOfficialPolicy(row)") || !activateSource.includes('status: "active"')) {
  failures.push("Activation script must assert policy safety before patching active");
}
if (/SUPABASE_SERVICE_ROLE_KEY/.test(activateSource) === false || /SUPABASE_SERVICE_ROLE_KEY/.test(listSource) === false) {
  failures.push("Review scripts must require service-role credentials");
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Policy review workflow validation passed");



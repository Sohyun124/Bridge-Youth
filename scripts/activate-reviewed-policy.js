const reviewOnlyFragments = [
  "검토 중",
  "검수 전에는 사용자에게 표시하지 않습니다",
  "쉬운 설명을 등록합니다",
  "공식 기관 확인 필요",
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseJsonEnv(name, fallback) {
  const value = process.env[name];
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${name} must be valid JSON`);
  }
}

async function supabaseRequest(path, options = {}) {
  const url = requireEnv("SUPABASE_URL").replace(/\/$/, "");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed ${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

function assertReviewedText(name, value) {
  if (!value || value.trim().length < 20) throw new Error(`${name} must be a reviewed Korean sentence, not a placeholder`);
  if (reviewOnlyFragments.some((fragment) => value.includes(fragment))) throw new Error(`${name} still contains review-only wording: ${value}`);
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function assertTransportStructure(eligibility, benefit) {
  if (!isFiniteNumber(eligibility.minAge) || !isFiniteNumber(eligibility.maxAge)) throw new Error("Transport policy requires numeric minAge and maxAge");
  if (!isFiniteNumber(eligibility.minMonthlyRides)) throw new Error("Transport policy requires numeric minMonthlyRides");
  if (!benefit.type || !benefit.calculationType) throw new Error("Transport policy requires benefit.type and benefit.calculationType");
  if (["refund", "regional-refund"].includes(benefit.type) && !isFiniteNumber(benefit.refundRate)) throw new Error(`${benefit.type} requires numeric refundRate`);
  if (benefit.type === "best-of-refund-or-threshold") {
    for (const key of ["refundRate", "regularThreshold", "plusThreshold"]) {
      if (!isFiniteNumber(benefit[key])) throw new Error(`best-of-refund-or-threshold requires numeric ${key}`);
    }
  }
  if (benefit.type === "fixed-pass" && (!isFiniteNumber(benefit.passCost) || !isFiniteNumber(benefit.ddareungiAddOn))) throw new Error("fixed-pass requires numeric passCost and ddareungiAddOn");
  if (benefit.type === "all-pass") {
    for (const key of ["capitalPlusThreshold", "localPlusThreshold", "capitalRegularThreshold", "localRegularThreshold"]) {
      if (!isFiniteNumber(benefit[key])) throw new Error(`all-pass requires numeric ${key}`);
    }
  }
  if (benefit.type === "long-distance" && !benefit.discountRange) throw new Error("long-distance requires discountRange");
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function assertApplicationPeriod(period) {
  if (!period || typeof period !== "object" || Array.isArray(period)) throw new Error("APPLICATION_PERIOD_JSON must be a JSON object");
  if (!["ongoing", "scheduled"].includes(period.kind)) throw new Error("APPLICATION_PERIOD_JSON.kind must be ongoing or scheduled for an active policy");
  if (period.startsAt && !isValidTimestamp(period.startsAt)) throw new Error("APPLICATION_PERIOD_JSON.startsAt must be a valid date when provided");
  if (period.endsAt && !isValidTimestamp(period.endsAt)) throw new Error("APPLICATION_PERIOD_JSON.endsAt must be a valid date when provided");
  if (!period.label || typeof period.label !== "string") throw new Error("APPLICATION_PERIOD_JSON.label must explain the official application timing");
}
function assertOfficialPolicy(row) {
  if (!row) throw new Error("Policy not found");
  if (row.status !== "needs_review") throw new Error(`Policy must be needs_review before activation, got ${row.status}`);
  if (!/^https:\/\//i.test(row.source_url || "")) throw new Error("Policy source_url must be HTTPS");
  if (!row.source_checked_at) throw new Error("Policy source_checked_at is required");
  if (row.application_url && !/^https:\/\//i.test(row.application_url)) throw new Error("Policy application_url must be HTTPS when provided");
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) throw new Error("Expired policy cannot be activated");
}

async function main() {
  const id = requireEnv("POLICY_ID");
  const reviewedBy = requireEnv("REVIEWED_BY");
  const sourcePublishedAt = requireEnv("SOURCE_PUBLISHED_AT");
  const applicationUrl = process.env.APPLICATION_URL || undefined;
  const applicationPeriod = parseJsonEnv("APPLICATION_PERIOD_JSON", undefined);
  const easySummary = requireEnv("EASY_SUMMARY");
  const caution = requireEnv("CAUTION");
  const requiredDocuments = parseJsonEnv("REQUIRED_DOCUMENTS_JSON", []);
  const eligibility = parseJsonEnv("ELIGIBILITY_JSON", undefined);
  const benefit = parseJsonEnv("BENEFIT_JSON", undefined);

  if (!isValidTimestamp(sourcePublishedAt)) throw new Error("SOURCE_PUBLISHED_AT must be a valid official publication or basis date");
  assertApplicationPeriod(applicationPeriod);
  if (applicationUrl && !/^https:\/\//i.test(applicationUrl)) throw new Error("APPLICATION_URL must be HTTPS when provided");
  assertReviewedText("EASY_SUMMARY", easySummary);
  assertReviewedText("CAUTION", caution);
  if (!Array.isArray(requiredDocuments)) throw new Error("REQUIRED_DOCUMENTS_JSON must be a JSON array");

  const query = new URLSearchParams({
    select: "id,status,category,source_url,application_url,source_published_at,source_checked_at,application_period,expires_at,eligibility,benefit,raw_source",
    id: `eq.${id}`,
    limit: "1",
  });
  const rows = await supabaseRequest(`policies?${query.toString()}`);
  const row = rows[0];
  assertOfficialPolicy(row);
  const finalEligibility = eligibility !== undefined ? eligibility : row.eligibility || {};
  const finalBenefit = benefit !== undefined ? benefit : row.benefit || {};
  if (row.category === "transport") assertTransportStructure(finalEligibility, finalBenefit);

  const patch = {
    status: "active",
    source_published_at: sourcePublishedAt,
    application_period: applicationPeriod,
    easy_summary: easySummary,
    caution,
    required_documents: requiredDocuments,
    updated_at: new Date().toISOString(),
    raw_source: {
      ...(row.raw_source || {}),
      review: {
        reviewedBy,
        reviewedAt: new Date().toISOString(),
        activationMethod: "scripts/activate-reviewed-policy.js",
      },
    },
  };
  if (applicationUrl !== undefined) patch.application_url = applicationUrl;
  patch.eligibility = finalEligibility;
  patch.benefit = finalBenefit;

  const updateQuery = new URLSearchParams({ id: `eq.${id}` });
  await supabaseRequest(`policies?${updateQuery.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
  console.log(JSON.stringify({ ok: true, activatedPolicyId: id, reviewedBy }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});


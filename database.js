function databaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && getSupabaseServerCredential());
}

const { getSupabaseServerCredential, supabaseServerHeaders } = require("./supabase-credentials");

function databaseHeaders(extra = {}) {
  return supabaseServerHeaders(extra);
}

async function supabaseRequest(path, options = {}) {
  if (!databaseConfigured()) throw new Error("Database is not configured");
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: databaseHeaders(options.headers),
  });
  if (!response.ok) throw new Error(`Database request failed: ${response.status}`);
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
async function checkDatabaseReadiness() {
  if (!databaseConfigured()) {
    return { ok: false, database: "missing_configuration", checks: { policies: false, journeyEvents: false } };
  }
  const checks = { policies: false, journeyEvents: false };
  try {
    await supabaseRequest("policies?select=id&limit=1");
    checks.policies = true;
    await supabaseRequest("journey_events?select=event_id&limit=1");
    checks.journeyEvents = true;
    return { ok: true, database: "configured", checks };
  } catch (error) {
    return { ok: false, database: "unavailable", checks, error: error.message };
  }
}

function policyRowToClientPolicy(row) {
  return {
    id: row.id,
    title: row.official_title,
    category: row.category,
    provider: row.provider,
    sourceName: row.provider,
    region: row.region,
    sourceUrl: row.source_url,
    applicationUrl: row.application_url,
    sourceUpdatedAt: row.source_checked_at,
    sourcePublishedAt: row.source_published_at,
    deadline: row.expires_at,
    applicationPeriod: row.application_period,
    summary: row.easy_summary,
    caution: row.caution,
    documents: row.required_documents,
    ...row.eligibility,
    ...row.benefit,
  };
}

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function hasReviewedText(value) {
  return typeof value === "string" && value.trim().length >= 20 && !value.includes("검토 중") && !value.includes("검수 전에는 사용자에게 표시하지 않습니다") && !value.includes("쉬운 설명을 등록합니다");
}

function isPolicyStructurallyUsable(row) {
  if (!row.id || !row.official_title || !row.provider || !row.region) return false;
  if (!/^https:\/\//i.test(row.source_url || "")) return false;
  if (row.application_url && !/^https:\/\//i.test(row.application_url)) return false;
  if (!isValidTimestamp(row.source_published_at) || !isValidTimestamp(row.source_checked_at) || !hasReviewedText(row.easy_summary) || !hasReviewedText(row.caution)) return false;
  if (!Array.isArray(row.required_documents)) return false;
  const applicationPeriod = row.application_period || {};
  if (!applicationPeriod || typeof applicationPeriod !== "object" || Array.isArray(applicationPeriod)) return false;
  if (!['ongoing', 'scheduled', 'closed'].includes(applicationPeriod.kind)) return false;
  const eligibility = row.eligibility || {};
  const benefit = row.benefit || {};
  if (row.category === "transport") {
    if (!isFiniteNumber(eligibility.minAge) || !isFiniteNumber(eligibility.maxAge)) return false;
    if (!isFiniteNumber(eligibility.minMonthlyRides)) return false;
    if (!benefit.type || !benefit.calculationType) return false;
    if (["refund", "regional-refund"].includes(benefit.type) && !isFiniteNumber(benefit.refundRate)) return false;
    if (benefit.type === "best-of-refund-or-threshold") {
      for (const key of ["refundRate", "regularThreshold", "plusThreshold"]) {
        if (!isFiniteNumber(benefit[key])) return false;
      }
    }
    if (benefit.type === "fixed-pass" && (!isFiniteNumber(benefit.passCost) || !isFiniteNumber(benefit.ddareungiAddOn))) return false;
    if (benefit.type === "all-pass") {
      for (const key of ["capitalPlusThreshold", "localPlusThreshold", "capitalRegularThreshold", "localRegularThreshold"]) {
        if (!isFiniteNumber(benefit[key])) return false;
      }
    }
    if (benefit.type === "long-distance" && !benefit.discountRange) return false;
  }
  return true;
}

async function listActivePolicies(category) {
  const query = new URLSearchParams({
    select: "id,official_title,category,provider,region,source_url,application_url,source_published_at,source_checked_at,expires_at,application_period,eligibility,benefit,easy_summary,caution,required_documents",
    status: "in.(active,expired)",
    order: "source_checked_at.desc",
  });
  if (category) query.set("category", `eq.${category}`);
  const rows = await supabaseRequest(`policies?${query.toString()}`);
  const now = Date.now();
  const staleCutoff = now - Number(process.env.POLICY_STALE_DAYS || 180) * 24 * 60 * 60 * 1000;
  const enrollmentOrder = { ongoing: 0, scheduled: 1, closed: 2 };
  const candidates = rows
    .filter((row) => /^https:\/\//i.test(row.source_url || ""))
    .filter((row) => row.source_checked_at && new Date(row.source_checked_at).getTime() >= staleCutoff)
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() >= now || row.application_period?.kind === "closed")
    .filter(isPolicyStructurallyUsable)
    .sort((left, right) => (enrollmentOrder[left.application_period?.kind] ?? 9) - (enrollmentOrder[right.application_period?.kind] ?? 9));

  const seenProducts = new Set();
  return candidates
    .filter((row) => {
      const key = `${row.category}::${row.official_title}::${row.region}`;
      if (seenProducts.has(key)) return false;
      seenProducts.add(key);
      return true;
    })
    .map(policyRowToClientPolicy);
}

async function insertJourneyEvent(event) {
  await supabaseRequest("journey_events", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=ignore-duplicates,return=minimal",
    },
    body: JSON.stringify({
      event_id: event.eventId,
      anonymous_user_id: event.anonymousUserId,
      benefit_id: event.benefitId,
      event_type: event.eventType,
      step: event.step,
      metadata: event.metadata || {},
      created_at: event.createdAt,
    }),
  });
}

async function listJourneyEvents(anonymousUserId) {
  const query = new URLSearchParams({
    select: "event_id,anonymous_user_id,benefit_id,event_type,step,metadata,created_at",
    order: "created_at.asc",
    limit: "5000",
  });
  if (anonymousUserId) query.set("anonymous_user_id", `eq.${anonymousUserId}`);
  const rows = await supabaseRequest(`journey_events?${query.toString()}`);
  return rows.map((row) => ({
    eventId: row.event_id,
    anonymousUserId: row.anonymous_user_id,
    benefitId: row.benefit_id,
    eventType: row.event_type,
    step: row.step,
    metadata: row.metadata,
    createdAt: row.created_at,
  }));
}

async function upsertPolicies(policies) {
  if (!policies.length) return;
  await supabaseRequest("policies?on_conflict=source_key", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(policies),
  });
}

async function createPolicySyncRun(sourceName) {
  const rows = await supabaseRequest("policy_sync_runs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ source_name: sourceName, status: "running" }),
  });
  return rows[0]?.id;
}

async function completePolicySyncRun(id, result) {
  if (!id) return;
  const query = new URLSearchParams({ id: `eq.${id}` });
  await supabaseRequest(`policy_sync_runs?${query.toString()}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({
      completed_at: new Date().toISOString(),
      status: result.status,
      imported_count: result.importedCount || 0,
      rejected_count: result.rejectedCount || 0,
      error_message: result.errorMessage || null,
    }),
  });
}

async function purgeJourneyEventsBefore(beforeIso) {
  const query = new URLSearchParams({ created_at: `lt.${beforeIso}` });
  await supabaseRequest(`journey_events?${query.toString()}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
}

module.exports = {
  databaseConfigured,
  checkDatabaseReadiness,
  insertJourneyEvent,
  listActivePolicies,
  listJourneyEvents,
  upsertPolicies,
  createPolicySyncRun,
  completePolicySyncRun,
  purgeJourneyEventsBefore,
  policyRowToClientPolicy,
  isPolicyStructurallyUsable,
};






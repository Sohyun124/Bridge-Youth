const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { checkDatabaseReadiness, databaseConfigured, insertJourneyEvent, listActivePolicies, listJourneyEvents, purgeJourneyEventsBefore } = require("./database");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const eventsPath = path.join(dataDir, "events.json");
const port = Number(process.env.PORT || 4173);
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
const allowedPolicyCategories = new Set(["transport", "housing", "education", "saving"]);

async function loadLocalEnv() {
  try {
    const source = await fs.readFile(path.join(rootDir, ".env"), "utf8");
    source.split(/\r?\n/).forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function readEvents() {
  try {
    return JSON.parse(await fs.readFile(eventsPath, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writeEvents(events) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(eventsPath, JSON.stringify(events, null, 2), "utf8");
}

function securityHeaders(extra = {}) {
  return {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Cross-Origin-Resource-Policy": "same-origin",
    ...extra,
  };
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, securityHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  }));
  response.end(JSON.stringify(value));
  return true;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 200_000) reject(new Error("Request body is too large"));
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

const allowedEventTypes = new Set([
  "category_select",
  "transport_form_view",
  "transport_form_exit",
  "saving_form_view",
  "saving_form_exit",
  "profile_save",
  "compare_submit",
  "comparison_results_viewed",
  "comparison_result_view",
  "category_results_viewed",
  "category_official_link_click",
  "benefit_card_click",
  "benefit_detail_view",
  "simple_explanation_view",
  "documents_view",
  "detail_section_dwell",
  "detail_scroll_depth",
  "detail_back_click",
  "detail_exit",
  "benefit_save",
  "reminder_view",
  "apply_link_click",
  "confusion_click",
  "feedback_submit",
  "interest_summary_request",
]);

const allowedSteps = new Set(["general", "category", "profile", "input", "results", "compare", "detail", "documents", "save", "reminder", "apply", "feedback", "analytics"]);
const allowedMetadataKeys = new Set([
  "sessionId",
  "comparisonId",
  "formId",
  "category",
  "resultCount",
  "topBenefitId",
  "rank",
  "estimatedSaving",
  "confidence",
  "clickElapsedSeconds",
  "elapsedSeconds",
  "sourceUrl",
  "ageGroup",
  "region",
  "status",
  "transitCostRange",
  "mobilityArea",
  "originRegion",
  "destinationRegion",
  "routeType",
  "interaction",
  "monthly15Rides",
  "usesPlusTransit",
  "bikeUsage",
  "longDistanceUse",
  "incomeAnswered",
  "housingAnswered",
  "completed",
  "nextView",
  "durationSeconds",
  "section",
  "depth",
  "seenSections",
  "scrollDepths",
  "exitAction",
  "type",
  "label",
  "categoryCount",
  "employment",
  "personalIncomeEntered",
  "personalIncomeBand",
  "householdIncomeKnown",
  "monthlyDepositBand",
  "enrollment",
  "ageInRange",
]);

function redactSensitiveText(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/(?:\+?82[-\s]?)?0?1[016789][-\s]?\d{3,4}[-\s]?\d{4}/g, "[redacted-phone]")
    .replace(/\d{6}[-\s]?\d{7}/g, "[redacted-id]");
}

function sanitizeMetadata(metadata = {}) {
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata || {})) {
    if (!allowedMetadataKeys.has(key)) continue;
    if (typeof value === "string") sanitized[key] = redactSensitiveText(value).slice(0, 300);
    else if (typeof value === "number" || typeof value === "boolean" || value === null) sanitized[key] = value;
    else if (Array.isArray(value)) sanitized[key] = value.slice(0, 20).map((item) => redactSensitiveText(item).slice(0, 100));
  }
  return sanitized;
}

function sanitizeEvent(event) {
  const eventType = String(event.eventType || "");
  if (!allowedEventTypes.has(eventType)) throw new Error("Unsupported event type");
  return {
    eventId: String(event.eventId || "").slice(0, 100),
    anonymousUserId: String(event.anonymousUserId || "").slice(0, 100),
    benefitId: event.benefitId ? String(event.benefitId).slice(0, 100) : null,
    eventType,
    step: allowedSteps.has(event.step) ? event.step : "general",
    metadata: sanitizeMetadata(event.metadata),
    createdAt: event.createdAt,
  };
}

const allowedInterestCategories = new Set(["교통비", "주거 지원", "교육·취업", "자산형성"]);

function sanitizeInterestCategories(categories) {
  if (!Array.isArray(categories)) return [];
  return categories
    .filter((item) => allowedInterestCategories.has(item.category))
    .slice(0, 4)
    .map((item) => ({
      category: item.category,
      views: Math.max(0, Number(item.views || 0)),
      saves: Math.max(0, Number(item.saves || 0)),
      links: Math.max(0, Number(item.links || 0)),
      score: Math.max(0, Number(item.score || 0)),
    }));
}

function categoryLabel(category) {
  return category === "transport" ? "교통비" :
    category === "housing" ? "주거 지원" :
    category === "education" ? "교육·취업" :
    category === "saving" ? "자산형성" : null;
}

async function getAggregateInterestCategories() {
  const [events, policies] = await Promise.all([listJourneyEvents(), listActivePolicies()]);
  const policyCategories = new Map(policies.map((policy) => [policy.id, categoryLabel(policy.category)]));
  const totals = new Map([...allowedInterestCategories].map((category) => [category, { category, views: 0, saves: 0, links: 0, score: 0 }]));
  for (const event of events) {
    const category = policyCategories.get(event.benefitId) || categoryLabel(event.metadata?.category);
    if (!category) continue;
    const item = totals.get(category);
    if (event.eventType === "benefit_detail_view" || event.eventType === "category_results_viewed") item.views += 1;
    if (event.eventType === "benefit_save") item.saves += 1;
    if (event.eventType === "apply_link_click" || event.eventType === "category_official_link_click") item.links += 1;
  }
  return [...totals.values()]
    .map((item) => ({ ...item, score: item.views + item.saves * 3 + item.links * 4 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function hasAdminDashboardAccess(request) {
  return Boolean(
    process.env.ADMIN_DASHBOARD_TOKEN &&
    request.headers["x-admin-dashboard-token"] === process.env.ADMIN_DASHBOARD_TOKEN
  );
}

async function getAdminDashboardAnalytics() {
  const [events, policies] = await Promise.all([listJourneyEvents(), listActivePolicies()]);
  const policyNames = new Map(policies.map((policy) => [policy.id, policy.title]));
  const topPolicies = new Map();
  const confusion = new Map();

  for (const event of events) {
    if (event.benefitId) {
      const item = topPolicies.get(event.benefitId) || {
        benefitId: event.benefitId,
        title: policyNames.get(event.benefitId) || "공식 정책",
        views: 0,
        saves: 0,
        officialLinkClicks: 0,
      };
      if (event.eventType === "benefit_card_click" || event.eventType === "benefit_detail_view") item.views += 1;
      if (event.eventType === "benefit_save") item.saves += 1;
      if (event.eventType === "apply_link_click" || event.eventType === "category_official_link_click") item.officialLinkClicks += 1;
      topPolicies.set(event.benefitId, item);
    }
    if (event.eventType === "feedback_submit") {
      const label = event.metadata?.label || "기타";
      confusion.set(label, (confusion.get(label) || 0) + 1);
    }
  }

  const count = (eventType) => events.filter((event) => event.eventType === eventType).length;
  const incompleteInputExits = events.filter(
    (event) => event.eventType === "transport_form_exit" && event.metadata?.completed === false
  ).length;
  return {
    generatedAt: new Date().toISOString(),
    eventCount: events.length,
    funnel: {
      inputStarted: count("transport_form_view"),
      inputAbandoned: incompleteInputExits,
      comparisonSubmitted: count("compare_submit"),
      resultsViewed: count("comparison_results_viewed"),
      detailViewed: count("benefit_detail_view"),
      officialLinkClicked: count("apply_link_click"),
    },
    topPolicies: [...topPolicies.values()]
      .map((item) => ({ ...item, interestScore: item.views + item.saves * 3 + item.officialLinkClicks * 4 }))
      .filter((item) => item.interestScore > 0)
      .sort((a, b) => b.interestScore - a.interestScore)
      .slice(0, 20),
    confusionSignals: [...confusion.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20),
  };
}
function getRequestedAnonymousUserId(request) {
  const id = new URL(request.url, `http://${request.headers.host}`).searchParams.get("anonymousUserId");
  return /^anon_[a-z0-9-]{8,100}$/i.test(id || "") ? id : null;
}
function buildLocalInterestSummary(categories) {
  if (!Array.isArray(categories) || categories.length === 0) {
    return "아직 관심 행동이 충분히 쌓이지 않았어요. 분야를 열어보거나 상세·공식 링크를 확인하면 관심 흐름을 요약해드려요.";
  }
  const top = [...categories].sort((a, b) => Number(b.score || 0) - Number(a.score || 0))[0];
  const action = top.links ? "공식 안내까지 확인했어요" : top.saves ? "저장해 두고 다시 보려 했어요" : "비교 화면을 가장 자주 확인했어요";
  return `현재는 ${top.category} 분야에 가장 관심이 있어 보여요. ${action} 이 정보는 다음에 어떤 분야를 먼저 보여줄지 정하는 데만 활용해요.`;
}

async function createInterestSummary(categories) {
  const safeCategories = sanitizeInterestCategories(categories);
  const fallback = buildLocalInterestSummary(safeCategories);
  if (!process.env.OPENAI_API_KEY) return { summary: fallback, source: "local" };

  const compactCategories = safeCategories.map((item) => ({
    category: item.category,
    views: Number(item.views || 0),
    saves: Number(item.saves || 0),
    links: Number(item.links || 0),
  }));
  const prompt = [
    "You summarize anonymized app-interest counts for a Korean youth benefit comparison service.",
    "Write exactly two short Korean sentences. Do not infer personal traits, eligibility, income, or financial advice.",
    "Use only the supplied category counts. Mention the strongest observed category if there is one, and suggest one neutral next action.",
    `Counts: ${JSON.stringify(compactCategories)}`,
  ].join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        input: prompt,
        store: false,
      }),
    });
    if (!response.ok) throw new Error("OpenAI request failed");
    const result = await response.json();
    return { summary: result.output_text || fallback, source: "openai" };
  } catch {
    return { summary: fallback, source: "local" };
  }
}

async function handleApi(request, response, pathname) {
  if (pathname === "/api/health" && request.method === "GET") {
    const readiness = await checkDatabaseReadiness();
    return sendJson(response, readiness.ok ? 200 : 503, readiness);
  }

  if (pathname === "/api/admin/dashboard" && request.method === "GET") {
    if (!databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
    if (!hasAdminDashboardAccess(request)) return sendJson(response, 401, { error: "Unauthorized" });
    return sendJson(response, 200, await getAdminDashboardAnalytics());
  }
  if (pathname === "/api/interest-summary" && request.method === "POST") {
    let body;
    try {
      body = JSON.parse(await readBody(request));
    } catch {
      return sendJson(response, 400, { error: "Invalid JSON payload" });
    }
    if (isProduction) {
      if (!databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
      return sendJson(response, 200, await createInterestSummary(await getAggregateInterestCategories()));
    }
    return sendJson(response, 200, await createInterestSummary(body.categories));
  }

  if (pathname === "/api/admin/purge-events" && request.method === "POST") {
    if (!databaseConfigured()) return sendJson(response, 503, { error: "Database is not configured" });
    if (!process.env.ADMIN_MAINTENANCE_TOKEN || request.headers["x-admin-token"] !== process.env.ADMIN_MAINTENANCE_TOKEN) {
      return sendJson(response, 401, { error: "Unauthorized" });
    }
    const retentionDays = Math.min(365, Math.max(30, Number(process.env.EVENT_RETENTION_DAYS || 90)));
    const before = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
    await purgeJourneyEventsBefore(before);
    return sendJson(response, 200, { ok: true, retentionDays });
  }

  if (pathname === "/api/policies" && request.method === "GET") {
    const category = new URL(request.url, `http://${request.headers.host}`).searchParams.get("category");
    if (category && !allowedPolicyCategories.has(category)) return sendJson(response, 400, { error: "Unsupported policy category" });
    if (!databaseConfigured()) return sendJson(response, 503, { error: "Policy database is not configured" });
    return sendJson(response, 200, { policies: await listActivePolicies(category || undefined) });
  }

  if (pathname !== "/api/events") return false;

  if (request.method === "GET") {
    if (isProduction && !databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
    const anonymousUserId = getRequestedAnonymousUserId(request);
    if (isProduction && !anonymousUserId) return sendJson(response, 400, { error: "A valid anonymousUserId is required" });
    const allEvents = databaseConfigured() ? await listJourneyEvents(anonymousUserId || undefined) : await readEvents();
    const events = databaseConfigured() || !anonymousUserId ? allEvents : allEvents.filter((event) => event.anonymousUserId === anonymousUserId);
    return sendJson(response, 200, { events, storage: databaseConfigured() ? "database" : "development-file" });
  }
  if (request.method === "POST") {
    let event;
    try {
      event = sanitizeEvent(JSON.parse(await readBody(request)));
    } catch {
      return sendJson(response, 400, { error: "Unsupported or invalid event payload" });
    }
    if (!event.eventId || !event.eventType || !event.createdAt || !event.anonymousUserId) {
      return sendJson(response, 400, { error: "eventId, anonymousUserId, eventType, createdAt are required" });
    }
    if (isProduction && !databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
    if (databaseConfigured()) await insertJourneyEvent(event);
    else {
      const events = await readEvents();
      if (!events.some((item) => item.eventId === event.eventId)) {
        events.push(event);
        await writeEvents(events);
      }
    }
    return sendJson(response, 201, { ok: true });
  }

  if (request.method === "DELETE") {
    if (isProduction && !databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
    if (databaseConfigured()) return sendJson(response, 405, { error: "Production event deletion is disabled" });
    await writeEvents([]);
    return sendJson(response, 200, { ok: true });
  }

  return sendJson(response, 405, { error: "Method not allowed" });
}

async function serveStatic(response, pathname) {
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const filePath = path.resolve(rootDir, relativePath);
  if (!filePath.startsWith(rootDir)) {
    response.writeHead(403, securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    response.end("Forbidden");
    return;
  }

  const extension = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
  };

  try {
    const content = await fs.readFile(filePath);
    const cacheControl = extension === ".html" ? "no-store" : "public, max-age=300, must-revalidate";
    const contentSecurityPolicy = extension === ".html" ? "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" : undefined;
    response.writeHead(200, securityHeaders({
      "Content-Type": contentTypes[extension] || "application/octet-stream",
      "Cache-Control": cacheControl,
      ...(contentSecurityPolicy ? { "Content-Security-Policy": contentSecurityPolicy } : {}),
    }));
    response.end(content);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    response.end(error.code === "ENOENT" ? "Not found" : "Server error");
  }
}

async function requestHandler(request, response) {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const handled = await handleApi(request, response, pathname);
    if (handled === false) await serveStatic(response, pathname);
  } catch (error) {
    sendJson(response, 500, { error: "Unable to process request" });
  }
}

const server = http.createServer(requestHandler);

if (require.main === module) {
  loadLocalEnv().then(() => {
    server.listen(port, () => {
      console.log(`Bridge Youth is running at http://localhost:${port}`);
    });
  });
}

module.exports = { server, requestHandler };
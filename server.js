const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { checkDatabaseReadiness, databaseConfigured, insertJourneyEvent, listActivePolicies, listJourneyEvents, purgeJourneyEventsBefore } = require("./database");
const { signUpMember, signInMember, getProviderAuthorizationUrl, getMember } = require("./auth");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const eventsPath = path.join(dataDir, "events.json");
const port = Number(process.env.PORT || 4173);
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.RENDER);
const allowedPolicyCategories = new Set(["transport", "housing", "education", "saving"]);
const publicFiles = new Map([
  ["/", "index.html"],
  ["/index.html", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
]);

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

function sendJson(response, statusCode, value, extraHeaders = {}) {
  response.writeHead(statusCode, securityHeaders({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  }));
  response.end(JSON.stringify(value));
  return true;
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let byteLength = 0;
    let tooLarge = false;
    request.on("data", (chunk) => {
      byteLength += chunk.length;
      if (byteLength > 200_000) {
        tooLarge = true;
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => {
      if (tooLarge) return reject(new Error("Request body is too large"));
      return resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });
}

function getClientAddress(request) {
  if (process.env.TRUST_PROXY === "true") {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  }
  return request.socket.remoteAddress || "unknown";
}

function createRateLimiter(limit, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const current = (hits.get(key) || []).filter((timestamp) => now - timestamp < windowMs);
    if (current.length >= limit) {
      hits.set(key, current);
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current[0])) / 1000)) };
    }
    current.push(now);
    hits.set(key, current);
    if (hits.size > 5_000) {
      for (const [candidate, timestamps] of hits) {
        if (!timestamps.some((timestamp) => now - timestamp < windowMs)) hits.delete(candidate);
      }
    }
    return { allowed: true };
  };
}

const eventWriteLimiter = createRateLimiter(60, 60_000);
const interestSummaryLimiter = createRateLimiter(8, 60 * 60_000);

function rejectIfRateLimited(response, limiter, request) {
  const result = limiter(getClientAddress(request));
  if (result.allowed) return false;
  return sendJson(response, 429, { error: "Too many requests. Please try again later." }, { "Retry-After": String(result.retryAfterSeconds) });
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

function cookieValue(request, name) {
  return String(request.headers.cookie || "").split(/;\s*/).find((item) => item.startsWith(`${name}=`))?.slice(name.length + 1) || null;
}
function sessionCookie(token, expiresIn) {
  return `bridge_access_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.max(60, Number(expiresIn || 3600))}${isProduction ? "; Secure" : ""}`;
}
function clearSessionCookie() { return `bridge_access_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isProduction ? "; Secure" : ""}`; }
function publicAppUrl(request) {
  const configured = String(process.env.APP_BASE_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  const protocol = isProduction ? "https" : "http";
  return `${protocol}://${request.headers.host}`;
}
function isStrongPassword(value) {
  return typeof value === "string" && value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value);
}
function isStaff(member) {
  return Boolean(member && ["staff", "admin"].includes(member.role));
}
async function currentMember(request) {
  const token = cookieValue(request, "bridge_access_token");
  if (!token) return null;
  try { return await getMember(token); } catch { return null; }
}
async function handleApi(request, response, pathname) {
  if (pathname === "/api/auth/signup" && request.method === "POST") {
    try {
      const { email, password, nickname, consent } = JSON.parse(await readBody(request));
      const normalizedEmail = String(email || "").trim().toLowerCase();
      const normalizedNickname = String(nickname || "").trim();
      if (!consent || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || normalizedNickname.length < 2 || normalizedNickname.length > 40 || !isStrongPassword(String(password || ""))) {
        return sendJson(response, 400, { error: "Invalid sign-up details" });
      }
      await signUpMember({ email: normalizedEmail, password: String(password), nickname: normalizedNickname, redirectTo: publicAppUrl(request) });
      return sendJson(response, 201, { ok: true, message: "Check your email to confirm your account." });
    } catch { return sendJson(response, 400, { error: "Unable to create account" }); }
  }
  if (pathname === "/api/auth/google" && request.method === "GET") {
    try {
      const location = getProviderAuthorizationUrl("google", publicAppUrl(request));
      response.writeHead(302, securityHeaders({ Location: location, "Cache-Control": "no-store" }));
      response.end();
      return true;
    } catch { return sendJson(response, 503, { error: "Google sign-in is unavailable" }); }
  }
  if (pathname === "/api/auth/session" && request.method === "POST") {
    try {
      const { accessToken, expiresIn } = JSON.parse(await readBody(request));
      const member = await getMember(String(accessToken || ""));
      if (!member) return sendJson(response, 401, { error: "Unauthorized" });
      return sendJson(response, 200, { ok: true, member }, { "Set-Cookie": sessionCookie(String(accessToken), expiresIn) });
    } catch { return sendJson(response, 401, { error: "Unauthorized" }); }
  }
  if (pathname === "/api/auth/login" && request.method === "POST") {
    try {
      const { email, password } = JSON.parse(await readBody(request));
      const session = await signInMember({ email: String(email || "").trim().toLowerCase(), password: String(password || "") });
      return sendJson(response, 200, { ok: true }, { "Set-Cookie": sessionCookie(session.access_token, session.expires_in) });
    } catch { return sendJson(response, 401, { error: "Invalid email or password" }); }
  }
  if (pathname === "/api/auth/me" && request.method === "GET") {
    const member = await currentMember(request);
    return member ? sendJson(response, 200, { member }) : sendJson(response, 401, { error: "Unauthorized" });
  }
  if (pathname === "/api/auth/logout" && request.method === "POST") return sendJson(response, 200, { ok: true }, { "Set-Cookie": clearSessionCookie() });
  if (pathname === "/api/health" && request.method === "GET") {
    const readiness = await checkDatabaseReadiness();
    return sendJson(response, readiness.ok ? 200 : 503, readiness);
  }

  if (pathname === "/api/admin/dashboard" && request.method === "GET") {
    if (!databaseConfigured()) return sendJson(response, 503, { error: "Event database is not configured" });
    const member = await currentMember(request);
    if (!isStaff(member)) return sendJson(response, 401, { error: "Unauthorized" });
    return sendJson(response, 200, await getAdminDashboardAnalytics());
  }
  if (pathname === "/api/interest-summary" && request.method === "POST") {
    const member = await currentMember(request);
    if (!isStaff(member)) return sendJson(response, 401, { error: "Unauthorized" });
    if (rejectIfRateLimited(response, interestSummaryLimiter, request)) return true;
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

  if (request.method === "POST") {
    if (rejectIfRateLimited(response, eventWriteLimiter, request)) return true;
    let event;
    try {
      event = sanitizeEvent(JSON.parse(await readBody(request)));
    } catch {
      return sendJson(response, 400, { error: "Unsupported or invalid event payload" });
    }
    if (!event.eventId || !event.eventType || !event.createdAt || !event.anonymousUserId) {
      return sendJson(response, 400, { error: "eventId, anonymousUserId, eventType, createdAt are required" });
    }
    const createdAt = Date.parse(event.createdAt);
    if (!Number.isFinite(createdAt) || createdAt > Date.now() + 5 * 60_000 || createdAt < Date.now() - 120 * 24 * 60 * 60_000) {
      return sendJson(response, 400, { error: "createdAt must be a recent valid timestamp" });
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

  return sendJson(response, 405, { error: "Method not allowed" });
}

async function serveStatic(request, response, pathname) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET, HEAD" });
  }
  const filename = publicFiles.get(pathname);
  if (!filename) {
    response.writeHead(404, securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    response.end("Not found");
    return;
  }

  const filePath = path.join(rootDir, filename);
  const extension = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
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
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    response.writeHead(500, securityHeaders({ "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }));
    response.end("Server error");
  }
}
const server = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
    const handled = await handleApi(request, response, pathname);
    if (handled === false) await serveStatic(request, response, pathname);
  } catch (error) {
    sendJson(response, 500, { error: "Unable to process request" });
  }
});

server.headersTimeout = 10_000;
server.requestTimeout = 15_000;
server.keepAliveTimeout = 5_000;

if (require.main === module) {
  loadLocalEnv().then(() => {
    server.listen(port, () => {
      console.log(`Bridge Youth is running at http://localhost:${port}`);
    });
  });
}

module.exports = server;







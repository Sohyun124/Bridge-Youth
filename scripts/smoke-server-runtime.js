const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const eventsPath = path.join(rootDir, "data", "events.json");

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function removeEventsFile() {
  try {
    await fs.rm(eventsPath, { force: true });
  } catch {}
}

async function startServer(env) {
  const child = spawn(process.execPath, ["server.js"], {
    cwd: rootDir,
    env: { ...process.env, ...env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "", OPENAI_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let output = "";
  child.stdout.on("data", (chunk) => output += chunk.toString());
  child.stderr.on("data", (chunk) => output += chunk.toString());
  for (let i = 0; i < 30; i += 1) {
    if (output.includes("Bridge Youth is running")) return child;
    if (child.exitCode !== null) throw new Error(`Server exited early: ${output}`);
    await delay(100);
  }
  child.kill();
  throw new Error(`Server did not start: ${output}`);
}

async function stopServer(child) {
  if (!child || child.exitCode !== null) return;
  child.kill();
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    delay(2000),
  ]);
}

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${pathName} did not return JSON: ${text}`);
  }
  return { status: response.status, body, headers: response.headers };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertSecurityHeaders(response, context) {
  assert(response.headers.get("x-content-type-options") === "nosniff", `${context} missing nosniff header`);
  assert(response.headers.get("referrer-policy") === "strict-origin-when-cross-origin", `${context} missing referrer policy`);
  assert(response.headers.get("permissions-policy")?.includes("camera=()"), `${context} missing permissions policy`);
}

async function checkDevelopmentMode() {
  await removeEventsFile();
  const port = "4191";
  const child = await startServer({ NODE_ENV: "development", PORT: port });
  const baseUrl = `http://localhost:${port}`;
  try {
    const event = {
      eventId: "evt_runtime_privacy",
      anonymousUserId: "anon_runtime_privacy",
      eventType: "feedback_submit",
      step: "feedback",
      createdAt: "2026-07-19T00:00:00.000Z",
      metadata: {
        label: "email user@example.com phone 010-1234-5678 id 900101-1234567",
        unexpected: "drop me",
      },
    };
    const post = await requestJson(baseUrl, "/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
    assert(post.status === 201, `development event POST returned ${post.status}`);
    assertSecurityHeaders(post, "event POST");
    assert(post.headers.get("cache-control") === "no-store", "event POST should be no-store");
    const events = await requestJson(baseUrl, "/api/events");
    assert(events.status === 200, `development event GET returned ${events.status}`);
    assert(events.body.storage === "development-file", "development storage should be development-file");
    const ownEvents = await requestJson(baseUrl, `/api/events?anonymousUserId=${event.anonymousUserId}`);
    assert(ownEvents.status === 200, `anonymous event GET returned ${ownEvents.status}`);
    assert(ownEvents.body.events.every((item) => item.anonymousUserId === event.anonymousUserId), "anonymous event GET returned another user event");
    const saved = events.body.events.find((item) => item.eventId === event.eventId);
    assert(saved, "saved development event not found");
    assert(saved.metadata.label.includes("[redacted-email]"), "email was not redacted");
    assert(saved.metadata.label.includes("[redacted-phone]"), "phone was not redacted");
    assert(saved.metadata.label.includes("[redacted-id]"), "id was not redacted");
    assert(saved.metadata.unexpected === undefined, "unexpected metadata key was not dropped");
    const invalidCategory = await requestJson(baseUrl, "/api/policies?category=invalid-category");
    assert(invalidCategory.status === 400, `invalid policy category returned ${invalidCategory.status}`);
    assertSecurityHeaders(invalidCategory, "invalid category");
    const home = await fetch(`${baseUrl}/`);
    assert(home.status === 200, `home returned ${home.status}`);
    assert(home.headers.get("content-security-policy")?.includes("default-src 'self'"), "home missing CSP");
    assert(home.headers.get("cache-control") === "no-store", "home should be no-store");
    assertSecurityHeaders({ headers: home.headers }, "home");
  } finally {
    await stopServer(child);
    await removeEventsFile();
  }
}

async function checkProductionMode() {
  const port = "4192";
  const child = await startServer({ NODE_ENV: "production", PORT: port });
  const baseUrl = `http://localhost:${port}`;
  try {
    const health = await requestJson(baseUrl, "/api/health");
    assert(health.status === 503, `production health without DB returned ${health.status}`);
    assertSecurityHeaders(health, "production health");
    assert(health.headers.get("cache-control") === "no-store", "production health should be no-store");
    assert(health.body.database === "missing_configuration", "production health should report missing DB configuration");
    assert(health.body.checks?.policies === false && health.body.checks?.journeyEvents === false, "production health should expose failed table checks");

    const invalid = await requestJson(baseUrl, "/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: "evt_bad", anonymousUserId: "anon_bad", eventType: "unsupported", createdAt: "2026-07-19T00:00:00.000Z" }),
    });
    assert(invalid.status === 400, `invalid production event returned ${invalid.status}`);

    const events = await requestJson(baseUrl, "/api/events");
    assert(events.status === 503, `production event GET without DB returned ${events.status}`);
    const policies = await requestJson(baseUrl, "/api/policies?category=transport");
    assert(policies.status === 503, `production policies without DB returned ${policies.status}`);
  } finally {
    await stopServer(child);
  }
}

async function main() {
  await checkDevelopmentMode();
  await checkProductionMode();
  console.log("Server runtime smoke validation passed");
}

main().catch(async (error) => {
  await removeEventsFile();
  console.error(error.message);
  process.exitCode = 1;
});




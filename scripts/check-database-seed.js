const requiredSeeds = [
  { sourceKey: "official:korea-pass:intro", category: "transport", status: "active", applicationUrl: "https://korea-pass.kr/join/join.do", applicationPeriodKind: "ongoing" },
  { sourceKey: "official:seoul:youth-climate-card", category: "transport", status: "active", applicationUrl: null, applicationPeriodKind: "ongoing" },
  { sourceKey: "official:jongno:bus-support-2026", category: "transport", status: "active", applicationUrl: "https://tbokji.tmoney.co.kr/jongno", applicationPeriodKind: "ongoing" },
  { sourceKey: "official:seoul:youth-monthly-rent-2026", category: "housing", status: "expired" },
  { sourceKey: "official:seoul:youth-allowance-2026-2nd", category: "education", status: "expired" },
  { sourceKey: "official:fsc:youth-future-savings-2026", category: "saving", status: "expired" },
];

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}

async function supabaseGet(path) {
  const url = requireEnv("SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed ${response.status}: ${text}`);
  return text ? JSON.parse(text) : [];
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

async function main() {
  const sourceKeys = requiredSeeds.map((item) => item.sourceKey).join(",");
  const query = new URLSearchParams({
    select: "source_key,category,status,source_url,application_url,application_period,source_checked_at,expires_at,required_documents",
    source_key: `in.(${sourceKeys})`,
    order: "source_key.asc",
  });
  const rows = await supabaseGet(`policies?${query.toString()}`);
  const byKey = new Map(rows.map((row) => [row.source_key, row]));

  for (const expected of requiredSeeds) {
    const row = byKey.get(expected.sourceKey);
    if (!row) {
      fail(`Missing seeded policy: ${expected.sourceKey}`);
      continue;
    }
    if (row.category !== expected.category) fail(`${expected.sourceKey} category ${row.category}, expected ${expected.category}`);
    if (row.status !== expected.status) fail(`${expected.sourceKey} status ${row.status}, expected ${expected.status}`);
    if (!/^https:\/\//i.test(row.source_url || "")) fail(`${expected.sourceKey} does not have an official HTTPS source URL`);
    if (!row.source_checked_at) fail(`${expected.sourceKey} missing source_checked_at`);
    if ((row.application_url || null) !== (expected.applicationUrl || null)) fail(`${expected.sourceKey} application_url did not match the verified official route`);
    if (expected.applicationPeriodKind && row.application_period?.kind !== expected.applicationPeriodKind) fail(`${expected.sourceKey} application_period kind did not match the verified official state`);
    if (!Array.isArray(row.required_documents)) fail(`${expected.sourceKey} required_documents must be an array`);
    if (row.status === "expired" && !row.expires_at) fail(`${expected.sourceKey} expired row must have expires_at`);
  }

  const activeTransport = rows.filter((row) => row.category === "transport" && row.status === "active").length;
  if (activeTransport < 3) fail("Expected at least three active transport policies after seed migration");
  if (process.exitCode) process.exit(process.exitCode);
  console.log("Database seed check passed");
}

main().catch((error) => {
  fail(error.message);
});

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value.replace(/\/$/, "");
}

async function supabaseRequest(path, options = {}) {
  const url = requireEnv("SUPABASE_URL");
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

async function main() {
  const limit = String(Math.min(100, Math.max(1, Number(process.env.REVIEW_LIMIT || 25))));
  const query = new URLSearchParams({
    select: "id,source_key,category,official_title,provider,region,source_url,application_url,source_published_at,source_checked_at,application_period,eligibility,benefit,easy_summary,caution,raw_source",
    status: "eq.needs_review",
    order: "source_checked_at.desc",
    limit,
  });
  const rows = await supabaseRequest(`policies?${query.toString()}`);
  const output = rows.map((row) => ({
    id: row.id,
    sourceKey: row.source_key,
    category: row.category,
    title: row.official_title,
    provider: row.provider,
    region: row.region,
    sourceUrl: row.source_url,
    applicationUrl: row.application_url,
    sourcePublishedAt: row.source_published_at,
    applicationPeriod: row.application_period,
    sourceCheckedAt: row.source_checked_at,
    eligibility: row.eligibility,
    benefit: row.benefit,
    currentSummary: row.easy_summary,
    currentCaution: row.caution,
  }));
  console.log(JSON.stringify({ count: output.length, policies: output }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

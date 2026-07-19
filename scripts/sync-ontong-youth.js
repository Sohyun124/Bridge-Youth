const { createHash } = require("crypto");
const {
  completePolicySyncRun,
  createPolicySyncRun,
  databaseConfigured,
  upsertPolicies,
} = require("../database");

const endpoint = process.env.YOUTH_POLICY_API_URL || "https://www.youthcenter.go.kr/opi/youthPlcyList.do";
const apiKey = process.env.YOUTH_POLICY_API_KEY;
const display = Number(process.env.YOUTH_POLICY_PAGE_SIZE || 100);
const page = Number(process.env.YOUTH_POLICY_PAGE || 1);

function decodeXml(value = "") {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function tagValue(xml, names) {
  for (const name of names) {
    const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
    if (match) return decodeXml(match[1].replace(/<[^>]+>/g, " "));
  }
  return "";
}

function extractRecords(xml) {
  const records = xml.match(/<(?:item|youthPolicy|youthPlcy)>[\s\S]*?<\/(?:item|youthPolicy|youthPlcy)>/gi) || [];
  return records.map((record) => ({
    sourceKey: tagValue(record, ["plcyNo", "plcyId", "policyId", "id"]),
    title: tagValue(record, ["plcyNm", "policyName", "title"]),
    provider: tagValue(record, ["operInstCdNm", "sprvsnInstCdNm", "provider", "instNm"]),
    region: tagValue(record, ["zipCd", "rgnSeCd", "region"]) || "전국",
    sourceUrl: tagValue(record, ["plcyUrl", "policyUrl", "rfrncUrl", "url"]),
    age: tagValue(record, ["ageInfo", "age", "ageRange"]),
    income: tagValue(record, ["incomeCd", "income", "incomeInfo"]),
    residence: tagValue(record, ["addAplcnQlfcCndCn", "residence", "resident"]),
    benefit: tagValue(record, ["plcySprtCn", "benefit", "supportContent"]),
    application: tagValue(record, ["aplyYmd", "aplyPeriod", "applicationPeriod"]),
    raw: record,
  }));
}

function normalizeRecord(record) {
  if (!record.sourceKey || !record.title || !/^https:\/\//i.test(record.sourceUrl)) return null;
  const id = `ontong-${createHash("sha256").update(record.sourceKey).digest("hex").slice(0, 20)}`;
  return {
    id,
    source_key: `ontong:${record.sourceKey}`,
    category: process.env.YOUTH_POLICY_CATEGORY || "education",
    official_title: record.title,
    provider: record.provider || "공식 기관 확인 필요",
    region: record.region,
    source_url: record.sourceUrl,
    source_checked_at: new Date().toISOString(),
    status: "needs_review",
    eligibility: { age: record.age, income: record.income, residence: record.residence },
    benefit: { description: record.benefit, applicationPeriod: record.application },
    application_period: { kind: "needs_review", raw: record.application },
    easy_summary: "공식 공고를 검토한 뒤 쉬운 설명을 등록합니다.",
    caution: "현재 공식 공고 원문 조건을 검토 중입니다. 검수 전에는 사용자에게 표시하지 않습니다.",
    required_documents: [],
    raw_source: { source: "ontong-youth-open-api", rawXml: record.raw },
  };
}

async function main() {
  if (!databaseConfigured()) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  if (!apiKey) throw new Error("YOUTH_POLICY_API_KEY is required");
  const syncId = await createPolicySyncRun("ontong-youth-open-api");
  try {
    const url = new URL(endpoint);
    url.searchParams.set("openApiVlak", apiKey);
    url.searchParams.set("pageIndex", String(page));
    url.searchParams.set("display", String(display));
    if (process.env.YOUTH_POLICY_QUERY) url.searchParams.set("query", process.env.YOUTH_POLICY_QUERY);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`OnTongYouth API request failed: ${response.status}`);
    const records = extractRecords(await response.text());
    const policies = records.map(normalizeRecord).filter(Boolean);
    await upsertPolicies(policies);
    await completePolicySyncRun(syncId, { status: "success", importedCount: policies.length, rejectedCount: records.length - policies.length });
    console.log(JSON.stringify({ imported: policies.length, rejected: records.length - policies.length }));
  } catch (error) {
    await completePolicySyncRun(syncId, { status: "failed", errorMessage: error.message });
    throw error;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});



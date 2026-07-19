const fs = require("fs");
const path = require("path");
const { isPolicyStructurallyUsable, policyRowToClientPolicy } = require("../database");

const mockRow = {
  id: "contract-policy",
  official_title: "계약 검증 정책",
  category: "transport",
  provider: "공식 기관",
  region: "전국",
  source_url: "https://official.example.test/policy",
  application_url: "https://official.example.test/apply",
  source_published_at: "2026-07-01T00:00:00+09:00",
  source_checked_at: "2026-07-19T00:00:00+09:00",
  expires_at: null,
  application_period: { kind: "ongoing", startsAt: null, endsAt: null, label: "상시 신청" },
  eligibility: { minAge: 19, maxAge: 34, minMonthlyRides: 15 },
  benefit: { type: "refund", refundRate: 0.3, calculationType: "monthly_transit_cost_refund" },
  easy_summary: "공식 데이터를 쉬운 말로 설명합니다.",
  caution: "공식 공고 기준 실제 신청 가능 여부와 세부 금액은 기관 안내에서 다시 확인해야 합니다.",
  required_documents: ["공식 신분 확인 서류", "공식 신청서"],
};

const policy = policyRowToClientPolicy(mockRow);
const requiredClientFields = [
  "id",
  "title",
  "category",
  "provider",
  "sourceName",
  "region",
  "sourceUrl",
  "applicationUrl",
  "applicationPeriod",
  "sourceUpdatedAt",
  "sourcePublishedAt",
  "summary",
  "caution",
  "documents",
  "minAge",
  "maxAge",
  "type",
  "calculationType",
];

const failures = [];
for (const field of requiredClientFields) {
  if (policy[field] === undefined || policy[field] === null || policy[field] === "") failures.push(`Missing mapped client field: ${field}`);
}
if (!Array.isArray(policy.documents)) failures.push("Mapped documents must be an array");
if (Object.prototype.hasOwnProperty.call(policy, "docs")) failures.push("Client policy must use documents, not docs");
if (!/^https:\/\//i.test(policy.sourceUrl)) failures.push("Mapped sourceUrl must be HTTPS");
if (!/^https:\/\//i.test(policy.applicationUrl)) failures.push("Mapped applicationUrl must be HTTPS");
if (!isPolicyStructurallyUsable(mockRow)) failures.push("Valid transport policy row should be structurally usable");
if (policy.applicationPeriod?.kind !== "ongoing") failures.push("Mapped application period must preserve the official kind");
const missingApplicationPeriod = {
  ...mockRow,
  id: "missing-application-period",
  application_period: {},
};
if (isPolicyStructurallyUsable(missingApplicationPeriod)) failures.push("Active-result policy without a structured application period must not be structurally usable");
const missingSourceBasisDate = {
  ...mockRow,
  id: "missing-source-basis-date",
  source_published_at: null,
};
if (isPolicyStructurallyUsable(missingSourceBasisDate)) failures.push("Active-result policy without an official basis date must not be structurally usable");
const invalidSourceBasisDate = {
  ...mockRow,
  id: "invalid-source-basis-date",
  source_published_at: "not-a-date",
};
if (isPolicyStructurallyUsable(invalidSourceBasisDate)) failures.push("Active-result policy with an invalid official basis date must not be structurally usable");
const malformedTransport = {
  ...mockRow,
  id: "malformed-transport",
  benefit: { type: "refund", calculationType: "monthly_transit_cost_refund" },
};
if (isPolicyStructurallyUsable(malformedTransport)) failures.push("Malformed transport policy without refundRate must not be structurally usable");
const reviewOnlyRow = {
  ...mockRow,
  id: "review-only-policy",
  easy_summary: "공식 공고를 검토한 뒤 쉬운 설명을 등록합니다.",
};
if (isPolicyStructurallyUsable(reviewOnlyRow)) failures.push("Review-only policy text must not be structurally usable for active results");

const appSource = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
if (/benefit\.docs\b/.test(appSource)) failures.push("app.js still references benefit.docs");
if (!appSource.includes('function sourceMetaLine')) failures.push('app.js must centralize official source/basis/update display');
if (!appSource.includes('기준일') || !appSource.includes('갱신일')) failures.push('app.js must display source basis and update dates');
for (const field of ["sourceName", "sourceUpdatedAt",
  "sourcePublishedAt", "documents", "sourceUrl", "applicationUrl", "applicationPeriod"]) {
  if (!appSource.includes(`benefit.${field}`)) failures.push(`app.js does not reference expected client field benefit.${field}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("API/client contract validation passed");





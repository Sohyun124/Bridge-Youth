const fs = require("fs");
const path = require("path");

try {
  const source = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
  source.split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  });
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}

const { upsertPolicies } = require("../server/database");

const policy = {
  id: "youth-future-savings-2026-scheduled",
  source_key: "official:kinfa:youth-future-savings-2026-scheduled",
  category: "saving",
  official_title: "청년미래적금",
  provider: "서민금융진흥원",
  region: "전국",
  source_url: "https://ylaccount.kinfa.or.kr/yfs/main",
  application_url: "https://ylaccount.kinfa.or.kr/yfs/main",
  source_published_at: "2026-07-19T00:00:00+09:00",
  source_checked_at: "2026-07-19T00:00:00+09:00",
  expires_at: null,
  application_period: {
    kind: "scheduled",
    startsAt: "2026-07-27T00:00:00+09:00",
    endsAt: "2026-08-07T23:59:59+09:00",
    label: "최초 가입 예정: 2026년 7월 27일~8월 7일",
  },
  status: "active",
  eligibility: {
    minAge: 19,
    maxAge: 34,
    income: "직전 과세기간 총급여 7,500만원 이하 및 종합소득금액 6,300만원 이하 등 공식 심사 필요",
    householdIncome: "가구원 합산 소득 기준중위소득 요건 및 가구원 동의 공식 확인 필요",
    employment: "우대형은 중소기업 재직 또는 신규취업 요건 공식 확인 필요",
  },
  benefit: {
    type: "matched_savings",
    monthlyLimit: 500000,
    termMonths: 36,
    matchRateGeneral: 0.06,
    matchRatePreferred: 0.12,
    maxMonthlyGovernmentContribution: 60000,
    calculationType: "government_contribution_only_excluding_bank_interest",
    duplicateCondition: "청년희망적금·청년도약계좌 보유자는 중복 가입 불가. 다른 자산형성 상품은 각 사업의 중복 제한을 공식 확인 필요",
  },
  easy_summary: "월 최대 50만원을 3년간 납입하는 청년 자산형성 상품입니다. 일반형은 월 납입액의 6%, 우대형은 12% 정부기여금이 안내되어 있으며 은행 이자는 취급기관 상품설명서에서 별도 확인해야 합니다.",
  caution: "가입 요건 심사에 4~6주가 걸릴 수 있습니다. 중도해지·납입중지·중소기업 근속 요건 미충족 시 정부기여금 또는 과세 혜택이 달라질 수 있으므로 공식 안내와 취급기관 설명서를 확인하세요.",
  required_documents: ["신분증", "소득 확인 자료 또는 행정정보 조회 동의", "가구원 소득 확인 동의", "우대형 해당 시 중소기업 확인 자료"],
  raw_source: { source: "kinfa_yfs_official", checkedBy: "manual_official_review" },
};

upsertPolicies([policy])
  .then(() => console.log(`Applied official saving policy: ${policy.id}`))
  .catch((error) => {
    console.error(`Failed to apply official saving policy: ${error.message}`);
    process.exitCode = 1;
  });

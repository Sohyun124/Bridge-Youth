const fs = require("fs");
const path = require("path");

const seedPath = path.join(__dirname, "..", "supabase", "migrations", "202607190001_seed_official_policies.sql");
const sql = fs.readFileSync(seedPath, "utf8");
const failures = [];

const requiredSourceKeys = [
  "official:korea-pass:intro",
  "official:seoul:youth-climate-card",
  "official:jongno:bus-support-2026",
  "official:seoul:youth-monthly-rent-2026",
  "official:seoul:youth-allowance-2026-2nd",
  "official:fsc:youth-future-savings-2026",
];

for (const key of requiredSourceKeys) {
  if (!sql.includes(`'${key}'`)) failures.push(`Missing source key: ${key}`);
}

if (/https?:\/\/example\.com/i.test(sql)) failures.push("Seed contains example.com URL");
if (/http:\/\//i.test(sql)) failures.push("Seed contains non-HTTPS URL");
if (/dummy|fake|sample only|lorem ipsum/i.test(sql)) failures.push("Seed contains placeholder wording");
if (!/source_checked_at/i.test(sql)) failures.push("Seed does not set source_checked_at");
if (!/application_url/i.test(sql)) failures.push("Seed does not define application_url");
if (!/application_period/i.test(sql)) failures.push("Seed does not define structured application_period");
if ((sql.match(/"kind":"ongoing"/g) || []).length < 3) failures.push("Active transport policies must include structured ongoing application periods");
if (!sql.includes("https://korea-pass.kr/join/join.do")) failures.push("K-pass seed must include the official enrollment URL");
if (!sql.includes("https://tbokji.tmoney.co.kr/jongno")) failures.push("Jongno seed must include the official application URL");
const schemaSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202607180001_create_bridge_youth_tables.sql"), "utf8");
const basisMigrationSql = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202607190002_require_active_policy_basis_date.sql"), "utf8");
if (!/active_policies_require_source_basis_date/i.test(basisMigrationSql)) failures.push("Active policy database constraint must require an official basis date");
for (const date of ["2026-04-01T00:00:00+09:00", "2026-06-08T00:00:00+09:00", "2026-01-05T00:00:00+09:00"]) {
  if (!sql.includes(`'${date}'`)) failures.push(`Missing verified active-policy basis date: ${date}`);
}
if (!/status\s*=\s*excluded\.status/i.test(sql)) failures.push("Seed upsert does not preserve reviewed status field");
if (!sql.includes("https://news.seoul.go.kr/traffic/archives/510963")) failures.push("Climate card seed must use the current Seoul traffic official guide URL");
if (!sql.includes("서울특별시 교통 안내")) failures.push("Climate card provider must match the Seoul traffic official guide source");
if (!sql.includes("\"passCost\":55000")) failures.push("Climate card youth pass cost must be 55,000 KRW according to the official youth fare guide");
if (!sql.includes("\"ddareungiAddOn\":3000")) failures.push("Climate card Ddareungi add-on must keep the 3,000 KRW official difference");

const activeCount = (sql.match(/'active'/g) || []).length;
const expiredCount = (sql.match(/'expired'/g) || []).length;
if (activeCount < 3) failures.push("Expected at least three active official transport policies");
if (expiredCount < 3) failures.push("Expected expired official records for non-current category coverage");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Official policy seed validation passed");



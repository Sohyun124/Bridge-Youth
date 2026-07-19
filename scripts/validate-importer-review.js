const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "sync-ontong-youth.js"), "utf8");
const failures = [];

for (const snippet of [
  'status: "needs_review"',
  'provider: record.provider || "공식 기관 확인 필요"',
  'easy_summary: "공식 공고를 검토한 뒤 쉬운 설명을 등록합니다."',
  'caution: "현재 공식 공고 원문 조건을 검토 중입니다. 검수 전에는 사용자에게 표시하지 않습니다."',
  'region: tagValue(record, ["zipCd", "rgnSeCd", "region"]) || "전국"',
]) {
  if (!source.includes(snippet)) failures.push(`Missing importer review guard: ${snippet}`);
}

if (/�|\?꾧뎅|怨듭떇|寃|깅줉|묒엯/.test(source)) failures.push("Importer contains mojibake Korean review text");
if (/status:\s*"active"/.test(source)) failures.push("Importer must not activate policies before human review");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Importer review guard validation passed");

const fs = require("fs");
const path = require("path");

const migration = fs.readFileSync(path.join(__dirname, "..", "supabase", "migrations", "202607180001_create_bridge_youth_tables.sql"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const failures = [];

function extractServerSet(name) {
  const match = server.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`));
  if (!match) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1]).sort();
}

function extractSqlValues(columnName) {
  const match = migration.match(new RegExp(`${columnName}[^\n]*check \\(\\s*${columnName} in \\(\\s*([\\s\\S]*?)\\s*\\)\\s*\\)`, "i"));
  if (!match) return [];
  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]).sort();
}

function compareSet(name, serverValues, sqlValues) {
  const missingInSql = serverValues.filter((value) => !sqlValues.includes(value));
  const missingInServer = sqlValues.filter((value) => !serverValues.includes(value));
  if (missingInSql.length) failures.push(`${name} missing in SQL: ${missingInSql.join(", ")}`);
  if (missingInServer.length) failures.push(`${name} missing in server allowlist: ${missingInServer.join(", ")}`);
}

compareSet("event_type", extractServerSet("allowedEventTypes"), extractSqlValues("event_type"));
compareSet("step", extractServerSet("allowedSteps"), extractSqlValues("step"));

for (const snippet of [
  "region text not null default '전국'",
  "application_url text check (application_url is null or application_url ~ '^https://')",
  "application_period jsonb not null default '{}'::jsonb check (jsonb_typeof(application_period) = 'object')",
  "jsonb_typeof(eligibility) = 'object'",
  "jsonb_typeof(benefit) = 'object'",
  "jsonb_typeof(required_documents) = 'array'",
  "jsonb_typeof(raw_source) = 'object'",
  "jsonb_typeof(metadata) = 'object'",
]) {
  if (!migration.includes(snippet)) failures.push(`Missing migration constraint/default: ${snippet}`);
}

if (/\?꾧뎅/.test(migration)) failures.push("Migration still contains mojibake default region text");

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Migration constraint validation passed");

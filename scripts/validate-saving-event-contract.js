const fs = require("fs");
const path = require("path");

const appSource = fs.readFileSync(path.join(__dirname, "..", "client.js"), "utf8");
const serverSource = fs.readFileSync(path.join(__dirname, "..", "server.js"), "utf8");
const failures = [];

const eventTypes = [
  "saving_form_view",
  "saving_form_exit",
  "compare_submit",
  "comparison_results_viewed",
  "comparison_result_view",
  "benefit_card_click",
  "benefit_detail_view",
  "benefit_save",
  "apply_link_click",
  "feedback_submit",
];
for (const eventType of eventTypes) {
  if (!serverSource.includes(`"${eventType}"`)) failures.push(`Server does not allow ${eventType}`);
}
for (const legacyType of ["saving_compare_submit", "saving_results_viewed"]) {
  if (appSource.includes(`"${legacyType}"`)) failures.push(`Client still emits unsupported ${legacyType}`);
}
if (appSource.includes('"saving_compare"')) failures.push("Client still uses an unsupported saving_compare event step");
for (const key of ["employment", "personalIncomeEntered", "personalIncomeBand", "householdIncomeKnown", "monthlyDepositBand", "enrollment", "ageInRange"]) {
  if (!serverSource.includes(`"${key}"`)) failures.push(`Server does not retain approved anonymous metric ${key}`);
}
for (const snippet of ["function startSavingForm", "function finishSavingForm", "loadSavingPolicies().then", "입력 조건 기준 예상은 비교에서 다시 계산"]) {
  if (!appSource.includes(snippet)) failures.push(`Missing saving flow safeguard: ${snippet}`);
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log("Saving event contract validation passed");
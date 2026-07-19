# Production Audit - Bridge Youth

Audited: 2026-07-19

| ID | Auditor | Severity | Area | Issue | Evidence | Fix | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PA-01 | Data / Recommendation | Critical | Data | Policy results must not be hard-coded or fabricated in the client. | `app.js` now renders only `/api/policies` results; `/api/policies` requires DB configuration. | `database.js` returns only `active` policies with official HTTPS URLs, non-expired dates, and fresh `source_checked_at`; official seed migration added. | Fixed in code; DB migration application pending |
| PA-02 | Analytics / Technical | Critical | Data | Production events must not fall back to local files or store arbitrary client metadata. | `server.js` now returns `503 Event database is not configured` in production when Supabase is missing and sanitizes allowed event types, steps, and metadata keys before storage. | Use `journey_events` in Supabase with server-only service-role credentials. | Fixed in code; DB connection pending |
| PA-03 | Privacy | High | Privacy | Production privacy notice and retention period must be surfaced. | `index.html` includes a dedicated privacy section with collected/not-collected data, 90-day retention, deletion basis, and AI summary scope. | Keep the privacy section visible in deployment and align `EVENT_RETENTION_DAYS` if retention changes. | Fixed in code; deployment verification pending |
| PA-04 | Data / Red Team | High | Recommendation | Broader live policy coverage still needs an approved official policy API key and human review. | OnTongYouth API requires an approved key; importer stores new records as `needs_review`. | Configure `YOUTH_POLICY_API_KEY`, import records, review official source fields, then activate only verified policies. | Open - external credential required |
| PA-05 | Deployment | High | Technical | No deployed database or public deployment environment is configured in this workspace. | `.env` is absent; Supabase project credentials and deployment URL are not available to Codex. | Create Supabase project, apply migrations, configure Render env vars, deploy, and run live checks. | Open - external account required |

## Verified Checks

| Check | Result |
| --- | --- |
| `npm run check` | Pass, including DB migration constraint validation, official policy seed validation, API/client contract validation, active policy structure validation, privacy guard validation, importer review guard validation, policy review workflow validation, server runtime smoke/security-header validation, and deployment-check syntax |
| Official transport seed data | Added for K-패스, 기후동행카드, 종로구 버스교통비 지원 |
| Expired/non-current category records | Stored as `expired`, not returned by `/api/policies` |
| Production event fallback | Disabled; DB missing returns `503` in production |
| Policy freshness gate | Active policies older than `POLICY_STALE_DAYS` are hidden until reviewed |
| Active policy structure gate | API filters out active rows missing reviewed text, documents array, official HTTPS source, valid official basis date, fresh checked date, or transport calculation fields |
| DB constraint gate | Migration enforces policy category/status allowlists, JSON object/array shapes, event type allowlist, and event step allowlist |
| Policy API input guard | `/api/policies` rejects unsupported categories with `400` before any DB query; covered by runtime smoke test |
| Read-only deployment check | Added `npm run check:deployment`; requires real deployed URL, readable `policies`/`journey_events` tables, and DB-backed event storage |
| Direct database seed check | Added `npm run check:database-seed`; verifies active transport seeds and expired housing/education/saving audit rows after migration |
| Official source URL check | Pass on 2026-07-19 with HEAD-to-GET fallback for public sites that do not support HEAD consistently |
| Importer review guard | Added validation that imported official API rows stay `needs_review` with review-only text until human activation |
| Review activation workflow | Added `npm run review:list` and guarded `npm run review:activate`; activation refuses expired, non-HTTPS, non-`needs_review`, placeholder-text, and structurally incomplete transport policies |
| Event privacy runtime smoke test | Automated in `npm run check`: sensitive metadata strings are redacted, unapproved metadata keys are dropped, raw events are scoped to the requesting opaque anonymous ID, production interest summaries use server aggregate counts, production DB-missing APIs fail closed, and temporary development logs are removed |
| HTTP security headers | API/static responses include nosniff, referrer policy, permissions policy, same-origin resource policy; API/HTML no-store and HTML CSP are covered by runtime smoke test |
| Official source, application routes, and period | Active policy DB constraint, API/client contract, cards, details, saved items, and deployment check require a valid official source URL, structured 접수 기간(`applicationPeriod`), 기준일(`sourcePublishedAt`), and 갱신일(`sourceUpdatedAt`); a separate official HTTPS `applicationUrl` is used only when verified |

## Launch Gate

Public deployment is blocked until PA-04 and PA-05 are resolved. This is intentional: Bridge must not show unreviewed policy data or silently downgrade to file-based analytics in production.

Use DEPLOYMENT_CHECKLIST.md as the required launch runbook. The project is not complete until local checks, Supabase seed verification, live deployment verification, and manual no-login smoke testing all pass.















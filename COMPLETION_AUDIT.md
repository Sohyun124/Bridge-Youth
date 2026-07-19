# Bridge Youth Completion Audit

Audited: 2026-07-19

This document records evidence for the requested production completion criteria. A `ready` item has code and local verification evidence. A `pending external` item requires a real Supabase or deployment environment and is not treated as complete.

| Requirement | Evidence | Status |
| --- | --- | --- |
| Official policy database | `policies` schema, five ordered migrations, and reviewed official-source seed records for transport, housing, education, and saving | Ready; migration application pending external |
| Structured policy conditions | `eligibility`, `benefit`, `application_period`, `application_url`, official source dates, documents, and duplicate-benefit conditions are stored and validated | Ready |
| Comparison and caution | API only returns active, fresh, non-expired, structurally valid policies; UI shows expected benefit, official basis/update dates, application period, caution, and official route | Ready |
| No fabricated policy results | Client has no policy fallback. Missing, stale, expired, or review-only policies are hidden and shown as current official confirmation required | Ready |
| Anonymous DB event logging | Production event POST fails closed without DB; valid events are sanitized before the server-only DB insert | Ready; real DB write pending external |
| Privacy boundary | Raw events are scoped to the requesting opaque anonymous ID; cross-user OpenAI summaries use server-side aggregate category counts only | Ready; live behavior pending external |
| OpenAI server boundary | Only `OPENAI_API_KEY` on the server is used; request prompt contains aggregate category counts and `store: false` | Ready; live key test pending external |
| Official application routes | K-pass and Jongno use verified separate official routes; Climate Card stays on official guidance because no separate online route is recorded | Ready |
| Security configuration | Service-role DB key is server-only, API/HTML no-store, CSP and baseline response headers are enabled | Ready; deployed header inspection pending external |
| No-login production flow | Client has no account requirement and deploy checklist covers comparison, feedback, official route click, and DB-backed dashboard validation | Ready; public URL smoke pending external |

## Local Evidence

- `npm run check` passes: migration constraints, seed rules, API contract, privacy rules, importer review rules, policy activation workflow, and runtime smoke tests.
- `npm run check:source-urls` passes for eight official source/application URLs.
- The production deployment check verifies database health, policy fields, DB-backed event storage, scoped raw event reads, and policy category responses once `BRIDGE_BASE_URL` is available.

## External Completion Gate

The following actions require project-owner account access and cannot be completed from this workspace:

1. Create or select the Supabase project and apply all migrations in `supabase/migrations` in filename order.
2. Set Render server environment variables: `NODE_ENV`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_MAINTENANCE_TOKEN`, `EVENT_RETENTION_DAYS`, and `POLICY_STALE_DAYS`.
3. Set `OPENAI_API_KEY` and `OPENAI_MODEL` when the aggregate AI summary must be live.
4. Deploy the service, then run `npm run check:database-seed` with server credentials and `BRIDGE_BASE_URL=<deployment-url> npm run check:deployment`.
5. Complete the manual no-login scenario in `DEPLOYMENT_CHECKLIST.md` on desktop and mobile.
6. Obtain and approve `YOUTH_POLICY_API_KEY` before importing broader official policy coverage; imported records must remain `needs_review` until a human verifies the source fields.

## Current Release Decision

Do not mark Bridge Youth complete yet. The codebase is ready for production verification, but no evidence currently proves that migrations, real DB writes, OpenAI server calls, or the public deployment URL work in the target environment.
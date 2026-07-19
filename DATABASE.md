# Bridge Youth Production Data

## Source of truth

Bridge stores only policies that have an official HTTPS source URL and a `source_checked_at` timestamp. An `active` policy must also have `source_published_at`: the official notice publication date or official effective/basis date when no publication date is published. User-facing policy cards show this as 기준일 and `source_checked_at` as 갱신일/확인일. `application_url` is optional and may only hold a separate official HTTPS application or enrollment route; otherwise the UI links to the official source guidance. `application_period` is a structured official timing object with `kind`, `startsAt`, `endsAt`, and a user-facing `label`. The database migration also enforces category/status allowlists, JSON object/array shapes for policy data, and event type/step allowlists for journey logs.

- `active`: reviewed and eligible to be shown.
- `needs_review`: retrieved but not shown to users yet.
- `expired`: retained for audit, never shown in comparison results.

The initial feed is the official OnTongYouth Open API. It requires an approved API key and returns XML. The policy importer must preserve the original source fields in `raw_source`, reject records without a source URL or verification date, and mark imported records `needs_review` until they are reviewed.

## Database setup

1. Create a Supabase project.
2. Apply migrations in order through the Supabase CLI or migration workflow:

```text
supabase/migrations/202607180001_create_bridge_youth_tables.sql
supabase/migrations/202607190001_seed_official_policies.sql
supabase/migrations/202607190002_require_active_policy_basis_date.sql
supabase/migrations/202607190003_add_official_application_urls.sql
supabase/migrations/202607190004_add_structured_application_period.sql
```

The seed migration inserts manually verified official-source records. Active transport records can be shown immediately after migration; expired housing, education, and saving records remain in the DB for audit but are not returned by `/api/policies`.
3. Configure server-only environment variables in the deployment service:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
YOUTH_POLICY_API_KEY=<approved OnTongYouth API key>
OPENAI_API_KEY=<optional server-only-secret>
```

4. Run the policy importer when an approved OnTongYouth API key is available, then review imported `needs_review` records before changing `status` to `active`. Imported rows intentionally use review-only summary/caution text and are hidden from users until activation.

```text
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> YOUTH_POLICY_API_KEY=<approved-key> npm run sync:ontong-youth
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> npm run review:list
```

Activate a reviewed policy only after checking the official source URL, any separate official application URL, 기준일, source text, eligibility, support calculation, duplicate-benefit limits, application period, and required documents. For transport policies, reviewed data must include numeric `minAge`, `maxAge`, `minMonthlyRides`, `benefit.type`, `calculationType`, and the calculation parameters required by that type. The activation helper refuses expired policies, non-HTTPS sources, non-`needs_review` rows, review-only placeholder text, and structurally incomplete transport policies:

```text
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> \
POLICY_ID=<policy-id> \
REVIEWED_BY=<reviewer-name> \
SOURCE_PUBLISHED_AT=<official-YYYY-MM-DD> \
APPLICATION_PERIOD_JSON='{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"상시 신청"}' \
EASY_SUMMARY="공식 공고 기준 쉬운 설명" \
CAUTION="공식 공고 기준 주의사항" \
REQUIRED_DOCUMENTS_JSON='["공식 기관 확인 필요"]' \
npm run review:activate
```

5. Keep `POLICY_STALE_DAYS=180` or stricter. Active policies older than this source-check window are hidden until reviewed again.

## Retention

Set `EVENT_RETENTION_DAYS=90` and schedule a server-to-server `POST /api/admin/purge-events` request with `x-admin-token: <ADMIN_MAINTENANCE_TOKEN>` once per day. The endpoint accepts only authenticated maintenance calls and deletes older anonymous events.

## HTTP response boundary

The server adds baseline security headers to API and static responses: `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cross-Origin-Resource-Policy`. JSON API responses and HTML use `Cache-Control: no-store`; HTML also uses a restrictive same-origin Content Security Policy.
## Privacy boundary

`journey_events` contains an opaque anonymous ID and interaction metadata only. Do not store a name, email, phone number, exact address, raw income, or submitted application data. In production, raw events are returned only for the requesting opaque anonymous ID; cross-user dashboard and OpenAI outputs use server-side aggregated counts. The client must never receive the service-role key.


## Local validation

Run this before deployment or after editing policy seed data:

```text
npm run check
```

The check validates JavaScript syntax, DB migration constraints, DB-to-client policy mapping, privacy guards, importer review guards, runtime server smoke behavior, and seed-data violations such as placeholder URLs, non-HTTPS official links, missing required source keys, or missing active/expired coverage expectations. The runtime smoke can also be run directly with `npm run smoke:server`; it creates only a temporary development event file and removes it before exit.

When network access is available, verify that official source URLs in the seed are still reachable. This is intentionally separate from `npm run check` because it depends on external public websites:

```text
npm run check:source-urls
```

After applying migrations with Supabase credentials available, verify the seed state directly. This checks active transport rows and expired category audit rows that are intentionally hidden from public policy results:

```text
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> npm run check:database-seed
```

After deploying and setting DB credentials, run the read-only live check. It does not create synthetic user logs:

```text
BRIDGE_BASE_URL=https://<deployed-url> npm run check:deployment
```

The deployment check requires `/api/health` to prove DB configuration and readable `policies`/`journey_events` tables, active transport policies to include official HTTPS source fields, and `/api/events` to report database-backed storage.












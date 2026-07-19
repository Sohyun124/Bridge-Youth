# Bridge Youth Launch Checklist

Last updated: 2026-07-19

This checklist is the launch gate for the production version. Do not mark Bridge Youth complete until every required item below is checked or explicitly listed as an external blocker.

## 1. Local Preflight

- Run `npm run check`.
- Run `npm run check:source-urls` with network access.
- Confirm no policy result uses client-side fallback data.
- Confirm `data/events.json` does not exist before deployment.
- Confirm `.env` is not committed.

## 2. Supabase Setup

- Create a Supabase project.
- Apply migrations in order:
  - `supabase/migrations/202607180001_create_bridge_youth_tables.sql`
  - `supabase/migrations/202607190001_seed_official_policies.sql`
  - `supabase/migrations/202607190002_require_active_policy_basis_date.sql`
  - `supabase/migrations/202607190003_add_official_application_urls.sql`
  - `supabase/migrations/202607190004_add_structured_application_period.sql`
- Keep Row Level Security enabled.
- Do not create public read/write policies for `policies`, `policy_sync_runs`, or `journey_events`.
- Store only the service-role key on the server or deployment platform.

Verify the migrated DB:

```text
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> npm run check:database-seed
```

## 3. Render Environment

Set these variables in Render, not in client code:

- `NODE_ENV=production`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_MAINTENANCE_TOKEN`
- `EVENT_RETENTION_DAYS=90`
- `POLICY_STALE_DAYS=180`
- `OPENAI_API_KEY` if AI summary is enabled
- `OPENAI_MODEL=gpt-5-mini`
- `YOUTH_POLICY_API_KEY` only after the official OnTongYouth key is approved

Deploy with `render.yaml` and confirm `/api/health` returns `ok: true`.

## 4. Live Verification

Run:

```text
BRIDGE_BASE_URL=https://<deployed-url> npm run check:deployment
```

Then manually test without signing in:

- Enter age `22`, region `서울`, monthly transit cost `75000`, ride count `52`.
- Submit comparison.
- Confirm K-패스, 기후동행카드, and 종로구 버스교통비 지원 appear only with official source links, structured 접수 기간(`application_period`), 기준일(`source_published_at`), and 갱신일(`source_checked_at`).
- Open a benefit detail.
- Confirm the official confirmation notice is visible.
- Save a benefit.
- Submit feedback.
- Click the official source link and confirm K-패스/종로구 buttons open their official enrollment/application route; 기후동행카드 remains an official guidance link because no separate online route is recorded.
- Open the logs/dashboard view and confirm only this browser's anonymous events are reflected from the DB-backed API; no cross-user raw event list is exposed.

## 5. Policy Review Gate

Imported policies must stay hidden until reviewed:

```text
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> YOUTH_POLICY_API_KEY=<approved-key> npm run sync:ontong-youth
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> npm run review:list
```

Activate a policy only after checking the official URL, 기준일, source text, eligibility, support calculation, duplicate-benefit conditions, application period, and required documents:

```text
SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<server-only-secret> POLICY_ID=<policy-id> REVIEWED_BY=<reviewer-name> SOURCE_PUBLISHED_AT=<official-YYYY-MM-DD> APPLICATION_URL=<official-HTTPS-url-if-separate> APPLICATION_PERIOD_JSON='{"kind":"ongoing","startsAt":null,"endsAt":null,"label":"상시 신청"}' EASY_SUMMARY="공식 공고 기준 쉬운 설명" CAUTION="공식 공고 기준 주의사항" REQUIRED_DOCUMENTS_JSON='["공식 기관 확인 필요"]' npm run review:activate
```

## 6. External Blockers

Codex cannot complete these without account access or credentials from the project owner:

- Supabase project creation.
- Applying migrations to the real Supabase project.
- Render deployment and environment variable registration.
- OpenAI API key registration if server-side AI summary should be live.
- OnTongYouth API key approval for broader automated official-policy import.
- Production URL handoff for `npm run check:deployment`.

## Done Criteria

- `npm run check` passes.
- `npm run check:source-urls` passes.
- `npm run check:database-seed` passes against Supabase.
- `npm run check:deployment` passes against the public URL.
- No production API falls back to local files.
- All visible policy results include an official source URL, a valid official basis date, and a source checked date.
- Anonymous journey logs are stored in the real DB and visible in the dashboard.


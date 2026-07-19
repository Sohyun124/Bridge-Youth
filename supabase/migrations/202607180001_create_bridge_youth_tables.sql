create extension if not exists pgcrypto;

create table if not exists public.policies (
  id text primary key,
  source_key text not null unique,
  category text not null check (category in ('transport', 'housing', 'education', 'saving')),
  official_title text not null,
  provider text not null,
  region text not null default '전국',
  source_url text not null check (source_url ~ '^https://'),
  application_url text check (application_url is null or application_url ~ '^https://'),
  source_published_at timestamptz,
  source_checked_at timestamptz not null,
  expires_at timestamptz,
  application_period jsonb not null default '{}'::jsonb check (jsonb_typeof(application_period) = 'object'),
  status text not null default 'needs_review' check (status in ('active', 'needs_review', 'expired')),
  eligibility jsonb not null default '{}'::jsonb check (jsonb_typeof(eligibility) = 'object'),
  benefit jsonb not null default '{}'::jsonb check (jsonb_typeof(benefit) = 'object'),
  easy_summary text not null,
  caution text not null,
  required_documents jsonb not null default '[]'::jsonb check (jsonb_typeof(required_documents) = 'array'),
  raw_source jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_source) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists policies_active_category_idx
  on public.policies (category, status, expires_at);

create table if not exists public.policy_sync_runs (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null check (status in ('running', 'success', 'failed')),
  imported_count integer not null default 0,
  rejected_count integer not null default 0,
  error_message text
);

create table if not exists public.journey_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null unique,
  anonymous_user_id text not null,
  benefit_id text,
  event_type text not null check (event_type in (
    'category_select',
    'transport_form_view',
    'transport_form_exit',
    'profile_save',
    'compare_submit',
    'comparison_results_viewed',
    'comparison_result_view',
    'category_results_viewed',
    'category_official_link_click',
    'benefit_card_click',
    'benefit_detail_view',
    'simple_explanation_view',
    'documents_view',
    'detail_section_dwell',
    'detail_scroll_depth',
    'detail_back_click',
    'detail_exit',
    'benefit_save',
    'reminder_view',
    'apply_link_click',
    'confusion_click',
    'feedback_submit',
    'interest_summary_request'
  )),
  step text not null check (step in ('general', 'category', 'profile', 'input', 'results', 'compare', 'detail', 'documents', 'save', 'reminder', 'apply', 'feedback', 'analytics')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null
);

create index if not exists journey_events_created_at_idx on public.journey_events (created_at desc);
create index if not exists journey_events_benefit_type_idx on public.journey_events (benefit_id, event_type);

alter table public.policies enable row level security;
alter table public.policy_sync_runs enable row level security;
alter table public.journey_events enable row level security;

-- The browser never uses Supabase credentials directly. Bridge's server uses a service-role key.
-- No public RLS policies are created for these tables.



-- Faith Works CMS: website form submissions (the canonical record of every submission).
--
-- Additive only: creates one new table and its indexes. No existing table, column, row, grant or
-- policy is changed. Idempotent; safe to run again.
--
-- Access model (same as the cms_* content tables): only the CMS server reads and writes, with the
-- secret/service-role key. Row Level Security is ON with no policies and the anon/authenticated
-- roles have no privileges, so the public Data API can neither read, list, change nor delete a
-- submission. The website submits through the CMS API (POST /api/forms/submit), never directly.
-- The service role cannot delete rows either: a submission is kept and its status changed.
--
-- Duplicates: one row per (provider, provider_id). provider_id is the browser's request id for
-- website submissions (reused on retries) or Netlify's submission id for Netlify Forms, and the
-- row id is derived from both, so a repeated delivery of the same submission can never add a row.

create table if not exists public.cms_form_submissions (
  id text primary key,                          -- sub_<hash of provider + provider_id>
  provider text not null,                       -- cms_endpoint | netlify_forms
  provider_id text not null,                    -- request id / Netlify submission id
  form_id text not null,                        -- starter_kit, corporate_inquiry… (cms/shared/forms.mjs)
  name text not null default '',
  email text not null default '',
  answers jsonb not null default '{}'::jsonb,   -- validated form fields
  context jsonb not null default '{}'::jsonb,   -- offer, source page, UTMs, consent
  status text not null default 'new' check (status in ('new', 'in_progress', 'completed')),
  kind text not null default 'genuine' check (kind in ('genuine', 'spam', 'test')),
  spam_reason text not null default '',
  ip_hash text not null default '',             -- keyed hash for rate limiting; never the address
  submitted_at timestamptz,                     -- as reported by the browser
  received_at timestamptz not null default now(),
  notify_state text not null default 'pending', -- pending | sending | sent | failed | off
  notify_attempts integer not null default 0,
  notify_error text not null default '',
  notified_at timestamptz,
  sheets_state text not null default 'off',     -- pending | sending | sent | failed | off
  sheets_attempts integer not null default 0,
  sheets_error text not null default '',
  sheets_at timestamptz,
  version integer not null default 1,
  write_id text not null default '',
  updated_at timestamptz,
  updated_by text not null default '',
  unique (provider, provider_id)
);

create index if not exists cms_form_submissions_received_idx on public.cms_form_submissions (received_at desc);
create index if not exists cms_form_submissions_form_idx on public.cms_form_submissions (form_id, received_at desc);
create index if not exists cms_form_submissions_ip_idx on public.cms_form_submissions (ip_hash, received_at desc);
create index if not exists cms_form_submissions_notify_idx on public.cms_form_submissions (notify_state) where notify_state in ('pending', 'sending', 'failed');
create index if not exists cms_form_submissions_sheets_idx on public.cms_form_submissions (sheets_state) where sheets_state in ('pending', 'sending', 'failed');

alter table public.cms_form_submissions enable row level security;
revoke all on table public.cms_form_submissions from anon, authenticated;
revoke all on table public.cms_form_submissions from service_role;
grant select, insert, update on table public.cms_form_submissions to service_role;

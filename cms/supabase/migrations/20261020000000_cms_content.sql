-- Faith Works CMS: content store on Supabase Postgres.
--
-- One table per CMS collection and system tab (cms/shared/schema.mjs). Workflow and bookkeeping
-- fields are real, typed columns; a collection's content fields (title, summary, page HTML…) are
-- kept in `fields` (jsonb), so adding a field to the content model needs no migration.
--
-- Access model: only the CMS server reads and writes these tables, with the service-role key
-- (server-side environment variable, never sent to a browser). Row Level Security is ON with no
-- policies, and the anon/authenticated roles have no privileges, so the public Data API cannot
-- read or write anything here. The public website gets published content from the CMS API
-- (/api/public/content), never from Supabase directly.
--
-- Nothing is ever hard-deleted by the CMS (deletes are soft: deleted_at). history and audit_log
-- are append-only, enforced by triggers.

-- ---- Content collections ------------------------------------------------------------------

create table if not exists public.cms_programs (
  id text primary key,
  slug text not null default '',
  status text not null default 'draft',
  version integer not null default 1,
  write_id text not null default '',
  created_at timestamptz, created_by text not null default '',
  updated_at timestamptz, updated_by text not null default '',
  published_at timestamptz, published_by text not null default '',
  published_version integer, published_slug text not null default '', previous_slugs text not null default '',
  deleted_at timestamptz, deleted_by text not null default '',
  fields jsonb not null default '{}'::jsonb
);

create table if not exists public.cms_events (like public.cms_programs including all);
create table if not exists public.cms_resources (like public.cms_programs including all);

-- Testimonials and Site settings have no page, so no slug.
create table if not exists public.cms_testimonials (
  id text primary key,
  status text not null default 'draft',
  version integer not null default 1,
  write_id text not null default '',
  created_at timestamptz, created_by text not null default '',
  updated_at timestamptz, updated_by text not null default '',
  published_at timestamptz, published_by text not null default '',
  published_version integer, published_slug text not null default '', previous_slugs text not null default '',
  deleted_at timestamptz, deleted_by text not null default '',
  fields jsonb not null default '{}'::jsonb
);

create table if not exists public.cms_settings (like public.cms_testimonials including all);

create index if not exists cms_programs_slug_idx on public.cms_programs (slug);
create index if not exists cms_events_slug_idx on public.cms_events (slug);
create index if not exists cms_resources_slug_idx on public.cms_resources (slug);

-- ---- Live copies (what the website shows) ------------------------------------------------

create table if not exists public.cms_published (
  id text primary key,                 -- "{collection}:{record_id}"
  record_id text not null,
  collection text not null check (collection in ('programs', 'events', 'resources', 'testimonials', 'settings')),
  slug text not null default '',
  version integer,
  state text not null default 'live',  -- live | unpublished
  published_at timestamptz,
  published_by text not null default '',
  write_id text not null default '',
  payload jsonb                        -- sanitized public projection (cms/shared/public.mjs)
);
create index if not exists cms_published_collection_state_idx on public.cms_published (collection, state);

-- ---- Version history and audit log (append-only) -----------------------------------------

create table if not exists public.cms_history (
  id text primary key,
  record_id text not null,
  collection text not null,
  version integer,
  kind text not null default '',
  status text not null default '',
  at timestamptz not null default now(),
  by text not null default '',
  write_id text not null default '',
  data jsonb                           -- full copy of the record after the change
);
create index if not exists cms_history_record_idx on public.cms_history (collection, record_id);

create table if not exists public.cms_audit_log (
  id text primary key,
  at timestamptz not null default now(),
  actor text not null default '',
  role text not null default '',
  action text not null,
  collection text not null default '',
  record_id text not null default '',
  version integer,
  detail text not null default '',
  request_id text not null default ''
);
create index if not exists cms_audit_log_at_idx on public.cms_audit_log (at desc);
create index if not exists cms_audit_log_actor_idx on public.cms_audit_log (actor);

create or replace function public.cms_append_only() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'The % table is append-only.', tg_table_name using errcode = '42501';
end $$;

drop trigger if exists cms_history_append_only on public.cms_history;
create trigger cms_history_append_only before update or delete on public.cms_history
  for each row execute function public.cms_append_only();
drop trigger if exists cms_audit_log_append_only on public.cms_audit_log;
create trigger cms_audit_log_append_only before update or delete on public.cms_audit_log
  for each row execute function public.cms_append_only();

-- ---- Users, roles and tags ---------------------------------------------------------------

-- CMS users (sign-in is Google OAuth; this table only says who may sign in and with which role).
-- `role` is not constrained: a row with a retired role is kept, refused at sign-in and flagged
-- for a Super Admin (cms/server/auth.mjs). Super Admins in CMS_SUPER_ADMINS need no row.
create table if not exists public.cms_users (
  id text primary key check (id = lower(id)),  -- the email address, lower case
  email text not null default '',
  name text not null default '',
  role text not null default '',
  active boolean not null default true,
  version integer not null default 1,
  write_id text not null default '',
  created_at timestamptz, created_by text not null default '',
  updated_at timestamptz, updated_by text not null default ''
);

create table if not exists public.cms_tags (
  id text primary key,                 -- slug
  label text not null default '',
  description text not null default '',
  archived boolean not null default false,
  version integer not null default 1,
  write_id text not null default '',
  created_at timestamptz, created_by text not null default '',
  updated_at timestamptz, updated_by text not null default ''
);

-- ---- Access control ----------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['cms_programs', 'cms_events', 'cms_resources', 'cms_testimonials', 'cms_settings',
                           'cms_published', 'cms_history', 'cms_audit_log', 'cms_users', 'cms_tags'] loop
    execute format('alter table public.%I enable row level security', t);
    -- Supabase grants new public tables to anon and authenticated by default: take that back.
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('revoke all on table public.%I from service_role', t);
    -- The CMS server never deletes rows, and never changes history or the audit log.
    if t in ('cms_history', 'cms_audit_log') then
      execute format('grant select, insert on table public.%I to service_role', t);
    else
      execute format('grant select, insert, update on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

revoke all on function public.cms_append_only() from public, anon, authenticated;

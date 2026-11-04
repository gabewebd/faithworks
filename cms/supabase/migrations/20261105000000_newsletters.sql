-- Newsletter issues for the GHL RSS feed (cms/server/services/newsletter.mjs).
-- One row per generated issue: status draft | approved | rejected; the copy, the chosen
-- resources (ids, titles, links, images) and approval details live in `data`.
-- No contacts, sends, opens or campaign data: GoHighLevel owns all of that.
create table if not exists public.cms_newsletters (
  id text primary key,
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected')),
  version integer not null default 1,
  write_id text not null default '',
  created_at timestamptz, created_by text not null default '',
  updated_at timestamptz, updated_by text not null default '',
  data jsonb not null default '{}'::jsonb
);
create index if not exists cms_newsletters_status_created on public.cms_newsletters (status, created_at desc);

-- Same access model as the other cms_* tables: RLS on, no anon/authenticated access,
-- the CMS server (service role / secret key) may read, insert and update, never delete.
alter table public.cms_newsletters enable row level security;
revoke all on table public.cms_newsletters from anon, authenticated;
revoke all on table public.cms_newsletters from service_role;
grant select, insert, update on table public.cms_newsletters to service_role;

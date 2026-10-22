-- Faith Works CMS: event image galleries.
--
-- Additive only. No row is rewritten and no column is added: an event's images live in its
-- `fields` jsonb like every other content field, as `gallery`, an ordered array of
--   { "url": text, "alt": text, "primary": boolean, "featured": boolean }
-- (array order is the display order; `primary` marks the cover; `featured` also puts the photo in
-- the website's Events gallery). Events saved before galleries keep `featured_image_url` and are
-- read as a one-image gallery (cms/shared/schema.mjs: migrateRecord) until someone saves them, so
-- no data is migrated here and nothing is lost. The CMS keeps `featured_image_url/_alt` equal to
-- the cover on every save, for event cards and older readers.
--
-- Why not an event_images table: content records are versioned as whole documents (write_id,
-- cms_history snapshots, the published copy in cms_published.payload, restore-a-version). A child
-- table would split one event across rows that those mechanisms do not version, so a restore or
-- an unpublished draft could show another version's images.
--
-- 1. Integrity, enforced by the database for every writer (the CMS also checks it first):
--    the gallery, when present, is an array of objects with a non-empty url; no url appears
--    twice; at most 24 images; exactly one cover when there is any image (so never two).
--    Checked on cms_events and on the live copies of events in cms_published.
-- 2. Uploads: a public Storage bucket "event-images" (JPEG/PNG/WebP, 5 MB) for files uploaded in
--    the dashboard (cms/server/services/media.mjs). Anyone may read a file by its address (they
--    are shown on the public website); only the CMS server, with the secret key, can write. No
--    storage policies are added, so the anon/authenticated roles cannot upload, change or delete.
--
-- Idempotent; safe to run again. To undo: supabase/manual/20261022000000_event_galleries_down.sql

create or replace function public.cms_event_gallery_ok(f jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when f is null or not (f ? 'gallery') or f->'gallery' = 'null'::jsonb then true
    when jsonb_typeof(f->'gallery') <> 'array' then false
    else (
      select coalesce(bool_and(jsonb_typeof(g) = 'object' and jsonb_typeof(g->'url') = 'string' and length(g->>'url') > 0), true)
        and count(*) <= 24
        and count(distinct g->>'url') = count(*)
        and count(*) filter (where g->>'primary' = 'true') = least(count(*), 1)
      from jsonb_array_elements(f->'gallery') as g
    )
  end
$$;

revoke all on function public.cms_event_gallery_ok(jsonb) from public, anon, authenticated;
grant execute on function public.cms_event_gallery_ok(jsonb) to service_role;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cms_events_gallery_ok') then
    alter table public.cms_events add constraint cms_events_gallery_ok check (public.cms_event_gallery_ok(fields)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'cms_published_event_gallery_ok') then
    alter table public.cms_published add constraint cms_published_event_gallery_ok
      check (collection <> 'events' or payload is null or public.cms_event_gallery_ok(payload)) not valid;
  end if;
end $$;
-- Existing rows have no gallery yet, so validating them cannot fail
alter table public.cms_events validate constraint cms_events_gallery_ok;
alter table public.cms_published validate constraint cms_published_event_gallery_ok;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

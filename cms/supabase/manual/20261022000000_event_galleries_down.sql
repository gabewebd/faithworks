-- Faith Works CMS: undo supabase/migrations/20261022000000_event_galleries.sql.
--
-- NOT a migration that runs on `supabase db push`: run it by hand (SQL Editor) only if the event
-- galleries change is rolled back, after `npm run supabase:backup`.
--
-- Removes the gallery checks and their function. Event rows are not changed: their `gallery`
-- values stay in `fields` (an older CMS ignores them and keeps showing `featured_image_url`, which
-- every save since galleries has kept equal to the cover). The "event-images" bucket is kept,
-- because the website may still show files from it; to remove it, first delete its files in the
-- Supabase dashboard (Storage), then: delete from storage.buckets where id = 'event-images';

begin;
alter table public.cms_events drop constraint if exists cms_events_gallery_ok;
alter table public.cms_published drop constraint if exists cms_published_event_gallery_ok;
drop function if exists public.cms_event_gallery_ok(jsonb);
commit;

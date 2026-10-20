-- Faith Works CMS: remove the stored testimonial card colour ("tone").
--
-- NOT a migration that runs on `supabase db push`: it changes existing content, so run it by hand
-- (SQL Editor) once it is approved, after `npm run supabase:backup`.
--
-- Card colours are no longer content: the website picks them from the brand palette by position
-- (tools/render.mjs), and the CMS neither shows nor saves the field. The code already ignores any
-- stored tone, so this only tidies the data; the site looks the same before and after.
--
-- Each row also gets `role` (empty unless already set). Records written before "Show on the
-- website" existed are recognised by having neither tone nor role (shared/schema.mjs:
-- migrateRecord), so a row must not lose its tone without gaining role, or its visibility would be
-- re-derived from old consent fields. Versions and timestamps are left alone; nothing is deleted.
-- cms_history is append-only and keeps its old snapshots as they are. Safe to run more than once.

begin;

update public.cms_testimonials
set fields = (fields - 'tone') || jsonb_build_object('role', coalesce(fields->'role', '""'::jsonb))
where fields ? 'tone';

update public.cms_published
set payload = (payload - 'tone') || jsonb_build_object('role', coalesce(payload->'role', '""'::jsonb))
where collection = 'testimonials' and payload ? 'tone';

commit;

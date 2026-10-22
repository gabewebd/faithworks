/* ==========================================================================
   Faith Works — runtime settings (public; never put API keys or private
   webhook URLs here). See docs/06_Forms_and_Lead_Capture_Specification.docx.

   forms.mode
     "preview"  : staging. Forms validate and show what would be recorded,
                  but nothing is sent or stored, and no false success is shown.
     "endpoint" : forms POST JSON to forms.endpoint: the CMS submission API,
                  https://<cms-domain>/api/forms/submit (cms/README.md §13). It
                  stores the submission in Supabase, then alerts the team. Its
                  credentials stay on the CMS server. Success is shown only when
                  it answers 2xx with { ok: true }. The website's origin must be
                  listed in the CMS setting FORMS_ALLOWED_ORIGINS.
     If native GHL forms are embedded instead (the recommended launch path),
     the designed forms are replaced and this setting is unused.
   starterKit.downloadUrl : the approved kit file. null until the PDF is final.
   ========================================================================== */
window.FW_CONFIG = {
  forms: {
    mode: "preview",
    endpoint: "",
    timeoutMs: 15000
  },
  starterKit: {
    downloadUrl: null,
    version: "v1.0-draft"
  },
  consentWordingVersion: "marketing-optin-v1-draft",
  contactEmail: "ibelieve@faithph.ai"
};

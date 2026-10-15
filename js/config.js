/* ==========================================================================
   Faith Works — runtime settings (public; never put API keys or private
   webhook URLs here). See docs/06_Forms_and_Lead_Capture_Specification.docx.

   forms.mode
     "preview"  : staging. Forms validate and show what would be recorded,
                  but nothing is sent or stored, and no false success is shown.
     "endpoint" : forms POST JSON to forms.endpoint, a server-side handler that
                  holds the CRM credentials (e.g. a serverless function that
                  creates/updates the GoHighLevel contact). Success is shown only
                  when it answers 2xx with { ok: true }.
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

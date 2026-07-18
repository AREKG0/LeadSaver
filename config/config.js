/**
 * ============================================================
 *  LeadSaver — Centralized Configuration
 * ============================================================
 *  All configurable values live here so the rest of the codebase
 *  never contains magic strings. When LinkedIn changes its DOM
 *  or you add a new field, edit THIS file only.
 * ============================================================
 */

const CONFIG = {
  /* --------------------------------------------------------
   *  Google Apps Script Webhook
   *  Replace the placeholder URL with your deployed
   *  Google Apps Script Web App URL.
   * ------------------------------------------------------- */
  SHEETS_WEBHOOK_URL: "",

  /* --------------------------------------------------------
   *  LinkedIn DOM Selectors
   *  LinkedIn updates its markup periodically.
   *  When that happens, update ONLY these selectors.
   * ------------------------------------------------------- */
  SELECTORS: {
    name: "h1.text-heading-xlarge",
    headline: "div.text-body-medium.break-words",
    location: "span.text-body-small.inline.t-black--light.break-words",
    about: "div.pv-shared-text-with-see-more span[aria-hidden='true']",
    profilePhoto: "img.pv-top-card-profile-picture__image--show",
    experienceSection: "#experience ~ .pvs-list__outer-container",
    experienceItems: "li.pvs-list__paged-list-item",
    experienceTitle: "div.display-flex.align-items-center.mr1.t-bold span[aria-hidden='true']",
    experienceCompany: "span.t-14.t-normal span[aria-hidden='true']",
  },

  /* --------------------------------------------------------
   *  Data Fields
   *  The columns that will appear in Google Sheets.
   *  The order here matches the column order in the sheet.
   * ------------------------------------------------------- */
  FIELDS: [
    "name",
    "headline",
    "company",
    "location",
    "profileUrl",
    "savedAt",
  ],

  /* --------------------------------------------------------
   *  Storage Keys  (chrome.storage.local)
   * ------------------------------------------------------- */
  STORAGE_KEYS: {
    webhookUrl: "leadsaver_webhook_url",
    savedLeads: "leadsaver_saved_leads",
    totalSaved: "leadsaver_total_saved",
  },

  /* --------------------------------------------------------
   *  Misc
   * ------------------------------------------------------- */
  LINKEDIN_PROFILE_REGEX: /^https:\/\/(www\.)?linkedin\.com\/in\//,
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
};

// Make CONFIG available to ES‑module imports (background.js)
// and to classic scripts (content.js, popup.js) via globalThis.
if (typeof globalThis !== "undefined") {
  globalThis.LEADSAVER_CONFIG = CONFIG;
}

// ES module export (used by background.js service worker)
try {
  // This will work in module contexts
  if (typeof module !== "undefined") {
    module.exports = CONFIG;
  }
} catch (_) {
  // Silently ignore in non-module contexts
}

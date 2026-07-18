/**
 * ============================================================
 *  LeadSaver — Shared Utility Functions
 * ============================================================
 */

const Utils = {
  /**
   * Cleans whitespace and newlines from scraped text.
   * @param {string} raw - Raw text from the DOM.
   * @returns {string} Trimmed, single-line string.
   */
  sanitize(raw) {
    if (!raw) return "";
    return raw.replace(/\s+/g, " ").trim();
  },

  /**
   * Returns a human-readable timestamp string.
   * @returns {string} e.g. "2026-07-17 17:55:00"
   */
  timestamp() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  },

  /**
   * Fetch with automatic retry and exponential backoff.
   * @param {string} url
   * @param {RequestInit} options
   * @param {number} retries
   * @param {number} delayMs
   * @returns {Promise<Response>}
   */
  async fetchWithRetry(url, options = {}, retries = 2, delayMs = 1000) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url, options);
        if (response.ok || response.redirected) return response;
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise((resolve) =>
          setTimeout(resolve, delayMs * Math.pow(2, attempt))
        );
      }
    }
  },

  /**
   * Checks if a URL is a valid LinkedIn profile page.
   * @param {string} url
   * @returns {boolean}
   */
  isLinkedInProfile(url) {
    return /^https:\/\/(www\.)?linkedin\.com\/in\//.test(url);
  },

  /**
   * Generates a unique ID for deduplication.
   * @returns {string}
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
  },
};

// Make available globally for classic script contexts
if (typeof globalThis !== "undefined") {
  globalThis.LeadSaverUtils = Utils;
}

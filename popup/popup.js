/**
 * ============================================================
 *  LeadSaver — Popup Controller (v2.0 with Auth)
 * ============================================================
 *  Orchestrates the popup UI:
 *   1. Checks auth state → shows login or main app.
 *   2. Handles sign in / sign up / sign out.
 *   3. Checks if the active tab is a LinkedIn profile.
 *   4. Injects the content script to scrape lead data.
 *   5. Displays the preview card and usage bar.
 *   6. Sends data to background.js on "Save" click.
 *   7. Manages the settings panel.
 * ============================================================
 */

document.addEventListener("DOMContentLoaded", init);

/* ----------------------------------------------------------
 *  State
 * -------------------------------------------------------- */
let currentLead = null;
let sessionSaved = 0;
let currentPlan = "FREE";
let leadsThisMonth = 0;
let leadsLimit = 50;

/* ----------------------------------------------------------
 *  DOM References — Auth Screen
 * -------------------------------------------------------- */
const $authScreen = document.getElementById("auth-screen");
const $authEmail = document.getElementById("auth-email");
const $authPassword = document.getElementById("auth-password");
const $authError = document.getElementById("auth-error");
const $btnSignIn = document.getElementById("btn-sign-in");
const $btnSignUp = document.getElementById("btn-sign-up");

/* ----------------------------------------------------------
 *  DOM References — Main App
 * -------------------------------------------------------- */
const $mainApp = document.getElementById("main-app");
const $planBadge = document.getElementById("plan-badge");
const $usageBar = document.getElementById("usage-bar");
const $usageCount = document.getElementById("usage-count");
const $usageLimit = document.getElementById("usage-limit");
const $usageFill = document.getElementById("usage-fill");
const $statusBar = document.getElementById("status-bar");
const $statusText = document.getElementById("status-text");
const $leadCard = document.getElementById("lead-card");
const $leadName = document.getElementById("lead-name");
const $leadHeadline = document.getElementById("lead-headline");
const $leadCompanyText = document.getElementById("lead-company-text");
const $leadLocationText = document.getElementById("lead-location-text");
const $btnSave = document.getElementById("btn-save");
const $btnSaveText = document.getElementById("btn-save-text");
const $btnUpgrade = document.getElementById("btn-upgrade");
const $statsTotal = document.getElementById("stats-total");
const $statsSession = document.getElementById("stats-session");
const $btnSettings = document.getElementById("btn-settings");
const $btnLogout = document.getElementById("btn-logout");
const $settingsPanel = document.getElementById("settings-panel");
const $btnSettingsClose = document.getElementById("btn-settings-close");
const $inputWebhook = document.getElementById("input-webhook");
const $btnSaveSettings = document.getElementById("btn-save-settings");
const $settingsEmail = document.getElementById("settings-email");
const $settingsPlan = document.getElementById("settings-plan");
const $toast = document.getElementById("toast");
const $toastText = document.getElementById("toast-text");

/* ----------------------------------------------------------
 *  Initialization
 * -------------------------------------------------------- */
async function init() {
  bindEvents();
  await checkAuthState();
}

/* ----------------------------------------------------------
 *  Event Bindings
 * -------------------------------------------------------- */
function bindEvents() {
  // Auth
  $btnSignIn.addEventListener("click", handleSignIn);
  $btnSignUp.addEventListener("click", handleSignUp);

  // Allow Enter key to submit
  $authPassword.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSignIn();
  });

  // Main App
  $btnSave.addEventListener("click", handleSave);
  $btnUpgrade.addEventListener("click", handleUpgrade);
  $btnSettings.addEventListener("click", openSettings);
  $btnSettingsClose.addEventListener("click", closeSettings);
  $btnSaveSettings.addEventListener("click", saveSettings);
  $btnLogout.addEventListener("click", handleSignOut);
}

/* ==========================================================
 *  AUTH STATE
 * ========================================================== */

async function checkAuthState() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "AUTH_GET_STATE" });

    if (response.success && response.data.isSignedIn) {
      // User is signed in → show the main app
      currentPlan = response.data.plan || "FREE";
      leadsThisMonth = response.data.leadsThisMonth || 0;
      leadsLimit = response.data.leadsLimit || 50;

      showMainApp(response.data.email);
      await loadStats();
      await checkActiveTab();
    } else {
      // Not signed in → show login screen
      showAuthScreen();
    }
  } catch (error) {
    console.error("LeadSaver: auth check error", error);
    showAuthScreen();
  }
}

function showAuthScreen() {
  $authScreen.classList.remove("auth-screen--hidden");
  $mainApp.classList.add("app--hidden");
}

function showMainApp(email) {
  $authScreen.classList.add("auth-screen--hidden");
  $mainApp.classList.remove("app--hidden");

  // Update plan badge
  updatePlanBadge();

  // Update usage bar
  updateUsageBar();

  // Update settings email
  if ($settingsEmail) $settingsEmail.textContent = email || "—";
  if ($settingsPlan) $settingsPlan.textContent = currentPlan;
}

function updatePlanBadge() {
  if (currentPlan === "PRO") {
    $planBadge.textContent = "PRO";
    $planBadge.className = "plan-badge plan-badge--pro";
  } else {
    $planBadge.textContent = "FREE";
    $planBadge.className = "plan-badge plan-badge--free";
  }
}

function updateUsageBar() {
  if (currentPlan === "PRO") {
    // Hide usage bar for Pro users
    $usageBar.classList.add("usage-bar--hidden");
    $btnSave.style.display = "";
    $btnUpgrade.classList.add("btn-upgrade--hidden");
    return;
  }

  $usageBar.classList.remove("usage-bar--hidden");
  $usageCount.textContent = leadsThisMonth;
  $usageLimit.textContent = leadsLimit;

  const percentage = Math.min((leadsThisMonth / leadsLimit) * 100, 100);
  $usageFill.style.width = `${percentage}%`;

  // Change color based on usage
  $usageFill.className = "usage-bar__fill";
  if (percentage >= 90) {
    $usageFill.classList.add("usage-bar__fill--danger");
  } else if (percentage >= 70) {
    $usageFill.classList.add("usage-bar__fill--warning");
  }

  // Show/hide upgrade button vs save button
  if (leadsThisMonth >= leadsLimit) {
    $btnSave.style.display = "none";
    $btnUpgrade.classList.remove("btn-upgrade--hidden");
  } else {
    $btnSave.style.display = "";
    $btnUpgrade.classList.add("btn-upgrade--hidden");
  }
}

/* ==========================================================
 *  SIGN IN / SIGN UP / SIGN OUT
 * ========================================================== */

async function handleSignIn() {
  const email = $authEmail.value.trim();
  const password = $authPassword.value;

  if (!email || !password) {
    showAuthError("Please enter both email and password.");
    return;
  }

  setAuthLoading(true);
  hideAuthError();

  try {
    const response = await chrome.runtime.sendMessage({
      action: "AUTH_SIGN_IN",
      email,
      password,
    });

    if (response.success) {
      currentPlan = response.data.plan || "FREE";
      leadsThisMonth = response.data.leadsThisMonth || 0;
      leadsLimit = response.data.leadsLimit || 50;
      showMainApp(response.data.email);
      await loadStats();
      await checkActiveTab();
    } else {
      showAuthError(response.error || "Sign in failed.");
    }
  } catch (error) {
    showAuthError("Connection error. Please try again.");
  } finally {
    setAuthLoading(false);
  }
}

async function handleSignUp() {
  const email = $authEmail.value.trim();
  const password = $authPassword.value;

  if (!email || !password) {
    showAuthError("Please enter both email and password.");
    return;
  }

  if (password.length < 6) {
    showAuthError("Password must be at least 6 characters.");
    return;
  }

  setAuthLoading(true);
  hideAuthError();

  try {
    const response = await chrome.runtime.sendMessage({
      action: "AUTH_SIGN_UP",
      email,
      password,
    });

    if (response.success) {
      currentPlan = response.data.plan || "FREE";
      leadsThisMonth = response.data.leadsThisMonth || 0;
      leadsLimit = response.data.leadsLimit || 50;
      showMainApp(response.data.email);
      showToast("Account created! Welcome to LeadSaver.", "success");
      await loadStats();
      await checkActiveTab();
    } else {
      showAuthError(response.error || "Sign up failed.");
    }
  } catch (error) {
    showAuthError("Connection error. Please try again.");
  } finally {
    setAuthLoading(false);
  }
}

async function handleSignOut() {
  try {
    await chrome.runtime.sendMessage({ action: "AUTH_SIGN_OUT" });
    showAuthScreen();
    $authEmail.value = "";
    $authPassword.value = "";
    hideAuthError();
    showToast("Signed out.", "success");
  } catch (error) {
    showToast("Sign out failed.", "error");
  }
}

function showAuthError(message) {
  $authError.textContent = message;
  $authError.classList.remove("auth-form__error--hidden");
}

function hideAuthError() {
  $authError.classList.add("auth-form__error--hidden");
}

function setAuthLoading(isLoading) {
  $btnSignIn.disabled = isLoading;
  $btnSignUp.disabled = isLoading;
  $btnSignIn.textContent = isLoading ? "Signing in…" : "Sign In";
}

/* ==========================================================
 *  LINKEDIN SCRAPING (same as before)
 * ========================================================== */

async function checkActiveTab() {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab || !tab.url) {
      setStatus("idle", "Open a LinkedIn profile to get started.");
      return;
    }

    const isLinkedIn = /^https:\/\/(www\.)?linkedin\.com\/in\//.test(tab.url);

    if (!isLinkedIn) {
      setStatus("idle", "Navigate to a LinkedIn profile to begin.");
      return;
    }

    // Check if webhook is configured
    const storage = await chrome.storage.local.get("leadsaver_webhook_url");
    if (!storage.leadsaver_webhook_url) {
      setStatus("error", "Set your Google Sheets URL in Settings first.");
      return;
    }

    // Inject content script and scrape the page
    setStatus("saving", "Scanning profile…");
    await scrapeProfile(tab.id);
  } catch (error) {
    console.error("LeadSaver: checkActiveTab error", error);
    setStatus("error", "Could not access the current tab.");
  }
}

async function scrapeProfile(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/content.js"],
    });

    const leadData = results?.[0]?.result;

    if (leadData && leadData.error === "PAGE_LOADING") {
      setStatus("error", "Page is still loading! Wait a second and click again.");
      return;
    }

    if (!leadData || !leadData.name) {
      setStatus("error", "Could not read profile data. Try refreshing the page (F5).");
      return;
    }

    currentLead = leadData;
    displayLead(leadData);
    setStatus("ready", "Profile loaded. Ready to save!");
    $btnSave.disabled = false;
  } catch (error) {
    console.error("LeadSaver: scrape error", error);
    setStatus("error", "Failed to read the LinkedIn page.");
  }
}

function displayLead(lead) {
  $leadName.textContent = lead.name || "—";
  $leadHeadline.textContent = lead.headline || "—";
  $leadCompanyText.textContent = lead.company || "Unknown";
  $leadLocationText.textContent = lead.location || "Unknown";
  $leadCard.classList.remove("lead-card--hidden");
}

/* ==========================================================
 *  UPGRADE TO PRO
 * ========================================================== */

function handleUpgrade() {
  const userEmail = $settingsEmail.textContent;
  const stripeUrl = `https://buy.stripe.com/test_5kQ28q9wy3x19ac4IN87K00?prefilled_email=${encodeURIComponent(userEmail)}`;
  chrome.tabs.create({ url: stripeUrl });
}

/* ==========================================================
 *  SAVE LEAD
 * ========================================================== */

async function handleSave() {
  if (!currentLead) return;

  // Check free tier limit before even trying
  if (currentPlan === "FREE" && leadsThisMonth >= leadsLimit) {
    setStatus("error", "Free limit reached! Upgrade to Pro for unlimited saves.");
    showToast("Monthly limit reached.", "error");
    return;
  }

  // Set loading state
  $btnSave.disabled = true;
  $btnSave.classList.add("btn-save--loading");
  setStatus("saving", "Saving to Google Sheets…");

  try {
    // 1. Check for duplicates locally first
    const dupeCheck = await chrome.storage.local.get("leadsaver_saved_leads");
    const savedLeads = dupeCheck.leadsaver_saved_leads || [];
    const isDuplicate = savedLeads.some(
      (lead) => lead.profileUrl === currentLead.profileUrl
    );

    let forceSave = false;
    if (isDuplicate) {
      const userConfirmed = confirm(
        "This profile has already been saved previously.\n\nDo you want to save it again?"
      );
      if (!userConfirmed) {
        $btnSave.disabled = false;
        $btnSave.classList.remove("btn-save--loading");
        setStatus("ready", "Save cancelled.");
        return;
      }
      forceSave = true;
      setStatus("saving", "Forcing save to Sheets...");
    }

    // 2. Send to background to process via Apps Script
    const response = await chrome.runtime.sendMessage({
      action: "SAVE_LEAD",
      data: currentLead,
      forceSave: forceSave,
    });

    if (response.success) {
      if (!forceSave) {
        sessionSaved++;
        $statsSession.textContent = sessionSaved;
      }
      $statsTotal.textContent = response.data.totalSaved;

      // Update usage
      leadsThisMonth = response.data.leadsThisMonth || leadsThisMonth + 1;
      updateUsageBar();

      $btnSave.classList.remove("btn-save--loading");
      $btnSave.classList.add("btn-save--success");

      if (forceSave) {
        $btnSaveText.textContent = "✓ Saved Again!";
        setStatus("success", "Saved duplicate copy to Sheets.");
        showToast("Saved another copy!", "success");
      } else {
        $btnSaveText.textContent = "✓ Saved!";
        setStatus("success", "Lead saved successfully!");
        showToast("Lead saved to Google Sheets!", "success");
      }
    } else {
      $btnSave.classList.remove("btn-save--loading");
      $btnSave.disabled = false;

      if (response.error === "NO_WEBHOOK_URL") {
        setStatus("error", "Set your Google Sheets URL in Settings.");
        showToast("Configure your Sheets URL first.", "error");
      } else if (response.error === "FREE_LIMIT_REACHED") {
        setStatus("error", "Free limit reached! Upgrade to Pro for unlimited saves.");
        showToast("Monthly limit reached.", "error");
      } else if (response.error === "NOT_SIGNED_IN" || response.error === "SESSION_EXPIRED") {
        showToast("Session expired. Please sign in again.", "error");
        showAuthScreen();
      } else {
        setStatus("error", "Error: " + response.error);
        showToast("Save failed. Please retry.", "error");
      }
    }
  } catch (error) {
    console.error("LeadSaver: save error", error);
    $btnSave.classList.remove("btn-save--loading");
    $btnSave.disabled = false;
    setStatus("error", "An unexpected error occurred.");
    showToast("Something went wrong.", "error");
  }
}

/* ==========================================================
 *  SETTINGS PANEL
 * ========================================================== */

async function openSettings() {
  const storage = await chrome.storage.local.get("leadsaver_webhook_url");
  $inputWebhook.value = storage.leadsaver_webhook_url || "";
  $settingsPanel.classList.remove("settings--hidden");
}

function closeSettings() {
  $settingsPanel.classList.add("settings--hidden");
}

async function saveSettings() {
  const url = $inputWebhook.value.trim();

  if (!url) {
    showToast("Please enter a valid URL.", "error");
    return;
  }

  if (!url.startsWith("https://script.google.com/")) {
    showToast("URL must start with https://script.google.com/", "error");
    return;
  }

  await chrome.storage.local.set({ leadsaver_webhook_url: url });
  showToast("Settings saved!", "success");
  closeSettings();

  await checkActiveTab();
}

/* ==========================================================
 *  STATS
 * ========================================================== */

async function loadStats() {
  try {
    const response = await chrome.runtime.sendMessage({ action: "GET_STATS" });
    if (response.success) {
      $statsTotal.textContent = response.data.totalSaved;
    }
  } catch (_) {
    // Stats are non-critical; silently ignore
  }
}

/* ==========================================================
 *  HELPERS
 * ========================================================== */

function setStatus(state, text) {
  $statusBar.className = `status-bar status-bar--${state}`;
  $statusText.textContent = text;

  const icons = {
    idle: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    ready: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>`,
    error: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    saving: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`,
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  };

  const $statusIcon = document.getElementById("status-icon");
  if (icons[state]) {
    $statusIcon.innerHTML = icons[state];
  }
}

function showToast(message, type = "success") {
  $toastText.textContent = message;
  $toast.className = `toast toast--${type} toast--visible`;

  setTimeout(() => {
    $toast.classList.remove("toast--visible");
    $toast.classList.add("toast--hidden");
  }, 2500);
}

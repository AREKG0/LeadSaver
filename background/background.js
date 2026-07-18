/**
 * ============================================================
 *  LeadSaver — Background Service Worker (v2.0 with Firebase)
 * ============================================================
 *  Handles:
 *   1. Firebase Authentication (sign up, sign in, sign out)
 *   2. Firestore user profile (plan, usage tracking)
 *   3. Saving leads to Google Sheets via webhook
 *   4. Free tier limit enforcement (50 leads/month)
 * ============================================================
 */

/* ----------------------------------------------------------
 *  Firebase Configuration
 * -------------------------------------------------------- */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDOEoj7NdnO4Jx0An_hpNQTx06IdimYyc8",
  authDomain: "leadsaver-48d47.firebaseapp.com",
  projectId: "leadsaver-48d47",
  storageBucket: "leadsaver-48d47.firebasestorage.app",
  messagingSenderId: "897050016390",
  appId: "1:897050016390:web:71662491250b6e6a9b2f07",
};

const AUTH_BASE = "https://identitytoolkit.googleapis.com/v1";
const TOKEN_BASE = "https://securetoken.googleapis.com/v1";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

const FREE_MONTHLY_LIMIT = 50;

/* ----------------------------------------------------------
 *  Message Listener
 * -------------------------------------------------------- */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handlers = {
    AUTH_SIGN_UP: () => handleSignUp(message.email, message.password),
    AUTH_SIGN_IN: () => handleSignIn(message.email, message.password),
    AUTH_SIGN_OUT: () => handleSignOut(),
    AUTH_GET_STATE: () => handleGetAuthState(),
    SAVE_LEAD: () => handleSaveLead(message.data, message.forceSave),
    GET_STATS: () => getStats(),
  };

  const handler = handlers[message.action];
  if (handler) {
    handler()
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((error) =>
        sendResponse({ success: false, error: error.message })
      );
    return true; // Keep message channel open for async
  }
});

/* ==========================================================
 *  FIREBASE AUTH — REST API
 * ========================================================== */

async function handleSignUp(email, password) {
  // 1. Create account via Firebase Auth REST API
  const res = await fetch(
    `${AUTH_BASE}/accounts:signUp?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(friendlyAuthError(data.error.message));
  }

  // 2. Store auth tokens locally
  const authState = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    userId: data.localId,
    email: data.email,
    expiresAt: Date.now() + parseInt(data.expiresIn) * 1000,
  };
  await chrome.storage.local.set({ leadsaver_auth: authState });

  // 3. Create Firestore user profile with FREE plan
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-07"
  await firestoreSetDoc(`users/${data.localId}`, {
    email: { stringValue: data.email },
    plan: { stringValue: "FREE" },
    leadsThisMonth: { integerValue: "0" },
    monthKey: { stringValue: currentMonth },
    createdAt: { stringValue: new Date().toISOString() },
  }, authState.idToken);

  return {
    email: data.email,
    plan: "FREE",
    leadsThisMonth: 0,
    leadsLimit: FREE_MONTHLY_LIMIT,
  };
}

async function handleSignIn(email, password) {
  // 1. Sign in via Firebase Auth REST API
  const res = await fetch(
    `${AUTH_BASE}/accounts:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error(friendlyAuthError(data.error.message));
  }

  // 2. Store auth tokens locally
  const authState = {
    idToken: data.idToken,
    refreshToken: data.refreshToken,
    userId: data.localId,
    email: data.email,
    expiresAt: Date.now() + parseInt(data.expiresIn) * 1000,
  };
  await chrome.storage.local.set({ leadsaver_auth: authState });

  // 3. Fetch user profile from Firestore
  const profile = await firestoreGetDoc(`users/${data.localId}`, authState.idToken);

  const plan = profile?.plan?.stringValue || "FREE";
  const leadsThisMonth = parseInt(profile?.leadsThisMonth?.integerValue || "0");
  const monthKey = profile?.monthKey?.stringValue || "";
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Reset counter if it's a new month
  let actualLeadsThisMonth = leadsThisMonth;
  if (monthKey !== currentMonth) {
    actualLeadsThisMonth = 0;
    await firestoreSetDoc(`users/${data.localId}`, {
      leadsThisMonth: { integerValue: "0" },
      monthKey: { stringValue: currentMonth },
    }, authState.idToken);
  }

  return {
    email: data.email,
    plan,
    leadsThisMonth: actualLeadsThisMonth,
    leadsLimit: plan === "PRO" ? Infinity : FREE_MONTHLY_LIMIT,
  };
}

async function handleSignOut() {
  await chrome.storage.local.remove("leadsaver_auth");
  return { signedOut: true };
}

async function handleGetAuthState() {
  const storage = await chrome.storage.local.get("leadsaver_auth");
  const auth = storage.leadsaver_auth;

  if (!auth || !auth.idToken) {
    return { isSignedIn: false };
  }

  // Refresh token if expired
  let idToken = auth.idToken;
  if (Date.now() >= auth.expiresAt - 60000) {
    try {
      const refreshed = await refreshAuthToken(auth.refreshToken);
      idToken = refreshed.idToken;
      auth.idToken = refreshed.idToken;
      auth.refreshToken = refreshed.refreshToken;
      auth.expiresAt = Date.now() + parseInt(refreshed.expiresIn) * 1000;
      await chrome.storage.local.set({ leadsaver_auth: auth });
    } catch (e) {
      // Token refresh failed — force sign out
      await chrome.storage.local.remove("leadsaver_auth");
      return { isSignedIn: false };
    }
  }

  // Fetch user profile from Firestore
  try {
    const profile = await firestoreGetDoc(`users/${auth.userId}`, idToken);
    const plan = profile?.plan?.stringValue || "FREE";
    const leadsThisMonth = parseInt(profile?.leadsThisMonth?.integerValue || "0");
    const monthKey = profile?.monthKey?.stringValue || "";
    const currentMonth = new Date().toISOString().slice(0, 7);

    let actualLeadsThisMonth = leadsThisMonth;
    if (monthKey !== currentMonth) {
      actualLeadsThisMonth = 0;
      await firestoreSetDoc(`users/${auth.userId}`, {
        leadsThisMonth: { integerValue: "0" },
        monthKey: { stringValue: currentMonth },
      }, idToken);
    }

    return {
      isSignedIn: true,
      email: auth.email,
      plan,
      leadsThisMonth: actualLeadsThisMonth,
      leadsLimit: plan === "PRO" ? Infinity : FREE_MONTHLY_LIMIT,
    };
  } catch (e) {
    return {
      isSignedIn: true,
      email: auth.email,
      plan: "FREE",
      leadsThisMonth: 0,
      leadsLimit: FREE_MONTHLY_LIMIT,
    };
  }
}

async function refreshAuthToken(refreshToken) {
  const res = await fetch(
    `${TOKEN_BASE}/token?key=${FIREBASE_CONFIG.apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    }
  );

  const data = await res.json();
  if (data.error) {
    throw new Error("Token refresh failed");
  }

  return {
    idToken: data.id_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

/* ==========================================================
 *  FIRESTORE — REST API
 * ========================================================== */

async function firestoreGetDoc(path, idToken) {
  const res = await fetch(`${FIRESTORE_BASE}/${path}`, {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Firestore GET failed: ${res.status}`);

  const doc = await res.json();
  return doc.fields || null;
}

async function firestoreSetDoc(path, fields, idToken) {
  // PATCH with updateMask to only update specified fields
  const fieldPaths = Object.keys(fields)
    .map((key) => `updateMask.fieldPaths=${key}`)
    .join("&");

  const res = await fetch(`${FIRESTORE_BASE}/${path}?${fieldPaths}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Firestore PATCH failed: ${res.status} ${JSON.stringify(errData)}`);
  }

  return await res.json();
}

/* ==========================================================
 *  SAVE LEAD (with plan limit enforcement)
 * ========================================================== */

async function handleSaveLead(leadData, forceSave = false) {
  // 1. Check if user is authenticated
  const storage = await chrome.storage.local.get("leadsaver_auth");
  const auth = storage.leadsaver_auth;

  if (!auth || !auth.idToken) {
    throw new Error("NOT_SIGNED_IN");
  }

  // 2. Get the webhook URL from storage
  const webhookStorage = await chrome.storage.local.get("leadsaver_webhook_url");
  const webhookUrl = webhookStorage.leadsaver_webhook_url;

  if (!webhookUrl) {
    throw new Error("NO_WEBHOOK_URL");
  }

  // 3. Refresh token if needed
  let idToken = auth.idToken;
  if (Date.now() >= auth.expiresAt - 60000) {
    try {
      const refreshed = await refreshAuthToken(auth.refreshToken);
      idToken = refreshed.idToken;
      auth.idToken = refreshed.idToken;
      auth.refreshToken = refreshed.refreshToken;
      auth.expiresAt = Date.now() + parseInt(refreshed.expiresIn) * 1000;
      await chrome.storage.local.set({ leadsaver_auth: auth });
    } catch (e) {
      throw new Error("SESSION_EXPIRED");
    }
  }

  // 4. Check plan limits
  const profile = await firestoreGetDoc(`users/${auth.userId}`, idToken);
  const plan = profile?.plan?.stringValue || "FREE";
  let leadsThisMonth = parseInt(profile?.leadsThisMonth?.integerValue || "0");
  const monthKey = profile?.monthKey?.stringValue || "";
  const currentMonth = new Date().toISOString().slice(0, 7);

  // Reset if new month
  if (monthKey !== currentMonth) {
    leadsThisMonth = 0;
  }

  if (plan === "FREE" && leadsThisMonth >= FREE_MONTHLY_LIMIT) {
    throw new Error("FREE_LIMIT_REACHED");
  }

  // 5. Check for duplicates locally
  const dupeCheck = await chrome.storage.local.get("leadsaver_saved_leads");
  const savedLeads = dupeCheck.leadsaver_saved_leads || [];

  const wasDuplicate = savedLeads.some(
    (lead) => lead.profileUrl === leadData.profileUrl
  );

  if (wasDuplicate && !forceSave) {
    throw new Error("DUPLICATE_LEAD_CONFIRM");
  }

  // 6. Send data to Google Apps Script webhook
  const response = await fetchWithRetry(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(leadData),
    redirect: "follow",
  });

  // 7. Update local storage for deduplication and stats
  if (!wasDuplicate) {
    savedLeads.push({
      profileUrl: leadData.profileUrl,
      name: leadData.name,
      savedAt: leadData.savedAt,
    });
  }

  const totalStorage = await chrome.storage.local.get("leadsaver_total_saved");
  const totalSaved = totalStorage.leadsaver_total_saved || 0;
  const newTotal = wasDuplicate ? totalSaved : totalSaved + 1;

  await chrome.storage.local.set({
    leadsaver_saved_leads: savedLeads,
    leadsaver_total_saved: newTotal,
  });

  // 8. Update Firestore usage counter
  const newLeadsThisMonth = leadsThisMonth + 1;
  await firestoreSetDoc(`users/${auth.userId}`, {
    leadsThisMonth: { integerValue: String(newLeadsThisMonth) },
    monthKey: { stringValue: currentMonth },
  }, idToken);

  return {
    totalSaved: newTotal,
    wasDuplicate,
    leadsThisMonth: newLeadsThisMonth,
    leadsLimit: plan === "PRO" ? Infinity : FREE_MONTHLY_LIMIT,
    plan,
  };
}

/* ----------------------------------------------------------
 *  Get Statistics
 * -------------------------------------------------------- */
async function getStats() {
  const storage = await chrome.storage.local.get([
    "leadsaver_total_saved",
    "leadsaver_saved_leads",
  ]);
  return {
    totalSaved: storage.leadsaver_total_saved || 0,
    recentLeads: (storage.leadsaver_saved_leads || []).slice(-5).reverse(),
  };
}

/* ----------------------------------------------------------
 *  Fetch with Retry
 * -------------------------------------------------------- */
async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 1000) {
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
}

/* ----------------------------------------------------------
 *  Friendly Auth Error Messages
 * -------------------------------------------------------- */
function friendlyAuthError(code) {
  const map = {
    EMAIL_EXISTS: "An account with this email already exists.",
    EMAIL_NOT_FOUND: "No account found with this email.",
    INVALID_PASSWORD: "Incorrect password. Please try again.",
    INVALID_EMAIL: "Please enter a valid email address.",
    WEAK_PASSWORD: "Password must be at least 6 characters.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Try again later.",
    INVALID_LOGIN_CREDENTIALS: "Invalid email or password.",
  };
  // Firebase sometimes returns "WEAK_PASSWORD : Password should be at least 6 characters"
  const baseCode = code.split(" ")[0].replace(":", "");
  return map[baseCode] || map[code] || `Authentication error: ${code}`;
}

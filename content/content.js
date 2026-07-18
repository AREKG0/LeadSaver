/**
 * ============================================================
 *  LeadSaver — Content Script (LinkedIn Scraper) v11
 * ============================================================
 *  Scopes the text search strictly to the "Top Card" so it 
 *  doesn't accidentally scrape companies or followers from 
 *  the sidebar (e.g. suggested companies). Also extracts
 *  Schools and 'Connections' if Followers are hidden.
 * ============================================================
 */

(() => {
  "use strict";

  function universalScraper() {
    let name = "";
    let headline = "";
    
    // 1. Get Name from Title
    const title = document.title || "";
    if (title && title !== "LinkedIn") {
      const cleanTitle = title.replace(/\s*\|\s*LinkedIn\s*$/i, "").trim();
      if (cleanTitle.includes(" - ")) {
        const parts = cleanTitle.split(" - ");
        name = parts[0].trim();
        headline = parts.slice(1).join(" - ").trim();
      } else {
        name = cleanTitle;
      }
    }
    
    const h1 = document.querySelector('h1');
    if (!name && h1) {
      name = h1.innerText.trim();
    }

    // 2. Find the TOP CARD specifically (to avoid sidebar junk)
    let topCardText = "";
    let topCardEl = document.body;
    if (h1) {
      topCardEl = h1.closest('section') || h1.parentElement?.parentElement?.parentElement || document.body;
      topCardText = topCardEl.innerText || "";
    } else {
      const main = document.querySelector('main');
      if (main) {
        topCardEl = main;
        topCardText = main.innerText || "";
      } else {
        topCardText = document.body.innerText || "";
      }
    }
    
    // Followers (Strictly 'followers' only, no guessing 'connections')
    let followers = "";
    const followerMatch = topCardText.match(/([\d,\.]+[KkMm]?)\s+followers?/i);
    if (followerMatch) {
      followers = followerMatch[1];
    }
    
    // Location
    let location = "";
    const locMatch = topCardText.match(/([^\n]+)\s*·\s*Contact info/i);
    if (locMatch) {
      location = locMatch[1].trim();
    } else {
      const cityStateMatch = topCardText.match(/([A-Z][a-zA-Z\s]+,\s+[A-Z][a-zA-Z\s]+(,\s+[A-Z][a-zA-Z\s]+)?)/);
      if (cityStateMatch) location = cityStateMatch[1];
    }

    // Headline fallback using top card text
    if (!headline && name) {
      const lines = topCardText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const nameIndex = lines.findIndex(l => l.includes(name) || name.includes(l));
      if (nameIndex >= 0) {
        for (let i = nameIndex + 1; i < nameIndex + 5 && i < lines.length; i++) {
          const line = lines[i];
          const skips = ["degree connection", "He/Him", "She/Her", "They/Them", "Verify", "Premium", "View profile"];
          if (skips.some(w => line.includes(w))) continue;
          headline = line;
          break;
        }
      }
    }
    
    // Company: Prioritize explicit button, then headline, then links
    let company = "";
    
    // 1. Explicit "Current company" aria-label
    const currentCompanyEl = topCardEl.querySelector('[aria-label^="Current company"]');
    if (currentCompanyEl) {
      const match = currentCompanyEl.getAttribute('aria-label').match(/Current company:\s*([^.]+)/i);
      if (match) {
        company = match[1].trim();
      } else {
        company = currentCompanyEl.innerText.split('\n')[0].trim();
      }
    }
    
    // 2. Extract from headline (e.g. "CEO at Google")
    if (!company && headline) {
      const seps = [" at ", " @ "];
      for (const sep of seps) {
        if (headline.toLowerCase().includes(sep)) {
          const parts = headline.split(new RegExp(sep, 'i'));
          if (parts.length > 1) {
            company = parts.pop().trim();
            // Clean up trailing titles (e.g. "Google | Angel Investor")
            company = company.split('|')[0].split('-')[0].trim();
            break;
          }
        }
      }
    }

    // 3. Fallback: First valid company/school link in the top card
    if (!company) {
      const companyLinks = topCardEl.querySelectorAll("a[href*='/company/'], a[href*='/school/']");
      for (const link of companyLinks) {
        const txt = link.innerText.trim();
        if (txt && txt.length > 1 && txt.length < 60 && !txt.toLowerCase().includes("mutual")) {
          company = txt.split('\n')[0].trim();
          break;
        }
      }
    }

    name = name.replace(/\s*✓\s*$/, "").replace(/\s*☑\s*$/, "").trim();

    return {
      name: name || "Unknown",
      headline: headline || "",
      company: company || "",
      location: location || "",
      followers: followers || "",
      profileUrl: window.location.href.split("?")[0],
      savedAt: new Date().toISOString()
    };
  }

  return universalScraper();
})();

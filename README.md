# LeadSaver — LinkedIn to Google Sheets Chrome Extension

A lightweight Chrome Extension that extracts LinkedIn profile data and saves it to your Google Sheet with one click.

---

## Quick Setup (5 Minutes)

### Step 1: Set Up Google Sheets (The Backend)

1. Go to [Google Sheets](https://sheets.google.com) and create a **new blank spreadsheet**.
2. In **Row 1**, type these headers across the columns:

   | A | B | C | D | E | F |
   |---|---|---|---|---|---|
   | Name | Headline | Company | Location | Profile URL | Saved At |

3. Click **Extensions → Apps Script** from the top menu.
4. Delete any existing code in the editor.
5. Open the file `google-apps-script/Code.gs` from this project and copy-paste the entire contents into the Apps Script editor.
6. Click **Deploy → New Deployment**.
7. Set the type to **Web app**.
8. Set **Execute as** → `Me`.
9. Set **Who has access** → `Anyone`.
10. Click **Deploy**, authorize the script, and **copy the Web App URL** it gives you.

> ⚠️ Keep this URL private. Anyone with this URL can write to your sheet.

---

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** (toggle in the top-right corner).
3. Click **Load unpacked**.
4. Select the root `leadsaver/` folder (the folder containing `manifest.json`).
5. The LeadSaver extension icon should now appear in your Chrome toolbar. Pin it for easy access.

---

### Step 3: Connect the Extension to Your Sheet

1. Click the **LeadSaver** icon in your Chrome toolbar.
2. Click the **⚙ Settings** gear icon in the top-right corner.
3. Paste the **Google Apps Script Web App URL** you copied in Step 1.
4. Click **Save Settings**.

---

### Step 4: Save Your First Lead

1. Navigate to any LinkedIn profile page (e.g., `linkedin.com/in/someone`).
2. Click the **LeadSaver** icon.
3. You will see a preview card with the person's name, headline, company, and location.
4. Click **"Save to Google Sheets"**.
5. Open your Google Sheet — the lead data should appear instantly in a new row! 🎉

---

## Project Structure

```
leadsaver/
├── manifest.json              # Chrome extension configuration
├── README.md                  # This file
│
├── config/
│   └── config.js              # Centralized settings & selectors
│
├── utils/
│   └── utils.js               # Shared utility functions
│
├── popup/
│   ├── popup.html             # Extension popup UI
│   ├── popup.css              # Styling (dark mode, glassmorphism)
│   └── popup.js               # Popup interaction logic
│
├── content/
│   └── content.js             # LinkedIn page scraper
│
├── background/
│   └── background.js          # Service Worker (API calls, storage)
│
├── google-apps-script/
│   └── Code.gs                # Google Apps Script (paste into Sheets)
│
└── icons/
    ├── icon16.png             # Toolbar icon
    ├── icon48.png             # Extensions page icon
    └── icon128.png            # Chrome Web Store icon
```

---

## Features

- ✅ One-click LinkedIn profile scraping
- ✅ Instant save to Google Sheets via webhook
- ✅ Duplicate lead detection (prevents re-saving the same profile)
- ✅ Session & lifetime stats tracking
- ✅ Settings panel to configure the webhook URL
- ✅ Premium dark-mode UI with micro-animations
- ✅ Toast notifications for success/error feedback
- ✅ Zero external dependencies (pure HTML/CSS/JS)
- ✅ Manifest V3 compliant (latest Chrome standard)

---

## Customization

### Changing the Visual Theme
All design tokens (colors, fonts, spacing) are defined as CSS Custom Properties in `popup/popup.css` under the `:root` selector. Change any value there to instantly re-theme the entire extension.

### Adding New Data Fields
1. Update the selectors in `config/config.js`.
2. Add the corresponding scraping logic in `content/content.js`.
3. Update the Google Apps Script (`Code.gs`) to include the new column.

### Updating LinkedIn Selectors
LinkedIn occasionally changes its HTML structure. When that happens:
1. Right-click the element on LinkedIn → Inspect.
2. Find the new CSS selector.
3. Update `content/content.js` (the `SEL` object at the top).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Extension Core | Chrome Manifest V3, Vanilla JavaScript |
| UI | HTML5, CSS3 (Dark Mode, Glassmorphism) |
| Backend | Google Apps Script (free, serverless) |
| Database | Google Sheets (user-owned) |
| Fonts | Inter (Google Fonts) |

---

## License

MIT — Use it, modify it, sell it. No restrictions.

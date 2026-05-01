# 📈 S&P 500 Market Calendar

A clean, iOS-inspired calendar that aggregates **earnings reports**, **ex-dividend dates**, **dividend payments**, **stock splits**, and **IPOs** for S&P 500 companies — all sorted chronologically and color-coded by event type.

> Pure HTML/CSS/JS. No build step. No backend. Powered by **Alpha Vantage**. Just open `index.html` or deploy to GitHub Pages.

---

## ✨ Features

- 📅 **Chronological timeline** — every event from S&P 500 names, in date order
- 🎨 **Color-coded by type** — earnings (red), ex-dividend (green), dividend payment (blue), splits (purple), IPOs (orange)
- 🔍 **Filter by event type** — tap a chip to see only earnings, only dividends, etc.
- 🔎 **Search** — by ticker (`AAPL`) or company name (`Tesla`)
- 📊 **Estimates vs actuals** — for past earnings, see EPS beat/miss with percentage and surprise %
- 📱 **iOS aesthetic** — sheet-style detail view, blur header, smooth animations, dark mode support
- 🌐 **Live data** — pulls from Alpha Vantage (your API key is already wired in); cached for 24 hours
- 🛟 **Demo fallback** — if API is blocked or rate-limited, automatically uses realistic mock data

---

## 🚀 Quick Start

### Option 1: GitHub Pages (recommended)

1. Create a new repo on GitHub (e.g. `sp500-calendar`)
2. Upload all files from this folder (or push via Git)
3. Go to **Settings → Pages**
4. Under "Source", choose **Deploy from a branch** → `main` → `/ (root)` → **Save**
5. Wait ~1 minute, then visit `https://YOUR_USERNAME.github.io/sp500-calendar/`

### Option 2: Run locally

```bash
# Just open the file
open index.html

# Or serve it (recommended — fetch works better)
python3 -m http.server 8000
# then visit http://localhost:8000
```

---

## 🔑 API Key

Your Alpha Vantage API key is already configured in `js/api.js`:

```js
const API_KEY = "RLO2OFNKRE8PNDEY";
```

**⚠️ Security note:** Because this is a frontend-only app, the API key is visible in the browser. That's acceptable for personal use, but **don't reuse this key for anything sensitive**. If you ever need to rotate it, get a new key at https://www.alphavantage.co/support/#api-key and replace it in `js/api.js`.

### Free tier limits
Alpha Vantage free tier: **25 API calls per day** and **5 per minute**. To stay within these:

- **Bulk endpoints used first.** `EARNINGS_CALENDAR` and `IPO_CALENDAR` each return hundreds of events in a single call.
- **24-hour cache.** Once data is loaded, it's stored in `localStorage` for 24 hours. Hit the refresh button (top right) only when you need fresh data.
- **Per-ticker calls limited.** Dividend dates and past-earnings actuals require per-ticker calls. The app limits these to ~14 tickers per refresh (8 dividends + 6 past earnings) — tune `DIVIDEND_ENRICH_LIMIT` and `PAST_EARNINGS_ENRICH_LIMIT` in `js/api.js` if needed.

A full refresh uses ~16 of your 25 daily calls. Use the refresh button sparingly.

---

## 📂 Project Structure

```
sp500-calendar/
├── index.html          # Main page
├── css/
│   └── styles.css      # iOS-inspired styling, dark mode
├── js/
│   ├── api.js          # Alpha Vantage data layer + 24h cache
│   └── app.js          # UI rendering & interaction
├── data/
│   └── sp500.js        # S&P 500 ticker list (~110 top names)
├── README.md
├── LICENSE
└── .gitignore
```

---

## 🎨 Color Coding

| Event type        | Color     | Meaning                                    |
| ----------------- | --------- | ------------------------------------------ |
| Earnings          | 🔴 Red    | Quarterly EPS report                       |
| Ex-Dividend       | 🟢 Green  | Last day to buy and qualify for dividend   |
| Dividend Payment  | 🔵 Blue   | Cash payout to shareholders                |
| Stock Split       | 🟣 Purple | Share count change (e.g. 2-for-1)          |
| IPO               | 🟠 Orange | New listing                                |

---

## 🔧 How the data works

The app calls Alpha Vantage in this order:

1. **`EARNINGS_CALENDAR`** — one call returns all upcoming earnings for the next 3 months. Filtered to S&P 500 tickers only.
2. **`IPO_CALENDAR`** — one call returns all upcoming IPOs.
3. **`EARNINGS`** (per ticker, top 6) — for recently-reported earnings, fetches actual EPS so the app can show **beat/miss vs estimates** with surprise %.
4. **`OVERVIEW`** (per ticker, top 8) — fetches `ExDividendDate` and `DividendDate` for the largest S&P 500 names.

All requests go through a CORS-proxy chain because Alpha Vantage doesn't allow direct browser calls in all environments. If proxies are unavailable, the app falls back to demo data.

---

## 🧩 Customizing

### Add more tickers
Edit `data/sp500.js` and append:
```js
{ ticker: "TICKER", name: "Company Name" }
```

### Pull dividends for more tickers
Open `js/api.js` and increase:
```js
const DIVIDEND_ENRICH_LIMIT = 8;        // ↑ to 15, 20, etc.
const PAST_EARNINGS_ENRICH_LIMIT = 6;
```
**Note:** each increment uses 1 more daily API call. Stay below ~20 total.

### Change colors
All event colors are CSS variables in `css/styles.css` under `:root`:
```css
--c-earnings: #ff453a;
--c-ex-dividend: #30d158;
/* etc. */
```

### Force a refresh
Tap the **circular refresh icon** in the header. It clears the cache and re-fetches.

---

## 🌙 Dark mode

Automatic — follows your system preference (`prefers-color-scheme: dark`).

---

## 📝 Tech notes

- **No dependencies, no build.** Loads two Google Fonts (Fraunces for headings, Inter for body).
- **Caching:** 24-hour TTL in `localStorage` to respect the free tier.
- **Sheet UX:** swipe-down to dismiss on mobile, ESC key on desktop, tap backdrop to close.
- **Accessibility:** keyboard navigation, ARIA roles on the sheet.

---

## 🪄 Roadmap ideas

- [ ] Calendar grid view (month at a glance)
- [ ] iCal export — `.ics` file you can subscribe to
- [ ] Personal watchlist (filter by user-saved tickers)
- [ ] Stock-split data (Alpha Vantage doesn't have a bulk splits endpoint — would need a different source)
- [ ] Move API key to a serverless proxy for true security (e.g. Cloudflare Worker)

---

## 📜 License

MIT — do whatever you want, attribution appreciated.

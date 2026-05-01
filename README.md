# 📈 S&P 500 Market Calendar

A clean, iOS-inspired calendar that aggregates **earnings reports**, **ex-dividend dates**, **dividend payments**, **stock splits**, and **IPOs** for S&P 500 companies — all sorted chronologically and color-coded by event type.

> Pure HTML/CSS/JS. No build step. No backend. Just open `index.html` or deploy to GitHub Pages.

---

## ✨ Features

- 📅 **Chronological timeline** — every event from S&P 500 names, in date order
- 🎨 **Color-coded by type** — earnings (red), ex-dividend (green), dividend payment (blue), splits (purple), IPOs (orange)
- 🔍 **Filter by event type** — tap a chip to see only earnings, only dividends, etc.
- 🔎 **Search** — by ticker (`AAPL`) or company name (`Tesla`)
- 📊 **Estimates vs actuals** — for past earnings, see EPS beat/miss with percentage
- 📱 **iOS aesthetic** — sheet-style detail view, blur header, smooth animations, dark mode support
- 🌐 **Live data** — pulls from Yahoo Finance (via CORS proxies); cached for 6 hours
- 🛟 **Demo fallback** — if live API is blocked, automatically uses realistic mock data so the UI is always functional

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

## 📂 Project Structure

```
sp500-calendar/
├── index.html          # Main page
├── css/
│   └── styles.css      # iOS-inspired styling, dark mode
├── js/
│   ├── api.js          # Data layer (Yahoo Finance + fallback)
│   └── app.js          # UI rendering & interaction
├── data/
│   └── sp500.js        # S&P 500 ticker list (~110 top names)
└── README.md
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

The app tries to fetch real data from **Yahoo Finance** via three rotating CORS proxies (browsers can't hit Yahoo directly because of CORS). Results are cached in `localStorage` for 6 hours.

### If the live API is blocked
Public CORS proxies are rate-limited and sometimes go down. When that happens, the app **automatically falls back to realistic demo data** so you always see a working UI. The status bar will show "demo data (live API blocked)".

### To use a real API key (optional upgrade)
For production-grade reliability, swap to a free API like:
- [Finnhub](https://finnhub.io/) — generous free tier, earnings calendar endpoint
- [Alpha Vantage](https://www.alphavantage.co/) — free tier with rate limits
- [Polygon.io](https://polygon.io/) — free tier for end-of-day data

Open `js/api.js` and add your fetcher in `loadEvents()`.

---

## 🧩 Customizing

### Add more tickers
Edit `data/sp500.js` and append objects of the form:
```js
{ ticker: "TICKER", name: "Company Name" }
```

### Change colors
All colors are CSS variables in `css/styles.css` under `:root`. Look for `--c-earnings`, `--c-ex-dividend`, etc.

### Change the time window
Currently shows everything the API returns (typically next earnings date + dividend dates). To restrict to "next 30 days" only, filter `allEvents` in `js/app.js` after loading.

---

## 🌙 Dark mode

Automatic — follows your system preference (`prefers-color-scheme: dark`).

---

## 📝 Tech notes

- **No dependencies, no build.** Loads two Google Fonts (Fraunces for headings, Inter for body). Everything else is vanilla.
- **Caching:** 6-hour TTL in `localStorage`. Hit the refresh button (top right) to force a refetch.
- **Sheet UX:** swipe-down to dismiss on mobile, ESC key on desktop, tap backdrop to close.
- **Accessibility:** keyboard navigation, ARIA roles on the sheet, color contrast meets WCAG AA on key text.

---

## 🪄 Roadmap ideas

- [ ] Calendar grid view (month at a glance)
- [ ] iCal export — `.ics` file you can subscribe to
- [ ] Push notifications (PWA install + service worker)
- [ ] Personal watchlist (filter by user-saved tickers)
- [ ] Historical earnings chart per ticker

---

## 📜 License

MIT — do whatever you want, attribution appreciated.

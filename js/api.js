/* ============================================
   Data layer — Alpha Vantage
   - Uses bulk endpoints (1 request per data type)
   - Earnings: EARNINGS_CALENDAR (CSV, all upcoming)
   - IPOs:     IPO_CALENDAR (CSV, all upcoming)
   - Dividends: OVERVIEW per ticker (limited subset due to API quota)
   - Past earnings (for actuals): EARNINGS per ticker (limited subset)
   - Caches 24h in localStorage to respect 25 req/day free tier
   ============================================ */

(function () {
  /* ---------- CONFIG ---------- */
  // Your Alpha Vantage API key
  const API_KEY = "RLO2OFNKRE8PNDEY";

  const CACHE_KEY = "sp500_av_cache_v1";
  const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (respect free-tier 25/day)

  // Alpha Vantage CORS — proxy chain fallback
  const CORS_PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest="
  ];

  // For dividend & past-earnings enrichment, only pull top N tickers
  // (each ticker = 1 API call, free tier = 25/day total)
  const DIVIDEND_ENRICH_LIMIT = 8;
  const PAST_EARNINGS_ENRICH_LIMIT = 6;

  /* ---------- Cache ---------- */
  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.savedAt > CACHE_TTL_MS) return null;
      return parsed.data;
    } catch { return null; }
  }
  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
    } catch {}
  }
  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  /* ---------- Fetch with proxy chain ---------- */
  async function fetchTextWithProxies(targetUrl) {
    let lastErr = null;
    // Try direct first
    try {
      const r = await fetch(targetUrl);
      if (r.ok) {
        const txt = await r.text();
        if (txt && !txt.toLowerCase().startsWith("<!doctype")) return txt;
      }
    } catch (e) { lastErr = e; }

    for (const proxy of CORS_PROXIES) {
      try {
        const url = proxy + encodeURIComponent(targetUrl);
        const res = await fetch(url);
        if (!res.ok) continue;
        const txt = await res.text();
        if (txt && txt.length > 20) return txt;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error("All proxies failed");
  }

  async function fetchJsonWithProxies(targetUrl) {
    const txt = await fetchTextWithProxies(targetUrl);
    return JSON.parse(txt);
  }

  /* ---------- CSV parser (lightweight) ---------- */
  function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map(h => h.trim());
    return lines.slice(1).map(line => {
      const cells = line.split(",");
      const row = {};
      headers.forEach((h, i) => row[h] = (cells[i] || "").trim());
      return row;
    });
  }

  /* ---------- S&P 500 lookups ---------- */
  const SP500_SET = new Set((window.SP500_TICKERS || []).map(t => t.ticker));
  const SP500_NAME = {};
  (window.SP500_TICKERS || []).forEach(t => SP500_NAME[t.ticker] = t.name);

  /* ---------- Endpoints ---------- */

  // EARNINGS_CALENDAR returns CSV: symbol,name,reportDate,fiscalDateEnding,estimate,currency
  async function fetchEarningsCalendar() {
    const url = `https://www.alphavantage.co/query?function=EARNINGS_CALENDAR&horizon=3month&apikey=${API_KEY}`;
    const csv = await fetchTextWithProxies(url);
    if (csv.includes("Information") && csv.length < 500) {
      throw new Error("Rate limited: " + csv.slice(0, 200));
    }
    const rows = parseCSV(csv);
    const events = [];
    rows.forEach(r => {
      if (!r.symbol || !r.reportDate) return;
      if (!SP500_SET.has(r.symbol)) return; // filter to S&P 500
      const date = new Date(r.reportDate + "T13:30:00Z");
      if (isNaN(date.getTime())) return;
      events.push({
        id: `${r.symbol}-earnings-${r.reportDate}`,
        ticker: r.symbol,
        name: r.name || SP500_NAME[r.symbol] || r.symbol,
        type: "earnings",
        date: date.toISOString(),
        epsEstimate: r.estimate ? parseFloat(r.estimate) : null,
        epsActual: null,
        revenueEstimate: null,
        revenueActual: null,
        fiscalEnding: r.fiscalDateEnding || null,
        currency: r.currency || "USD"
      });
    });
    return events;
  }

  // IPO_CALENDAR returns CSV: symbol,name,ipoDate,priceRangeLow,priceRangeHigh,currency,exchange
  async function fetchIPOCalendar() {
    const url = `https://www.alphavantage.co/query?function=IPO_CALENDAR&apikey=${API_KEY}`;
    const csv = await fetchTextWithProxies(url);
    if (csv.includes("Information") && csv.length < 500) {
      throw new Error("Rate limited");
    }
    const rows = parseCSV(csv);
    const events = [];
    rows.forEach(r => {
      if (!r.symbol || !r.ipoDate) return;
      const date = new Date(r.ipoDate + "T13:30:00Z");
      if (isNaN(date.getTime())) return;
      const low  = r.priceRangeLow  ? parseFloat(r.priceRangeLow)  : null;
      const high = r.priceRangeHigh ? parseFloat(r.priceRangeHigh) : null;
      const mid = (low != null && high != null) ? (low + high) / 2 : (low || high);
      events.push({
        id: `${r.symbol}-ipo-${r.ipoDate}`,
        ticker: r.symbol,
        name: r.name || r.symbol,
        type: "ipo",
        date: date.toISOString(),
        ipoPrice: mid,
        priceRangeLow: low,
        priceRangeHigh: high,
        exchange: r.exchange || "—",
        currency: r.currency || "USD"
      });
    });
    return events;
  }

  // OVERVIEW returns JSON with ExDividendDate and DividendDate
  async function fetchOverview(ticker) {
    const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${ticker}&apikey=${API_KEY}`;
    const json = await fetchJsonWithProxies(url);
    if (json.Information || json.Note) throw new Error("Rate limited");
    return json;
  }

  // EARNINGS returns JSON with quarterlyEarnings: [{ fiscalDateEnding, reportedDate, reportedEPS, estimatedEPS, surprise, surprisePercentage }]
  async function fetchPastEarnings(ticker) {
    const url = `https://www.alphavantage.co/query?function=EARNINGS&symbol=${ticker}&apikey=${API_KEY}`;
    const json = await fetchJsonWithProxies(url);
    if (json.Information || json.Note) throw new Error("Rate limited");
    return json;
  }

  function extractDividendEvents(ticker, name, ov) {
    const events = [];
    const exDiv = ov.ExDividendDate;
    const divDate = ov.DividendDate;
    const rate = ov.DividendPerShare && ov.DividendPerShare !== "None"
      ? parseFloat(ov.DividendPerShare) : null;
    const yld  = ov.DividendYield && ov.DividendYield !== "None"
      ? parseFloat(ov.DividendYield)   : null;

    if (exDiv && exDiv !== "None" && exDiv !== "0000-00-00") {
      const d = new Date(exDiv + "T09:30:00Z");
      if (!isNaN(d.getTime())) {
        events.push({
          id: `${ticker}-exdiv-${exDiv}`,
          ticker, name,
          type: "ex-dividend",
          date: d.toISOString(),
          dividendRate: rate,
          dividendYield: yld
        });
      }
    }
    if (divDate && divDate !== "None" && divDate !== "0000-00-00") {
      const d = new Date(divDate + "T09:30:00Z");
      if (!isNaN(d.getTime())) {
        events.push({
          id: `${ticker}-divpay-${divDate}`,
          ticker, name,
          type: "dividend-payment",
          date: d.toISOString(),
          dividendRate: rate,
          dividendYield: yld
        });
      }
    }
    return events;
  }

  /* ---------- Mock fallback ---------- */
  function makeMockEvents() {
    const events = [];
    const now = new Date();
    const tickerData = window.SP500_TICKERS;
    let s = now.getFullYear() * 1000 + now.getMonth() * 32 + now.getDate();
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

    for (let i = 0; i < 90; i++) {
      const stock = tickerData[Math.floor(rand() * tickerData.length)];
      const dayOffset = Math.floor(rand() * 60) - 5;
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(13, 30, 0, 0);

      const r = rand();
      let type;
      if (r < 0.45) type = "earnings";
      else if (r < 0.65) type = "ex-dividend";
      else if (r < 0.85) type = "dividend-payment";
      else if (r < 0.95) type = "split";
      else type = "ipo";

      const ev = {
        id: `${stock.ticker}-${type}-${date.toISOString()}-${i}`,
        ticker: stock.ticker, name: stock.name, type,
        date: date.toISOString()
      };

      if (type === "earnings") {
        const est = +(rand() * 4 + 0.3).toFixed(2);
        const past = dayOffset < 0;
        ev.epsEstimate = est;
        ev.revenueEstimate = Math.round((rand() * 80 + 5) * 1e9);
        if (past) {
          const beatRoll = rand();
          let actual = beatRoll < 0.65 ? +(est * (1 + rand() * 0.08)).toFixed(2)
                     : beatRoll < 0.85 ? +(est * (1 - rand() * 0.06)).toFixed(2)
                     : est;
          ev.epsActual = actual;
          ev.revenueActual = Math.round(ev.revenueEstimate * (0.95 + rand() * 0.12));
        }
      } else if (type === "ex-dividend" || type === "dividend-payment") {
        ev.dividendRate = +(rand() * 4 + 0.2).toFixed(2);
        ev.dividendYield = +(rand() * 0.04 + 0.005).toFixed(4);
      } else if (type === "split") {
        ev.splitRatio = ["2-for-1","3-for-1","4-for-1"][Math.floor(rand() * 3)];
      } else if (type === "ipo") {
        ev.ipoPrice = +(rand() * 50 + 10).toFixed(2);
        ev.exchange = rand() > 0.5 ? "NASDAQ" : "NYSE";
      }
      events.push(ev);
    }
    return events;
  }

  /* ---------- Main loader ---------- */
  async function loadEvents({ useCache = true, onProgress } = {}) {
    if (useCache) {
      const cached = readCache();
      if (cached && cached.length) return { events: cached, source: "cache" };
    }

    const collected = [];
    let liveOK = false;

    // Step 1: Earnings calendar (1 API call, returns hundreds)
    try {
      if (onProgress) onProgress("Loading earnings calendar…");
      const earnings = await fetchEarningsCalendar();
      collected.push(...earnings);
      if (earnings.length > 0) liveOK = true;
    } catch (e) {
      console.warn("Earnings calendar failed:", e.message);
    }

    // Step 2: IPO calendar (1 API call)
    try {
      if (onProgress) onProgress("Loading IPO calendar…");
      const ipos = await fetchIPOCalendar();
      collected.push(...ipos);
      if (ipos.length > 0) liveOK = true;
    } catch (e) {
      console.warn("IPO calendar failed:", e.message);
    }

    // Step 3: Past earnings actuals — for top recent earnings, pull EARNINGS endpoint
    const today = Date.now();
    const recentEarnings = collected
      .filter(e => e.type === "earnings" && new Date(e.date).getTime() < today + 86400000)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, PAST_EARNINGS_ENRICH_LIMIT);

    for (let i = 0; i < recentEarnings.length; i++) {
      const ev = recentEarnings[i];
      try {
        if (onProgress) onProgress(`Past earnings ${ev.ticker} (${i+1}/${recentEarnings.length})`);
        const past = await fetchPastEarnings(ev.ticker);
        const q = past.quarterlyEarnings || [];
        if (q.length) {
          const target = new Date(ev.date).getTime();
          const match = q.find(quarterly => {
            if (!quarterly.reportedDate) return false;
            const t = new Date(quarterly.reportedDate).getTime();
            return Math.abs(t - target) < 5 * 86400000;
          }) || q[0];
          if (match) {
            ev.epsActual = match.reportedEPS && match.reportedEPS !== "None"
              ? parseFloat(match.reportedEPS) : null;
            if (match.estimatedEPS && match.estimatedEPS !== "None") {
              ev.epsEstimate = parseFloat(match.estimatedEPS);
            }
            if (match.surprisePercentage && match.surprisePercentage !== "None") {
              ev.surprisePct = parseFloat(match.surprisePercentage);
            }
          }
        }
      } catch (e) { /* keep going */ }
      await new Promise(r => setTimeout(r, 100));
    }

    // Step 4: Dividends — top N S&P 500 tickers
    const topForDividends = (window.SP500_TICKERS || []).slice(0, DIVIDEND_ENRICH_LIMIT);
    for (let i = 0; i < topForDividends.length; i++) {
      const t = topForDividends[i];
      try {
        if (onProgress) onProgress(`Dividends ${t.ticker} (${i+1}/${topForDividends.length})`);
        const ov = await fetchOverview(t.ticker);
        const divEvents = extractDividendEvents(t.ticker, t.name, ov);
        collected.push(...divEvents);
      } catch (e) { /* skip */ }
      await new Promise(r => setTimeout(r, 100));
    }

    if (liveOK && collected.length > 5) {
      writeCache(collected);
      return { events: collected, source: "live" };
    }

    return { events: makeMockEvents(), source: "demo" };
  }

  // Expose
  window.MarketAPI = {
    loadEvents,
    clearCache,
    getApiKey: () => API_KEY
  };
})();

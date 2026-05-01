/* ============================================
   Data layer
   - Tries Yahoo Finance (via CORS proxy)
   - Falls back to realistic mock data
   - Caches in localStorage for 6 hours
   ============================================ */

(function () {
  const CACHE_KEY = "sp500_calendar_cache_v1";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

  // Public CORS proxies — fallback chain. Yahoo blocks direct browser calls.
  // We try several so the app keeps working if one is rate-limited.
  const CORS_PROXIES = [
    "https://api.allorigins.win/raw?url=",
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest="
  ];

  /* ---------- Cache helpers ---------- */
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
      localStorage.setItem(CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        data
      }));
    } catch {}
  }

  /* ---------- Yahoo Finance fetchers ---------- */

  async function fetchWithProxies(targetUrl) {
    for (const proxy of CORS_PROXIES) {
      try {
        const url = proxy + encodeURIComponent(targetUrl);
        const res = await fetch(url, { method: "GET" });
        if (!res.ok) continue;
        const txt = await res.text();
        return JSON.parse(txt);
      } catch (e) {
        // try next proxy
      }
    }
    throw new Error("All CORS proxies failed for " + targetUrl);
  }

  // Yahoo earnings calendar via "quoteSummary" calendarEvents module
  // Returns next earnings date, EPS estimate, and dividend info
  async function fetchYahooQuoteSummary(ticker) {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=calendarEvents,earnings,defaultKeyStatistics,summaryDetail`;
    return fetchWithProxies(url);
  }

  /* ---------- Event extraction ---------- */

  function unixToDate(unix) {
    if (!unix) return null;
    return new Date(unix * 1000);
  }

  function extractEventsFromQuote(ticker, name, json) {
    const events = [];
    if (!json || !json.quoteSummary || !json.quoteSummary.result) return events;
    const result = json.quoteSummary.result[0];
    if (!result) return events;

    const cal = result.calendarEvents || {};
    const earnings = result.earnings || {};
    const summary = result.summaryDetail || {};

    // ---- Earnings date ----
    if (cal.earnings && cal.earnings.earningsDate && cal.earnings.earningsDate.length) {
      const dateRaw = cal.earnings.earningsDate[0];
      const date = unixToDate(dateRaw && (dateRaw.raw || dateRaw));
      if (date) {
        events.push({
          id: `${ticker}-earnings-${date.toISOString()}`,
          ticker,
          name,
          type: "earnings",
          date: date.toISOString(),
          epsEstimate: cal.earnings.earningsAverage ? cal.earnings.earningsAverage.raw : null,
          epsLow:      cal.earnings.earningsLow     ? cal.earnings.earningsLow.raw : null,
          epsHigh:     cal.earnings.earningsHigh    ? cal.earnings.earningsHigh.raw : null,
          revenueEstimate: cal.earnings.revenueAverage ? cal.earnings.revenueAverage.raw : null,
          // Actual values come from earnings module (past quarters)
          epsActual: null,
          revenueActual: null
        });
      }
    }

    // ---- Past earnings (with actual results vs expectations) ----
    if (earnings.earningsChart && Array.isArray(earnings.earningsChart.quarterly)) {
      earnings.earningsChart.quarterly.forEach(q => {
        // q has {date: "1Q2024", actual: {raw}, estimate: {raw}}
        // We don't have a precise date, so we approximate to mid-quarter
        // Skipped — these are historical; we focus on upcoming. But we can use them
        // to enrich the upcoming earnings card with last-quarter context if needed.
      });
    }

    // ---- Ex-dividend date ----
    const exDivUnix = cal.exDividendDate && (cal.exDividendDate.raw || cal.exDividendDate);
    if (exDivUnix) {
      const date = unixToDate(exDivUnix);
      if (date) {
        events.push({
          id: `${ticker}-exdiv-${date.toISOString()}`,
          ticker,
          name,
          type: "ex-dividend",
          date: date.toISOString(),
          dividendRate: summary.dividendRate ? summary.dividendRate.raw : null,
          dividendYield: summary.dividendYield ? summary.dividendYield.raw : null
        });
      }
    }

    // ---- Dividend payment date ----
    const divDateUnix = cal.dividendDate && (cal.dividendDate.raw || cal.dividendDate);
    if (divDateUnix) {
      const date = unixToDate(divDateUnix);
      if (date) {
        events.push({
          id: `${ticker}-divpay-${date.toISOString()}`,
          ticker,
          name,
          type: "dividend-payment",
          date: date.toISOString(),
          dividendRate: summary.dividendRate ? summary.dividendRate.raw : null,
          dividendYield: summary.dividendYield ? summary.dividendYield.raw : null
        });
      }
    }

    return events;
  }

  /* ---------- Mock data generator (fallback when proxies fail) ---------- */

  function makeMockEvents() {
    const events = [];
    const now = new Date();
    const types = ["earnings", "ex-dividend", "dividend-payment", "split", "ipo"];
    const tickerData = window.SP500_TICKERS;

    // Seeded pseudo-random for stability across reloads (same day)
    const seed = now.getFullYear() * 1000 + now.getMonth() * 32 + now.getDate();
    let s = seed;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    // Spread events across ~60 days
    for (let i = 0; i < 90; i++) {
      const stock = tickerData[Math.floor(rand() * tickerData.length)];
      const dayOffset = Math.floor(rand() * 60) - 5; // -5 .. +55 days
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(13, 30, 0, 0); // pre-market typical

      const r = rand();
      let type;
      if (r < 0.45) type = "earnings";
      else if (r < 0.65) type = "ex-dividend";
      else if (r < 0.85) type = "dividend-payment";
      else if (r < 0.95) type = "split";
      else type = "ipo";

      const ev = {
        id: `${stock.ticker}-${type}-${date.toISOString()}-${i}`,
        ticker: stock.ticker,
        name: stock.name,
        type,
        date: date.toISOString()
      };

      if (type === "earnings") {
        const est = +(rand() * 4 + 0.3).toFixed(2);
        const past = dayOffset < 0;
        ev.epsEstimate = est;
        ev.epsLow = +(est * 0.9).toFixed(2);
        ev.epsHigh = +(est * 1.1).toFixed(2);
        ev.revenueEstimate = Math.round((rand() * 80 + 5) * 1e9);
        if (past) {
          // generate actual: usually beats by small amount
          const beatRoll = rand();
          let actual;
          if (beatRoll < 0.65) actual = +(est * (1 + rand() * 0.08)).toFixed(2);
          else if (beatRoll < 0.85) actual = +(est * (1 - rand() * 0.06)).toFixed(2);
          else actual = est;
          ev.epsActual = actual;
          ev.revenueActual = Math.round(ev.revenueEstimate * (0.95 + rand() * 0.12));
        }
      } else if (type === "ex-dividend" || type === "dividend-payment") {
        ev.dividendRate = +(rand() * 4 + 0.2).toFixed(2);
        ev.dividendYield = +(rand() * 0.04 + 0.005).toFixed(4);
      } else if (type === "split") {
        const ratios = ["2-for-1", "3-for-1", "4-for-1", "10-for-1"];
        ev.splitRatio = ratios[Math.floor(rand() * ratios.length)];
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
    // 1. Check cache
    if (useCache) {
      const cached = readCache();
      if (cached && cached.length) return { events: cached, source: "cache" };
    }

    // 2. Try live Yahoo via proxies — limit to top 30 tickers to avoid hammering
    const topTickers = window.SP500_TICKERS.slice(0, 30);
    const collected = [];
    let liveOK = 0;

    for (let i = 0; i < topTickers.length; i++) {
      const t = topTickers[i];
      if (onProgress) onProgress(i + 1, topTickers.length, t.ticker);
      try {
        const json = await fetchYahooQuoteSummary(t.ticker);
        const evts = extractEventsFromQuote(t.ticker, t.name, json);
        collected.push(...evts);
        if (evts.length) liveOK++;
      } catch (e) {
        // skip; will fall back if too few succeed
      }
      // Tiny throttle so proxies don't rate-limit
      await new Promise(r => setTimeout(r, 80));
    }

    if (liveOK >= 5) {
      writeCache(collected);
      return { events: collected, source: "live" };
    }

    // 3. Fallback to mock
    const mock = makeMockEvents();
    return { events: mock, source: "demo" };
  }

  function clearCache() {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }

  // Expose
  window.MarketAPI = {
    loadEvents,
    clearCache
  };
})();

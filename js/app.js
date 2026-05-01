/* ============================================
   App logic
   ============================================ */

(function () {
  // State
  let allEvents = [];
  let activeFilter = "all";
  let searchQuery = "";

  // DOM
  const $timeline = document.getElementById("timeline");
  const $statusText = document.getElementById("statusText");
  const $searchInput = document.getElementById("searchInput");
  const $clearSearch = document.getElementById("clearSearch");
  const $refreshBtn = document.getElementById("refreshBtn");
  const $filterRow = document.getElementById("filterRow");
  const $sheet = document.getElementById("detailSheet");
  const $sheetBackdrop = document.getElementById("sheetBackdrop");
  const $sheetContent = document.getElementById("sheetContent");

  /* ---------- Event metadata ---------- */
  const EVENT_META = {
    "earnings": {
      label: "Earnings",
      tag: "EPS",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l6-6 4 4 7-7"/><path d="M14 8h6v6"/></svg>`,
      color: "var(--c-earnings)",
      soft: "var(--c-earnings-soft)"
    },
    "ex-dividend": {
      label: "Ex-Dividend",
      tag: "EX-DIV",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9 9h4.5a2 2 0 010 4H9M9 13h4.5a2 2 0 010 4H9"/></svg>`,
      color: "var(--c-ex-dividend)",
      soft: "var(--c-ex-dividend-soft)"
    },
    "dividend-payment": {
      label: "Dividend Payment",
      tag: "DIV PAY",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18M8 15h2"/></svg>`,
      color: "var(--c-dividend-payment)",
      soft: "var(--c-dividend-payment-soft)"
    },
    "split": {
      label: "Stock Split",
      tag: "SPLIT",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v6M8 21V11M16 3v18M3 8h10M3 16h18"/></svg>`,
      color: "var(--c-split)",
      soft: "var(--c-split-soft)"
    },
    "ipo": {
      label: "IPO",
      tag: "IPO",
      icon: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L4 14h6v8l8-12h-6V2z"/></svg>`,
      color: "var(--c-ipo)",
      soft: "var(--c-ipo-soft)"
    }
  };

  /* ---------- Helpers ---------- */
  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

  function fmtMoney(n) {
    if (n == null || isNaN(n)) return "—";
    if (Math.abs(n) >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
    if (Math.abs(n) >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
    if (Math.abs(n) >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
    return `$${n.toFixed(2)}`;
  }
  function fmtEPS(n) {
    if (n == null || isNaN(n)) return "—";
    return `$${n.toFixed(2)}`;
  }
  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return `${(n * 100).toFixed(2)}%`;
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }
  function dayKey(iso) {
    const d = new Date(iso);
    return d.toISOString().slice(0, 10);
  }
  function isToday(iso) {
    return dayKey(iso) === dayKey(new Date().toISOString());
  }

  /* ---------- Filtering ---------- */
  function applyFilters(events) {
    const q = searchQuery.trim().toLowerCase();
    return events.filter(e => {
      if (activeFilter !== "all" && e.type !== activeFilter) return false;
      if (q) {
        if (!e.ticker.toLowerCase().includes(q) &&
            !e.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }

  function groupByDay(events) {
    const groups = {};
    events.forEach(e => {
      const k = dayKey(e.date);
      if (!groups[k]) groups[k] = [];
      groups[k].push(e);
    });
    // Sort within each day by ticker
    Object.values(groups).forEach(arr => arr.sort((a, b) => a.ticker.localeCompare(b.ticker)));
    // Return sorted array
    return Object.keys(groups)
      .sort()
      .map(k => ({ dayKey: k, events: groups[k] }));
  }

  /* ---------- Render ---------- */
  function renderTimeline() {
    const filtered = applyFilters(allEvents);
    const groups = groupByDay(filtered);

    if (!groups.length) {
      $timeline.innerHTML = `
        <div class="empty">
          <div class="empty-icon">📭</div>
          <div class="empty-title">No events found</div>
          <div class="empty-text">Try clearing filters or adjusting your search.</div>
        </div>`;
      $statusText.textContent = "0 events";
      return;
    }

    const total = filtered.length;
    $statusText.textContent = `${total} event${total !== 1 ? "s" : ""} · sorted chronologically`;

    let html = "";
    groups.forEach(group => {
      const date = new Date(group.dayKey + "T12:00:00");
      const today = isToday(date.toISOString());
      html += `
        <div class="day-group">
          <div class="day-header ${today ? "is-today" : ""}">
            <div class="day-num">${date.getDate()}</div>
            <div class="day-meta">
              <div class="day-month">${MONTHS[date.getMonth()]} ${date.getFullYear()}</div>
              <div class="day-weekday">${WEEKDAYS[date.getDay()]}</div>
            </div>
          </div>`;
      group.events.forEach(e => {
        const meta = EVENT_META[e.type];
        html += `
          <div class="event-card" data-id="${e.id}"
               style="--card-color: ${meta.color}; --card-soft: ${meta.soft};">
            <div class="event-icon">${meta.icon}</div>
            <div class="event-body">
              <div class="event-title">
                <span class="event-ticker">${e.ticker}</span>
                <span class="event-tag">${meta.tag}</span>
              </div>
              <div class="event-company">${e.name}</div>
            </div>
            <div class="event-meta">
              ${renderEventMeta(e)}
            </div>
          </div>`;
      });
      html += `</div>`;
    });
    $timeline.innerHTML = html;

    // Attach click handlers
    $timeline.querySelectorAll(".event-card").forEach(card => {
      card.addEventListener("click", () => {
        const id = card.getAttribute("data-id");
        const ev = allEvents.find(x => x.id === id);
        if (ev) openSheet(ev);
      });
    });
  }

  function renderEventMeta(e) {
    if (e.type === "earnings") {
      if (e.epsActual != null && e.epsEstimate != null) {
        const diff = e.epsActual - e.epsEstimate;
        const pct = (diff / Math.abs(e.epsEstimate)) * 100;
        const cls = diff > 0.001 ? "beat" : diff < -0.001 ? "miss" : "";
        const sign = diff >= 0 ? "+" : "";
        return `
          <div class="event-value">${fmtEPS(e.epsActual)}</div>
          <div class="event-sub ${cls}">${sign}${pct.toFixed(1)}% vs est</div>`;
      }
      return `
        <div class="event-value">${fmtEPS(e.epsEstimate)}</div>
        <div class="event-sub">est. EPS</div>`;
    }
    if (e.type === "ex-dividend" || e.type === "dividend-payment") {
      return `
        <div class="event-value">${e.dividendRate != null ? "$"+e.dividendRate.toFixed(2) : "—"}</div>
        <div class="event-sub">${e.dividendYield != null ? fmtPct(e.dividendYield)+" yld" : "annual"}</div>`;
    }
    if (e.type === "split") {
      return `
        <div class="event-value">${e.splitRatio || "split"}</div>
        <div class="event-sub">ratio</div>`;
    }
    if (e.type === "ipo") {
      return `
        <div class="event-value">${e.ipoPrice != null ? "$"+e.ipoPrice.toFixed(2) : "TBD"}</div>
        <div class="event-sub">${e.exchange || "—"}</div>`;
    }
    return "";
  }

  /* ---------- Detail sheet ---------- */
  function openSheet(e) {
    const meta = EVENT_META[e.type];
    let html = `
      <div class="sheet-hero" style="--card-color: ${meta.color}; --card-soft: ${meta.soft};">
        <div class="event-icon">${meta.icon}</div>
        <div>
          <h2>${e.ticker}</h2>
          <p>${e.name} · ${meta.label}</p>
        </div>
      </div>
      <div class="sheet-section">
        <h3>Event details</h3>
        <div class="sheet-list">
          <div class="sheet-row"><span class="label">Date</span><span class="value">${fmtDate(e.date)}</span></div>
          <div class="sheet-row"><span class="label">Type</span><span class="value">${meta.label}</span></div>
          <div class="sheet-row"><span class="label">Ticker</span><span class="value">${e.ticker}</span></div>
        </div>
      </div>`;

    if (e.type === "earnings") {
      html += `<div class="sheet-section">
        <h3>Estimates vs Results</h3>
        <div class="compare-card">`;

      if (e.epsActual != null) {
        const diff = e.epsActual - e.epsEstimate;
        const pct = e.epsEstimate ? (diff / Math.abs(e.epsEstimate)) * 100 : 0;
        const status = diff > 0.001 ? "beat" : diff < -0.001 ? "miss" : "inline";
        const label = status === "beat" ? "Beat estimates" : status === "miss" ? "Missed estimates" : "In line";
        const arrow = status === "beat" ? "▲" : status === "miss" ? "▼" : "—";
        html += `
          <div class="compare-row">
            <span class="label">EPS estimate</span>
            <span class="value">${fmtEPS(e.epsEstimate)}</span>
          </div>
          <div class="compare-row">
            <span class="label">EPS actual</span>
            <span class="value ${status}">${fmtEPS(e.epsActual)}</span>
          </div>
          ${e.revenueEstimate ? `
          <div class="compare-row">
            <span class="label">Revenue estimate</span>
            <span class="value">${fmtMoney(e.revenueEstimate)}</span>
          </div>` : ""}
          ${e.revenueActual ? `
          <div class="compare-row">
            <span class="label">Revenue actual</span>
            <span class="value">${fmtMoney(e.revenueActual)}</span>
          </div>` : ""}
          <div class="compare-result ${status}">
            ${arrow} ${label} by ${Math.abs(pct).toFixed(2)}% on EPS
          </div>`;
      } else {
        html += `
          <div class="compare-row">
            <span class="label">EPS estimate (avg)</span>
            <span class="value">${fmtEPS(e.epsEstimate)}</span>
          </div>
          ${e.epsLow != null ? `
          <div class="compare-row">
            <span class="label">Estimate range</span>
            <span class="value">${fmtEPS(e.epsLow)} – ${fmtEPS(e.epsHigh)}</span>
          </div>` : ""}
          ${e.revenueEstimate ? `
          <div class="compare-row">
            <span class="label">Revenue estimate</span>
            <span class="value">${fmtMoney(e.revenueEstimate)}</span>
          </div>` : ""}
          <div class="compare-result inline">
            ⏳ Awaiting results — actuals will appear after the report
          </div>`;
      }
      html += `</div></div>`;
    }

    if (e.type === "ex-dividend" || e.type === "dividend-payment") {
      html += `<div class="sheet-section">
        <h3>Dividend information</h3>
        <div class="sheet-list">
          <div class="sheet-row"><span class="label">Annual rate</span><span class="value">${e.dividendRate != null ? "$"+e.dividendRate.toFixed(2) : "—"}</span></div>
          <div class="sheet-row"><span class="label">Yield</span><span class="value">${e.dividendYield != null ? fmtPct(e.dividendYield) : "—"}</span></div>
          <div class="sheet-row"><span class="label">Status</span><span class="value">${e.type === "ex-dividend" ? "Stock goes ex-dividend" : "Payment to holders"}</span></div>
        </div></div>`;
    }

    if (e.type === "split") {
      html += `<div class="sheet-section">
        <h3>Split details</h3>
        <div class="sheet-list">
          <div class="sheet-row"><span class="label">Ratio</span><span class="value">${e.splitRatio || "—"}</span></div>
          <div class="sheet-row"><span class="label">Effective</span><span class="value">${fmtDate(e.date)}</span></div>
        </div></div>`;
    }

    if (e.type === "ipo") {
      html += `<div class="sheet-section">
        <h3>IPO details</h3>
        <div class="sheet-list">
          <div class="sheet-row"><span class="label">Listing price</span><span class="value">${e.ipoPrice != null ? "$"+e.ipoPrice.toFixed(2) : "TBD"}</span></div>
          <div class="sheet-row"><span class="label">Exchange</span><span class="value">${e.exchange || "—"}</span></div>
        </div></div>`;
    }

    $sheetContent.innerHTML = html;
    $sheet.classList.add("visible");
    $sheetBackdrop.classList.add("visible");
  }

  function closeSheet() {
    $sheet.classList.remove("visible");
    $sheetBackdrop.classList.remove("visible");
  }

  /* ---------- Loading ---------- */
  function showSkeleton() {
    let s = "";
    for (let i = 0; i < 6; i++) s += `<div class="skel"></div>`;
    $timeline.innerHTML = s;
  }

  async function load(force = false) {
    showSkeleton();
    $statusText.textContent = "Loading events…";

    if (force) window.MarketAPI.clearCache();

    const result = await window.MarketAPI.loadEvents({
      useCache: !force,
      onProgress: (msg) => {
        $statusText.textContent = msg;
      }
    });

    allEvents = result.events;

    // Sort chronologically
    allEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    let sourceLabel = "";
    if (result.source === "cache") sourceLabel = " · cached (24h)";
    else if (result.source === "live") sourceLabel = " · Alpha Vantage live";
    else if (result.source === "demo") sourceLabel = " · demo data (API rate-limited or blocked)";

    renderTimeline();
    $statusText.textContent += sourceLabel;
  }

  /* ---------- Wire up UI ---------- */
  $filterRow.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    $filterRow.querySelectorAll(".chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");
    activeFilter = chip.getAttribute("data-filter");
    renderTimeline();
  });

  $searchInput.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (searchQuery) $clearSearch.classList.add("visible");
    else $clearSearch.classList.remove("visible");
    renderTimeline();
  });
  $clearSearch.addEventListener("click", () => {
    $searchInput.value = "";
    searchQuery = "";
    $clearSearch.classList.remove("visible");
    renderTimeline();
    $searchInput.focus();
  });

  $refreshBtn.addEventListener("click", () => load(true));
  $sheetBackdrop.addEventListener("click", closeSheet);
  // Allow swipe-down to close on mobile (simple version)
  let touchStartY = null;
  $sheet.addEventListener("touchstart", (e) => {
    if ($sheet.scrollTop === 0) touchStartY = e.touches[0].clientY;
  });
  $sheet.addEventListener("touchmove", (e) => {
    if (touchStartY == null) return;
    const dy = e.touches[0].clientY - touchStartY;
    if (dy > 80) { closeSheet(); touchStartY = null; }
  });
  $sheet.addEventListener("touchend", () => { touchStartY = null; });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeSheet();
  });

  // Boot
  load(false);
})();

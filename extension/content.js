(function () {
  'use strict';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const WORK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

  function parseCurrency(s) {
    if (!s || typeof s !== 'string') return 0;
    const trimmed = s.trim();
    const cleaned = trimmed.replace(/[$,]/g, '').replace(/\s/g, '');
    const n = parseFloat(cleaned);
    if (isNaN(n)) return 0;
    if (trimmed.indexOf('(') !== -1) return -Math.abs(n);
    return n;
  }

  function parseDate(s) {
    if (!s || typeof s !== 'string') return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  function getCellText(row, dataLabel) {
    const td = row.querySelector(`td[data-label="${dataLabel}"]`);
    return td ? (td.textContent || '').trim() : '';
  }

  function parseTable(table) {
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    return rows.map((tr) => {
      const netPnlText = getCellText(tr, 'Net PnL');
      const netPnl = parseCurrency(netPnlText);
      const pnlHigh = parseCurrency(getCellText(tr, 'PnL High'));
      const pnlLow = parseCurrency(getCellText(tr, 'PnL Low'));
      const symbolEl = tr.querySelector('.symbol-badge');
      const symbol = symbolEl ? (symbolEl.textContent || '').trim() : getCellText(tr, 'Symbol');
      const dateText = getCellText(tr, 'Date');
      const date = parseDate(dateText);
      const commission = parseCurrency(getCellText(tr, 'Commission'));
      const grossPnl = netPnl + commission;
      return {
        date,
        dateStr: dateText,
        symbol,
        netPnl,
        grossPnl,
        commission,
        pnlHigh,
        pnlLow,
        dayOfWeek: date ? date.getDay() : null,
        dayName: date ? DAYS[date.getDay()] : '',
      };
    }).filter((r) => r.symbol && r.dateStr);
  }

  function computeStats(rows) {
    if (!rows.length) {
      return {
        profitableDays: 0,
        losingDays: 0,
        dayWinRatePct: 0,
        grossPnl: 0,
        totalCommission: 0,
        profitFactor: 0,
        netPnl: 0,
        expectancy: 0,
        worstDayNet: 0,
        worstIntradayLow: 0,
      };
    }
    const byDate = {};
    rows.forEach((r) => {
      const key = r.dateStr || (r.date ? r.date.toISOString().slice(0, 10) : '');
      if (!key) return;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(r);
    });
    const dateTotals = Object.keys(byDate).map((key) => ({
      date: key,
      netPnl: byDate[key].reduce((s, r) => s + r.netPnl, 0),
      grossPnl: byDate[key].reduce((s, r) => s + (r.grossPnl || r.netPnl + (r.commission || 0)), 0),
    }));
    const profitableDays = dateTotals.filter((d) => d.netPnl > 0).length;
    const losingDays = dateTotals.filter((d) => d.netPnl < 0).length;
    const totalTradingDays = dateTotals.length;
    const dayWinRatePct = totalTradingDays ? (profitableDays / totalTradingDays) * 100 : 0;

    // Profit factor = total gross (pre-comm) from profitable days ÷ total gross from losing days (standard formula, day-based)
    const grossProfitFromDays = dateTotals.filter((d) => d.grossPnl > 0).reduce((s, d) => s + d.grossPnl, 0);
    const grossLossFromDays = Math.abs(dateTotals.filter((d) => d.grossPnl < 0).reduce((s, d) => s + d.grossPnl, 0));
    const profitFactor = grossLossFromDays > 0 ? grossProfitFromDays / grossLossFromDays : (grossProfitFromDays > 0 ? 999 : 0);

    const profitable = rows.filter((r) => r.netPnl > 0);
    const losing = rows.filter((r) => r.netPnl < 0);
    const netProfit = profitable.reduce((s, r) => s + r.netPnl, 0);
    const netLoss = Math.abs(losing.reduce((s, r) => s + r.netPnl, 0));
    const netPnl = rows.reduce((s, r) => s + r.netPnl, 0);
    const totalCommission = rows.reduce((s, r) => s + (r.commission || 0), 0);
    const grossProfit = rows.filter((r) => r.grossPnl > 0).reduce((s, r) => s + r.grossPnl, 0);
    const grossLoss = Math.abs(rows.filter((r) => r.grossPnl < 0).reduce((s, r) => s + r.grossPnl, 0));
    const grossPnl = grossProfit - grossLoss;
    const avgWinPerDay = profitable.length ? profitable.reduce((s, r) => s + r.netPnl, 0) / profitable.length : 0;
    const avgLossPerDay = losing.length ? losing.reduce((s, r) => s + Math.abs(r.netPnl), 0) / losing.length : 0;
    const expectancy = (dayWinRatePct / 100) * avgWinPerDay - (1 - dayWinRatePct / 100) * avgLossPerDay;
    const worstDayNet = losing.length ? Math.min(...losing.map((r) => r.netPnl)) : 0;
    const pnlLows = rows.map((r) => r.pnlLow).filter((v) => typeof v === 'number' && !isNaN(v));
    const worstIntradayLow = pnlLows.length ? Math.min(...pnlLows) : (losing.length ? worstDayNet : 0);

    return {
      profitableDays,
      losingDays,
      dayWinRatePct,
      grossPnl,
      totalCommission,
      profitFactor,
      netPnl,
      expectancy,
      worstDayNet,
      worstIntradayLow,
    };
  }

  function groupBySymbol(rows) {
    const bySymbol = {};
    rows.forEach((r) => {
      if (!bySymbol[r.symbol]) bySymbol[r.symbol] = [];
      bySymbol[r.symbol].push(r);
    });
    return bySymbol;
  }

  function groupByDayOfWeek(rows) {
    const byDay = {};
    DAYS.forEach((d) => { byDay[d] = []; });
    rows.forEach((r) => {
      if (r.dayName && byDay[r.dayName]) byDay[r.dayName].push(r);
    });
    return byDay;
  }

  function formatMoney(n) {
    const sign = n >= 0 ? '' : '-';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatPct(n) {
    return (n || 0).toFixed(1) + '%';
  }

  function formatNum(n, decimals = 2) {
    return (n ?? 0).toFixed(decimals);
  }

  function renderPanel(container, allRows, viewMode, assetKey, dayKey) {
    const bySymbol = groupBySymbol(allRows);
    const byDay = groupByDayOfWeek(allRows);
    const symbols = Object.keys(bySymbol).sort();
    let currentStats = computeStats(allRows);
    if (viewMode === 'asset' && assetKey && bySymbol[assetKey]) {
      currentStats = computeStats(bySymbol[assetKey]);
    } else if (viewMode === 'day' && dayKey && byDay[dayKey]) {
      currentStats = computeStats(byDay[dayKey]);
    }

    const assetSelectOpts = symbols.map((sym) => `<option value="${sym}" ${assetKey === sym ? 'selected' : ''}>${sym}</option>`).join('');
    const daySelectOpts = WORK_DAYS.map((d) => `<option value="${d}" ${dayKey === d ? 'selected' : ''}>${d}</option>`).join('');

    container.innerHTML = `
    <div class="lucid-stats-panel">
      <div class="lucid-stats-section-header">
        <div class="lucid-stats-header-left">
          <h3 class="lucid-stats-section-title">
            <svg class="lucid-stats-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
            Trading Stats
            <span class="lucid-stats-eod">Updated EOD</span>
          </h3>
          <div class="lucid-stats-view-toggle">
            <button type="button" class="lucid-toggle-btn ${viewMode === 'all' ? 'active' : ''}" data-view="all">All</button>
            <button type="button" class="lucid-toggle-btn ${viewMode === 'asset' ? 'active' : ''}" data-view="asset">By asset</button>
            <button type="button" class="lucid-toggle-btn ${viewMode === 'day' ? 'active' : ''}" data-view="day">By day</button>
          </div>
          ${viewMode === 'asset' && symbols.length ? `
            <div class="lucid-slice-inline">
              <label class="lucid-slice-label">Asset</label>
              <select class="lucid-slice-select" id="lucid-asset-select">${assetSelectOpts}</select>
            </div>
          ` : ''}
          ${viewMode === 'day' ? `
            <div class="lucid-slice-inline">
              <label class="lucid-slice-label">Day</label>
              <select class="lucid-slice-select" id="lucid-day-select">${daySelectOpts}</select>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="lucid-stats-grid">
        <div class="lucid-stat-card lucid-stat-card-hero">
          <span class="lucid-stat-label">Net P&L</span>
          <span class="lucid-stat-value ${currentStats.netPnl > 0 ? 'positive' : currentStats.netPnl < 0 ? 'negative' : ''}">${formatMoney(currentStats.netPnl)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Expectancy</span>
          <span class="lucid-stat-value ${currentStats.expectancy > 0 ? 'positive' : currentStats.expectancy < 0 ? 'negative' : ''}">${formatMoney(currentStats.expectancy)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">${viewMode === 'asset' ? 'Day win rate (asset)' : viewMode === 'day' ? 'Day win rate (weekday)' : 'Day win rate'}</span>
          <span class="lucid-stat-value">${formatPct(currentStats.dayWinRatePct)} <span class="lucid-stat-sub">(${currentStats.profitableDays} / ${currentStats.losingDays})</span></span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Profit factor</span>
          <span class="lucid-stat-value">${formatNum(currentStats.profitFactor, 2)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Gross PnL</span>
          <span class="lucid-stat-value ${currentStats.grossPnl > 0 ? 'positive' : currentStats.grossPnl < 0 ? 'negative' : ''}">${formatMoney(currentStats.grossPnl)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Commission</span>
          <span class="lucid-stat-value">${formatMoney(-currentStats.totalCommission)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Worst intraday</span>
          <span class="lucid-stat-value negative">${formatMoney(currentStats.worstIntradayLow)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Worst day</span>
          <span class="lucid-stat-value negative">${formatMoney(currentStats.worstDayNet)}</span>
        </div>
      </div>
    </div>
    `;

    container.querySelectorAll('.lucid-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-view');
        const nextAsset = v === 'asset' && symbols.length ? symbols[0] : null;
        const nextDay = v === 'day' ? WORK_DAYS[0] : null;
        renderPanel(container, allRows, v, nextAsset, nextDay);
      });
    });

    const assetSelect = container.querySelector('#lucid-asset-select');
    if (assetSelect) {
      assetSelect.addEventListener('change', () => {
        renderPanel(container, allRows, 'asset', assetSelect.value, null);
      });
    }

    const daySelect = container.querySelector('#lucid-day-select');
    if (daySelect) {
      daySelect.addEventListener('change', () => {
        renderPanel(container, allRows, 'day', null, daySelect.value);
      });
    }
  }

  function injectPanel() {
    const table = document.querySelector('.data-table-section .data-table') || document.querySelector('table.data-table');
    if (!table) return false;

    let wrapper = document.getElementById('lucid-stats-extension-root');
    if (wrapper) {
      const rows = parseTable(table);
      if (!rows.length) return true;
      renderPanel(wrapper, rows, 'all', null, null);
      return true;
    }

    const rows = parseTable(table);
    wrapper = document.createElement('div');
    wrapper.id = 'lucid-stats-extension-root';
    wrapper.className = 'lucid-stats-extension-root';

    const section = document.querySelector('.stats-summary-section') || document.querySelector('.chart-section') || document.querySelector('.account-progress-bar');
    const parent = section ? section.parentElement : table.closest('c-container') || table.closest('.body') || document.body;
    const insertBefore = document.querySelector('.chart-section') || document.querySelector('.account-progress-bar');

    if (insertBefore) {
      parent.insertBefore(wrapper, insertBefore);
    } else {
      parent.insertBefore(wrapper, section && section.nextSibling ? section.nextSibling : parent.firstChild);
    }

    if (rows.length) {
      renderPanel(wrapper, rows, 'all', null, null);
    } else {
      wrapper.innerHTML = '<div class="lucid-stats-panel"><div class="lucid-stats-section-header"><h3 class="lucid-stats-section-title">Trading stats</h3></div><p class="lucid-stats-empty">No trading history data yet. Open Account Details and ensure the table has loaded.</p></div>';
    }
    return true;
  }

  function run() {
    const done = injectPanel();
    if (!done) {
      setTimeout(run, 1500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }

  let injectDebounceTimer = null;
  const DEBOUNCE_MS = 500;

  const observer = new MutationObserver((mutations) => {
    const root = document.getElementById('lucid-stats-extension-root');
    const onlyOurChanges = root && mutations.every((m) => m.target === root || root.contains(m.target));
    if (onlyOurChanges) return;

    if (injectDebounceTimer) clearTimeout(injectDebounceTimer);
    injectDebounceTimer = setTimeout(() => {
      injectDebounceTimer = null;
      if (document.querySelector('.data-table-section .data-table') || document.querySelector('table.data-table')) {
        injectPanel();
      }
    }, DEBOUNCE_MS);
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();

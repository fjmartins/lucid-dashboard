(function () {
  'use strict';

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  function parseCurrency(s) {
    if (!s || typeof s !== 'string') return 0;
    const cleaned = s.replace(/[$,]/g, '').trim();
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function parsePct(s) {
    if (!s || typeof s !== 'string') return 0;
    const n = parseFloat(s.replace('%', '').trim());
    return isNaN(n) ? 0 : n;
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
      const symbolEl = tr.querySelector('.symbol-badge');
      const symbol = symbolEl ? (symbolEl.textContent || '').trim() : getCellText(tr, 'Symbol');
      const dateText = getCellText(tr, 'Date');
      const date = parseDate(dateText);
      const winPctText = tr.querySelector('.win-badge') ? (tr.querySelector('.win-badge').textContent || '').trim() : getCellText(tr, 'Win %');
      const winPct = parsePct(winPctText);
      const avgWin = parseCurrency(getCellText(tr, 'Avg Win'));
      const avgLoss = parseCurrency(getCellText(tr, 'Avg Loss'));
      return {
        date: date,
        dateStr: dateText,
        symbol,
        netPnl,
        winPct,
        avgWin,
        avgLoss,
        dayOfWeek: date ? date.getDay() : null,
        dayName: date ? DAYS[date.getDay()] : '',
      };
    }).filter((r) => r.symbol && r.dateStr);
  }

  function computeStats(rows) {
    if (!rows.length) {
      return {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRate: 0,
        grossProfit: 0,
        grossLoss: 0,
        profitFactor: 0,
        netPnl: 0,
        expectancy: 0,
        avgWin: 0,
        avgLoss: 0,
        largestWin: 0,
        largestLoss: 0,
        avgWinPct: 0,
      };
    }
    const wins = rows.filter((r) => r.netPnl > 0);
    const losses = rows.filter((r) => r.netPnl < 0);
    const grossProfit = wins.reduce((s, r) => s + r.netPnl, 0);
    const grossLoss = Math.abs(losses.reduce((s, r) => s + r.netPnl, 0));
    const netPnl = rows.reduce((s, r) => s + r.netPnl, 0);
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    const winRate = rows.length ? (wins.length / rows.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((s, r) => s + r.netPnl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, r) => s + Math.abs(r.netPnl), 0) / losses.length : 0;
    const expectancy = rows.length ? (winRate / 100) * avgWin - (1 - winRate / 100) * avgLoss : 0;
    const largestWin = wins.length ? Math.max(...wins.map((r) => r.netPnl)) : 0;
    const largestLoss = losses.length ? Math.min(...losses.map((r) => r.netPnl)) : 0;
    const winPcts = rows.map((r) => r.winPct).filter((p) => p > 0);
    const avgWinPct = winPcts.length ? winPcts.reduce((a, b) => a + b, 0) / winPcts.length : 0;

    return {
      totalTrades: rows.length,
      winningTrades: wins.length,
      losingTrades: losses.length,
      winRate,
      grossProfit,
      grossLoss,
      profitFactor,
      netPnl,
      expectancy,
      avgWin,
      avgLoss,
      largestWin,
      largestLoss,
      avgWinPct,
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
    let sliceKey = null;

    if (viewMode === 'asset' && assetKey && bySymbol[assetKey]) {
      currentStats = computeStats(bySymbol[assetKey]);
      sliceKey = assetKey;
    } else if (viewMode === 'day' && dayKey && byDay[dayKey]) {
      currentStats = computeStats(byDay[dayKey]);
      sliceKey = dayKey;
    }

    const assetSelectOpts = symbols.map((sym) => `<option value="${sym}" ${assetKey === sym ? 'selected' : ''}>${sym}</option>`).join('');
    const daySelectOpts = DAYS.map((d) => `<option value="${d}" ${dayKey === d ? 'selected' : ''}>${d}</option>`).join('');

    container.innerHTML = `
    <div class="lucid-stats-panel">
      <div class="lucid-stats-header">
        <h3 class="lucid-stats-title">Trading stats</h3>
        <div class="lucid-stats-view-toggle">
          <button type="button" class="lucid-toggle-btn ${viewMode === 'all' ? 'active' : ''}" data-view="all">All</button>
          <button type="button" class="lucid-toggle-btn ${viewMode === 'asset' ? 'active' : ''}" data-view="asset">By asset</button>
          <button type="button" class="lucid-toggle-btn ${viewMode === 'day' ? 'active' : ''}" data-view="day">By day</button>
        </div>
      </div>
      ${viewMode === 'asset' && symbols.length ? `
        <div class="lucid-slice-selector">
          <label class="lucid-slice-label">Asset</label>
          <select class="lucid-slice-select" id="lucid-asset-select">${assetSelectOpts}</select>
        </div>
      ` : ''}
      ${viewMode === 'day' ? `
        <div class="lucid-slice-selector">
          <label class="lucid-slice-label">Day of week</label>
          <select class="lucid-slice-select" id="lucid-day-select">${daySelectOpts}</select>
        </div>
      ` : ''}
      <div class="lucid-stats-grid">
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Win rate</span>
          <span class="lucid-stat-value">${formatPct(currentStats.winRate)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Profit factor</span>
          <span class="lucid-stat-value">${formatNum(currentStats.profitFactor, 2)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Total trades</span>
          <span class="lucid-stat-value">${currentStats.totalTrades}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Net P&L</span>
          <span class="lucid-stat-value ${currentStats.netPnl > 0 ? 'positive' : currentStats.netPnl < 0 ? 'negative' : ''}">${formatMoney(currentStats.netPnl)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Gross profit</span>
          <span class="lucid-stat-value positive">${formatMoney(currentStats.grossProfit)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Gross loss</span>
          <span class="lucid-stat-value negative">${formatMoney(-currentStats.grossLoss)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Expectancy</span>
          <span class="lucid-stat-value ${currentStats.expectancy > 0 ? 'positive' : currentStats.expectancy < 0 ? 'negative' : ''}">${formatMoney(currentStats.expectancy)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Avg win</span>
          <span class="lucid-stat-value positive">${formatMoney(currentStats.avgWin)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Avg loss</span>
          <span class="lucid-stat-value negative">${formatMoney(-currentStats.avgLoss)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Largest win</span>
          <span class="lucid-stat-value positive">${formatMoney(currentStats.largestWin)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Largest loss</span>
          <span class="lucid-stat-value negative">${formatMoney(currentStats.largestLoss)}</span>
        </div>
        <div class="lucid-stat-card">
          <span class="lucid-stat-label">Wins / Losses</span>
          <span class="lucid-stat-value">${currentStats.winningTrades} / ${currentStats.losingTrades}</span>
        </div>
      </div>
    </div>
    `;

    container.querySelectorAll('.lucid-toggle-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const v = btn.getAttribute('data-view');
        const nextAsset = v === 'asset' && symbols.length ? symbols[0] : null;
        const nextDay = v === 'day' ? DAYS[0] : null;
        renderPanel(container, allRows, v, nextAsset, nextDay);
        attachListeners(container, allRows);
      });
    });

    const assetSelect = container.querySelector('#lucid-asset-select');
    if (assetSelect) {
      assetSelect.addEventListener('change', () => {
        renderPanel(container, allRows, 'asset', assetSelect.value, null);
        attachListeners(container, allRows);
      });
    }

    const daySelect = container.querySelector('#lucid-day-select');
    if (daySelect) {
      daySelect.addEventListener('change', () => {
        renderPanel(container, allRows, 'day', null, daySelect.value);
        attachListeners(container, allRows);
      });
    }
  }

  function attachListeners(container, allRows) {
    // Re-attach is done inside renderPanel for the new DOM
  }

  function injectPanel() {
    const table = document.querySelector('.data-table-section .data-table') || document.querySelector('table.data-table');
    if (!table) return false;

    let wrapper = document.getElementById('lucid-stats-extension-root');
    if (wrapper) {
      const rows = parseTable(table);
      if (!rows.length) return true;
      renderPanel(wrapper, rows, 'all', null, null);
      attachListeners(wrapper, rows);
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
      attachListeners(wrapper, rows);
    } else {
      wrapper.innerHTML = '<div class="lucid-stats-panel"><div class="lucid-stats-header"><h3 class="lucid-stats-title">Trading stats</h3></div><p class="lucid-stats-empty">No trading history data yet. Open Account Details and ensure the table has loaded.</p></div>';
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

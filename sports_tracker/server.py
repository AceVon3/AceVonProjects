"""
Cover2Sports Betting Analytics — Web Server

Usage:
    pip install flask
    python server.py
    Open http://localhost:5000
"""

import os
import sys
from datetime import date
from flask import Flask, request, jsonify

sys.path.insert(0, os.path.dirname(__file__))

app = Flask(__name__)

DASHBOARD_HTML = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Cover2Sports Dashboard</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #22263a;
    --accent: #4f8ef7;
    --green: #22c55e;
    --red: #ef4444;
    --gray: #6b7280;
    --text: #e2e8f0;
    --muted: #94a3b8;
    --border: #2d3148;
    --radius: 10px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: var(--bg); color: var(--text); font-family: system-ui, sans-serif; min-height: 100vh; }
  header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; }
  header h1 { font-size: 1.3rem; font-weight: 700; color: var(--accent); }
  header span { color: var(--muted); font-size: 0.85rem; }
  .main { padding: 24px 32px; max-width: 1400px; margin: 0 auto; }

  /* Credentials */
  .creds-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px 24px; margin-bottom: 20px; display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; }
  .creds-card .field { display: flex; flex-direction: column; gap: 6px; }
  .creds-card .field label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .creds-card input[type="text"],
  .creds-card input[type="password"],
  .creds-card input[type="date"] { background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 8px 12px; font-size: 0.875rem; width: 210px; }
  .creds-card input:focus { outline: 1px solid var(--accent); }
  .headed-label { display: flex; align-items: center; gap: 6px; font-size: 0.82rem; color: var(--muted); cursor: pointer; padding-bottom: 2px; }
  .headed-label input { accent-color: var(--accent); }
  .btn-primary { background: var(--accent); color: #fff; border: none; border-radius: 6px; padding: 9px 22px; cursor: pointer; font-size: 0.9rem; font-weight: 600; white-space: nowrap; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--surface2); border: 1px solid var(--border); color: var(--muted); border-radius: 6px; padding: 8px 18px; cursor: pointer; font-size: 0.875rem; font-weight: 600; }

  /* Status bar */
  .status { border-radius: var(--radius); padding: 12px 18px; margin-bottom: 20px; font-size: 0.875rem; display: flex; align-items: center; gap: 10px; }
  .status.loading { background: #1e293b; border: 1px solid #334155; color: var(--muted); }
  .status.success { background: #14532d33; border: 1px solid #22c55e55; color: var(--green); }
  .status.error   { background: #450a0a33; border: 1px solid #ef444455; color: var(--red); }
  .spinner { width: 16px; height: 16px; border: 2px solid #334155; border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; flex-shrink: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Filters */
  .filters { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 24px; margin-bottom: 24px; display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-end; }
  .filter-group { display: flex; flex-direction: column; gap: 6px; }
  .filter-group label { font-size: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
  .filter-group input[type="date"],
  .filter-group select { background: var(--surface2); border: 1px solid var(--border); color: var(--text); border-radius: 6px; padding: 7px 10px; font-size: 0.875rem; }
  .checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
  .checkbox-group label { display: flex; align-items: center; gap: 5px; font-size: 0.82rem; cursor: pointer; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 5px 10px; user-select: none; }
  .checkbox-group input { accent-color: var(--accent); }
  .filter-actions { display: flex; gap: 8px; align-items: flex-end; }

  /* Summary cards */
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px 20px; }
  .card .label { font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
  .card .value { font-size: 1.55rem; font-weight: 700; }
  .card .value.pos { color: var(--green); }
  .card .value.neg { color: var(--red); }
  .card .value.neutral { color: var(--text); }
  .card .sub { font-size: 0.78rem; color: var(--muted); margin-top: 4px; }

  /* Charts */
  .charts { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
  .chart-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
  .chart-card h3 { font-size: 0.9rem; color: var(--muted); margin-bottom: 16px; }
  .chart-card canvas { max-height: 260px; }
  @media (max-width: 900px) { .charts { grid-template-columns: 1fr; } }

  /* Table */
  .table-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
  .table-card h3 { padding: 16px 20px; font-size: 0.9rem; color: var(--muted); border-bottom: 1px solid var(--border); }
  .table-wrap { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 0.84rem; }
  th { padding: 10px 14px; text-align: left; font-size: 0.72rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; cursor: pointer; user-select: none; background: var(--surface2); border-bottom: 1px solid var(--border); white-space: nowrap; }
  th:hover { color: var(--accent); }
  th .sort-icon { margin-left: 4px; opacity: 0.5; }
  th.sorted .sort-icon { opacity: 1; color: var(--accent); }
  td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
  tr:last-child td { border-bottom: none; }
  tr.win td:first-child { border-left: 3px solid var(--green); }
  tr.loss td:first-child { border-left: 3px solid var(--red); }
  tr.push td:first-child, tr.pending td:first-child { border-left: 3px solid var(--gray); }
  .badge { display: inline-block; border-radius: 4px; padding: 2px 8px; font-size: 0.72rem; font-weight: 600; }
  .badge.win { background: #14532d; color: var(--green); }
  .badge.loss { background: #450a0a; color: var(--red); }
  .badge.push, .badge.pending { background: #1f2937; color: var(--muted); }
  .pl.pos { color: var(--green); }
  .pl.neg { color: var(--red); }
  .empty-msg { text-align: center; padding: 60px 20px; color: var(--muted); }
  .empty-msg h2 { font-size: 1.1rem; margin-bottom: 8px; }
</style>
</head>
<body>
<header>
  <h1>Cover2Sports Dashboard</h1>
  <span id="lastUpdated"></span>
</header>

<div class="main">
  <!-- Credentials -->
  <div class="creds-card">
    <div class="field">
      <label>Username</label>
      <input type="text" id="username" placeholder="Cover2Sports username" autocomplete="username">
    </div>
    <div class="field">
      <label>Password</label>
      <input type="password" id="password" placeholder="Password" autocomplete="current-password">
    </div>
    <label class="headed-label">
      <input type="checkbox" id="headed"> Headed mode
    </label>
    <div class="field">
      <label>From Date</label>
      <input type="date" id="scrapeStart" value="2026-03-02">
    </div>
    <div class="field">
      <label>To Date</label>
      <input type="date" id="scrapeEnd">
    </div>
    <button class="btn-primary" id="scrapeBtn" onclick="runScraper()">Scrape &amp; Refresh</button>
  </div>

  <!-- Status bar -->
  <div class="status" id="statusBar" style="display:none"></div>

  <!-- Dashboard — hidden until first successful scrape -->
  <div id="dashSection" style="display:none">

    <!-- Filters -->
    <div class="filters">
      <div class="filter-group">
        <label>Start Date</label>
        <input type="date" id="fStartDate" value="2026-03-02">
      </div>
      <div class="filter-group">
        <label>End Date</label>
        <input type="date" id="fEndDate">
      </div>
      <div class="filter-group">
        <label>Sport</label>
        <select id="fSport">
          <option value="">All Sports</option>
        </select>
      </div>
      <div class="filter-group">
        <label>Bet Type</label>
        <div class="checkbox-group" id="fBetType">
          <label><input type="checkbox" value="Moneyline" checked> Moneyline</label>
          <label><input type="checkbox" value="Spread" checked> Spread</label>
          <label><input type="checkbox" value="Over/Under" checked> Over/Under</label>
        </div>
      </div>
      <div class="filter-group">
        <label>Wager Type</label>
        <div class="checkbox-group" id="fWagerType">
          <label><input type="checkbox" value="Straight" checked> Straight</label>
          <label><input type="checkbox" value="Parlay" checked> Parlay</label>
          <label><input type="checkbox" value="Teaser" checked> Teaser</label>
          <label><input type="checkbox" value="Reverse" checked> Reverse</label>
          <label><input type="checkbox" value="IF Bet" checked> IF Bet</label>
        </div>
      </div>
      <div class="filter-group">
        <label>Result</label>
        <div class="checkbox-group" id="fResult">
          <label><input type="checkbox" value="Win" checked> Win</label>
          <label><input type="checkbox" value="Loss" checked> Loss</label>
          <label><input type="checkbox" value="Push" checked> Push</label>
          <label><input type="checkbox" value="Pending" checked> Pending</label>
        </div>
      </div>
      <div class="filter-actions">
        <button class="btn-primary" onclick="applyFilters()">Apply</button>
        <button class="btn-secondary" onclick="resetFilters()">Reset</button>
      </div>
    </div>

    <!-- Summary cards -->
    <div class="cards">
      <div class="card"><div class="label">Total Bets</div><div class="value neutral" id="cTotal">-</div></div>
      <div class="card"><div class="label">Record</div><div class="value neutral" id="cRecord">-</div><div class="sub" id="cWinPct"></div></div>
      <div class="card"><div class="label">Total Wagered</div><div class="value neutral" id="cWagered">-</div></div>
      <div class="card"><div class="label">Net P/L</div><div class="value neutral" id="cNetPL">-</div></div>
      <div class="card"><div class="label">ROI</div><div class="value neutral" id="cROI">-</div></div>
    </div>

    <!-- Charts -->
    <div class="charts">
      <div class="chart-card" style="grid-column: span 2;">
        <h3>Cumulative P/L Over Time</h3>
        <canvas id="chartPL"></canvas>
      </div>
      <div class="chart-card">
        <h3>Win Rate by Sport</h3>
        <canvas id="chartSport"></canvas>
      </div>
      <div class="chart-card">
        <h3>Bet Type Breakdown</h3>
        <canvas id="chartType"></canvas>
      </div>
    </div>

    <!-- Bet history table -->
    <div class="table-card">
      <h3>Bet History</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th onclick="sortTable('date')">Date <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('sport')">Sport <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('wager_type')">Wager <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('bet_type')">Bet Type <span class="sort-icon">↕</span></th>
              <th>Game</th>
              <th>Pick</th>
              <th onclick="sortTable('odds')">Odds <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('amount')">Amount <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('result')">Result <span class="sort-icon">↕</span></th>
              <th onclick="sortTable('profit_loss')">P/L <span class="sort-icon">↕</span></th>
            </tr>
          </thead>
          <tbody id="betTableBody"></tbody>
        </table>
        <div class="empty-msg" id="emptyMsg" style="display:none">
          <h2>No bets found</h2>
          <p>Adjust your filters or click Scrape &amp; Refresh.</p>
        </div>
      </div>
    </div>

  </div><!-- /dashSection -->
</div>

<script>
// ============================================================
// State
// ============================================================
let BETS = [];
let sortKey = 'date';
let sortDir = { date: -1 };
let filteredBets = [];
let charts = {};

// ============================================================
// Init
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const todayISO = new Date().toISOString().slice(0, 10);
  document.getElementById('fEndDate').value = todayISO;
  document.getElementById('scrapeEnd').value = todayISO;
  ['username', 'password'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', e => {
      if (e.key === 'Enter') runScraper();
    });
  });
});

// ============================================================
// Scraper
// ============================================================
async function runScraper() {
  const username    = document.getElementById('username').value.trim();
  const password    = document.getElementById('password').value.trim();
  const headed      = document.getElementById('headed').checked;
  const scrapeStart = document.getElementById('scrapeStart').value;
  const scrapeEnd   = document.getElementById('scrapeEnd').value;

  if (!username || !password) {
    showStatus('error', 'Please enter your username and password.');
    return;
  }

  const btn = document.getElementById('scrapeBtn');
  btn.disabled = true;
  showStatus('loading', 'Launching browser and scraping bet history\u2026 this may take 30\u201360 seconds.');

  try {
    const resp = await fetch('/api/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, headed, start_date: scrapeStart, end_date: scrapeEnd }),
    });
    const json = await resp.json();

    if (!resp.ok || json.error) {
      showStatus('error', json.error || 'Unknown server error.');
      return;
    }

    BETS = json.bets || [];
    const now = new Date().toLocaleString();
    document.getElementById('lastUpdated').textContent = 'Updated: ' + now;
    showStatus('success', `Loaded ${BETS.length} bet(s) \u2014 last updated ${now}`);
    document.getElementById('dashSection').style.display = '';

    // Rebuild sport dropdown
    const sports = [...new Set(BETS.map(b => b.sport).filter(Boolean))].sort();
    const sel = document.getElementById('fSport');
    sel.innerHTML = '<option value="">All Sports</option>';
    sports.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s; opt.textContent = s;
      sel.appendChild(opt);
    });

    applyFilters();
  } catch (e) {
    showStatus('error', 'Network error: ' + e.message);
  } finally {
    btn.disabled = false;
  }
}

function showStatus(type, msg) {
  const bar = document.getElementById('statusBar');
  bar.style.display = '';
  bar.className = 'status ' + type;
  bar.innerHTML = type === 'loading'
    ? `<div class="spinner"></div><span>${msg}</span>`
    : `<span>${msg}</span>`;
}

// ============================================================
// Filtering
// ============================================================
function applyFilters() {
  const start   = document.getElementById('fStartDate').value;
  const end     = document.getElementById('fEndDate').value;
  const sport   = document.getElementById('fSport').value;
  const btypes  = checkedValues('fBetType');
  const wtypes  = checkedValues('fWagerType');
  const results = checkedValues('fResult');

  filteredBets = BETS.filter(b => {
    if (start && b.date < start) return false;
    if (end   && b.date > end)   return false;
    if (sport && b.sport !== sport) return false;
    if (!btypes.includes(b.bet_type))   return false;
    if (!wtypes.includes(b.wager_type)) return false;
    if (!results.includes(b.result))    return false;
    return true;
  });

  renderCards();
  renderCharts();
  renderTable();
}

function resetFilters() {
  document.getElementById('fStartDate').value = '2026-03-02';
  document.getElementById('fEndDate').value = new Date().toISOString().slice(0, 10);
  document.getElementById('fSport').value = '';
  document.querySelectorAll('#fBetType input, #fWagerType input, #fResult input')
    .forEach(cb => cb.checked = true);
  applyFilters();
}

function checkedValues(id) {
  return [...document.querySelectorAll(`#${id} input:checked`)].map(c => c.value);
}

// ============================================================
// Summary Cards
// ============================================================
function renderCards() {
  const bets    = filteredBets;
  const wins    = bets.filter(b => b.result === 'Win').length;
  const losses  = bets.filter(b => b.result === 'Loss').length;
  const pushes  = bets.filter(b => b.result === 'Push').length;
  const decided = wins + losses;
  const winPct  = decided > 0 ? (wins / decided * 100).toFixed(1) : '\u2014';
  const wagered = bets.reduce((s, b) => s + (b.amount || 0), 0);
  const netPL   = bets.reduce((s, b) => s + (b.profit_loss || 0), 0);
  const roi     = wagered > 0 ? (netPL / wagered * 100).toFixed(1) : '\u2014';

  setText('cTotal',   bets.length);
  setText('cRecord',  `${wins}-${losses}-${pushes}`);
  setText('cWinPct',  decided > 0 ? `${winPct}% win rate` : '');
  setText('cWagered', fmt$(wagered));
  setEl('cNetPL', fmt$(netPL, true), netPL >= 0 ? 'pos' : 'neg');
  setEl('cROI',   roi !== '\u2014' ? `${roi}%` : '\u2014', netPL >= 0 ? 'pos' : 'neg');
}

function setText(id, val) { document.getElementById(id).textContent = val; }
function setEl(id, val, cls) {
  const el = document.getElementById(id);
  el.textContent = val;
  el.className = 'value ' + cls;
}
function fmt$(n, sign = false) {
  if (n == null || isNaN(n)) return '\u2014';
  const abs = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return sign ? (n >= 0 ? '+$' : '-$') + abs : '$' + abs;
}

// ============================================================
// Charts
// ============================================================
const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: { legend: { labels: { color: '#94a3b8', font: { size: 12 } } } },
};

function renderCharts() {
  renderPLChart();
  renderSportChart();
  renderTypeChart();
}

function renderPLChart() {
  const sorted = [...filteredBets].sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  const labels = [], data = [];
  sorted.forEach(b => {
    cum += (b.profit_loss || 0);
    labels.push(b.date);
    data.push(+cum.toFixed(2));
  });

  const ctx = document.getElementById('chartPL').getContext('2d');
  if (charts.pl) charts.pl.destroy();
  charts.pl = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Cumulative P/L ($)',
        data,
        borderColor: '#4f8ef7',
        backgroundColor: 'rgba(79,142,247,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: sorted.length < 50 ? 4 : 0,
        pointHoverRadius: 6,
      }]
    },
    options: {
      ...CHART_DEFAULTS,
      scales: {
        x: { ticks: { color: '#6b7280', maxTicksLimit: 12 }, grid: { color: '#1f2937' } },
        y: { ticks: { color: '#6b7280', callback: v => '$' + v }, grid: { color: '#1f2937' } }
      }
    }
  });
}

function renderSportChart() {
  const m = {};
  filteredBets.forEach(b => {
    if (!b.sport) return;
    if (!m[b.sport]) m[b.sport] = { wins: 0, total: 0 };
    m[b.sport].total++;
    if (b.result === 'Win') m[b.sport].wins++;
  });
  const sports = Object.keys(m);
  const rates  = sports.map(s => +(m[s].wins / m[s].total * 100).toFixed(1));

  const ctx = document.getElementById('chartSport').getContext('2d');
  if (charts.sport) charts.sport.destroy();
  charts.sport = new Chart(ctx, {
    type: 'bar',
    data: { labels: sports, datasets: [{ label: 'Win Rate (%)', data: rates, backgroundColor: '#4f8ef7', borderRadius: 5 }] },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      scales: {
        x: { min: 0, max: 100, ticks: { color: '#6b7280', callback: v => v + '%' }, grid: { color: '#1f2937' } },
        y: { ticks: { color: '#6b7280' }, grid: { display: false } }
      }
    }
  });
}

function renderTypeChart() {
  const counts = {};
  filteredBets.forEach(b => { const t = b.bet_type || 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
  const labels = Object.keys(counts);
  const data   = labels.map(l => counts[l]);
  const colors = ['#4f8ef7', '#22c55e', '#f59e0b', '#ec4899', '#8b5cf6'];

  const ctx = document.getElementById('chartType').getContext('2d');
  if (charts.type) charts.type.destroy();
  charts.type = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
    options: { ...CHART_DEFAULTS, cutout: '60%' }
  });
}

// ============================================================
// Table
// ============================================================
function sortTable(key) {
  sortDir[key] = sortKey === key ? (sortDir[key] || -1) * -1 : 1;
  sortKey = key;
  document.querySelectorAll('th').forEach(th => th.classList.remove('sorted'));
  const headers = ['date', 'sport', 'wager_type', 'bet_type', 'game', 'pick', 'odds', 'amount', 'result', 'profit_loss'];
  const th = document.querySelectorAll('th')[headers.indexOf(key)];
  if (th) { th.classList.add('sorted'); th.querySelector('.sort-icon').textContent = sortDir[key] === 1 ? '\u2191' : '\u2193'; }
  renderTable();
}

function renderTable() {
  const bets = [...filteredBets].sort((a, b) => {
    let av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    return av < bv ? -sortDir[sortKey] : av > bv ? sortDir[sortKey] : 0;
  });

  const tbody = document.getElementById('betTableBody');
  const empty = document.getElementById('emptyMsg');

  if (!bets.length) { tbody.innerHTML = ''; empty.style.display = ''; return; }
  empty.style.display = 'none';

  tbody.innerHTML = bets.map(b => {
    const res     = (b.result || 'Pending').toLowerCase();
    const pl      = b.profit_loss;
    const plClass = pl > 0 ? 'pos' : pl < 0 ? 'neg' : '';
    const plStr   = pl != null ? (pl >= 0 ? '+' : '') + '$' + Math.abs(pl).toFixed(2) : '\u2014';
    return `<tr class="${res}">
      <td>${b.date || '\u2014'}</td>
      <td>${b.sport || '\u2014'}</td>
      <td>${b.wager_type || '\u2014'}</td>
      <td>${b.bet_type || '\u2014'}</td>
      <td>${b.game || '\u2014'}</td>
      <td>${b.pick || '\u2014'}</td>
      <td>${b.odds != null ? b.odds : '\u2014'}</td>
      <td>${b.amount != null ? '$' + b.amount.toFixed(2) : '\u2014'}</td>
      <td><span class="badge ${res}">${b.result || 'Pending'}</span></td>
      <td class="pl ${plClass}">${plStr}</td>
    </tr>`;
  }).join('');
}
</script>
</body>
</html>"""


@app.route('/')
def index():
    return DASHBOARD_HTML


@app.route('/api/scrape', methods=['POST'])
def api_scrape():
    print("=== /api/scrape called ===", flush=True)
    try:
        import importlib
        import scraper
        print("Reloading scraper...", flush=True)
        importlib.reload(scraper)
        run_scraper = scraper.run_scraper
        print("Scraper loaded OK.", flush=True)
    except Exception as e:
        print(f"Failed to load scraper: {e}", flush=True)
        return jsonify({'error': f'Failed to load scraper: {e}'}), 500

    data       = request.get_json(force=True)
    username   = (data.get('username')   or '').strip()
    password   = (data.get('password')   or '').strip()
    headed     = bool(data.get('headed', False))
    start_date = (data.get('start_date') or '').strip() or '2026-03-02'
    end_date   = (data.get('end_date')   or '').strip() or date.today().isoformat()

    if not username or not password:
        return jsonify({'error': 'Username and password are required.'}), 400

    try:
        bets = run_scraper(username, password, headed=headed,
                           start_date=start_date, end_date=end_date)
        return jsonify({'bets': bets})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    print('=' * 55)
    print(' Cover2Sports Dashboard Server')
    print('=' * 55)
    print(' Open http://localhost:5000 in your browser')
    print(' Press Ctrl+C to stop')
    print('=' * 55)
    app.run(host='127.0.0.1', port=5001, debug=False)

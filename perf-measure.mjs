// perf-measure.mjs
// CTGP-7-Leaderboard のローディング画面にかかる時間を Chromium(Playwright) で計測し、
// Logs.txt / Logs.json に書き出す。リポジトリのルートに置いて実行する。
//
// 使い方:
//   npm i -D playwright
//   npx playwright install --with-deps chromium
//   node perf-measure.mjs
//
// 環境変数:
//   RUNS=5            計測回数 (毎回 cold cache の新規コンテキスト)
//   NET=none|wifi|fast4g|slow4g   ネットワーク制限 (既定 none)
//   URL=https://...   本番URLを計測 (未指定ならローカル配信。ローカルは HTTP/1.1)
//   TRACE=1           1回目だけ Chrome トレース(trace.json)も保存 (ui.perfetto.dev で閲覧可)
//   TIMEOUT_MS=60000  ローディングが終わらない場合の待ち上限
//   VIEWPORT=1280x800 ビューポート (lazy画像の読み込み数に影響)
//   OUT=.             出力先ディレクトリ

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.ROOT || __dirname);
const OUT = path.resolve(process.env.OUT || __dirname);
const RUNS = Number(process.env.RUNS || 5);
const NET = process.env.NET || 'none';
const TARGET = process.env.URL || '';
const TRACE = process.env.TRACE === '1';
const TIMEOUT = Number(process.env.TIMEOUT_MS || 60000);
const [VW, VH] = (process.env.VIEWPORT || '1280x800').split('x').map(Number);
const BASE_PATH = '/CTGP-7-Leaderboard/'; // index.html の <base href> に合わせる

const NET_PROFILES = {
  wifi:   { latency: 20,  down: 30,  up: 15 },
  fast4g: { latency: 165, down: 9,   up: 1.5 },
  slow4g: { latency: 150, down: 1.6, up: 0.75 },
};

// ---------- ローカル静的サーバー ----------
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (!p.startsWith(BASE_PATH)) { res.writeHead(404); return res.end('not found'); }
      const rel = p.slice(BASE_PATH.length) || 'index.html';
      const file = path.resolve(ROOT, rel);
      if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
      fs.stat(file, (err, st) => {
        if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
        const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
        const headers = { 'Content-Type': type, 'Cache-Control': 'no-store' };
        const raw = fs.readFileSync(file);
        const gz = /html|css|javascript|json|svg/.test(type) && (req.headers['accept-encoding'] || '').includes('gzip');
        if (gz) {
          const body = zlib.gzipSync(raw);
          res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', 'Content-Length': body.length });
          res.end(body);
        } else {
          res.writeHead(200, { ...headers, 'Content-Length': raw.length });
          res.end(raw);
        }
      });
    });
    srv.listen(0, '127.0.0.1', () =>
      resolve({ srv, url: `http://127.0.0.1:${srv.address().port}${BASE_PATH}` }));
  });
}

// ---------- ページ内計測 (全ページスクリプトより前に注入) ----------
const INIT = `(() => {
  const m = window.__m = { ticks: [], longTasks: [] };
  const now = () => performance.now();
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) m.longTasks.push({ s: e.startTime, d: e.duration }); })
      .observe({ type: 'longtask', buffered: true });
  } catch (e) {}
  document.addEventListener('DOMContentLoaded', () => {
    m.dcl = now();
    const bar = document.getElementById('progress-bar');
    const ls = document.getElementById('loading-screen');
    if (bar) new MutationObserver(() => m.ticks.push({ t: now(), w: bar.style.width }))
      .observe(bar, { attributes: true, attributeFilter: ['style'] });
    if (ls) {
      new MutationObserver(() => { if (ls.classList.contains('hidden') && m.hiddenAt == null) m.hiddenAt = now(); })
        .observe(ls, { attributes: true, attributeFilter: ['class'] });
      ls.addEventListener('transitionend', e => { if (e.propertyName === 'opacity' && m.fadedAt == null) m.fadedAt = now(); });
    }
  });
})();`;

// ---------- リクエスト分類 ----------
function classify(r) {
  const u = r.firstUrl;
  let l;
  if (/googletagmanager|google-analytics|simpleanalyticscdn/.test(u)) l = 'analytics';
  else if (u.includes('/rest/v1/times')) l = 'supabase:General';
  else if (u.includes('/rest/v1/flap_leaderboard')) l = 'supabase:Flap';
  else if (u.includes('/rest/v1/players')) l = 'supabase:players';
  else if (u.includes('gid=2103674373')) l = 'sheets:Default';
  else if (u.includes('gid=1676868794')) l = 'sheets:Mission';
  else if (u.includes('/img/trackImage/')) l = 'img:track';
  else if (u.includes('/img/cupImage/')) l = 'img:cup';
  else if (/\/img\/(earth|person|favicon\/|category\/|rank\/)/.test(u)) l = 'img:static';
  else if (/mofa\.go\.jp/.test(u)) l = 'img:flag';
  else if (r.type === 'Document') l = 'html';
  else if (r.type === 'Stylesheet') l = 'css';
  else if (r.type === 'Script') l = 'js';
  else l = 'other';
  return r.type === 'Preflight' ? 'preflight>' + l : l;
}

const median = (a) => {
  const s = a.filter((x) => x != null && !Number.isNaN(x)).sort((x, y) => x - y);
  if (!s.length) return null;
  const h = s.length >> 1;
  return s.length % 2 ? s[h] : Math.round((s[h - 1] + s[h]) / 2);
};
const r0 = (x) => (x == null ? null : Math.round(x));

// ---------- 1回分の計測 ----------
async function runOnce(browser, url, idx) {
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, serviceWorkers: 'block' });
  await ctx.addInitScript(INIT);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  if (NET_PROFILES[NET]) {
    const p = NET_PROFILES[NET];
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: p.latency,
      downloadThroughput: (p.down * 1e6) / 8, uploadThroughput: (p.up * 1e6) / 8,
    });
  }

  const reqs = new Map();
  let t0 = null;
  cdp.on('Network.requestWillBeSent', (e) => {
    if (t0 == null) t0 = e.timestamp;
    let r = reqs.get(e.requestId);
    if (r && e.redirectResponse) {
      r.redirects.push({ url: r.url, status: e.redirectResponse.status });
      r.url = e.request.url;
    } else if (!r) {
      reqs.set(e.requestId, {
        firstUrl: e.request.url, url: e.request.url, method: e.request.method, type: e.type,
        startTs: e.timestamp, redirects: [], bytes: 0,
      });
    }
  });
  cdp.on('Network.responseReceived', (e) => {
    const r = reqs.get(e.requestId); if (!r) return;
    r.status = e.response.status; r.protocol = e.response.protocol; r.timing = e.response.timing;
    r.fromCache = !!(e.response.fromDiskCache || e.response.fromServiceWorker);
  });
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId); if (!r) return;
    r.endTs = e.timestamp; r.bytes = e.encodedDataLength;
  });
  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId); if (!r) return;
    r.endTs = e.timestamp; r.failed = e.errorText;
  });

  const doTrace = TRACE && idx === 0;
  if (doTrace) await browser.startTracing(page, { path: path.join(OUT, 'trace.json'), screenshots: false });

  let timedOut = false;
  try {
    await page.goto(url, { waitUntil: 'commit', timeout: TIMEOUT });
    await page.waitForFunction(
      () => { const m = window.__m; return m && (m.fadedAt != null || (m.hiddenAt != null && performance.now() - m.hiddenAt > 1500)); },
      null, { timeout: TIMEOUT, polling: 50 });
  } catch (e) { timedOut = true; }
  await page.waitForTimeout(1500); // 画面が消えた後の画像読み込みも少し観察

  const m = await page.evaluate(() => ({
    ...window.__m,
    fcp: (performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint') || {}).startTime ?? null,
  })).catch(() => ({ ticks: [], longTasks: [] }));

  if (doTrace) await browser.stopTracing();
  await ctx.close();

  // リクエスト整形 (t0 = 最初のリクエスト送信時刻 ≒ ナビゲーション開始)
  const ms = (ts) => (ts == null || t0 == null ? null : Math.round((ts - t0) * 1000));
  const rows = [...reqs.values()].map((r) => {
    const o = {
      label: classify(r), url: r.url, method: r.method, type: r.type, status: r.status ?? null,
      protocol: r.protocol ?? null, redirects: r.redirects.length, bytes: r.bytes,
      start: ms(r.startTs), end: ms(r.endTs), failed: r.failed ?? null,
    };
    const t = r.timing;
    if (t) {
      const d = (a, b) => (a >= 0 && b >= 0 ? Math.max(0, b - a) : 0);
      const dns = d(t.dnsStart, t.dnsEnd);
      const ssl = d(t.sslStart, t.sslEnd);
      const tcp = Math.max(0, d(t.connectStart, t.connectEnd) - ssl);
      o.dns = r0(dns); o.tcp = r0(tcp); o.ssl = r0(ssl);
      o.stall = r0(Math.max(0, (t.requestTime - r.startTs) * 1000 + t.sendStart - dns - tcp - ssl)); // キュー待ち+リダイレクト等
      o.wait = r0(t.receiveHeadersEnd - t.sendEnd);                                                   // サーバー応答待ち(TTFB)
      o.recv = r.endTs != null ? r0((r.endTs - t.requestTime) * 1000 - t.receiveHeadersEnd) : null;    // ダウンロード
    }
    return o;
  }).sort((a, b) => (a.start ?? 0) - (b.start ?? 0));

  return { run: idx + 1, timedOut, page: m, requests: rows, summary: summarize(m, rows) };
}

function summarize(m, rows) {
  const maxEnd = (rs) => { const v = rs.map((r) => r.end).filter((x) => x != null); return v.length ? Math.max(...v) : null; };
  const minStart = (rs) => { const v = rs.map((r) => r.start).filter((x) => x != null); return v.length ? Math.min(...v) : null; };
  const of = (l) => rows.filter((r) => r.label === l);
  const data = rows.filter((r) => /^(supabase|sheets):/.test(r.label));
  const lastTick = m.ticks?.length ? m.ticks[m.ticks.length - 1].t : null;
  const slowest = data.filter((r) => r.end != null).sort((a, b) => (b.end - b.start) - (a.end - a.start))[0];
  const tr = of('img:track');
  const hidden = m.hiddenAt ?? null;
  const trStarted = hidden == null ? [] : tr.filter((r) => r.start != null && r.start <= hidden);
  const trDone = hidden == null ? [] : tr.filter((r) => r.end != null && r.end <= hidden);
  const lt = (m.longTasks || []).filter((t) => hidden == null || t.s <= hidden);
  return {
    html_end: maxEnd(of('html')),
    css_end: maxEnd(of('css')),
    js_end: maxEnd(of('js')),
    dom_content_loaded: r0(m.dcl),
    first_contentful_paint: r0(m.fcp),
    data_fetch_start: minStart(data),
    data_fetch_end: maxEnd(data),
    static_icons_end: maxEnd(of('img:static')),
    progress_ticks: m.ticks?.length ?? 0,
    last_progress_tick: r0(lastTick),
    loading_hidden: r0(hidden),
    loading_faded: r0(m.fadedAt),
    hidden_minus_last_tick: hidden != null && lastTick != null ? r0(hidden - lastTick) : null,
    slowest_data: slowest ? { label: slowest.label, duration: slowest.end - slowest.start } : null,
    longtask_total_before_hidden: r0(lt.reduce((s, t) => s + t.d, 0)),
    track_img_started_before_hidden: trStarted.length,
    track_img_finished_before_hidden: trDone.length,
    track_img_bytes_before_hidden: trDone.reduce((s, r) => s + (r.bytes || 0), 0),
    data_bytes: data.reduce((s, r) => s + (r.bytes || 0), 0),
  };
}

// ---------- RTT の目安 (Node から) ----------
async function probeRtt() {
  const out = {};
  let supa = null;
  try { supa = fs.readFileSync(path.join(ROOT, 'js/config.js'), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)?.[1]; } catch {}
  const targets = { supabase: supa ? supa + '/rest/v1/' : null, 'docs.google.com': 'https://docs.google.com/', 'cdnjs(参考)': 'https://cdnjs.cloudflare.com/' };
  for (const [k, u] of Object.entries(targets)) {
    if (!u) continue;
    const ts = [];
    for (let i = 0; i < 4; i++) {
      const s = performance.now();
      try { await fetch(u, { method: 'HEAD', redirect: 'manual' }); ts.push(performance.now() - s); } catch {}
    }
    if (ts.length) out[k] = { first_ms: r0(ts[0]), min_ms: r0(Math.min(...ts)) };
  }
  return out;
}

// ---------- 出力 ----------
const METRICS = [
  ['html_end', 'HTML取得完了'],
  ['css_end', 'CSS全完了'],
  ['js_end', 'JSモジュール全完了'],
  ['dom_content_loaded', 'DOMContentLoaded (init開始)'],
  ['first_contentful_paint', 'First Contentful Paint'],
  ['data_fetch_start', 'データfetch開始'],
  ['data_fetch_end', 'データfetch全完了 (CSV2+Supabase3)'],
  ['static_icons_end', '静的アイコン21枚 全完了'],
  ['last_progress_tick', '最後の進捗(26/26)'],
  ['loading_hidden', 'ローディング画面 hidden付与'],
  ['loading_faded', 'フェード完了 (=見た目上の終了)'],
  ['hidden_minus_last_tick', '(固定待ち) hidden - 最後の進捗'],
  ['longtask_total_before_hidden', 'Long Task合計(50ms超, hidden前)'],
  ['track_img_started_before_hidden', 'ローディング中に開始したトラック画像(枚)'],
  ['track_img_finished_before_hidden', 'ローディング中に完了したトラック画像(枚)'],
  ['track_img_bytes_before_hidden', 'ローディング中に転送したトラック画像(bytes)'],
  ['data_bytes', 'データ転送量 CSV+Supabase (bytes)'],
];

function pad(s, n) { s = String(s ?? '-'); return s.length >= n ? s : s + ' '.repeat(n - s.length); }
function lpad(s, n) { s = String(s ?? '-'); return s.length >= n ? s : ' '.repeat(n - s.length) + s; }

function buildTxt(meta, runs) {
  const L = [];
  L.push('=== CTGP-7 Leaderboard ローディング計測 ===');
  for (const [k, v] of Object.entries(meta)) L.push(`${pad(k, 14)}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
  L.push('');
  L.push('注意: 時刻はすべてナビゲーション開始からのms。CDP時刻とページ内時刻の突合せのため±数十msの誤差あり。');
  L.push('');
  L.push('--- 中央値 / 最小 / 最大 (ms) ---');
  L.push(pad('指標', 46) + lpad('median', 9) + lpad('min', 9) + lpad('max', 9));
  for (const [k, label] of METRICS) {
    const vals = runs.map((r) => r.summary[k]).filter((x) => x != null);
    L.push(pad(label, 46) + lpad(median(vals), 9) + lpad(vals.length ? Math.min(...vals) : null, 9) + lpad(vals.length ? Math.max(...vals) : null, 9));
  }
  const slow = runs.map((r) => r.summary.slowest_data?.label).filter(Boolean);
  const cnt = {}; slow.forEach((l) => (cnt[l] = (cnt[l] || 0) + 1));
  L.push('');
  L.push('律速になったデータ取得 (回数): ' + JSON.stringify(cnt));
  L.push('タイムアウト回数: ' + runs.filter((r) => r.timedOut).length + ' / ' + runs.length);

  for (const run of runs) {
    L.push('');
    L.push(`================ RUN ${run.run}${run.timedOut ? '  (TIMEOUT: ローディングが終わらなかった)' : ''} ================`);
    for (const [k, label] of METRICS) L.push(`${pad(label, 46)}${lpad(run.summary[k], 9)}`);
    L.push('');
    L.push('進捗tick(ms): ' + run.page.ticks.map((t) => `${Math.round(t.t)}`).join(', '));
    L.push('');
    L.push('-- リクエスト (img:track / img:cup / img:flag は集計のみ) --');
    L.push(pad('label', 26) + lpad('start', 7) + lpad('end', 7) + lpad('dur', 7) + lpad('stall', 7) + lpad('dns', 5) + lpad('tcp', 5) + lpad('ssl', 5) + lpad('wait', 7) + lpad('recv', 7) + lpad('bytes', 9) + '  st proto redir');
    for (const r of run.requests) {
      if (['img:track', 'img:cup', 'img:flag'].includes(r.label)) continue;
      const dur = r.end != null && r.start != null ? r.end - r.start : null;
      L.push(pad(r.label, 26) + lpad(r.start, 7) + lpad(r.end, 7) + lpad(dur, 7) + lpad(r.stall, 7) + lpad(r.dns, 5) + lpad(r.tcp, 5) + lpad(r.ssl, 5) + lpad(r.wait, 7) + lpad(r.recv, 7) + lpad(r.bytes, 9) + `  ${r.failed ? 'FAIL:' + r.failed : r.status} ${r.protocol ?? ''} ${r.redirects || ''}`);
    }
    for (const lab of ['img:track', 'img:cup', 'img:flag']) {
      const rs = run.requests.filter((r) => r.label === lab);
      if (!rs.length) continue;
      L.push(`${pad(lab, 26)} ${rs.length}件, 合計 ${rs.reduce((s, r) => s + (r.bytes || 0), 0)} bytes, 最終完了 ${Math.max(...rs.map((r) => r.end ?? 0))}ms`);
    }
  }
  L.push('');
  L.push('列の意味: stall=キュー待ち/リダイレクト, dns/tcp/ssl=接続確立, wait=サーバー応答待ち(TTFB), recv=ダウンロード, 単位ms');
  L.push('preflight>… 行は CORS プリフライト(OPTIONS)。');
  return L.join('\n') + '\n';
}

// ---------- main ----------
const local = TARGET ? null : await startServer();
const url = TARGET || local.url;
const browser = await chromium.launch({ args: ['--no-sandbox'] });

const meta = {
  date: new Date().toISOString(),
  target: url,
  mode: TARGET ? '本番URL' : 'ローカル配信(HTTP/1.1, gzip)',
  network: NET_PROFILES[NET] ? `${NET} ${JSON.stringify(NET_PROFILES[NET])}` : 'none (Codespaces回線そのまま)',
  chromium: browser.version(),
  node: process.version,
  host: `${os.platform()} ${os.arch()} cpus=${os.cpus().length}`,
  viewport: `${VW}x${VH}`,
  runs: RUNS,
  rtt_probe: await probeRtt(),
};
console.log('meta:', meta);

const runs = [];
for (let i = 0; i < RUNS; i++) {
  console.log(`run ${i + 1}/${RUNS} ...`);
  const r = await runOnce(browser, url, i);
  runs.push(r);
  console.log(`  hidden=${r.summary.loading_hidden}ms faded=${r.summary.loading_faded}ms data_end=${r.summary.data_fetch_end}ms timedOut=${r.timedOut}`);
  await new Promise((res) => setTimeout(res, 1000));
}
await browser.close();
local?.srv.close();

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'Logs.json'), JSON.stringify({ meta, runs }, null, 2));
fs.writeFileSync(path.join(OUT, 'Logs.txt'), buildTxt(meta, runs));
console.log(`\n書き出し完了: ${path.join(OUT, 'Logs.txt')} / Logs.json` + (TRACE ? ' / trace.json' : ''));

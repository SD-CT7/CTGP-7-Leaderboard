// js/features/history.js
// 過去バージョン(History)の閲覧。times.version が 0 = 現行、1以上 = 過去(数字が大きいほど古い)。
// - 過去バージョンがあるコースの一覧は Supabase のビュー track_versions から取得する(courses.js には持たない)
// - 記録本体はコース×バージョンを選んだ時に初めて取得する(初期ロードを重くしない)
// ranking.js との循環参照を避けるため、再描画は initHistory(rerender) で受け取る。
import { SUPABASE_URL, SUPABASE_KEY } from '../config.js';
import { state } from '../state.js';

// トラックキー(小文字) → { trackName: DB上の正確な名前, versions: [1, 2, ...] }
let availability = {};
let rerender = () => {};
let requestSeq = 0;
const cache = new Map();   // `${trackName}|${version}` → rows

export const versionLabel = (v) => (v === 0 ? 'Current' : `Previous ${v}`);

async function sbFetch(path) {
  const res = await fetch(SUPABASE_URL + '/rest/v1/' + path, { headers: { apikey: SUPABASE_KEY } });
  if (!res.ok) throw new Error('Supabase request failed: ' + path);
  return res.json();
}

export async function loadHistoryAvailability() {
  try {
    const rows = await sbFetch('track_versions?select=track_name,version&order=track_name,version&limit=5000');
    const map = {};
    for (const r of rows) {
      const v = Number(r.version);
      if (!r.track_name || !Number.isInteger(v) || v < 1) continue;
      const key = String(r.track_name).toLowerCase();
      (map[key] ||= { trackName: r.track_name, versions: [] }).versions.push(v);
    }
    availability = map;
  } catch (e) {
    console.warn(e);
    availability = {};
  }
  refreshHistoryUI();   // すでにランキング画面が開いていれば反映する
}

// 現在表示中のコースのキー(ranking.js と同じ規則。Glitch は _G を付ける)
function currentKey() {
  const c = state.currentSelectedCourse;
  if (!c) return null;
  return (c.file.substring(4) + (state.isGlitch ? '_G' : '')).toLowerCase();
}

function currentEntry() {
  if (state.currentCategory !== 'General') return null;   // times テーブルは General のみ
  const key = currentKey();
  return key ? availability[key] || null : null;
}

async function fetchRows(trackName, version) {
  const ck = `${trackName}|${version}`;
  if (cache.has(ck)) return cache.get(ck);
  const rows = await sbFetch(
    'times?select=rank,player,time,video&category=eq.General' +
    '&track_name=eq.' + encodeURIComponent(trackName) +
    '&version=eq.' + version + '&order=rank&limit=500'
  );
  const data = rows.map(r => ({
    rank: r.rank,
    name: r.player,
    time: r.time || '-',
    video: r.video || '-',
    channel: '-',
    country: '-',   // 国は ranking.js が players 由来の辞書で補完する
  }));
  cache.set(ck, data);
  return data;
}

export async function selectHistoryVersion(version) {
  const entry = currentEntry();
  const seq = ++requestSeq;
  state.historyVersion = version;
  state.isReadMoreExpanded = false;

  if (version === 0 || !entry) {
    state.historyVersion = 0;
    state.historyStatus = 'idle';
    state.historyRows = [];
    renderBar();
    rerender();
    return;
  }

  state.historyStatus = 'loading';
  state.historyRows = [];
  renderBar();
  rerender();

  try {
    const rows = await fetchRows(entry.trackName, version);
    if (seq !== requestSeq) return;   // 途中で別のバージョン/コースに切り替えられた
    state.historyRows = rows;
    state.historyStatus = 'ready';
  } catch (e) {
    if (seq !== requestSeq) return;
    console.warn(e);
    state.historyStatus = 'error';
  }
  rerender();
}

function renderBar() {
  const bar = document.getElementById('history-bar');
  const btn = document.getElementById('history-btn');
  const entry = currentEntry();

  btn.classList.toggle('hidden', !entry);
  btn.classList.toggle('active', state.historyOpen && !!entry);

  if (!entry || !state.historyOpen) { bar.classList.add('hidden'); return; }

  const versions = [0, ...entry.versions];
  bar.innerHTML =
    '<div class="history-pills">' +
    versions.map(v =>
      `<button type="button" class="history-pill ${v === state.historyVersion ? 'selected' : ''}" data-version="${v}">${versionLabel(v)}</button>`
    ).join('') +
    '</div>' +
    (state.historyVersion > 0
      ? '<div class="history-note">Viewing records from an older version of this course.</div>'
      : '');
  bar.classList.remove('hidden');
}

// コース・カテゴリ・Glitch が変わった時や画面を開いた時に呼ぶ。現行バージョンに戻して UI を更新する。
export function resetHistory() {
  requestSeq++;
  state.historyOpen = false;
  state.historyVersion = 0;
  state.historyStatus = 'idle';
  state.historyRows = [];
  renderBar();
}

export function refreshHistoryUI() {
  // 履歴の有無が後から分かった場合などに、現在の状態を保ったままボタンだけ更新する
  if (!state.currentSelectedCourse) return;
  renderBar();
}

export function initHistory(rerenderFn) {
  rerender = rerenderFn;
  document.getElementById('history-btn').addEventListener('click', () => {
    state.historyOpen = !state.historyOpen;
    if (!state.historyOpen) { selectHistoryVersion(0); return; }
    renderBar();
  });
  document.getElementById('history-bar').addEventListener('click', (e) => {
    const pill = e.target.closest('.history-pill[data-version]');
    if (pill) selectHistoryVersion(Number(pill.dataset.version));
  });
}

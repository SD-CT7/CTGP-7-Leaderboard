// js/data/loader.js

import {
  SUPABASE_URL, SUPABASE_KEY, STATIC_ICONS,
} from '../config.js';
import { getInitialCupImages, loadCupImage, loadRemainingCupImages } from '../features/cupCards.js';
import { loadHistoryAvailability } from '../features/history.js';

// 進捗管理用の状態（このモジュール内で完結）
let loadedAssets = 0;
const totalImages = STATIC_ICONS.length;
const totalCsvs = 1 + 3 + 1; // General + (Flap/Mission/Shroomless) + players
let totalAssets = totalImages + totalCsvs; // 初期表示のカード画像を数に加えるため let

// 全アセットの読み込み完了 かつ データの後処理(マップ構築・switchCategory)完了で消す。
// 以前は setTimeout(500ms) の固定待ちで後処理の完了を見込んでいたが、
// 条件を明示してタイマーを廃止した。
let dataReady = false;
let loadingHidden = false;

function tryHideLoading() {
  if (loadingHidden || !dataReady || loadedAssets < totalAssets) return;
  loadingHidden = true;
  document.getElementById('loading-screen').classList.add('hidden');
  // 画面が消えたら、まだ読み込んでいない(画面外の)カード画像を読み込む
  loadRemainingCupImages();
}

function updateProgress() {
  loadedAssets++;
  const percent = Math.min((loadedAssets / totalAssets) * 100, 100);
  document.getElementById('progress-bar').style.width = percent + '%';
  tryHideLoading();
}

export function preloadStaticIcons() {
  STATIC_ICONS.forEach(src => {
    const img = new Image();
    img.onload = updateProgress;
    img.onerror = updateProgress;
    img.src = src;
  });
}

// 初期表示で見えているカード画像を、ローディングの完了条件に加える。
// 画面が消える瞬間には、これらが読み込み・デコード済みになっている。
// (initCupCards() の後、かつ他のロード処理を始める前に同期的に呼ぶこと)
export function preloadInitialCupImages() {
  const imgs = getInitialCupImages();
  totalAssets += imgs.length;
  imgs.forEach(img => loadCupImage(img).then(updateProgress));
}

export function buildPlayerChannelMap(allCategoryData) {
  const map = {};
  Object.values(allCategoryData).forEach(categoryData => {
    Object.values(categoryData).forEach(track => {
      ['without', 'dekatire'].forEach(mode => {
        (track[mode] || []).forEach(entry => {
          if (entry.name && entry.channel && entry.channel !== '-') {
            map[entry.name] = entry.channel;
          }
        });
      });
    });
  });
  return map;
}

export function buildPlayerCountryMap(allCategoryData) {
  const map = {};
  Object.values(allCategoryData).forEach(categoryData => {
    Object.values(categoryData).forEach(track => {
      ['without', 'dekatire'].forEach(mode => {
        (track[mode] || []).forEach(entry => {
          if (entry.name && entry.country && entry.country !== '-') {
            map[entry.name] = entry.country.toLowerCase();
          }
        });
      });
    });
  });
  return map;
}

// プレイヤー情報の名前からチャンネルURL・国コードへの辞書を作る。
export function buildMapsFromPlayers(rows) {
  const channel = {};
  const country = {};
  for (const p of rows) {
    let aliases = p.aliases;
    if (typeof aliases === 'string') {
      try { aliases = JSON.parse(aliases); } catch { aliases = []; }
    }
    if (!Array.isArray(aliases)) aliases = [];

    const url = String(p.channel_url || '').trim();
    const cc = String(p.country || '').trim().toLowerCase();

    for (const n of [p.name, ...aliases]) {
      if (!n) continue;
      if (/^https?:\/\//i.test(url)) channel[n] = url;
      if (cc) country[n] = cc;
    }
  }
  return { channel, country };
}

export async function startLoadingProcess() {
  const allCategoryData = window.allCategoryData;

  // General は Supabase から取得
  const supabasePromise = (async () => {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/times?select=track_name,rank,player,time,video,is_obsolete&category=eq.General&version=eq.0&order=track_name,rank&limit=5000',
        {
          headers: {
            'apikey': SUPABASE_KEY,
          }
        }
      );
      if (!res.ok) throw new Error('Failed to load General from Supabase');
      const rows = await res.json();

      const generalData = {};
      for (const row of rows) {
        const track = String(row.track_name || '').toLowerCase();
        if (!generalData[track]) {
          generalData[track] = { without: [], dekatire: [] };
        }
        generalData[track]['without'].push({
          rank: row.rank,
          name: row.player,
          time: row.time || '-',
          video: row.video || '-',
          channel: '-',
          country: '-',
          isObsolete: row.is_obsolete === true,
        });
      }
      allCategoryData['General'] = generalData;
    } catch (e) {
      console.warn(e);
      allCategoryData['General'] = {};
    } finally {
      updateProgress();
    }
  })();

  // Flap / Mission / Shroomless は Supabase のビューから取得(形式は共通)
  const fmtMs = (ms) => {
    const m = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return m + ':' + String(sec).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
  };

  const fetchLeaderboardView = async (categoryKey, viewName) => {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/' + viewName + '?select=track_key,place,player,country,channel_url,time_ms,video_url&order=track_key,place,time_ms&limit=5000',
        {
          headers: {
            'apikey': SUPABASE_KEY,
          }
        }
      );
      if (!res.ok) throw new Error(`Failed to load ${categoryKey} from Supabase`);
      const rows = await res.json();

      const data = {};
      for (const row of rows) {
        const track = String(row.track_key || '').toLowerCase();
        if (!data[track]) data[track] = { without: [], dekatire: [] };
        data[track]['without'].push({
          rank: row.place,
          name: row.player,
          time: fmtMs(row.time_ms),
          video: row.video_url || '-',
          channel: row.channel_url || '-',
          country: row.country || '-',
        });
      }
      allCategoryData[categoryKey] = data;
    } catch (e) {
      console.warn(e);
      allCategoryData[categoryKey] = {};
    } finally {
      updateProgress();
    }
  };

  const flapPromise = fetchLeaderboardView('Flap', 'flap_leaderboard');
  const missionPromise = fetchLeaderboardView('Mission', 'mission_leaderboard');
  const shroomlessPromise = fetchLeaderboardView('Shroomless', 'shroomless_leaderboard');

  // プレイヤー情報は Supabase の players テーブルから取得
  let playersMaps = { channel: {}, country: {} };
  const playersPromise = (async () => {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/players?select=name,country,channel_url,aliases&order=id&limit=5000',
        {
          headers: {
            'apikey': SUPABASE_KEY,
          }
        }
      );
      if (!res.ok) throw new Error('Failed to load players from Supabase');
      playersMaps = buildMapsFromPlayers(await res.json());
    } catch (e) {
      console.warn(e);
    } finally {
      updateProgress();
    }
  })();

  await Promise.all([
    supabasePromise,
    flapPromise,
    missionPromise,
    shroomlessPromise,
    playersPromise
  ]);

  // General のチャンネルURLと国コードは times ではなく players の情報を使う
  Object.values(allCategoryData['General'] || {}).forEach(track => {
    ['without', 'dekatire'].forEach(mode => {
      (track[mode] || []).forEach(entry => {
        entry.channel = playersMaps.channel[entry.name] || '-';
        entry.country = playersMaps.country[entry.name] || '-';
      });
    });
  });

  // 記録データをプレイヤー情報で補完
  window.globalPlayerChannelMap = {
    ...buildPlayerChannelMap(allCategoryData),
    ...playersMaps.channel
  };
  window.globalPlayerCountryMap = {
    ...buildPlayerCountryMap(allCategoryData),
    ...playersMaps.country
  };

  window.switchCategory('General');
  window.checkInitialPlayerRoute();

  // 過去バージョンがあるコースの一覧(任意機能なのでローディングの完了条件には含めない)
  loadHistoryAvailability();

  dataReady = true;
  tryHideLoading();
}

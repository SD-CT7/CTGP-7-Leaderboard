// js/data/loader.js

import {
  SUPABASE_URL, SUPABASE_KEY, CSV_URLS,
  PLAYER_LEADERBOARD_CSV_URL, STATIC_ICONS,
} from '../config.js';
import { parseRankingCsv, parsePlayerLeaderboardCsv } from './parser.js';

// 進捗管理用の状態（このモジュール内で完結）
let loadedAssets = 0;
const totalImages = STATIC_ICONS.length;
const totalCsvs = Object.keys(CSV_URLS).length + 1 + 1 + 1 + 1;
const totalAssets = totalImages + totalCsvs;

function updateProgress() {
  loadedAssets++;
  const percent = Math.min((loadedAssets / totalAssets) * 100, 100);
  document.getElementById('progress-bar').style.width = percent + '%';

  if (loadedAssets >= totalAssets) {
    setTimeout(() => {
      document.getElementById('loading-screen').classList.add('hidden');
    }, 500);
  }
}

export function preloadStaticIcons() {
  STATIC_ICONS.forEach(src => {
    const img = new Image();
    img.onload = updateProgress;
    img.onerror = updateProgress;
    img.src = src;
  });
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
  let playerLeaderboardData = window.playerLeaderboardData;

  // Default / Mission はCSVから取得
  const csvPromises = Object.keys(CSV_URLS).map(async (key) => {
    const url = CSV_URLS[key];
    try {
      const res = await fetch(url + "&t=" + Date.now());
      if (!res.ok) throw new Error(`Failed to load ${key}`);
      const text = await res.text();
      allCategoryData[key] = parseRankingCsv(text);
    } catch (e) {
      console.warn(e);
      allCategoryData[key] = {};
    } finally {
      updateProgress();
    }
  });

  // General は Supabase から取得
  const supabasePromise = (async () => {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/times?category=eq.General&order=track_name,rank&limit=5000',
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
          channel: row.channel || '-',
          country: row.country || '-',
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

  // Flap は Supabase(flap_leaderboard ビュー)から取得
  const flapPromise = (async () => {
    try {
      const res = await fetch(
        SUPABASE_URL + '/rest/v1/flap_leaderboard?select=track_key,place,player,country,channel_url,time_ms,video_url&order=track_key,place,time_ms&limit=5000',
        {
          headers: {
            'apikey': SUPABASE_KEY,
          }
        }
      );
      if (!res.ok) throw new Error('Failed to load Flap from Supabase');
      const rows = await res.json();

      const fmtMs = (ms) => {
        const m = Math.floor(ms / 60000);
        const sec = Math.floor((ms % 60000) / 1000);
        return m + ':' + String(sec).padStart(2, '0') + '.' + String(ms % 1000).padStart(3, '0');
      };
      const flapData = {};
      for (const row of rows) {
        const track = String(row.track_key || '').toLowerCase();
        if (!flapData[track]) flapData[track] = { without: [], dekatire: [] };
        flapData[track]['without'].push({
          rank: row.place,
          name: row.player,
          time: fmtMs(row.time_ms),
          video: row.video_url || '-',
          channel: row.channel_url || '-',
          country: row.country || '-',
        });
      }
      allCategoryData['Flap'] = flapData;
    } catch (e) {
      console.warn(e);
      allCategoryData['Flap'] = {};
    } finally {
      updateProgress();
    }
  })();

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

  // プレイヤーリーダーボードは公開CSVから取得
  const playerLeaderboardPromise = (async () => {
    if (!PLAYER_LEADERBOARD_CSV_URL) {
      console.warn('PLAYER_LEADERBOARD_CSV_URL is not set, using fallback data.');
      updateProgress();
      return;
    }
    try {
      const res = await fetch(PLAYER_LEADERBOARD_CSV_URL + "&t=" + Date.now());
      if (!res.ok) throw new Error('Failed to load player leaderboard CSV');
      const text = await res.text();
      const parsed = parsePlayerLeaderboardCsv(text);
      if (parsed.length > 0) {
        window.playerLeaderboardData = parsed;
        playerLeaderboardData = parsed;
      }
    } catch (e) {
      console.warn(e);
    } finally {
      updateProgress();
    }
  })();

  await Promise.all([
    ...csvPromises,
    supabasePromise,
    flapPromise,
    playersPromise,
    playerLeaderboardPromise
  ]);

  // 記録データをプレイヤー情報で補完
  window.globalPlayerChannelMap = {
    ...buildPlayerChannelMap(allCategoryData),
    ...playersMaps.channel
  };
  window.globalPlayerCountryMap = {
    ...buildPlayerCountryMap(allCategoryData),
    ...playersMaps.country
  };
  window.playerLeaderboardData.forEach(p => {
    p.link = window.globalPlayerChannelMap[p.name] || null;
  });

  window.switchCategory('General');
  window.checkInitialPlayerRoute();
}

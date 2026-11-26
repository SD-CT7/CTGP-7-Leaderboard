// js/main.js
import { state } from './state.js';
import { preloadStaticIcons, startLoadingProcess } from './data/loader.js';

import { initFilterEvents, openCountryFilterMenu } from './features/filter.js';
import { initLeaderboardEvents, closeLeaderboard, renderPlayerLeaderboard } from './features/leaderboard.js';
import { initPlayerProfileEvents, closePlayerProfile, openPlayerProfile, checkInitialPlayerRoute } from './features/playerProfile.js';
import { initRankingEvents, switchCategory, renderRankingList, showRankingScreen } from './features/ranking.js';
import { initCupCards, resetCard } from './features/cupCards.js';
import { initVideoModalEvents, openVideoModal } from './ui/videoModal.js';
import { initCategoryPicker } from './ui/categoryPicker.js';

// 後方互換性のため window に公開 (既存の loader.js 等の呼び出しに対応)
window.switchCategory = switchCategory;
window.checkInitialPlayerRoute = checkInitialPlayerRoute;

// フィルター変更時の再描画コールバック
window.onFilterChange = () => {
  if (state.leaderboardActive) renderPlayerLeaderboard();
  if (!document.getElementById('ranking-screen').classList.contains('hidden')) renderRankingList();
};

function initGlobalEvents() {
  window.addEventListener('open-country-filter', openCountryFilterMenu);
  
  window.addEventListener('jump-to-course', (e) => {
    switchCategory(e.detail.cat);
    setTimeout(() => showRankingScreen(e.detail.course), 50);
  });

  document.querySelector('.close-btn').addEventListener('click', () => {
    if (state.playerProfileActive) closePlayerProfile();
    else if (state.leaderboardActive) closeLeaderboard();
    else resetCard();
  });

  // 動的イベント委譲: ランキング一覧
  document.getElementById('rankingList').addEventListener('click', (e) => {
    const nameLink = e.target.closest('.name-link[data-player]');
    if (nameLink) { e.preventDefault(); openPlayerProfile(nameLink.dataset.player, nameLink); return; }
    const videoIcon = e.target.closest('.video-icon[data-video-url]');
    if (videoIcon) { openVideoModal(videoIcon.dataset.videoUrl); return; }
  });

  // 動的イベント委譲: プレイヤーリーダーボード
  document.getElementById('playerRankingList').addEventListener('click', (e) => {
    const nameLink = e.target.closest('.name-link[data-player]');
    if (nameLink) { e.preventDefault(); openPlayerProfile(nameLink.dataset.player, nameLink); return; }
    const row = e.target.closest('.player-row[data-player]');
    if (row) { openPlayerProfile(row.dataset.player, row); return; }
  });
}

// ===== 初期化 =====
document.addEventListener('DOMContentLoaded', () => {
  initCategoryPicker();
  initCupCards();
  initFilterEvents();
  initLeaderboardEvents();
  initPlayerProfileEvents();
  initRankingEvents();
  initVideoModalEvents();
  initGlobalEvents();
  
  preloadStaticIcons();
  startLoadingProcess();
});

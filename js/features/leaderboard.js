import { state } from '../state.js';
import { countryMatchesFilter, openCountryFilterMenu } from './filter.js';
import { escapeAttr, getRankImageSrc } from '../utils/dom.js';

export function renderPlayerLeaderboard() {
  const listEl = document.getElementById('playerRankingList');
  listEl.innerHTML = '';
  const filteredData = state.playerLeaderboardData.filter(p => countryMatchesFilter(state.globalPlayerCountryMap[p.name]));
  
  filteredData.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `player-row ${p.rank === 1 ? 'rank-1st' : ''} animate-slide-in`;
    row.style.animationDelay = `${Math.min(i + 1, 20) * 0.03}s`;
    row.dataset.player = p.name;

    let rankContent;

    if (p.rank <= 8) {
      rankContent = `<img src="${getRankImageSrc(p.rank)}" onerror="this.style.display='none';this.parentElement.innerText='${p.rank}'">`;
    } else {
      rankContent = `${p.rank}`;
    }

    row.innerHTML = `
      <div class="pr-rank">${rankContent}</div>
      <div class="pr-name"><a href="/player/${encodeURIComponent(p.name)}" class="name-link" data-player="${escapeAttr(p.name)}">${p.name}</a></div>
      <div class="pr-points">${p.points} pt</div>
    `;
    listEl.appendChild(row);
  });
}

export function openLeaderboard() {
  const btn = document.getElementById('leaderboard-btn');
  const panel = document.getElementById('leaderboard-panel');
  const rect = btn.getBoundingClientRect();
  state.cardRects.set('leaderboard-panel', rect);

  panel.classList.remove('hidden');
  panel.style.cssText = `position:fixed; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px; margin:0;`;
  document.body.classList.add('mode-expanded');
  state.leaderboardActive = true;
  renderPlayerLeaderboard();

  setTimeout(() => {
    panel.classList.add('active-panel');
    panel.style.cssText = `position:fixed; top:50%; left:50%; width:min(700px, 92vw); height:min(80vh, 750px); transform:translate(-50%, -50%); margin:0;`;
  }, 10);
}

export function closeLeaderboard() {
  const panel = document.getElementById('leaderboard-panel');
  const rect = state.cardRects.get('leaderboard-panel');
  panel.classList.remove('active-panel');
  document.body.classList.remove('mode-expanded');
  panel.style.cssText = `position:fixed; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px; margin:0;`;

  setTimeout(() => {
    panel.style.cssText = '';
    panel.classList.add('hidden');
    state.leaderboardActive = false;
  }, 600);
}

export function initLeaderboardEvents() {
  document.getElementById('leaderboard-btn').addEventListener('click', openLeaderboard);
  document.querySelector('#leaderboard-panel .earth-btn').addEventListener('click', openCountryFilterMenu);
}

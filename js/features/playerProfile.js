import { state } from '../state.js';
import { RAW_CSV_DATA } from '../data/courses.js';
import { escapeAttr, getRankImageSrc } from '../utils/dom.js';
import {
  getVideoIcon,
  isModalVideoIcon,
  NO_VIDEO_ICON
} from '../ui/videoModal.js';

export function getPlayerCourseRows(name, catKey) {
  let key = (catKey === '200cc' || catKey === 'Shroomless') ? 'Default' : catKey;
  const categoryData = state.allCategoryData[key] || {};

  return RAW_CSV_DATA.map(course => {
    const trackKey = course.file.substring(4);
    const trackData = categoryData[trackKey];
    const entry = trackData ? (trackData.without || []).find(e => e.name === name) : null;
    return {
      trackName: course.name, course,
      rank: entry ? entry.rank : null,
      time: entry ? entry.time : null,
      video: entry ? entry.video : null,
    };
  });
}

export function renderPlayerProfileRecords() {
  let rows = getPlayerCourseRows(state.currentProfileName, state.currentProfileCategory);
  if (state.currentProfileSortMode === 'rank') {
    rows = [...rows].sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });
  }

  const listEl = document.getElementById('ppRecordList');
  listEl.innerHTML = '';

  rows.forEach((r, i) => {
    const hasRecord = r.rank !== null;
    const row = document.createElement('div');
    row.className = `record-row ${hasRecord && r.rank === 1 ? 'gold-rank' : ''} animate-slide-in`;
    row.style.animationDelay = `${Math.min(i + 1, 25) * 0.02}s`;

    let rankContent = hasRecord ? (r.rank <= 8 ? `<img src="${getRankImageSrc(r.rank)}" onerror="this.style.display='none';this.parentElement.innerText='${r.rank}'">` : `${r.rank}`) : '-';
    let iconHtml = `<img src="${NO_VIDEO_ICON}">`;
    let timeHtml = hasRecord ? r.time : '-';

    if (hasRecord && r.video && r.video !== '-') {
      const iconSrc = getVideoIcon(r.video);
      const isModalTarget = isModalVideoIcon(iconSrc);
      const safeHref = escapeAttr(String(r.video));
      timeHtml = `<a href="${safeHref}" target="_blank" rel="noopener" class="time-link">${r.time}</a>`;
      iconHtml = isModalTarget 
        ? `<div class="video-icon" data-video-url="${safeHref}" style="cursor:pointer"><img src="${iconSrc}" onerror="this.src='${NO_VIDEO_ICON}'"></div>`
        : `<a href="${safeHref}" target="_blank" rel="noopener"><img src="${iconSrc}" onerror="this.src='img/favicon/novideo.webp'"></a>`;
    }

    row.innerHTML = `<div class="rr-rank">${rankContent}</div><div class="rr-track course-jump">${r.trackName}</div><div class="rr-time">${timeHtml}</div><div class="rr-icon">${iconHtml}</div>`;
    row.querySelector('.rr-track').addEventListener('click', () => jumpToCourseFromProfile(r.course));
    listEl.appendChild(row);
  });
}

export function jumpToCourseFromProfile(course) {
  closePlayerProfile(true);
  // 循環参照を避けるためカスタムイベントで main.js に処理を委譲
  window.dispatchEvent(new CustomEvent('jump-to-course', { detail: { course, cat: state.currentProfileCategory } }));
}

export function switchProfileCategory(cat) {
  state.currentProfileCategory = cat;
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('selected', t.dataset.cat === cat));
  renderPlayerProfileRecords();
}

export function setProfileSortMode(mode) {
  state.currentProfileSortMode = mode;
  document.querySelectorAll('.sort-toggle-option').forEach(el => el.classList.toggle('selected', el.dataset.sort === mode));
  renderPlayerProfileRecords();
}

export function openPlayerProfile(name, originEl, pushState = true) {
if (state.leaderboardActive) {
  const panel = document.getElementById('leaderboard-panel');
  panel.classList.remove('active-panel');
  panel.classList.add('hidden');
  panel.style.cssText = '';
  state.leaderboardActive = false;
}

  state.currentProfileName = name;
  state.currentProfileCategory = 'General';
  state.currentProfileSortMode = 'course';
  
  const channelUrl = state.globalPlayerChannelMap[name];
  const ppNameEl = document.getElementById('pp-name');
  ppNameEl.innerHTML = channelUrl ? `<a href="${channelUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" class="name-link">${name}</a>` : name;
  
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('selected', t.dataset.cat === 'General'));
  document.querySelectorAll('.sort-toggle-option').forEach(el => el.classList.toggle('selected', el.dataset.sort === 'course'));

  const panel = document.getElementById('player-profile-panel');
  panel.classList.remove('hidden');
  
  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    state.cardRects.set('player-profile-panel', rect);
    panel.style.cssText = `position:fixed; margin:0; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px; opacity:1;`;
  } else {
    state.cardRects.delete('player-profile-panel');
    panel.style.cssText = `position:fixed; margin:0; top:50%; left:50%; width:min(700px, 92vw); height:min(80vh, 750px); transform:translate(-50%, -50%); opacity:0;`;
  }

  document.body.classList.add('mode-expanded');
  state.playerProfileActive = true;
  renderPlayerProfileRecords();

  requestAnimationFrame(() => {
    setTimeout(() => {
      panel.classList.add('active-panel');
      panel.style.cssText = `position:fixed; margin:0; top:50%; left:50%; width:min(700px, 92vw); height:min(80vh, 750px); transform:translate(-50%, -50%); opacity:1;`;
    }, 10);
  });

  if (pushState) history.pushState({ player: name }, '', '/player/' + encodeURIComponent(name));
}

export function closePlayerProfile(skipHistory) {
  const panel = document.getElementById('player-profile-panel');
  const rect = state.cardRects.get('player-profile-panel');
  panel.classList.remove('active-panel');
  document.body.classList.remove('mode-expanded');

  if (rect) {
    panel.style.cssText = `position:fixed; margin:0; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px;`;
  } else {
    panel.style.opacity = '0';
  }

  setTimeout(() => {
    panel.style.cssText = '';
    panel.classList.add('hidden');
    state.playerProfileActive = false;
  }, 600);

  if (!skipHistory) history.pushState({}, '', '/');
}

export function checkInitialPlayerRoute() {
  const match = window.location.pathname.match(/^\/player\/([^\/]+)\/?$/);
  if (match) openPlayerProfile(decodeURIComponent(match[1]), null, false);
}

export function initPlayerProfileEvents() {
  window.addEventListener('popstate', () => {
    const match = window.location.pathname.match(/^\/player\/([^\/]+)\/?$/);
    if (match) {
      const name = decodeURIComponent(match[1]);
      if (!(state.playerProfileActive && state.currentProfileName === name)) openPlayerProfile(name, null, false);
    } else if (state.playerProfileActive) {
      closePlayerProfile(true);
    }
  });

  document.querySelector('#player-profile-panel .panel-close-btn').addEventListener('click', () => closePlayerProfile());
  document.querySelector('#player-profile-panel .pp-mobile-btn').addEventListener('click', () => document.getElementById('profile-mobile-category-overlay').classList.add('visible'));
  
  const profileMobileOverlay = document.getElementById('profile-mobile-category-overlay');
  profileMobileOverlay.addEventListener('click', () => profileMobileOverlay.classList.remove('visible'));
  profileMobileOverlay.querySelector('.mobile-category-list').addEventListener('click', (e) => e.stopPropagation());
  profileMobileOverlay.querySelectorAll('.mobile-category-item[data-cat]').forEach(item => {
    item.addEventListener('click', () => { switchProfileCategory(item.dataset.cat); profileMobileOverlay.classList.remove('visible'); });
  });

  document.getElementById('pp-tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('.pp-tab[data-cat]');
    if (tab) switchProfileCategory(tab.dataset.cat);
  });

  document.getElementById('pp-sort-toggle').addEventListener('click', (e) => {
    const opt = e.target.closest('.sort-toggle-option[data-sort]');
    if (opt) setProfileSortMode(opt.dataset.sort);
  });
}

// js/main.js  ── Step 3 完了版

// ===== import =====
import {
  RANK_IMG_BASE, RANK_EXT,
  CSV_URLS,
  STATIC_ICONS,
  LOCAL_CSV_PATH, COURSES_PER_CUP, ICON_BASE_PATH,
  SCALE_FACTOR, SIDEBAR_WIDTH, FLAG_BASE_URL,
} from './config.js';

import { RAW_CSV_DATA as rawCsvData, GLITCH_COURSES } from './data/courses.js';
import { REGION_DATA, SELECTABLE_REGIONS, COUNTRY_TO_REGION } from './data/regions.js';
import { FALLBACK_PLAYER_DATA } from './data/playerFallback.js';

import { parseRankingCsv, parsePlayerLeaderboardCsv } from './data/parser.js';
import {
  startLoadingProcess,
  preloadStaticIcons,
  buildPlayerChannelMap,
  buildPlayerCountryMap,
} from './data/loader.js';

// ===== 状態変数 =====
let allCategoryData = {};
let currentSheetUrl = CSV_URLS.General; // 未使用だが既存挙動維持のため残す

let globalRankingData = {};
let currentTire = 'without';
let isGlitch = false;
let isReadMoreExpanded = false;
let activeCard = null, currentSelectedCourse = null, placeholderEl = null;
let cardRects = new Map();

let playerLeaderboardData = FALLBACK_PLAYER_DATA;

let globalPlayerChannelMap = {};
let globalPlayerCountryMap = {};
let leaderboardActive = false;
let playerProfileActive = false;
let currentProfileName = null;
let currentProfileCategory = 'General';
let currentProfileSortMode = 'course';

let countryFilter = { type: 'all', value: null };

// ===== 地域・国フィルター =====
function countryMatchesFilter(countryCode) {
  if (countryFilter.type === 'all') return true;
  if (!countryCode || countryCode === '-') return false;
  const code = countryCode.toLowerCase();
  if (countryFilter.type === 'country') {
    if (countryFilter.value === 'uk' && code === 'scotland') return true;
    return code === countryFilter.value;
  }
  if (countryFilter.type === 'region') return COUNTRY_TO_REGION[code] === countryFilter.value;
  return true;
}

function openCountryFilterMenu() {
  document.getElementById('country-filter-overlay').classList.add('visible');
  showRegionList();
}
function closeCountryFilterMenu() {
  document.getElementById('country-filter-overlay').classList.remove('visible');
}

function showRegionList() {
  document.getElementById('cf-title').innerText = 'Filter by Region';
  document.getElementById('cf-back-btn').classList.remove('visible');
  const list = document.getElementById('cf-list');
  list.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'cf-item all-item' + (countryFilter.type === 'all' ? ' selected' : '');
  allItem.innerText = 'All Regions';
  allItem.onclick = () => applyCountryFilter('all', null);
  list.appendChild(allItem);

  SELECTABLE_REGIONS.forEach(region => {
    const isSelected = countryFilter.type === 'region' && countryFilter.value === region;
    const item = document.createElement('div');
    item.className = 'cf-item' + (isSelected ? ' selected' : '');
    item.innerText = region;
    item.onclick = () => showCountryList(region);
    list.appendChild(item);
  });
}

function showCountryList(region) {
  document.getElementById('cf-title').innerText = region;
  document.getElementById('cf-back-btn').classList.add('visible');
  const list = document.getElementById('cf-list');
  list.innerHTML = '';

  const allItem = document.createElement('div');
  allItem.className = 'cf-item all-item' + (countryFilter.type === 'region' && countryFilter.value === region ? ' selected' : '');
  allItem.innerText = `All of ${region}`;
  allItem.onclick = () => applyCountryFilter('region', region);
  list.appendChild(allItem);

  REGION_DATA[region].forEach(c => {
    const isSelected = countryFilter.type === 'country' && countryFilter.value === c.code;
    const flagSrc = c.code === 'scotland' ? 'Scotland.webp' : `${FLAG_BASE_URL}${c.code}.svg`;
    const item = document.createElement('div');
    item.className = 'cf-item' + (isSelected ? ' selected' : '');
    item.innerHTML = `<img src="${flagSrc}" onerror="this.style.visibility='hidden'">${c.name}`;
    item.onclick = () => applyCountryFilter('country', c.code);
    list.appendChild(item);
  });
}

function applyCountryFilter(type, value) {
  countryFilter = { type, value };
  closeCountryFilterMenu();
  updateCountryFilterButtonState();
  refreshCurrentFilterableView();
}

function updateCountryFilterButtonState() {
  const active = countryFilter.type !== 'all';
  document.querySelectorAll('.earth-btn').forEach(btn => btn.classList.toggle('filter-active', active));
}

function refreshCurrentFilterableView() {
  if (leaderboardActive) renderPlayerLeaderboard();
  if (!rankingScreen.classList.contains('hidden')) renderRankingList();
}

// ===== DOM参照 =====
const cupScreen = document.getElementById('cup-select-screen');
const rankingScreen = document.getElementById('ranking-screen');
const container = document.getElementById('cupsContainer');
const rankingListEl = document.getElementById('rankingList');
const statusEl = document.getElementById('data-status');
const videoModal = document.getElementById('video-modal');
const youtubeFrame = document.getElementById('youtube-frame');
const modalImage = document.getElementById('modal-image');
const modalVideo = document.getElementById('modal-video'); 

// ===== カテゴリメニュー =====
function openCategoryMenu() {
  document.getElementById('mobile-category-overlay').classList.add('visible');
}
function closeCategoryMenu() {
  document.getElementById('mobile-category-overlay').classList.remove('visible');
}

function openProfileCategoryMenu() {
  document.getElementById('profile-mobile-category-overlay').classList.add('visible');
}
function closeProfileCategoryMenu() {
  document.getElementById('profile-mobile-category-overlay').classList.remove('visible');
}

function switchCategory(cat) {
  let key = cat;
  if (key === '200cc' || key === 'Shroomless') key = 'Default';

  if (allCategoryData[key]) {
    globalRankingData = allCategoryData[key];
    if (currentSelectedCourse) renderRankingList();
  } else {
    console.warn("Data not ready for " + key);
  }
}

// ===== プレイヤーリーダーボード =====
const leaderboardBtn = document.getElementById('leaderboard-btn');
const leaderboardPanel = document.getElementById('leaderboard-panel');
const playerRankingListEl = document.getElementById('playerRankingList');

function renderPlayerLeaderboard() {
  playerRankingListEl.innerHTML = '';
  const filteredData = playerLeaderboardData.filter(p => countryMatchesFilter(globalPlayerCountryMap[p.name]));
  filteredData.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = `player-row ${p.rank === 1 ? 'rank-1st' : ''} animate-slide-in`;
    row.style.animationDelay = `${Math.min(i + 1, 20) * 0.03}s`;

    let rankContent;
    if (p.rank <= 8) {
      rankContent = `<img src="${RANK_IMG_BASE}${p.rank}${RANK_EXT}" onerror="this.style.display='none';this.parentElement.innerText='${p.rank}'">`;
    } else {
      rankContent = `${p.rank}`;
    }

    const safeName = p.name.replace(/'/g, "\\'");
    let nameHtml = `<a href="/player/${encodeURIComponent(p.name)}" class="name-link" onclick="event.preventDefault();event.stopPropagation();openPlayerProfile('${safeName}', this)">${p.name}</a>`;

    row.innerHTML = `
      <div class="pr-rank">${rankContent}</div>
      <div class="pr-name">${nameHtml}</div>
      <div class="pr-points">${p.points} pt</div>
    `;
    row.addEventListener('click', (e) => {
      if (e.target.closest('.name-link')) return;
      openPlayerProfile(p.name, row);
    });
    playerRankingListEl.appendChild(row);
  });
}

function openLeaderboard() {
  const rect = leaderboardBtn.getBoundingClientRect();
  cardRects.set('leaderboard-panel', rect);

  leaderboardPanel.classList.remove('hidden');
  leaderboardPanel.style.position = 'fixed';
  leaderboardPanel.style.top = rect.top + 'px';
  leaderboardPanel.style.left = rect.left + 'px';
  leaderboardPanel.style.width = rect.width + 'px';
  leaderboardPanel.style.height = rect.height + 'px';
  leaderboardPanel.style.margin = '0';

  document.body.classList.add('mode-expanded');
  leaderboardActive = true;

  renderPlayerLeaderboard();

  setTimeout(() => {
    leaderboardPanel.classList.add('active-panel');
    leaderboardPanel.style.top = '50%';
    leaderboardPanel.style.left = '50%';
    leaderboardPanel.style.width = 'min(700px, 92vw)';
    leaderboardPanel.style.height = 'min(80vh, 750px)';
    leaderboardPanel.style.transform = 'translate(-50%, -50%)';
  }, 10);
}

function closeLeaderboard() {
  const rect = cardRects.get('leaderboard-panel');
  leaderboardPanel.classList.remove('active-panel');
  document.body.classList.remove('mode-expanded');
  leaderboardPanel.style.top = rect.top + 'px';
  leaderboardPanel.style.left = rect.left + 'px';
  leaderboardPanel.style.width = rect.width + 'px';
  leaderboardPanel.style.height = rect.height + 'px';
  leaderboardPanel.style.transform = '';

  setTimeout(() => {
    leaderboardPanel.style = '';
    leaderboardPanel.classList.add('hidden');
    leaderboardActive = false;
  }, 600);
}

function handleGlobalClose() {
  if (playerProfileActive) closePlayerProfile();
  else if (leaderboardActive) closeLeaderboard();
  else resetCard();
}

// ===== プレイヤープロフィールページ =====
const playerProfilePanel = document.getElementById('player-profile-panel');
const ppNameEl = document.getElementById('pp-name');
const ppRecordListEl = document.getElementById('ppRecordList');

function getPlayerCourseRows(name, catKey) {
  let key = catKey;
  if (key === '200cc' || key === 'Shroomless') key = 'Default';
  const categoryData = allCategoryData[key] || {};

  return rawCsvData.map(course => {
    const trackKey = course.file.substring(4);
    const trackData = categoryData[trackKey];
    const entry = trackData ? (trackData.without || []).find(e => e.name === name) : null;
    return {
      trackName: course.name,
      course: course,
      rank: entry ? entry.rank : null,
      time: entry ? entry.time : null,
      video: entry ? entry.video : null,
    };
  });
}

function renderPlayerProfileRecords() {
  let rows = getPlayerCourseRows(currentProfileName, currentProfileCategory);

  if (currentProfileSortMode === 'rank') {
    rows = [...rows].sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });
  }

  ppRecordListEl.innerHTML = '';

  rows.forEach((r, i) => {
    const hasRecord = r.rank !== null;
    const row = document.createElement('div');
    row.className = `record-row ${hasRecord && r.rank === 1 ? 'gold-rank' : ''} animate-slide-in`;
    row.style.animationDelay = `${Math.min(i + 1, 25) * 0.02}s`;

    let rankContent = '-';
    if (hasRecord) {
      if (r.rank <= 8) {
        rankContent = `<img src="${RANK_IMG_BASE}${r.rank}${RANK_EXT}" onerror="this.style.display='none';this.parentElement.innerText='${r.rank}'">`;
      } else {
        rankContent = `${r.rank}`;
      }
    }

    let iconHtml = `<img src="Novideo.webp">`;
    let timeHtml = hasRecord ? r.time : '-';
    if (hasRecord && r.video && r.video !== '-') {
      const iconSrc = getVideoIcon(r.video);
      const isModalTarget = (iconSrc === 'Youtube.webp' || iconSrc === 'Discord.webp' || iconSrc === 'Filenow.webp');
      const safeUrl = String(r.video).replace(/'/g, "\\'");
      const safeHref = String(r.video).replace(/"/g, '&quot;');
      timeHtml = `<a href="${safeHref}" target="_blank" rel="noopener" class="time-link">${r.time}</a>`;
      if (isModalTarget) {
        iconHtml = `<div onclick="openVideoModal('${safeUrl}')" style="cursor:pointer"><img src="${iconSrc}" onerror="this.src='Novideo.webp'"></div>`;
      } else {
        iconHtml = `<a href="${safeHref}" target="_blank" rel="noopener"><img src="${iconSrc}" onerror="this.src='Novideo.webp'"></a>`;
      }
    }

    row.innerHTML = `
      <div class="rr-rank">${rankContent}</div>
      <div class="rr-track course-jump">${r.trackName}</div>
      <div class="rr-time">${timeHtml}</div>
      <div class="rr-icon">${iconHtml}</div>
    `;
    row.querySelector('.rr-track').addEventListener('click', () => jumpToCourseFromProfile(r.course));
    ppRecordListEl.appendChild(row);
  });
}

function jumpToCourseFromProfile(course) {
  const cat = currentProfileCategory;
  playerProfilePanel.classList.remove('active-panel');
  playerProfilePanel.classList.add('hidden');
  playerProfilePanel.style.cssText = '';
  playerProfileActive = false;
  document.body.classList.remove('mode-expanded');
  history.pushState({}, '', '/');

  switchCategory(cat);
  showRankingScreen(course);
}

function switchProfileCategory(cat) {
  currentProfileCategory = cat;
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('selected', t.dataset.cat === cat));
  renderPlayerProfileRecords();
}

function setProfileSortMode(mode) {
  currentProfileSortMode = mode;
  document.querySelectorAll('.sort-toggle-option').forEach(el => el.classList.toggle('selected', el.dataset.sort === mode));
  renderPlayerProfileRecords();
}

function openPlayerProfile(name, originEl, pushState = true) {
  if (leaderboardActive) {
    leaderboardPanel.classList.remove('active-panel');
    leaderboardPanel.classList.add('hidden');
    leaderboardPanel.style.cssText = '';
    leaderboardActive = false;
  }

  currentProfileName = name;
  currentProfileCategory = 'General';
  currentProfileSortMode = 'course';
  const channelUrl = globalPlayerChannelMap[name];
  if (channelUrl) {
    ppNameEl.innerHTML = `<a href="${channelUrl.replace(/"/g, '&quot;')}" target="_blank" rel="noopener" class="name-link">${name}</a>`;
  } else {
    ppNameEl.innerText = name;
  }
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('selected', t.dataset.cat === 'General'));
  document.querySelectorAll('.sort-toggle-option').forEach(el => el.classList.toggle('selected', el.dataset.sort === 'course'));

  playerProfilePanel.classList.remove('hidden');
  playerProfilePanel.style.position = 'fixed';
  playerProfilePanel.style.margin = '0';

  if (originEl) {
    const rect = originEl.getBoundingClientRect();
    cardRects.set('player-profile-panel', rect);
    playerProfilePanel.style.top = rect.top + 'px';
    playerProfilePanel.style.left = rect.left + 'px';
    playerProfilePanel.style.width = rect.width + 'px';
    playerProfilePanel.style.height = rect.height + 'px';
    playerProfilePanel.style.opacity = '1';
  } else {
    cardRects.delete('player-profile-panel');
    playerProfilePanel.style.top = '50%';
    playerProfilePanel.style.left = '50%';
    playerProfilePanel.style.width = 'min(700px, 92vw)';
    playerProfilePanel.style.height = 'min(80vh, 750px)';
    playerProfilePanel.style.transform = 'translate(-50%, -50%)';
    playerProfilePanel.style.opacity = '0';
  }

  document.body.classList.add('mode-expanded');
  playerProfileActive = true;

  renderPlayerProfileRecords();

  requestAnimationFrame(() => {
    setTimeout(() => {
      playerProfilePanel.classList.add('active-panel');
      playerProfilePanel.style.top = '50%';
      playerProfilePanel.style.left = '50%';
      playerProfilePanel.style.width = 'min(700px, 92vw)';
      playerProfilePanel.style.height = 'min(80vh, 750px)';
      playerProfilePanel.style.transform = 'translate(-50%, -50%)';
      playerProfilePanel.style.opacity = '1';
    }, 10);
  });

  if (pushState) {
    history.pushState({ player: name }, '', '/player/' + encodeURIComponent(name));
  }
}

function closePlayerProfile(skipHistory) {
  const rect = cardRects.get('player-profile-panel');
  playerProfilePanel.classList.remove('active-panel');
  document.body.classList.remove('mode-expanded');

  if (rect) {
    playerProfilePanel.style.top = rect.top + 'px';
    playerProfilePanel.style.left = rect.left + 'px';
    playerProfilePanel.style.width = rect.width + 'px';
    playerProfilePanel.style.height = rect.height + 'px';
    playerProfilePanel.style.transform = '';
  } else {
    playerProfilePanel.style.opacity = '0';
  }

  setTimeout(() => {
    playerProfilePanel.style = '';
    playerProfilePanel.classList.add('hidden');
    playerProfileActive = false;
  }, 600);

  if (!skipHistory) {
    history.pushState({}, '', '/');
  }
}

function checkInitialPlayerRoute() {
  const match = window.location.pathname.match(/^\/player\/([^\/]+)\/?$/);
  if (match) {
    openPlayerProfile(decodeURIComponent(match[1]), null, false);
  }
}

window.addEventListener('popstate', () => {
  const match = window.location.pathname.match(/^\/player\/([^\/]+)\/?$/);
  if (match) {
    const name = decodeURIComponent(match[1]);
    if (!(playerProfileActive && currentProfileName === name)) {
      openPlayerProfile(name, null, false);
    }
  } else if (playerProfileActive) {
    closePlayerProfile(true);
  }
});

// ===== カップ生成 =====
rawCsvData.forEach((course, i) => {
  if (i % COURSES_PER_CUP === 0) {
    const cupIdx = i / COURSES_PER_CUP;
    const card = document.createElement('div');
    card.className = 'cup-card';
    card.id = `card-${i}`;
    card.onclick = () => { if (!card.classList.contains('active')) expandCard(card); };
    
    const grid = document.createElement('div');
    grid.className = 'course-grid';
    rawCsvData.slice(i, i + COURSES_PER_CUP).forEach(c => {
      const w = document.createElement('div');
      w.className = 'course-img-wrapper';
      w.onclick = (e) => { if (card.classList.contains('active')) { e.stopPropagation(); showRankingScreen(c); } };
      w.innerHTML = `<img src="${c.file}.webp" loading="lazy" decoding="async" onerror="this.style.display='none'">`;
      grid.appendChild(w);
    });
    
    const icon = document.createElement('div');
    icon.className = 'cup-icon-wrapper';
    icon.innerHTML = `<img src="${ICON_BASE_PATH}${cupIdx + 9}.webp" loading="lazy" decoding="async">`;
    card.append(grid, icon);
    container.appendChild(card);
  }
});

function expandCard(card) {
  const rect = card.getBoundingClientRect();
  cardRects.set(card.id, rect);
  
  placeholderEl = document.createElement('div');
  placeholderEl.className = 'cup-card-placeholder';
  placeholderEl.style.width = rect.width + 'px'; placeholderEl.style.height = rect.height + 'px';
  placeholderEl.onclick = resetCard;
  
  card.parentNode.insertBefore(placeholderEl, card);
  
  card.style.position = 'fixed'; card.style.top = rect.top + 'px'; card.style.left = rect.left + 'px';
  card.style.width = rect.width + 'px'; card.style.height = rect.height + 'px'; card.style.margin = '0';
  
  document.body.classList.add('mode-expanded');
  
  setTimeout(() => {
    card.classList.add('active');
    card.style.top = '50%'; card.style.left = '50%';
    card.style.width = `${rect.width * SCALE_FACTOR + SIDEBAR_WIDTH + 50}px`; 
    card.style.height = `${rect.height * SCALE_FACTOR + 25}px`;
    card.style.transform = 'translate(-50%, -50%)';
    activeCard = card;
  }, 10);
}

function resetCard() {
  if (!activeCard) return;
  const c = activeCard;
  const r = cardRects.get(c.id);
  c.classList.remove('active');
  document.body.classList.remove('mode-expanded');
  c.style.top = r.top + 'px'; c.style.left = r.left + 'px'; c.style.width = r.width + 'px'; c.style.height = r.height + 'px'; c.style.transform = '';
  
  setTimeout(() => {
    c.style = '';
    if (placeholderEl) { placeholderEl.remove(); placeholderEl = null; }
    activeCard = null;
  }, 600);
}

function showRankingScreen(c) {
  currentSelectedCourse = c;
  
  currentTire = 'without';
  isGlitch = false;
  isReadMoreExpanded = false; 
  updateToggleUI();

  document.body.classList.remove('mode-expanded');

  cupScreen.classList.add('hidden');
  rankingScreen.classList.remove('hidden');
  document.getElementById('ranking-course-title').innerText = c.name;

  const glitchBtn = document.getElementById('glitch-btn');
  if (GLITCH_COURSES.includes(c.name)) {
    glitchBtn.classList.remove('hidden');
  } else {
    glitchBtn.classList.add('hidden');
  }

  renderRankingList();
  window.scrollTo(0,0);
}

function goBackToCups() { 
  rankingScreen.classList.add('hidden'); 
  cupScreen.classList.remove('hidden'); 
  currentSelectedCourse = null;

  if (activeCard) {
    document.body.classList.add('mode-expanded');
  }
}

function toggleMode() {
  currentTire = (currentTire === 'without') ? 'dekatire' : 'without';
  updateToggleUI();
  renderRankingList();
}

function toggleGlitchMode() {
  isGlitch = !isGlitch;
  updateToggleUI();
  renderRankingList();
}

function toggleReadMore() {
  isReadMoreExpanded = true;
  renderRankingList();
}

function updateToggleUI() {
  const optWithout = document.getElementById('opt-without');
  const optDekatire = document.getElementById('opt-dekatire');
  const btnGlitch = document.getElementById('glitch-btn');

  optWithout.classList.remove('selected');
  optDekatire.classList.remove('selected');
  btnGlitch.classList.remove('active');
  
  if (currentTire === 'without') optWithout.classList.add('selected');
  else optDekatire.classList.add('selected');
  
  if (isGlitch) btnGlitch.classList.add('active');
}

function renderRankingList() {
  rankingListEl.innerHTML = '';
  
  let key = currentSelectedCourse.file.substring(4);
  if (isGlitch) {
    key += "_G";
  }

  let data = [];
  if (globalRankingData[key]) {
    data = globalRankingData[key][currentTire] || [];
  }
  data = data.filter(d => countryMatchesFilter(d.country));
  
  const displayCount = isReadMoreExpanded ? data.length : 8;
  
  for (let i = 0; i < displayCount; i++) {
    const d = data[i] || (i < 8 ? { rank: i+1, name: "---", time: "--:--", video: "-", channel: "-", country: "-" } : null);
    if (!d) continue;

    const row = document.createElement('div');
    row.className = `rank-row ${d.rank===1 ? 'rank-1st' : ''} animate-slide-in`;
    row.style.animationDelay = `${(i+1)*0.04}s`;
    
    const iconSrc = getVideoIcon(d.video);
    const hasVid = (d.video !== '-' && d.video !== '' && iconSrc !== 'Novideo.webp');
    const safeUrl = d.video.replace(/'/g, "\\'");
    
    let flagHtml = '';
    if (d.country && d.country !== '-') {
      const countryCode = d.country.toLowerCase();
      if (countryCode === 'scotland') {
        flagHtml = `<img src="Scotland.webp" onerror="this.style.visibility='hidden'">`;
      } else {
        flagHtml = `<img src="${FLAG_BASE_URL}${countryCode}.svg" onerror="this.style.visibility='hidden'">`;
      }
    }

    const safeName = d.name.replace(/'/g, "\\'");
    let nameHtml = d.name;
    if (d.name !== '---') {
      nameHtml = `<a href="/player/${encodeURIComponent(d.name)}" class="name-link" onclick="event.preventDefault();openPlayerProfile('${safeName}', this)">${d.name}</a>`;
    }

    const isModalTarget = (iconSrc === 'Youtube.webp' || iconSrc === 'Discord.webp' || iconSrc === 'Filenow.webp');
    const timeHtml = hasVid 
      ? `<a href="${d.video}" target="_blank" class="time-link">${d.time}</a>`
      : d.time;

    let rankContent = '';
    if (d.rank <= 8) {
        rankContent = `<img src="${RANK_IMG_BASE}${d.rank}${RANK_EXT}" onerror="this.style.display='none';this.parentElement.innerText='${d.rank}'">`;
    } else {
        rankContent = `<span style="font-size: 1.5rem; font-weight: bold; font-family: 'Arial', sans-serif;">${d.rank}</span>`;
    }

    let iconHtml = `<div class="no-link"><img src="Novideo.webp"></div>`;
    if (hasVid) {
      if (isModalTarget) {
        iconHtml = `<div onclick="openVideoModal('${safeUrl}')" style="cursor:pointer"><img src="${iconSrc}"></div>`;
      } else {
        iconHtml = `<a href="${d.video}" target="_blank"><img src="${iconSrc}"></a>`;
      }
    }

    row.innerHTML = `
      <div class="section col-rank">${rankContent}</div>
      <div class="section col-name">${nameHtml}</div>
      <div class="section col-time">${timeHtml}</div>
      <div class="section col-icon">${iconHtml}</div>
      <div class="section col-flag">${flagHtml}</div>
    `;
    rankingListEl.appendChild(row);
  }

  if (!isReadMoreExpanded && data.length > 8) {
    const btn = document.createElement('div');
    btn.className = 'read-more-btn animate-slide-in';
    btn.innerText = '▼ Load more ▼';
    btn.onclick = toggleReadMore;
    rankingListEl.appendChild(btn);
  }
}

function getVideoIcon(url) {
  if (!url || url==='-') return 'Novideo.webp';
  const l = url.toLowerCase();
  if (l.includes('youtube') || l.includes('youtu.be') || l.includes('archive')) return 'Youtube.webp';
  if (l.includes('twitter') || l.includes('x.com')) return 'X.webp';
  if (l.includes('d.kuku.lu')) return 'Filenow.webp';
  if (l.includes('discord')) return 'Discord.webp';
  return 'Novideo.webp';
}

function openVideoModal(url) {
  youtubeFrame.style.display = 'none'; youtubeFrame.src = "";
  modalImage.style.display = 'none'; modalImage.src = "";
  modalVideo.style.display = 'none'; modalVideo.src = "";

  if (url.toLowerCase().includes('archive')) {
    modalVideo.src = url;
    modalVideo.style.display = 'block';
    videoModal.classList.add('visible');
    return;
  }

  let vid = null;
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') {
      vid = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube')) {
      if (u.searchParams.get('v')) {
        vid = u.searchParams.get('v');
      } else {
        const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);
        if (shortsMatch) vid = shortsMatch[1];
      }
    }
  } catch(e){}
  
  if (vid) { 
    youtubeFrame.src = `https://www.youtube.com/embed/${vid}?autoplay=1`; 
    youtubeFrame.style.display = 'block';
    videoModal.classList.add('visible'); 
    return;
  }

  const isVideo = url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i);
  if (isVideo) {
    modalVideo.src = url;
    modalVideo.style.display = 'block';
    videoModal.classList.add('visible');
    return;
  }

  const isImage = url.includes('cdn.discordapp.com') || url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i);
  if (isImage) {
    modalImage.src = url;
    modalImage.style.display = 'block';
    videoModal.classList.add('visible');
    return;
  }

  window.open(url, '_blank');
}

function closeVideoModal() { 
  videoModal.classList.remove('visible'); 
  setTimeout(() => { 
    youtubeFrame.src = ""; 
    modalImage.src = "";
    modalVideo.pause(); 
    modalVideo.src = "";
  }, 300); 
}

// ===== window 公開（Step 4a で addEventListener 化するまでの暫定） =====
// UI 関数（HTML の onclick 属性から呼ばれる）
window.openLeaderboard = openLeaderboard;
window.closeLeaderboard = closeLeaderboard;
window.handleGlobalClose = handleGlobalClose;
window.openPlayerProfile = openPlayerProfile;
window.closePlayerProfile = closePlayerProfile;
window.openCountryFilterMenu = openCountryFilterMenu;
window.closeCountryFilterMenu = closeCountryFilterMenu;
window.showRegionList = showRegionList;
window.showCountryList = showCountryList;
window.switchCategory = switchCategory;
window.switchProfileCategory = switchProfileCategory;
window.setProfileSortMode = setProfileSortMode;
window.goBackToCups = goBackToCups;
window.toggleMode = toggleMode;
window.toggleGlitchMode = toggleGlitchMode;
window.toggleReadMore = toggleReadMore;
window.openVideoModal = openVideoModal;
window.closeVideoModal = closeVideoModal;
window.openCategoryMenu = openCategoryMenu;
window.closeCategoryMenu = closeCategoryMenu;
window.openProfileCategoryMenu = openProfileCategoryMenu;
window.closeProfileCategoryMenu = closeProfileCategoryMenu;

// loader.js から参照される状態・関数
window.allCategoryData = allCategoryData;
window.playerLeaderboardData = playerLeaderboardData;
window.globalPlayerChannelMap = globalPlayerChannelMap;
window.globalPlayerCountryMap = globalPlayerCountryMap;
window.switchCategory = switchCategory;
window.checkInitialPlayerRoute = checkInitialPlayerRoute;

// ===== 初期化 =====
preloadStaticIcons();
startLoadingProcess();

// js/features/cupCards.js
import { state } from '../state.js';
import { RAW_CSV_DATA } from '../data/courses.js';
import { COURSES_PER_CUP, ICON_BASE_PATH, SCALE_FACTOR, SIDEBAR_WIDTH } from '../config.js';
import { getTrackImageSrc, getTrackThumbSrc } from '../utils/dom.js';
import { showRankingScreen } from './ranking.js';

// ===== 画像の読み込み =====
// カード内の <img> は最初は src を持たず、data-src(小サイズ) / data-full(展開用) だけを持つ。
//  1. ローディング中 : 画面内に見えているカードの画像だけ読み込み、デコードまで待つ
//                      (ローディング画面が消えた瞬間に表示済みになる)
//  2. ローディング後 : 残りのカードの画像を読み込む
//  3. カード展開時   : 展開用の画像に差し替える (ホバー/タッチ開始時に先読み)

const IMAGE_TIMEOUT_MS = 5000; // 画像1枚あたりの待ち上限 (超えたら待たずに先へ進む)

function whenReady(img) {
  // decode() は取得+デコードの完了まで待てる。非対応環境では load イベントで代用。
  if (typeof img.decode === 'function') return img.decode();
  return new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
}

// 絶対にreject しない。完了・失敗・タイムアウトのいずれかで resolve する。
export function loadCupImage(img) {
  if (img.dataset.state) return Promise.resolve();   // 開始済み
  img.dataset.state = 'loading';

  const tryLoad = async (src) => {
    img.src = src;
    await whenReady(img);
  };

  const job = (async () => {
    try {
      await tryLoad(img.dataset.src);
    } catch {
      // 小サイズ画像が無い場合は展開用の画像で代用する
      if (img.dataset.full && img.dataset.full !== img.dataset.src) {
        try { await tryLoad(img.dataset.full); return; } catch { /* 下で非表示 */ }
      }
      img.style.display = 'none';
    }
  })();

  const timeout = new Promise((resolve) => setTimeout(resolve, IMAGE_TIMEOUT_MS));
  return Promise.race([job, timeout]).then(() => { img.dataset.state = 'done'; });
}

// 初期表示(スクロールなし)で見えているカードの画像
export function getInitialCupImages() {
  const limit = window.innerHeight + 100;
  const imgs = [];
  document.querySelectorAll('#cupsContainer .cup-card').forEach((card) => {
    if (card.getBoundingClientRect().top < limit) {
      imgs.push(...card.querySelectorAll('img[data-src]'));
    }
  });
  return imgs;
}

// ローディング後に、まだ読み込んでいない画像をすべて読み込む
export function loadRemainingCupImages() {
  document.querySelectorAll('#cupsContainer img[data-src]').forEach((img) => {
    if (!img.dataset.state) loadCupImage(img);
  });
}

// カード内の画像を展開用サイズに差し替える (読み込み+デコード完了後に差し替えるのでちらつかない)
function upgradeCardImages(card) {
  card.querySelectorAll('img[data-full]').forEach((img) => {
    if (img.dataset.upgraded) return;
    img.dataset.upgraded = '1';
    const big = new Image();
    big.src = img.dataset.full;
    whenReady(big).then(() => { img.src = big.src; }).catch(() => {});
  });
}

export function expandCard(card) {
  upgradeCardImages(card);
  const rect = card.getBoundingClientRect();
  state.cardRects.set(card.id, rect);
  
  state.placeholderEl = document.createElement('div');
  state.placeholderEl.className = 'cup-card-placeholder';
  state.placeholderEl.style.width = rect.width + 'px';
  state.placeholderEl.style.height = rect.height + 'px';
  state.placeholderEl.onclick = resetCard;
  
  card.parentNode.insertBefore(state.placeholderEl, card);
  card.style.cssText = `position:fixed; top:${rect.top}px; left:${rect.left}px; width:${rect.width}px; height:${rect.height}px; margin:0;`;
  document.body.classList.add('mode-expanded');
  
  setTimeout(() => {
    card.classList.add('active');
    card.style.cssText = `position:fixed; top:50%; left:50%; width:${rect.width * SCALE_FACTOR + SIDEBAR_WIDTH + 50}px; height:${rect.height * SCALE_FACTOR + 25}px; transform:translate(-50%, -50%); margin:0;`;
    state.activeCard = card;
  }, 10);
}

export function resetCard() {
  if (!state.activeCard) return;
  const c = state.activeCard;
  const r = state.cardRects.get(c.id);
  c.classList.remove('active');
  document.body.classList.remove('mode-expanded');
  c.style.cssText = `position:fixed; top:${r.top}px; left:${r.left}px; width:${r.width}px; height:${r.height}px;`;
  
  setTimeout(() => {
    c.style.cssText = '';
    if (state.placeholderEl) { state.placeholderEl.remove(); state.placeholderEl = null; }
    state.activeCard = null;
  }, 600);
}

export function initCupCards() {
  const container = document.getElementById('cupsContainer');
  RAW_CSV_DATA.forEach((course, i) => {
    if (i % COURSES_PER_CUP === 0) {
      const cupIdx = i / COURSES_PER_CUP;
      const card = document.createElement('div');
      card.className = 'cup-card';
      card.id = `card-${i}`;
      card.onclick = () => { if (!card.classList.contains('active')) expandCard(card); };
      
      const grid = document.createElement('div');
      grid.className = 'course-grid';
      RAW_CSV_DATA.slice(i, i + COURSES_PER_CUP).forEach(c => {
        const w = document.createElement('div');
        w.className = 'course-img-wrapper';
        w.onclick = (e) => { 
          if (card.classList.contains('active')) { 
            e.stopPropagation(); 
            showRankingScreen(c); 
          } 
        };
        const img = document.createElement('img');
        img.decoding = 'async';
        img.alt = '';
        img.dataset.src = getTrackThumbSrc(c.file);
        img.dataset.full = getTrackImageSrc(c.file);
        w.appendChild(img);
        grid.appendChild(w);
      });
      
      const icon = document.createElement('div');
      icon.className = 'cup-icon-wrapper';
      const iconImg = document.createElement('img');
      iconImg.decoding = 'async';
      iconImg.alt = '';
      iconImg.dataset.src = `${ICON_BASE_PATH}${cupIdx + 9}.webp`;
      icon.appendChild(iconImg);
      card.append(grid, icon);

      // マウスを乗せた/触れた時点で展開用画像を先読みする
      const prefetch = () => upgradeCardImages(card);
      card.addEventListener('pointerenter', prefetch, { once: true });
      card.addEventListener('touchstart', prefetch, { once: true, passive: true });
      container.appendChild(card);
    }
  });
}

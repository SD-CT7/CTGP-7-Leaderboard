import { state } from '../state.js';
import { RAW_CSV_DATA, COURSES_PER_CUP, ICON_BASE_PATH, SCALE_FACTOR, SIDEBAR_WIDTH } from '../config.js';
import { showRankingScreen } from './ranking.js';

export function expandCard(card) {
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
}

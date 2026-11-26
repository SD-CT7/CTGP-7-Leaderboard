// カテゴリ選択オーバーレイ(ランキング・プレイヤープロフィール・プレイヤーランキングで共通)
let onSelect = null;

const getOverlay = () => document.getElementById('category-overlay');

function close() {
  getOverlay().classList.remove('visible');
  onSelect = null;
}

// current: 現在のカテゴリ(ハイライト用) / callback: 選択されたカテゴリ名を受け取る関数
export function openCategoryPicker(current, callback) {
  onSelect = callback;
  const overlay = getOverlay();
  overlay.querySelectorAll('.mobile-category-item[data-cat]').forEach(item => {
    item.classList.toggle('selected', item.dataset.cat === current);
  });
  overlay.classList.add('visible');
}

export function initCategoryPicker() {
  const overlay = getOverlay();
  overlay.addEventListener('click', close);
  overlay.querySelector('.mobile-category-list').addEventListener('click', (e) => {
    e.stopPropagation();
    const item = e.target.closest('.mobile-category-item[data-cat]');
    if (!item) return;
    const cb = onSelect;
    close();
    if (cb) cb(item.dataset.cat);
  });
}

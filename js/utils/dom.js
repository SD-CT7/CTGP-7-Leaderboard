// js/utils/dom.js
export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * ランク画像のパスを生成する (例: 1 -> img/rank/1st.webp)
 */
export function getRankImageSrc(rank) {
  const suffixes = { 1: 'st', 2: 'nd', 3: 'rd', 4: 'th', 5: 'th', 6: 'th', 7: 'th', 8: 'th' };
  return `img/rank/${rank}${suffixes[rank] || 'th'}.webp`;
}

// カテゴリ名 → state.allCategoryData のキー
// 200cc / Shroomless は Default のデータを共用している
export function getCategoryDataKey(cat) {
  return (cat === '200cc' || cat === 'Shroomless') ? 'Default' : cat;
}

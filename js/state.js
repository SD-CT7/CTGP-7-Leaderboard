export const state = {
  allCategoryData: {},
  globalRankingData: {},
  currentTire: 'without',
  isGlitch: false,
  isReadMoreExpanded: false,
  activeCard: null,
  currentSelectedCourse: null,
  placeholderEl: null,
  cardRects: new Map(),
  currentCategory: 'General',
  leaderboardCategory: 'General',
  globalPlayerChannelMap: {},
  globalPlayerCountryMap: {},
  leaderboardActive: false,
  playerProfileActive: false,
  currentProfileName: null,
  currentProfileCategory: 'General',
  currentProfileSortMode: 'course',
  countryFilter: { type: 'all', value: null }
};

// 後方互換性: loader.js 等が window オブジェクトを参照している場合のために透過的に接続
Object.defineProperty(window, 'allCategoryData', { get: () => state.allCategoryData, set: v => state.allCategoryData = v });
Object.defineProperty(window, 'globalPlayerChannelMap', { get: () => state.globalPlayerChannelMap, set: v => state.globalPlayerChannelMap = v });
Object.defineProperty(window, 'globalPlayerCountryMap', { get: () => state.globalPlayerCountryMap, set: v => state.globalPlayerCountryMap = v });

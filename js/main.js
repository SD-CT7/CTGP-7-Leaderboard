// ===== 追加: import 群 =====
import {
  RANK_IMG_BASE, RANK_EXT,
  SUPABASE_URL, SUPABASE_KEY,
  CSV_URLS, PLAYER_LEADERBOARD_CSV_URL,
  STATIC_ICONS,
  LOCAL_CSV_PATH, COURSES_PER_CUP, ICON_BASE_PATH,
  SCALE_FACTOR, SIDEBAR_WIDTH, FLAG_BASE_URL,
} from './config.js';

import { RAW_CSV_DATA as rawCsvData, GLITCH_COURSES } from './data/courses.js';
import { REGION_DATA, SELECTABLE_REGIONS, COUNTRY_TO_REGION } from './data/regions.js';
import { FALLBACK_PLAYER_DATA } from './data/playerFallback.js';

// ===== 以下、既存の <script> の中身（削除済みの定数定義を除く） =====

// ★ 元コードの先頭にあった以下は config.js へ移動済みなので削除:
// const RANK_IMG_BASE = ...
// const RANK_EXT = ...
// const STATIC_ICONS = [...]
// for (let i = 1; i <= 8; i++) { ... }
// const SUPABASE_URL = ...
// const SUPABASE_KEY = ...
// const CSV_URLS = {...}
// const PLAYER_LEADERBOARD_CSV_URL = ...
// const FALLBACK_PLAYER_DATA = [...]
// const LOCAL_CSV_PATH = ...
// const COURSES_PER_CUP = ...
// const ICON_BASE_PATH = ...
// const SCALE_FACTOR = ...
// const SIDEBAR_WIDTH = ...
// const FLAG_BASE_URL = ...
// const REGION_DATA = {...}
// const SELECTABLE_REGIONS = [...]
// const COUNTRY_TO_REGION = {...}
// const GLITCH_COURSES = [...]
// const rawCsvData = [...]

// ★ 残すもの（状態変数・関数・処理）:
let allCategoryData = {};
let currentSheetUrl = CSV_URLS.General;
let loadedAssets = 0;
const totalImages = STATIC_ICONS.length;
const totalCsvs = Object.keys(CSV_URLS).length + 1 + 1;
const totalAssets = totalImages + totalCsvs;

let globalRankingData = {};
let currentTire = 'without';
let isGlitch = false;
let isReadMoreExpanded = false;
let activeCard = null, currentSelectedCourse = null, placeholderEl = null;
let cardRects = new Map();

// let playerLeaderboardData = FALLBACK_PLAYER_DATA;  ← ここは残す（再代入あり）
let playerLeaderboardData = FALLBACK_PLAYER_DATA;

let globalPlayerChannelMap = {};
let globalPlayerCountryMap = {};
let leaderboardActive = false;
let playerProfileActive = false;
let currentProfileName = null;
let currentProfileCategory = 'General';
let currentProfileSortMode = 'course';
let countryFilter = { type: 'all', value: null };

// ★ 以下、既存の関数群をそのままコピー（updateProgress, startLoadingProcess, parseRankingCsv, ... すべて）

// ===== 最後: 初期化呼び出し =====
startLoadingProcess();

export const SUPABASE_URL = 'https://fpbwgncudjekqwplluct.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_CxryfeGj45IL6opyJJlEAg_s985qwS9';

export const CSV_URLS = {
  Default: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=2103674373&single=true&output=csv",
  Flap: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=1016759313&single=true&output=csv",
  Mission: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=1676868794&single=true&output=csv"
};

export const PLAYER_LEADERBOARD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vScYBDDVnDZcLrhBuS9Kg1fq60UTv3YDKeNBtwd0gepQ7Tz8QRg24IRmeteUWcrM7EiXEZwXeyEUFql/pub?gid=1119970158&single=true&output=csv";

export const RANK_IMG_BASE = 'img/rank/';
export const ICON_BASE_PATH = 'img/cupImage/';

// タイヤ画像のパス（トグルボタンなどで使用）
export const TIRE_NORMAL = 'img/kart/tire/normal.webp';
export const TIRE_REDMONSTER = 'img/kart/tire/redmonster.webp';

// 事前読み込み対象の静的アイコン一覧
export const STATIC_ICONS = [
  'img/earth.webp',
  'img/person.webp',
  'img/favicon/youtube.webp',
  'img/favicon/discord.webp',
  'img/favicon/x.webp',
  'img/favicon/filenow.webp',
  'img/favicon/novideo.webp',
  'img/favicon/excel.webp',
  'img/category/general.webp',
  'img/category/200cc.webp',
  'img/category/shroomless.webp',
  'img/category/mission.webp',
  'img/category/flap.webp',
  TIRE_NORMAL,
  TIRE_REDMONSTER
];

for (let i = 1; i <= 8; i++) {
  STATIC_ICONS.push(`${RANK_IMG_BASE}${i}${RANK_EXT}`);
}

// その他の定数
export const LOCAL_CSV_PATH = "./times.csv";
export const COURSES_PER_CUP = 4;
export const SCALE_FACTOR = 2.5;
export const SIDEBAR_WIDTH = 120;
export const FLAG_BASE_URL = "https://www.mofa.go.jp/mofaj/kids/img/flags/";

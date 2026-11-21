export const RANK_IMG_BASE = "split_1_";
export const RANK_EXT = ".webp";

export const SUPABASE_URL = 'https://fpbwgncudjekqwplluct.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_CxryfeGj45IL6opyJJlEAg_s985qwS9';

export const CSV_URLS = {
  Default: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=2103674373&single=true&output=csv",
  Flap: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=1016759313&single=true&output=csv",
  Mission: "https://docs.google.com/spreadsheets/d/e/2PACX-1vTG7cpe3sUQsINvQrt8pjd3dIOdKethaou57zQy-rFlycWeJqgNdAkDWvA5-OCQNmZOur_iokr9dEFo/pub?gid=1676868794&single=true&output=csv"
};

export const PLAYER_LEADERBOARD_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vScYBDDVnDZcLrhBuS9Kg1fq60UTv3YDKeNBtwd0gepQ7Tz8QRg24IRmeteUWcrM7EiXEZwXeyEUFql/pub?gid=1119970158&single=true&output=csv";

// 静的アセットのリスト(ローディング進捗で使用)
export const STATIC_ICONS = [
  "Youtube.webp", "X.webp", "Filenow.webp", "Discord.webp", "Novideo.webp",
  "Scotland.webp", "without.webp", "dekatire.webp", "Mission.webp",
  "Flap.webp", "Shroomless.webp", "General.webp", "200cc.webp", "excel.webp"
];

for (let i = 1; i <= 8; i++) {
  STATIC_ICONS.push(`${RANK_IMG_BASE}${i}${RANK_EXT}`);
}

// その他の定数
export const LOCAL_CSV_PATH = "./times.csv";
export const COURSES_PER_CUP = 4;
export const ICON_BASE_PATH = "./Icons/";
export const SCALE_FACTOR = 2.5;
export const SIDEBAR_WIDTH = 120;
export const FLAG_BASE_URL = "https://www.mofa.go.jp/mofaj/kids/img/flags/";

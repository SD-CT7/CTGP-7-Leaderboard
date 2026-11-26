import { RAW_CSV_DATA } from '../data/courses.js';

// 1位10点 / 2位4点 / 3位3点 / 4位2点 / 5位1点 / 6位以降0点
export const POINTS_BY_RANK = [10, 4, 3, 2, 1];

export function pointsForRank(rank) {
  return POINTS_BY_RANK[rank - 1] ?? 0;
}

// "1:23.456" や "59.123" をミリ秒に変換する。解釈できない値は null
export function timeToMs(str) {
  const m = /^\s*(?:(\d+):)?(\d+(?:\.\d+)?)\s*$/.exec(String(str ?? ''));
  if (!m) return null;
  const minutes = m[1] ? parseInt(m[1], 10) : 0;
  return Math.round((minutes * 60 + parseFloat(m[2])) * 1000);
}

// 1コース分の記録(without)に同点を考慮した順位 calcRank を付ける。
// 同タイムは同順位、次の順位は人数分飛ぶ (1st, 1st, 3rd)。
export function assignCompetitionRanks(entries) {
  const sorted = [...entries].sort((a, b) => {
    const ra = Number.isFinite(Number(a.rank)) ? Number(a.rank) : Infinity;
    const rb = Number.isFinite(Number(b.rank)) ? Number(b.rank) : Infinity;
    return ra === rb ? 0 : ra - rb;
  });

  let prevMs = null;
  let prevRank = 0;
  return sorted.map((e, i) => {
    const ms = timeToMs(e.time);
    const calcRank = (ms !== null && ms === prevMs) ? prevRank : i + 1;
    prevMs = ms;
    prevRank = calcRank;
    return { ...e, calcRank };
  });
}

// categoryData(= state.allCategoryData[key])から全コースの合計ポイントを計算する。
// 戻り値は順位付き・ポイント降順の [{ rank, name, points }]。0ポイントのプレイヤーは含めない。
export function calculatePlayerPoints(categoryData) {
  const totals = new Map();

  for (const course of RAW_CSV_DATA) {
    const track = categoryData?.[course.file.substring(4)];
    for (const e of assignCompetitionRanks(track?.without || [])) {
      if (!e.name || e.name === '-') continue;
      totals.set(e.name, (totals.get(e.name) || 0) + pointsForRank(e.calcRank));
    }
  }

  const list = [...totals]
    .filter(([, points]) => points > 0)
    .map(([name, points]) => ({ name, points }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // 合計ポイントが同じなら同順位 (1st, 1st, 3rd)
  let prevPoints = null;
  let prevRank = 0;
  list.forEach((p, i) => {
    p.rank = p.points === prevPoints ? prevRank : i + 1;
    prevPoints = p.points;
    prevRank = p.rank;
  });

  return list;
}

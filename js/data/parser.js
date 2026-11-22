// js/data/parser.js

// RFC 4180 準拠の簡易CSVパーサー。
// ダブルクォートで囲まれたセル内のカンマ・改行・"" (エスケープされた引用符) を正しく扱う。
// 単純な line.split(',') だと、カンマを含むURL(例: archive.org の googlevideo URL)が
// 列ズレを起こすため、必ずこちらを使うこと。
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let inQuotes = false;

  text = String(text).replace(/^\uFEFF/, '');

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
    } else {
      cell += ch;
    }
  }

  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

export function parseRankingCsv(csvText) {
  const rows = parseCsv(csvText);
  let currentTrackKey = null;
  const resultData = {};

  const normalizeTrackKey = (track) =>
  track
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

  const getCell = (val) => {
    if (!val) return '-';
    const s = val.trim();
    return s === '' ? '-' : s;
  };

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];

    if (cells.length < 2) continue;

    const track = cells[0].trim();
    let mode = 'without';

    if (track && track !== '-') {
      currentTrackKey = normalizeTrackKey(track);
    } else if (currentTrackKey) {
      mode = 'dekatire';
    } else {
      continue;
    }

    if (!resultData[currentTrackKey]) {
      resultData[currentTrackKey] = {
        without: [],
        dekatire: []
      };
    }

    for (let r = 0; r < 100; r++) {
      const idx = 1 + (r * 5);

      if (idx + 4 >= cells.length) break;

      const name = cells[idx] ? cells[idx].trim() : '-';

      if (name && name !== '-' && name !== '') {
        resultData[currentTrackKey][mode].push({
          rank: r + 1,
          name,
          time: getCell(cells[idx + 1]),
          video: getCell(cells[idx + 2]),
          channel: getCell(cells[idx + 3]),
          country: getCell(cells[idx + 4])
        });
      }
    }
  }

  return resultData;
}

export function parsePlayerLeaderboardCsv(csvText) {
  const rows = parseCsv(csvText);
  const result = [];
  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length < 13) continue;
    const name = cells[10] ? cells[10].trim() : '';
    const points = parseInt((cells[11] || '').trim(), 10);
    const rank = parseInt((cells[12] || '').trim(), 10);
    // 数値でない行(列ズレ・ゴミ行)は取り込まない
    if (name && Number.isFinite(points) && Number.isFinite(rank)) {
      result.push({ rank, name, points });
    }
  }
  return result;
}

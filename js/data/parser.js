// js/data/parser.js

export function parseRankingCsv(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
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

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');

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
  const lines = csvText.trim().split(/\r?\n/);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',');
    if (cells.length < 13) continue;
    const name = cells[10] ? cells[10].trim() : '';
    const points = cells[11] ? cells[11].trim() : '';
    const rank = cells[12] ? cells[12].trim() : '';
    if (name && points !== '' && rank !== '') {
      result.push({ rank: parseInt(rank, 10), name, points: parseInt(points, 10) });
    }
  }
  return result;
}

import { state } from '../state.js';
import { escapeAttr, getRankImageSrc } from '../utils/dom.js';
import { getVideoIcon, isModalVideoIcon, NO_VIDEO_ICON } from '../ui/videoModal.js';

export function getPlayerCourseRows(name, catKey) {
  let key = (catKey === '200cc' || catKey === 'Shroomless') ? 'Default' : catKey;
  const categoryData = state.allCategoryData[key] || {};
  return state.tracks.map(course => {
    const trackKey = course.file.substring(4);
    const trackData = categoryData[trackKey];
    const entry = trackData ? (trackData.without || []).find(e => e.name === name) : null;
    return { trackName: course.name, course, rank: entry ? entry.rank : null, time: entry ? entry.time : null, video: entry ? entry.video : null };
  });
}

export function renderPlayerProfileRecords() {
  let rows = getPlayerCourseRows(state.currentProfileName, state.currentProfileCategory);
  if (state.currentProfileSortMode === 'rank') {
    rows = [...rows].sort((a, b) => {
      if (a.rank === null && b.rank === null) return 0;
      if (a.rank === null) return 1;
      if (b.rank === null) return -1;
      return a.rank - b.rank;
    });
  }
  const listEl = document.getElementById('ppRecordList');
  listEl.innerHTML = '';
  rows.forEach((r, i) => {
    const hasRecord = r.rank !== null;
    const row = document.createElement('div');
    row.className = `record-row ${hasRecord && r.rank === 1 ? 'gold-rank' : ''} animate-slide-in`;
    row.style.animationDelay = `${Math.min(i + 1, 25) * 0.02}s`;
    let rankContent = hasRecord ? (r.rank <= 8 ? `<img src="${getRankImageSrc(r.rank)}" onerror="this.style.display='none';this.parentElement.innerText='${r.rank}'">` : `${r.rank}`) : '-';
    let iconHtml = `<img src="${NO_VIDEO_ICON}">`;
    let timeHtml = hasRecord ? r.time : '-';
    if (hasRecord && r.video && r.video !== '-') {
      const iconSrc = getVideoIcon(r.video);
      const isModalTarget = isModalVideoIcon(iconSrc);
      const safeHref = escapeAttr(String(r.video));
      timeHtml = `<a href="${safeHref}" target="_blank" rel="noopener" class="time-link">${r.time}</a>`;
      iconHtml = isModalTarget
        ? `<div class="video-icon" data-video-url="${safeHref}" style="cursor:pointer"><img src="${iconSrc}" onerror="this.src='${NO_VIDEO_ICON}'"></div>`
        : `<a href="${safeHref}" target="_blank" rel="noopener"><img src="${iconSrc}" onerror="this.src='img/favicon/novideo.webp'"></a>`;
    }
    row.innerHTML = `<div class="rr-rank">${rankContent}</div><div class="rr-track course-jump">${r.trackName}</div><div class="rr-time">${timeHtml}</div><div class="rr-icon">${iconHtml}</div>`;
    row.querySelector('.rr-track').addEventListener('click', () => jumpToCourseFromProfile(r.course));
    listEl.appendChild(row);
  });
}

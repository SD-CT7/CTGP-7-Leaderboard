import { RANK_EXT, RANK_IMG_BASE } from '../config.js';

export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const RANK_SUFFIX = {
  1: "st",
  2: "nd",
  3: "rd"
};

export function getRankImageSrc(rank) {
  rank = Number(rank);

  if (!Number.isInteger(rank) || rank < 1) {
    rank = 1;
  }

  const suffix = RANK_SUFFIX[rank] || "th";
  return `${RANK_IMG_BASE}${rank}${suffix}${RANK_EXT}`;
}

export function normalizeTrackFileName(file) {
  return String(file)
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, "_");
}

export function getTrackImageSrc(file) {
  return `img/trackImage/${normalizeTrackFileName(file)}.webp`;
}

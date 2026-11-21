export function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
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
    return "img/rank/1st.webp";
  }

  const suffix = RANK_SUFFIX[rank] || "th";
  return `img/rank/${rank}${suffix}.webp`;
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

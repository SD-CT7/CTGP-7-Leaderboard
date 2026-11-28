
// js/ui/videoModal.js

export const NO_VIDEO_ICON = 'img/favicon/novideo.webp';

export function getVideoIcon(url) {
  if (!url || url === '-') return NO_VIDEO_ICON;

  const l = url.toLowerCase();

  if (l.includes('youtube') || l.includes('youtu.be') || l.includes('archive')) {
    return 'img/favicon/youtube.webp';
  }

  if (l.includes('twitter') || l.includes('x.com') || l.includes('twimg')) {
    return 'img/favicon/x.webp';
  }

  if (l.includes('d.kuku.lu')) {
    return 'img/favicon/filenow.webp';
  }

  if (l.includes('discord')) {
    return 'img/favicon/discord.webp';
  }

  return 'NO_VIDEO_ICON';
}

// twimg(pbs.twimg.com / video.twimg.com)の直リンクはモーダルで再生する。
// x.com / twitter.com のツイートURLは従来どおり別タブで開く。
export function isTwimgUrl(url) {
  return typeof url === 'string' && url.toLowerCase().includes('twimg');
}

// url を渡すと twimg も判定できる
export function isModalVideoIcon(iconSrc, url) {
  return iconSrc.includes('youtube.webp') ||
         iconSrc.includes('discord.webp') ||
         iconSrc.includes('filenow.webp') ||
         isTwimgUrl(url);
}

export function openVideoModal(url) {
  const youtubeFrame = document.getElementById('youtube-frame');
  const modalImage = document.getElementById('modal-image');
  const modalVideo = document.getElementById('modal-video');
  const videoModal = document.getElementById('video-modal');

  // 既存の表示をリセット
  youtubeFrame.style.display = 'none';
  youtubeFrame.src = "";

  modalImage.style.display = 'none';
  modalImage.src = "";

  modalVideo.pause();
  modalVideo.style.display = 'none';
  modalVideo.src = "";

  // Archive動画
  if (url.toLowerCase().includes('archive')) {
    modalVideo.src = url;
    modalVideo.style.display = 'block';

    videoModal.classList.add('visible');
    return;
  }

  // X (Twitter) の直リンク
  if (isTwimgUrl(url)) {
    const isImage =
      /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) ||
      /[?&]format=(jpe?g|png|gif|webp)/i.test(url);

    if (isImage) {
      modalImage.src = url;
      modalImage.style.display = 'block';
    } else {
      // 動画を設定
      modalVideo.src = url;
      modalVideo.style.display = 'block';

      // Safari向け設定
      modalVideo.controls = true;
      modalVideo.playsInline = true;

      // 動画読み込みエラーを記録
      modalVideo.onerror = () => {
        console.error('[VideoModal] 動画読み込みエラー:', {
          error: modalVideo.error,
          networkState: modalVideo.networkState,
          readyState: modalVideo.readyState,
          src: modalVideo.currentSrc
        });
      };

      // 動画読み込み成功を記録
      modalVideo.onloadeddata = () => {
        console.log('[VideoModal] 動画読み込み成功');
      };

      // 動画を読み込む
      modalVideo.load();
    }

    videoModal.classList.add('visible');
    return;
  }

  // YouTube動画IDの取得
  let vid = null;

  try {
    const u = new URL(url);

    if (u.hostname === 'youtu.be') {
      vid = u.pathname.slice(1);
    } else if (u.hostname.includes('youtube')) {
      vid = u.searchParams.get('v');

      if (!vid) {
        const shortsMatch = u.pathname.match(/\/shorts\/([a-zA-Z0-9_-]+)/);

        if (shortsMatch) {
          vid = shortsMatch[1];
        }
      }
    }
  } catch (e) {}

  // YouTube
  if (vid) {
    youtubeFrame.src = `https://www.youtube.com/embed/${vid}?autoplay=1`;
    youtubeFrame.style.display = 'block';

    videoModal.classList.add('visible');
    return;
  }

  // MP4 / WebM / MOV / MKV
  if (url.match(/\.(mp4|webm|mov|mkv)(\?.*)?$/i)) {
    modalVideo.src = url;
    modalVideo.style.display = 'block';

    videoModal.classList.add('visible');
    return;
  }

  // Discord画像など
  if (
    url.includes('cdn.discordapp.com') ||
    url.match(/\.(jpeg|jpg|gif|png|webp)(\?.*)?$/i)
  ) {
    modalImage.src = url;
    modalImage.style.display = 'block';

    videoModal.classList.add('visible');
    return;
  }

  // その他のURLは別タブで開く
  window.open(url, '_blank');
}

export function closeVideoModal() {
  const videoModal = document.getElementById('video-modal');

  videoModal.classList.remove('visible');

  setTimeout(() => {
    document.getElementById('youtube-frame').src = "";
    document.getElementById('modal-image').src = "";

    const mv = document.getElementById('modal-video');

    mv.pause();
    mv.src = "";
  }, 300);
}

export function initVideoModalEvents() {
  const videoModal = document.getElementById('video-modal');

  videoModal.addEventListener('click', closeVideoModal);

  videoModal.querySelector('.modal-content').addEventListener('click', (e) => {
    e.stopPropagation();
  });

  videoModal.querySelector('.close-modal-btn').addEventListener('click', closeVideoModal);
}

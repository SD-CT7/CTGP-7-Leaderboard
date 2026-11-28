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

export function isTwimgUrl(url) {
  return typeof url === 'string' && url.toLowerCase().includes('twimg');
}

export function isModalVideoIcon(iconSrc, url) {
  return iconSrc.includes('youtube.webp') ||
         iconSrc.includes('discord.webp') ||
         iconSrc.includes('filenow.webp') ||
         isTwimgUrl(url);
}

// 診断表示を作成
function createVideoStatus(modalContent) {
  let status = document.getElementById('video-diagnostic');

  if (!status) {
    status = document.createElement('div');
    status.id = 'video-diagnostic';

    Object.assign(status.style, {
      position: 'absolute',
      top: '10px',
      left: '10px',
      right: '10px',
      zIndex: '100',
      padding: '10px',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#ffffff',
      fontSize: '13px',
      lineHeight: '1.6',
      borderRadius: '6px',
      pointerEvents: 'none',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere'
    });

    modalContent.appendChild(status);
  }

  status.style.display = 'block';
  return status;
}

function getVideoErrorMessage(error) {
  if (!error) return 'エラー情報なし';

  const messages = {
    1: 'MEDIA_ERR_ABORTED：読み込みが中断されました',
    2: 'MEDIA_ERR_NETWORK：ネットワークエラー',
    3: 'MEDIA_ERR_DECODE：動画のデコードに失敗',
    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED：動画形式またはURLに問題があります'
  };

  return messages[error.code] || `不明なエラー（コード ${error.code}）`;
}

export function openVideoModal(url) {
  const youtubeFrame = document.getElementById('youtube-frame');
  const modalImage = document.getElementById('modal-image');
  const modalVideo = document.getElementById('modal-video');
  const videoModal = document.getElementById('video-modal');
  const modalContent = videoModal.querySelector('.modal-content');

  const oldStatus = document.getElementById('video-diagnostic');
  if (oldStatus) oldStatus.style.display = 'none';

  youtubeFrame.style.display = 'none';
  youtubeFrame.src = '';

  modalImage.style.display = 'none';
  modalImage.src = '';

  modalVideo.pause();
  modalVideo.removeAttribute('src');
  modalVideo.style.display = 'none';
  modalVideo.removeAttribute('autoplay');

  // Archive動画
  if (url.toLowerCase().includes('archive')) {
    modalVideo.src = url;
    modalVideo.style.display = 'block';
    videoModal.classList.add('visible');
    return;
  }

  // X / Twitter直リンク
  if (isTwimgUrl(url)) {
    const isImage =
      /\.(jpe?g|png|gif|webp)(\?|$)/i.test(url) ||
      /[?&]format=(jpe?g|png|gif|webp)/i.test(url);

    if (isImage) {
      modalImage.src = url;
      modalImage.style.display = 'block';
    } else {
      const status = createVideoStatus(modalContent);

      // 自動再生を無効化
      modalVideo.autoplay = false;
      modalVideo.controls = true;
      modalVideo.playsInline = true;
      modalVideo.setAttribute('playsinline', '');
      modalVideo.preload = 'metadata';

      modalVideo.style.display = 'block';
      modalVideo.style.width = '100%';
      modalVideo.style.height = '100%';
      modalVideo.style.objectFit = 'contain';

      status.textContent =
        '【動画診断】\n' +
        'URL設定：完了\n' +
        '読み込み：開始待ち\n' +
        'エラー：なし';

      modalVideo.addEventListener('loadstart', () => {
        status.textContent =
          '【動画診断】\n' +
          'URL設定：完了\n' +
          '読み込み：開始しました\n' +
          'エラー：なし';
      });

      modalVideo.addEventListener('loadedmetadata', () => {
        status.textContent =
          '【動画診断】\n' +
          '動画情報：取得成功\n' +
          `動画サイズ：${modalVideo.videoWidth} × ${modalVideo.videoHeight}\n` +
          `長さ：${modalVideo.duration} 秒\n` +
          'エラー：なし';
      });

      modalVideo.addEventListener('loadeddata', () => {
        status.textContent =
          '【動画診断】\n' +
          '動画データ：読み込み成功\n' +
          `動画サイズ：${modalVideo.videoWidth} × ${modalVideo.videoHeight}\n` +
          '再生操作を試してください。\n' +
          'エラー：なし';
      });

      modalVideo.addEventListener('canplay', () => {
        status.textContent =
          '【動画診断】\n' +
          '再生準備：完了\n' +
          `動画サイズ：${modalVideo.videoWidth} × ${modalVideo.videoHeight}\n` +
          '再生ボタンを押してください。';
      });

      modalVideo.addEventListener('playing', () => {
        status.textContent =
          '【動画診断】\n' +
          '再生状態：再生中';
      });

      modalVideo.addEventListener('pause', () => {
        if (!modalVideo.ended) {
          status.textContent =
            '【動画診断】\n' +
            '再生状態：一時停止';
        }
      });

      modalVideo.addEventListener('error', () => {
        status.textContent =
          '【動画診断：エラー】\n' +
          getVideoErrorMessage(modalVideo.error) + '\n' +
          `networkState：${modalVideo.networkState}\n` +
          `readyState：${modalVideo.readyState}\n` +
          `URL：${modalVideo.currentSrc || url}`;
      });

      videoModal.classList.add('visible');

      // モーダルを表示してから読み込み
      modalVideo.src = url;
      modalVideo.load();
      return;
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
        if (shortsMatch) vid = shortsMatch[1];
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

  window.open(url, '_blank');
}

export function closeVideoModal() {
  const videoModal = document.getElementById('video-modal');

  videoModal.classList.remove('visible');

  setTimeout(() => {
    document.getElementById('youtube-frame').src = '';
    document.getElementById('modal-image').src = '';

    const mv = document.getElementById('modal-video');
    mv.pause();
    mv.removeAttribute('src');
    mv.load();

    const status = document.getElementById('video-diagnostic');
    if (status) status.style.display = 'none';
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

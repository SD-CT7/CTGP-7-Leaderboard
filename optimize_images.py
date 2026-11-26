#!/usr/bin/env python3
"""
コース画像の最適化スクリプト (リポジトリのルートに置いて実行)

  pip install pillow
  python3 optimize_images.py

やること:
  1. 初回のみ img/trackImage の元画像(1120x768)を img-original/trackImage にバックアップ
  2. img-original から  img/trackThumb/  (カード一覧用 小サイズ) を生成
  3. img-original から  img/trackImage/  (カード展開用 中サイズ) を上書き生成

何度でも再実行できます (常に img-original を元にするので画質は劣化しません)。
画質・サイズは環境変数で調整できます。
  THUMB_W=480 THUMB_Q=70 FULL_W=800 FULL_Q=75 python3 optimize_images.py
  (WEBP_METHOD=6 にすると少し小さくなりますが、かなり遅くなります)
"""
import glob
import os
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
FULL_DIR = os.path.join(ROOT, "img", "trackImage")
THUMB_DIR = os.path.join(ROOT, "img", "trackThumb")
SRC_DIR = os.path.join(ROOT, "img-original", "trackImage")

THUMB_W = int(os.environ.get("THUMB_W", 480))
THUMB_Q = int(os.environ.get("THUMB_Q", 70))
FULL_W = int(os.environ.get("FULL_W", 800))
FULL_Q = int(os.environ.get("FULL_Q", 75))
# 0(速い)〜6(遅いが小さい)。4で十分小さく、全体で数十秒程度。
METHOD = int(os.environ.get("WEBP_METHOD", 4))


def opaque(im: Image.Image) -> bool:
    """アルファが全面不透明なら True (RGBに落としてサイズ削減できる)"""
    if im.mode != "RGBA":
        return True
    return im.getchannel("A").getextrema()[0] == 255


def save(im: Image.Image, width: int, quality: int, dest: str) -> int:
    if im.width > width:
        h = round(width * im.height / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    if opaque(im):
        im = im.convert("RGB")
    im.save(dest, "WEBP", quality=quality, method=METHOD)
    return os.path.getsize(dest)


def main() -> int:
    if not os.path.isdir(SRC_DIR):
        if not os.path.isdir(FULL_DIR):
            print(f"見つかりません: {FULL_DIR}", file=sys.stderr)
            return 1
        shutil.copytree(FULL_DIR, SRC_DIR)
        print(f"元画像をバックアップ: {os.path.relpath(SRC_DIR, ROOT)}")

    os.makedirs(THUMB_DIR, exist_ok=True)
    files = sorted(glob.glob(os.path.join(SRC_DIR, "*.webp")))
    if not files:
        print("元画像がありません", file=sys.stderr)
        return 1

    before = after_full = after_thumb = 0
    for f in files:
        name = os.path.basename(f)
        before += os.path.getsize(f)
        with Image.open(f) as im:
            im.load()
            after_thumb += save(im, THUMB_W, THUMB_Q, os.path.join(THUMB_DIR, name))
            after_full += save(im, FULL_W, FULL_Q, os.path.join(FULL_DIR, name))

    mb = lambda b: f"{b / 1e6:.2f}MB"
    print(f"{len(files)}枚処理")
    print(f"元画像           : {mb(before)} (平均 {before // len(files) // 1000}KB)")
    print(f"trackThumb {THUMB_W}px q{THUMB_Q}: {mb(after_thumb)} (平均 {after_thumb // len(files) // 1000}KB)  ← 一覧表示で使用")
    print(f"trackImage {FULL_W}px q{FULL_Q}: {mb(after_full)} (平均 {after_full // len(files) // 1000}KB)  ← カード展開時に使用")
    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
コース画像の最適化スクリプト (リポジトリのルートに置いて実行)

  pip install pillow
  python3 optimize_images.py

■ 画像を追加・差し替えするとき
  1. 元画像(1120x768 推奨)を  img/trackImage/  にファイル名 「<番号>_<名前>.webp」 で置く
     (png / jpg でも可。変換後は <名前>.webp になり、元ファイルは img-original に移動)
  2. python3 optimize_images.py を実行 (変更があったものだけ処理します)
  3. git add -A して commit / push

  ・img/trackImage に置いた画像が FULL_W(既定800px)より大きい、または新規の名前なら
    「未変換の元画像」として自動で取り込みます。
  ・元画像を直接 img-original/trackImage/ に置いても構いません (常に元画像として扱います)。
  ・新しいコースは js/data/courses.js にも追加してください (最後に不足を警告します)。

■ 生成物
  img-original/trackImage/ : 元画像 (これを元に毎回変換するので画質は劣化しません)
  img/trackThumb/          : カード一覧用 (小)
  img/trackImage/          : カード展開用 (中)

■ 環境変数
  THUMB_W=480 THUMB_Q=70 FULL_W=800 FULL_Q=75   サイズ・画質 (変えると全件を作り直します)
  WEBP_METHOD=4                                  0(速い)〜6(遅いが小さい)
  FORCE=1                                        全件を強制的に作り直す
"""
import glob
import json
import os
import re
import shutil
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.abspath(__file__))
FULL_DIR = os.path.join(ROOT, "img", "trackImage")
THUMB_DIR = os.path.join(ROOT, "img", "trackThumb")
SRC_DIR = os.path.join(ROOT, "img-original", "trackImage")
SETTINGS_FILE = os.path.join(ROOT, "img-original", ".settings.json")
COURSES_JS = os.path.join(ROOT, "js", "data", "courses.js")

THUMB_W = int(os.environ.get("THUMB_W", 480))
THUMB_Q = int(os.environ.get("THUMB_Q", 70))
FULL_W = int(os.environ.get("FULL_W", 800))
FULL_Q = int(os.environ.get("FULL_Q", 75))
METHOD = int(os.environ.get("WEBP_METHOD", 4))
FORCE = os.environ.get("FORCE") == "1"

INPUT_EXTS = (".webp", ".png", ".jpg", ".jpeg")


def opaque(im: Image.Image) -> bool:
    """アルファが全面不透明なら True (RGBに落としてサイズ削減できる)"""
    if im.mode != "RGBA":
        return True
    return im.getchannel("A").getextrema()[0] == 255


def save(im: Image.Image, width: int, quality: int, dest: str) -> int:
    if im.width > width:
        h = round(width * im.height / im.width)
        im = im.resize((width, h), Image.LANCZOS)
    if not opaque(im):
        im = im.convert("RGBA")
    else:
        im = im.convert("RGB")
    im.save(dest, "WEBP", quality=quality, method=METHOD)
    return os.path.getsize(dest)


def width_of(path: str) -> int:
    with Image.open(path) as im:
        return im.width


def import_new_originals() -> set:
    """img/trackImage に置かれた未変換の画像を img-original に取り込む。取り込んだ名前を返す。"""
    imported = set()
    for path in sorted(glob.glob(os.path.join(FULL_DIR, "*"))):
        base, ext = os.path.splitext(os.path.basename(path))
        if ext.lower() not in INPUT_EXTS:
            continue
        dest = os.path.join(SRC_DIR, base + ext.lower())
        # 同名の webp が img-original にあれば「変換済みの出力」か「差し替えた元画像」のどちらか。
        # 800px(FULL_W)より大きければ未変換とみなす。webp以外(png/jpg)は常に新しい元画像。
        # 元画像は png/jpg の場合もあるので、どの拡張子でも「既知」とみなす
        known = any(os.path.exists(os.path.join(SRC_DIR, base + e)) for e in INPUT_EXTS)
        is_new_source = ext.lower() != ".webp" or not known or width_of(path) > FULL_W
        if not is_new_source:
            continue
        # png/jpg の元画像が既にある場合も上書き
        os.makedirs(SRC_DIR, exist_ok=True)
        if ext.lower() == ".webp":
            shutil.copy2(path, dest)          # 出力先(img/trackImage)は後で縮小版に上書きされる
        else:
            shutil.move(path, dest)           # png/jpg は出力に残さない
        # 同じ名前で別形式の古い元画像が残っていると、どちらを使うか曖昧になるので消す
        for other in INPUT_EXTS:
            stale_src = os.path.join(SRC_DIR, base + other)
            if other != ext.lower() and os.path.exists(stale_src):
                os.remove(stale_src)
        imported.add(base)
        print(f"  取り込み: {os.path.basename(path)}")
    return imported


def load_settings() -> dict:
    try:
        with open(SETTINGS_FILE, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def check_courses():
    """js/data/courses.js のコースに対して、画像の不足・未使用を警告する"""
    if not os.path.exists(COURSES_JS):
        return
    with open(COURSES_JS, encoding="utf-8") as f:
        names = set(m.lower() for m in re.findall(r'file:\s*"([^"]+)"', f.read()))
    have_full = {os.path.splitext(os.path.basename(p))[0].lower() for p in glob.glob(os.path.join(FULL_DIR, "*.webp"))}
    have_thumb = {os.path.splitext(os.path.basename(p))[0].lower() for p in glob.glob(os.path.join(THUMB_DIR, "*.webp"))}
    missing = sorted(n for n in names if n not in have_full or n not in have_thumb)
    orphan = sorted(n for n in (have_full | have_thumb) if n not in names)
    if missing:
        print("\n[警告] courses.js にあるが画像が足りないコース:")
        for n in missing:
            print(f"   - {n}  (full:{'有' if n in have_full else '無'} thumb:{'有' if n in have_thumb else '無'})")
    if orphan:
        print("\n[注意] 画像はあるが courses.js に無いもの (新コースなら courses.js に追加してください):")
        for n in orphan:
            print(f"   - {n}")
    if not missing and not orphan:
        print(f"\ncourses.js の {len(names)} コースと画像は一致しています。")


def main() -> int:
    os.makedirs(os.path.join(ROOT, "img-original"), exist_ok=True)
    os.makedirs(THUMB_DIR, exist_ok=True)
    os.makedirs(FULL_DIR, exist_ok=True)

    # 初回: 現在の img/trackImage を元画像としてバックアップ
    if not os.path.isdir(SRC_DIR):
        shutil.copytree(FULL_DIR, SRC_DIR)
        print(f"元画像をバックアップ: {os.path.relpath(SRC_DIR, ROOT)}")
        imported = set()
    else:
        print("新規・差し替えの確認...")
        imported = import_new_originals()
        if not imported:
            print("  なし")

    settings = {"thumb_w": THUMB_W, "thumb_q": THUMB_Q, "full_w": FULL_W, "full_q": FULL_Q}
    rebuild_all = FORCE or load_settings() != settings
    if rebuild_all and not FORCE and load_settings():
        print("サイズ/画質の設定が前回と違うため、全件を作り直します。")

    sources = {}
    for p in glob.glob(os.path.join(SRC_DIR, "*")):
        base, ext = os.path.splitext(os.path.basename(p))
        if ext.lower() in INPUT_EXTS:
            sources[base] = p

    if not sources:
        print("元画像がありません", file=sys.stderr)
        return 1

    done, skipped = [], 0
    for base, src in sorted(sources.items()):
        t_out = os.path.join(THUMB_DIR, base + ".webp")
        f_out = os.path.join(FULL_DIR, base + ".webp")
        stale = (
            not os.path.exists(t_out) or not os.path.exists(f_out)
            or os.path.getmtime(src) > os.path.getmtime(t_out)
        )
        if not (rebuild_all or base in imported or stale):
            skipped += 1
            continue
        with Image.open(src) as im:
            im.load()
            save(im, THUMB_W, THUMB_Q, t_out)
            save(im, FULL_W, FULL_Q, f_out)
        done.append(base)

    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(settings, f)

    if done:
        shown = ", ".join(done[:8]) + (f" ほか{len(done) - 8}件" if len(done) > 8 else "")
        print(f"\n変換 {len(done)}件: {shown}")
    else:
        print("\n変更なし (すべて最新です)")
    if skipped:
        print(f"スキップ {skipped}件 (変更なし)")

    t_total = sum(os.path.getsize(p) for p in glob.glob(os.path.join(THUMB_DIR, "*.webp")))
    f_total = sum(os.path.getsize(p) for p in glob.glob(os.path.join(FULL_DIR, "*.webp")))
    o_total = sum(os.path.getsize(p) for p in sources.values())
    n = len(sources)
    print(f"\n現在の合計 ({n}枚)")
    print(f"  元画像      : {o_total / 1e6:.2f}MB (平均 {o_total // n // 1000}KB)")
    print(f"  trackThumb  : {t_total / 1e6:.2f}MB (平均 {t_total // n // 1000}KB)  ← 一覧表示 ({THUMB_W}px q{THUMB_Q})")
    print(f"  trackImage  : {f_total / 1e6:.2f}MB (平均 {f_total // n // 1000}KB)  ← 展開表示 ({FULL_W}px q{FULL_Q})")

    check_courses()
    return 0


if __name__ == "__main__":
    sys.exit(main())

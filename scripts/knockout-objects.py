#!/usr/bin/env python3
"""把筆畫物品圖的白底去掉，裁到外框，輸出透明 WebP。

只清除「與邊緣相連」的白色，物件內部的白（高光、刷毛、瓷面）會保留。

用法：
    python3 scripts/knockout-objects.py apps/巧手拼拼字/public/objects
"""
import sys
from collections import deque
from pathlib import Path

from PIL import Image

# 判為背景的亮度門檻；生成圖的白底常帶一點灰或暖色
WHITE_MIN = 232
# 邊長，正方輸出
OUT_SIZE = 512
# 裁切後四周留的透明邊，避免旋轉時邊緣被切
PAD = 8


def knockout(path: Path) -> None:
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    px = img.load()

    def is_bg(x: int, y: int) -> bool:
        r, g, b, a = px[x, y]
        return a > 0 and r >= WHITE_MIN and g >= WHITE_MIN and b >= WHITE_MIN

    # 由四邊向內做泛洪，只有連到邊緣的白才算背景
    seen = bytearray(w * h)
    queue: deque[tuple[int, int]] = deque()
    for x in range(w):
        for y in (0, h - 1):
            if is_bg(x, y):
                queue.append((x, y))
                seen[y * w + x] = 1
    for y in range(h):
        for x in (0, w - 1):
            if is_bg(x, y):
                queue.append((x, y))
                seen[y * w + x] = 1

    while queue:
        x, y = queue.popleft()
        px[x, y] = (255, 255, 255, 0)
        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx] and is_bg(nx, ny):
                seen[ny * w + nx] = 1
                queue.append((nx, ny))

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    side = max(img.size) + PAD * 2
    canvas = Image.new("RGBA", (side, side), (255, 255, 255, 0))
    canvas.paste(img, ((side - img.width) // 2, (side - img.height) // 2), img)
    canvas = canvas.resize((OUT_SIZE, OUT_SIZE), Image.LANCZOS)

    out = path.with_suffix(".webp")
    canvas.save(out, "WEBP", quality=90, method=6)
    print(f"  {path.name} -> {out.name} ({out.stat().st_size // 1024} KB)")


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 1
    target = Path(sys.argv[1])
    pngs = sorted(target.glob("*.png"))
    if not pngs:
        print(f"no PNG found in {target}")
        return 1
    print(f"knocking out {len(pngs)} images in {target}")
    for p in pngs:
        knockout(p)
        p.unlink()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

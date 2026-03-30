"""
医薬品構造式かるたリスト.pdf から各カードを切り出す（オートクロップ版）

セル内のコンテンツ境界を自動検出して正確にトリミングする。
"""

import os
import json
import numpy as np
from PIL import Image

ASSETS   = "assets/structures"
OUT_STRUCT = "assets/cards/structure"
OUT_HINT   = "assets/cards/hint"
os.makedirs(OUT_STRUCT, exist_ok=True)
os.makedirs(OUT_HINT,   exist_ok=True)

# カード番号配置: col 右→左、奇数が上行・偶数が下行
# カード1,3,5,7,9  → row0  col(4,3,2,1,0)
# カード2,4,6,8,10 → row1  col(4,3,2,1,0)
# カード11-20は+10して下セクション row2/row3
def make_grid(n_cards):
    layout = {}
    for i in range(min(5, (n_cards + 1) // 2)):
        odd  = 2 * i + 1
        even = 2 * i + 2
        col  = 4 - i
        layout[odd] = (0, col)
        if even <= n_cards:
            layout[even] = (1, col)
    if n_cards > 10:
        for i in range(min(5, (n_cards - 10 + 1) // 2)):
            odd  = 2 * i + 11
            even = 2 * i + 12
            col  = 4 - i
            layout[odd] = (2, col)
            if even <= n_cards:
                layout[even] = (3, col)
    return layout


def detect_row_bounds(arr, n_rows, threshold=20, min_gap=50, large_section_threshold=1400, pad=15):
    """画像からコンテンツのY境界を自動検出してrow_boundsを返す"""
    H = arr.shape[0]
    row_max = arr.max(axis=1)
    is_content = row_max > threshold

    sections = []
    in_c = False
    s = None
    for y in range(H):
        if is_content[y] and not in_c:
            s = y; in_c = True
        elif not is_content[y] and in_c:
            sections.append((s, y)); in_c = False
    if in_c:
        sections.append((s, H))

    # 小ギャップをマージ
    merged = [sections[0]]
    for sec in sections[1:]:
        if sec[0] - merged[-1][1] <= min_gap:
            merged[-1] = (merged[-1][0], sec[1])
        else:
            merged.append(sec)

    # ノイズ除外（高さ100px未満）
    valid = [(s, e) for s, e in merged if e - s >= 100]

    row_bounds = []
    for s, e in valid:
        if e - s >= large_section_threshold:
            # 2行分が結合したセクション → 中点で分割
            mid = (s + e) // 2
            row_bounds.append((max(0, s - pad), min(H, mid + pad)))
            row_bounds.append((max(0, mid - pad), min(H, e + pad)))
        else:
            row_bounds.append((max(0, s - pad), min(H, e + pad)))

    return row_bounds[:n_rows]


def detect_col_bounds(arr, n_cols=5, threshold=5, min_dark_width=10, search_window=250,
                      bleed_trim=50):
    """
    列間の暗いギャップ（印刷の余白）を検出して col_bounds を返す。
    各列の等分割境界付近でギャップを探し、見つかればギャップ中点を使用、
    見つからなければ等分割境界にフォールバックする。
    フォールバック境界の右側列は bleed_trim px 分左端をトリムして
    隣カードのラベル映り込みを防ぐ。
    """
    W = arr.shape[1]
    col_max = arr.max(axis=0)
    is_dark = col_max <= threshold

    # 幅 min_dark_width 以上の連続darkゾーンを収集
    dark_zones = []
    in_d = False; s = None
    for x in range(W):
        if is_dark[x] and not in_d:
            s = x; in_d = True
        elif not is_dark[x] and in_d:
            dark_zones.append((s, x)); in_d = False
    if in_d:
        dark_zones.append((s, W))
    sig_dark = [(s, e) for s, e in dark_zones if e - s >= min_dark_width]

    # 等分割境界 (境界数 = n_cols - 1)
    equal_dividers = [int(W * c / n_cols) for c in range(1, n_cols)]

    # 各等分割境界について最近傍のdarkゾーンを探す
    actual_dividers = []
    is_gap_based = []  # True=ギャップ検出, False=フォールバック
    for eq in equal_dividers:
        best = None
        best_dist = search_window + 1
        for s, e in sig_dark:
            mid = (s + e) // 2
            dist = abs(mid - eq)
            if dist < best_dist:
                best_dist = dist
                best = (s + e) // 2
        if best is not None and best_dist <= search_window:
            actual_dividers.append(best)
            is_gap_based.append(True)
        else:
            actual_dividers.append(eq)  # フォールバック
            is_gap_based.append(False)

    # 境界から col_bounds を生成
    # フォールバック境界の右側列は bleed_trim px トリムして隣ラベルの映り込みを防ぐ
    dividers = [0] + sorted(actual_dividers) + [W]
    col_bounds = []
    for c in range(n_cols):
        x0 = dividers[c]
        x1 = dividers[c + 1]
        # c>0 かつ左境界がフォールバックの場合: 左端をトリム
        if c > 0 and not is_gap_based[c - 1]:
            x0 = min(x0 + bleed_trim, x1)
        col_bounds.append((x0, x1))
    return col_bounds, is_gap_based


def autocrop_cell(cell_img, threshold=20, pad=20):
    arr  = np.array(cell_img.convert('L'))
    mask = arr > threshold
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if len(rows) == 0 or len(cols) == 0:
        return cell_img
    x0 = max(0, int(cols[0])  - pad)
    x1 = min(cell_img.width,  int(cols[-1]) + pad)
    y0 = max(0, int(rows[0])  - pad)
    y1 = min(cell_img.height, int(rows[-1]) + pad)
    return cell_img.crop((x0, y0, x1, y1))


def extract_page(img_path, offset, n_cards, out_dir, flip180=False):
    """
    flip180=True  : ページが180°反転して保存されているケース (page02/page05)
                    行・列インデックスを逆転し ROTATE_270 (CW) を適用する。
    flip180=False : 通常ページ (page01/page03/page04/page06)
                    ROTATE_90 (CCW) を適用する。
    """
    img  = Image.open(img_path)
    W, H = img.size
    arr  = np.array(img.convert('L'))

    n_rows = 4 if n_cards > 10 else 2

    # 実際のコンテンツ境界を自動検出
    row_bounds = detect_row_bounds(arr, n_rows)
    # 列境界を暗いギャップから自動検出（隣カードの映り込みを防ぐ）
    col_bounds, is_gap_based = detect_col_bounds(arr)

    grid = make_grid(n_cards)
    rotation = Image.Transpose.ROTATE_270 if flip180 else Image.Transpose.ROTATE_90
    print(f"\n--- {img_path} ({W}x{H}), {n_cards} cards, offset={offset}, flip180={flip180} ---")
    print(f"  row_bounds: {row_bounds}")
    print(f"  col_bounds: {col_bounds}  fallback: {[i for i,g in enumerate(is_gap_based) if not g]}")

    for rel_id, (row_idx, col_idx) in sorted(grid.items()):
        abs_id = offset + rel_id
        # flip180 時は行・列インデックスを逆転（ページが上下逆のため）
        actual_row = (n_rows - 1 - row_idx) if flip180 else row_idx
        actual_col = (4 - col_idx)          if flip180 else col_idx
        cx0, cx1 = col_bounds[actual_col]
        cy0, cy1 = row_bounds[actual_row]

        cell    = img.crop((cx0, cy0, cx1, cy1))
        cell    = cell.transpose(rotation)
        cropped = autocrop_cell(cell)

        ratio   = 600 / cropped.width
        out_img = cropped.resize((600, int(cropped.height * ratio)), Image.LANCZOS)

        fname = f"card-{abs_id:03d}.jpg"
        out_img.save(os.path.join(out_dir, fname), "JPEG", quality=88)
        print(f"  card {abs_id:03d}  cell=({cx0},{cy0})-({cx1},{cy1})  cropped={cropped.size}")

    return sorted(grid.keys())


def main():
    struct_pages = [
        ("page01_img01.jpeg",  0, 20, False),  # 通常向き (CCW)
        ("page02_img01.jpeg", 20, 20, True),   # 180°反転 (CW + 逆インデックス)
        ("page03_img01.jpeg", 40, 10, False),  # 通常向き (CCW)
    ]
    all_ids = set()
    for fname, offset, n, flip in struct_pages:
        ids = extract_page(os.path.join(ASSETS, fname), offset, n, OUT_STRUCT, flip180=flip)
        all_ids.update(offset + i for i in ids)

    hint_pages = [
        ("page04_img01.jpeg",  0, 20, False),  # 通常向き (CCW)
        ("page05_img01.jpeg", 20, 20, True),   # 180°反転 (CW + 逆インデックス)
        ("page06_img01.jpeg", 40, 10, False),  # 通常向き (CCW)
    ]
    for fname, offset, n, flip in hint_pages:
        extract_page(os.path.join(ASSETS, fname), offset, n, OUT_HINT, flip180=flip)

    cards = [
        {
            "id":        cid,
            "structure": f"assets/cards/structure/card-{cid:03d}.jpg",
            "hint":      f"assets/cards/hint/card-{cid:03d}.jpg",
        }
        for cid in sorted(all_ids)
    ]
    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"\n=== 完了: {len(cards)} 枚生成 ===")


if __name__ == "__main__":
    main()

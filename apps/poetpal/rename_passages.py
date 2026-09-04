#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""將建議篇章賞析 PDF 與誦讀錄音改為帶篇名及語言備註的檔名。"""

import os
import re

BASE = os.path.dirname(os.path.abspath(__file__))
APPR = os.path.join(BASE, "建議篇章賞析")
AUDIO = os.path.join(BASE, "誦讀錄音")

# 第一學習階段 20 篇（檔名用簡短名，避免過長）
KS1_NAMES = [
    "守株待兔", "孟母戒子", "江南", "七步詩", "詠鵝",
    "回鄉偶書", "登鸛鵲樓", "春曉", "九月九日憶山東兄弟", "靜夜思",
    "賦得古原草送別", "遊子吟", "憫農其二", "金縷衣", "清明",
    "蜂", "元日", "小池", "畫雞", "詠雪"
]

# 第二學習階段 20 篇
KS2_NAMES = [
    "論語四則", "二子學弈", "鄭人買履", "鷸蚌相爭", "折箭",
    "涼州詞", "出塞", "送元二使安西", "早發白帝城", "客至",
    "絕句", "楓橋夜泊", "江雪", "山行", "泊船瓜洲",
    "題西林壁", "曉出淨慈寺送林子方", "石灰吟", "明日歌", "朱子家訓節錄"
]

# 第三學習階段 25 篇（07a/07b, 11a/11b 用子篇名）
KS3_NAMES = {
    "01": "論四端", "02": "大同與小康", "03": "愚公移山", "04": "鄒忌諷齊王納諫",
    "05": "古詩十九首兩首", "06": "桃花源記", "07": "世說新語兩則", "08": "木蘭詩",
    "09": "送杜少府之任蜀州", "10": "兵車行", "11": "詠鳥詩兩首", "12": "陋室銘",
    "13": "虞美人", "14": "賣油翁", "15": "愛蓮說", "16": "傷仲永",
    "17": "水調歌頭並序", "18": "滿江紅", "19": "天淨沙秋思", "20": "岳飛之少年時代",
    "21": "楊修之死", "22": "賣柑者言", "23": "為學", "24": "貓捕雀", "25": "習慣說",
    "07a": "荀巨伯遠看友人疾", "07b": "管寧華歆共園中鋤菜",
    "11a": "燕詩", "11b": "慈烏夜啼",
}

# 第四學習階段（錄音用）
KS4_NAMES = {
    "01": "國風關雎", "02": "曹劌論戰", "03": "論仁論孝論君子", "04": "魚我所欲也",
    "05": "逍遙遊", "06": "勸學", "07": "大學", "08": "廉頗藺相如列傳",
    "09": "出師表", "10": "陳情表", "11": "飲酒其五", "12": "師說",
    "13": "始得西山宴遊記", "14": "岳陽樓記", "15": "六國論",
    "16a": "山居秋暝", "16b": "月下獨酌其一", "16c": "登樓",
    "17a": "念奴嬌赤壁懷古", "17b": "聲聲慢秋情", "17c": "青玉案元夕",
    "18a": "四塊玉閒適", "18b": "沉醉東風漁父詞",
    "19": "滿井遊記", "20": "左忠毅公軼事",
}

# 錄音後綴 -> 括號備註
AUDIO_SUFFIX = {"_c": "(粵語)", "_c1": "(粵語)", "_c2": "(粵語)", "_p": "(普通話)", "_y": "(粵語吟誦)"}


def rename_appreciation_pdfs():
    """賞析 PDF：KS1/KS2/KS3 改為 KSx_NN_篇名.pdf"""
    for i, name in enumerate(KS1_NAMES, 1):
        old = os.path.join(APPR, f"KS1_{i:02d}_賞析.pdf")
        new = os.path.join(APPR, f"KS1_{i:02d}_{name}.pdf")
        if os.path.isfile(old):
            os.rename(old, new)
            print(f"  {os.path.basename(old)} -> {os.path.basename(new)}")

    for i, name in enumerate(KS2_NAMES, 1):
        old = os.path.join(APPR, f"KS2_{i:02d}_賞析.pdf")
        new = os.path.join(APPR, f"KS2_{i:02d}_{name}.pdf")
        if os.path.isfile(old):
            os.rename(old, new)
            print(f"  {os.path.basename(old)} -> {os.path.basename(new)}")

    for num, name in KS3_NAMES.items():
        if len(num) <= 2 and not num.endswith("a") and not num.endswith("b"):
            old = os.path.join(APPR, f"KS3_{num}_賞析.pdf")
            new = os.path.join(APPR, f"KS3_{num}_{name}.pdf")
            if os.path.isfile(old):
                os.rename(old, new)
                print(f"  {os.path.basename(old)} -> {os.path.basename(new)}")


def parse_audio_basename(basename):
    """解析錄音檔名，回傳 (stage, num, suffix) 如 ('KS1','01','_p')。"""
    # 統一為小寫比對
    b = basename.replace(".mp3", "")
    for stage in ["KS1", "KS2", "KS3", "KS4"]:
        prefix = stage
        if not b.upper().startswith(prefix):
            continue
        rest = b[len(prefix):].lstrip("_")
        # rest 可能是 01_c, 07a_p, 17a_c1 等
        m = re.match(r"(\d+[ab]?)(_c1|_c2|_c|_p|_y)$", rest, re.I)
        if m:
            return stage.upper(), m.group(1).upper().replace("A", "a").replace("B", "b"), m.group(2).lower()
        # KS1_2_c 這種缺零
        m2 = re.match(r"(\d+)(_c|_p)$", rest, re.I)
        if m2:
            return stage.upper(), m2.group(1).zfill(2), m2.group(2).lower()
    return None, None, None


def get_name_for_audio(stage, num):
    if stage == "KS1":
        idx = int(num) if num.isdigit() else 0
        if 1 <= idx <= 20:
            return KS1_NAMES[idx - 1]
    elif stage == "KS2":
        idx = int(num) if num.isdigit() else 0
        if 1 <= idx <= 20:
            return KS2_NAMES[idx - 1]
    elif stage == "KS3":
        return KS3_NAMES.get(num, num)
    elif stage == "KS4":
        return KS4_NAMES.get(num, num)
    return num


def rename_audio_in_folder(stage_dir, stage_label):
    """將一個階段資料夾內的 mp3 改為 篇名(粵語/普通話).mp3"""
    if not os.path.isdir(stage_dir):
        return
    names_map = {"KS1": KS1_NAMES, "KS2": KS2_NAMES, "KS3": KS3_NAMES, "KS4": KS4_NAMES}
    for f in os.listdir(stage_dir):
        if not f.lower().endswith(".mp3"):
            continue
        path = os.path.join(stage_dir, f)
        if not os.path.isfile(path):
            continue
        stage, num, suffix = parse_audio_basename(f)
        if not stage or not num or not suffix:
            continue
        if stage != stage_label:
            continue
        name = get_name_for_audio(stage, num)
        lang_note = AUDIO_SUFFIX.get(suffix, suffix)
        # 格式: KS1_01_守株待兔(普通話).mp3
        new_basename = f"{stage}_{num}_{name}{lang_note}.mp3"
        new_path = os.path.join(stage_dir, new_basename)
        if path != new_path and not os.path.isfile(new_path):
            os.rename(path, new_path)
            print(f"  {f} -> {new_basename}")


def main():
    print("=== 賞析 PDF 重新命名（KS1–KS3）===")
    rename_appreciation_pdfs()
    print("\n=== 誦讀錄音重新命名（KS1–KS4，括號備註粵語/普通話）===")
    for stage in ["KS1", "KS2", "KS3", "KS4"]:
        d = os.path.join(AUDIO, stage)
        print(f"\n--- {stage} ---")
        rename_audio_in_folder(d, stage)
    print("\n完成。")


if __name__ == "__main__":
    main()

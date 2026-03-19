#!/usr/bin/env python3
"""
Build annotated text for KS3_02 to KS3_08.
Uses only annotations with 3+ chars to avoid false matches (e.g. 作 in 作動詞用).
"""
import re
import json
from pathlib import Path
from pypdf import PdfReader

BASE = Path(__file__).parent

# Annotations to EXCLUDE (cause false matches when used as single-char)
SKIP_KEYS = {'作', '分', '方', '尋', '美', '私', '及', '莫', '語', '子', '委', '值', '要', '具', '窮', '才', '異', '亡', '易', '謹', '歸', '謀'}

def load_annotations():
    content = (BASE / 'KS3_ANALYSIS.js').read_text(encoding='utf-8')
    result = {}
    for kid in ['KS3_02', 'KS3_03', 'KS3_04', 'KS3_05', 'KS3_06', 'KS3_07', 'KS3_08']:
        result[kid] = {}
        pattern = rf"'{kid}':\s*\{{[^}}]*annotations:\s*\{{([^}}]*(?:\{{[^}}]*\}}[^}}]*)*)\}}"
        m = re.search(pattern, content, re.DOTALL)
        if m:
            ann_block = m.group(1)
            for km in re.finditer(r"'([^']+)':\s*'((?:[^'\\]|\\.)*)'", ann_block):
                key, val = km.group(1), km.group(2).replace("\\'", "'")
                if key not in SKIP_KEYS and len(key) >= 2:  # Use 2+ char annotations
                    result[kid][key] = val
    return result

def extract_pdf(pdf_path):
    r = PdfReader(pdf_path)
    return ''.join(p.extract_text() or '' + '\n' for p in r.pages)

def cut_before(text, markers):
    for m in markers:
        idx = text.find(m)
        if idx >= 0:
            return text[:idx].strip()
    return text

def clean(text):
    # Remove footnote numbers and leading page numbers
    text = re.sub(r'^\s*\d+\s+', '', text)  # leading "1 " etc
    text = re.sub(r'\s?\d{1,2}(?=[，。\、\s！；]|$)', '', text)  # footnote refs
    text = re.sub(r'(?<=[\u4e00-\u9fff])\d{1,2}(?=\s|[,。\、\s]|$)', '', text)
    return re.sub(r'\s+', ' ', text).strip()

def apply_annotations(text, annotations):
    for key in sorted(annotations.keys(), key=len, reverse=True):
        if key in text:
            text = text.replace(key, '{' + key + '|' + annotations[key] + '}')
    return text

def main():
    ann = load_annotations()
    pdfs = [
        ('KS3_02', '建議篇章賞析/KS3_02_大同與小康.pdf'),
        ('KS3_03', '建議篇章賞析/KS3_03_愚公移山.pdf'),
        ('KS3_04', '建議篇章賞析/KS3_04_鄒忌諷齊王納諫.pdf'),
        ('KS3_05', '建議篇章賞析/KS3_05_古詩十九首兩首.pdf'),
        ('KS3_06', '建議篇章賞析/KS3_06_桃花源記.pdf'),
        ('KS3_07', '建議篇章賞析/KS3_07_世說新語兩則.pdf'),
        ('KS3_08', '建議篇章賞析/KS3_08_木蘭詩.pdf'),
    ]
    markers = ['一、作者簡介', '一、 作者簡介', '一 、 作 者 簡 介']
    results = {}
    for kid, pdf_rel in pdfs:
        text = extract_pdf(BASE / pdf_rel)
        if kid == 'KS3_05':
            p1 = cut_before(text, markers)
            if '迢迢' in text:
                s = text.index('迢迢')
                # Find end: 脈脈不得語 (may have footnote between 脈脈 and 不得語)
                end_m = re.search(r'脈脈\s*\d*\s*不得語', text[s:])
                e = s + end_m.end() if end_m else text.find('不得語', s) + len('不得語') if '不得語' in text[s:] else len(text)
                p2 = text[s:e]
                text = (p1 + '\n\n' + p2).strip()
            else:
                text = p1
        elif kid == 'KS3_07':
            p1 = cut_before(text, markers)
            if '管寧、華歆共園中鋤菜' in text:
                s = text.index('管寧、華歆共園中鋤菜')
                end_m = text.find('一、 注釋', s)
                if end_m < 0:
                    end_m = text.find('一、注釋', s)
                p2 = text[s:end_m].strip() if end_m > 0 else text[s:s+500]
                text = (p1 + '\n\n' + p2).strip()
            else:
                text = p1
        elif kid == 'KS3_04':
            # Cut at "此所謂戰勝於朝廷" - the article ends there, before 一、 作者簡介
            idx = text.find('此所謂戰勝於朝廷')
            if idx >= 0:
                text = text[:idx + len('此所謂戰勝於朝廷')].strip()
            else:
                text = cut_before(text, markers)
        else:
            text = cut_before(text, markers)
        text = clean(text)
        text = apply_annotations(text, ann.get(kid, {}))
        results[kid] = text
    print(json.dumps(results, ensure_ascii=False, indent=0))

if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""
Extract original text from KS4 PDFs (before 一、作者簡介) and build {word|definition} format
using annotations from KS4_ANALYSIS.js and KS4_ANALYSIS_APPEND.js.
"""
import re
import os

# PDF mapping: article_id -> pdf filename
KS4_PDFS = {
    'KS4_01': 'KS4_01_國風關雎.pdf',
    'KS4_02': 'KS4_02_曹劌論戰.pdf',
    'KS4_03': 'KS4_03_論仁論孝論君子.pdf',
    'KS4_04': 'KS4_04_魚我所欲也.pdf',
    'KS4_05': 'KS4_05_逍遙遊.pdf',
    'KS4_06': 'KS4_06_勸學.pdf',
    'KS4_07': 'KS4_07_大學.pdf',
    'KS4_08': 'KS4_08_廉頗藺相如列傳.pdf',
    'KS4_09': 'KS4_09_出師表.pdf',
    'KS4_10': 'KS4_10_陳情表.pdf',
    'KS4_12': 'KS4_12_師說.pdf',
    'KS4_13': 'KS4_13_始得西山宴遊記.pdf',
    'KS4_14': 'KS4_14_岳陽樓記.pdf',
    'KS4_15': 'KS4_15_六國論.pdf',
    'KS4_19': 'KS4_19_滿井遊記.pdf',
    'KS4_20': 'KS4_20_左忠毅公軼事.pdf',
}

def extract_pdf_text(pdf_path):
    """Extract text from PDF before 一、作者簡介."""
    import pdfplumber
    with pdfplumber.open(pdf_path) as pdf:
        text = ''.join(p.extract_text() or '' for p in pdf.pages)
    marker = '一、作者簡介'
    idx = text.find(marker)
    if idx >= 0:
        text = text[:idx]
    return text.strip()

def clean_extracted_text(text):
    """Remove annotation numbers (e.g. 1, 2, 10) from text."""
    # Remove numbers that appear between words (annotation refs like "關關 1 雎鳩 2")
    text = re.sub(r'\s+\d+\s*', ' ', text)
    # Remove numbers before punctuation (e.g. "巴陵郡3。" -> "巴陵郡。")
    text = re.sub(r'\d+([。，、；：])', r'\1', text)
    # Collapse multiple spaces but preserve newlines
    text = re.sub(r'[ \t]+', ' ', text)
    text = re.sub(r' *\n *', '\n', text)
    return text.strip()

def apply_annotations(text, annotations):
    """Replace annotated words with {word|definition} format. Scan original text only to avoid replacing inside definitions."""
    if not annotations:
        return text
    keys = sorted(annotations.keys(), key=len, reverse=True)
    result = []
    i = 0
    while i < len(text):
        matched = False
        for word in keys:
            if text[i:i+len(word)] == word:
                definition = annotations[word]
                result.append('{' + word + '|' + definition + '}')
                i += len(word)
                matched = True
                break
        if not matched:
            result.append(text[i])
            i += 1
    return ''.join(result)

def parse_all_annotations(script_dir):
    """Parse annotations from KS4_ANALYSIS.js and KS4_ANALYSIS_APPEND.js."""
    all_annotations = {}
    for js_name in ['KS4_ANALYSIS.js', 'KS4_ANALYSIS_APPEND.js']:
        js_path = os.path.join(script_dir, js_name)
        if not os.path.exists(js_path):
            continue
        with open(js_path, 'r', encoding='utf-8') as f:
            content = f.read()
        # Find each 'KS4_XX': block and its annotations
        for m in re.finditer(r"'KS4_\d+[a-z]?'", content):
            aid = m.group(0)[1:-1]
            start = m.end()
            ann_start = content.find('annotations:', start)
            if ann_start < 0 or ann_start - start > 5000:
                continue
            brace = content.find('{', ann_start)
            if brace < 0:
                continue
            # Extract block - annotations end with }\n  } or }\n  },
            block = content[brace:brace+8000]
            end_markers = ['}\n  }', '}\n  },']
            end_pos = len(block)
            for em in end_markers:
                idx = block.find(em)
                if idx >= 0:
                    end_pos = min(end_pos, idx + 1)
            block = block[:end_pos]
            ann_dict = {}
            for am in re.finditer(r"'([^']+)':\s*'((?:[^'\\]|\\.)*?)'(?=\s*[,}\n])", block):
                key = am.group(1).replace("\\'", "'")
                val = am.group(2).replace("\\'", "'").replace('\\n', '\n')
                ann_dict[key] = val
            if ann_dict:
                all_annotations[aid] = ann_dict
    return all_annotations

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    pdf_dir = os.path.join(script_dir, '建議篇章賞析')
    all_annotations = parse_all_annotations(script_dir)
    
    # Extract and process each PDF
    outputs = {}
    for aid, pdf_name in KS4_PDFS.items():
        pdf_path = os.path.join(pdf_dir, pdf_name)
        if not os.path.exists(pdf_path):
            print(f"Warning: {pdf_path} not found")
            continue
        raw = extract_pdf_text(pdf_path)
        cleaned = clean_extracted_text(raw)
        annotations = all_annotations.get(aid, {})
        final = apply_annotations(cleaned, annotations)
        outputs[aid] = final
        print(f"--- {aid} ---")
        print(final[:300] + '...' if len(final) > 300 else final)
        print()
    
    return outputs

if __name__ == '__main__':
    import json
    out = main()
    # Write to JSON for use when updating articles.js
    with open(os.path.join(os.path.dirname(__file__), 'ks4_extracted.json'), 'w', encoding='utf-8') as f:
        json.dump(out, f, ensure_ascii=False, indent=0)

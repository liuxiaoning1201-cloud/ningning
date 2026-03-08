#!/usr/bin/env python3
"""Update articles.js with extracted KS4 text."""
import json
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(script_dir, 'ks4_extracted.json'), 'r', encoding='utf-8') as f:
    data = json.load(f)

with open(os.path.join(script_dir, 'articles.js'), 'r', encoding='utf-8') as f:
    content = f.read()

for aid, text in data.items():
    # Escape single quotes for JavaScript
    escaped = text.replace('\\', '\\\\').replace("'", "\\'").replace('\n', '\\n')
    import re
    # Pattern: {id:'KS4_XX'...}text:null (match article block up to text:null)
    pattern = rf"(\{{id:'{re.escape(aid)}'[^}}]*?)text:null"
    replacement = rf"\1text:'{escaped}'"
    new_content, n = re.subn(pattern, replacement, content, count=1)
    if n > 0:
        content = new_content
        print(f"Updated {aid}")
    else:
        print(f"Could not find pattern for {aid}")

with open(os.path.join(script_dir, 'articles.js'), 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")

#!/usr/bin/env node
/**
 * Export KS4 annotations as JSON for use by extract_ks4_text.py
 */
const fs = require('fs');
const path = require('path');

// Load KS4_ANALYSIS (defines KS4_ANALYSIS)
eval(fs.readFileSync(path.join(__dirname, 'KS4_ANALYSIS.js'), 'utf8'));
// Load KS4_ANALYSIS_APPEND (Object.assign into KS4_ANALYSIS)
eval(fs.readFileSync(path.join(__dirname, 'KS4_ANALYSIS_APPEND.js'), 'utf8'));

const output = {};
for (const [id, data] of Object.entries(KS4_ANALYSIS)) {
  if (data && data.annotations) {
    output[id] = data.annotations;
  }
}
console.log(JSON.stringify(output, null, 0));

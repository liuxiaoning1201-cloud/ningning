/* 詩友記 PoetPal - 篇章賞析數據 */

const ANALYSIS = Object.assign({}, 
  (typeof KS1_ANALYSIS !== "undefined" ? KS1_ANALYSIS : {}),
  (typeof KS2_ANALYSIS !== "undefined" ? KS2_ANALYSIS : {}),
  (typeof KS3_ANALYSIS !== "undefined" ? KS3_ANALYSIS : {}),
  (typeof KS4_ANALYSIS !== "undefined" ? KS4_ANALYSIS : {})
);

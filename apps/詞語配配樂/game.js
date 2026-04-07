(function () {
  const STORAGE_BANK = "word-match-bank-text";
  const STORAGE_PAIRS = "word-match-pairs-per-round";
  const STORAGE_LEVEL_MODE = "word-match-level-mode";
  const STORAGE_PAIRS_PER_LEVEL = "word-match-pairs-per-level";
  const STORAGE_TOTAL_LEVELS = "word-match-total-levels";

  const SFX_SUCCESS_SRC = "./assets/sfx/success.mp3";
  const SFX_ERROR_SRC = "./assets/sfx/error.mp3";

  const sfxSuccess = new Audio(SFX_SUCCESS_SRC);
  const sfxError = new Audio(SFX_ERROR_SRC);
  sfxSuccess.preload = "auto";
  sfxError.preload = "auto";

  function playSfx(audio) {
    try {
      audio.pause();
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
    } catch (_) {}
  }

  const DEMO_BANK = `勇敢/遇到困難也不退縮
開心/心裡很快樂的感覺
專心/做事很認真、不分心
朋友/互相幫助、一起玩的人
春天/天氣變暖、花草長出來的季節`;

  const PAIR_CHOICES = [3, 4, 5, 6, 8];
  const TOTAL_LEVEL_CHOICES = Array.from({ length: 20 }, function (_, i) {
    return i + 1;
  });

  /** @typedef {{ id: string, word: string, meaning: string }} Pair */

  /**
   * @param {string} text
   * @returns {{ pairs: Pair[], invalid: number }}
   */
  function parseBank(text) {
    const pairs = [];
    let invalid = 0;
    const lines = text.split(/\r?\n/);
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const idx = t.indexOf("/");
      if (idx <= 0 || idx === t.length - 1) {
        invalid++;
        continue;
      }
      const word = t.slice(0, idx).trim();
      const meaning = t.slice(idx + 1).trim();
      if (!word || !meaning) {
        invalid++;
        continue;
      }
      pairs.push({
        id: "p" + pairs.length,
        word,
        meaning,
      });
    }
    return { pairs, invalid };
  }

  /** @template T @param {T[]} arr @returns {T[]} */
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function loadBankText() {
    try {
      const raw = localStorage.getItem(STORAGE_BANK);
      if (raw && raw.trim()) return raw;
    } catch (_) {}
    return DEMO_BANK;
  }

  function loadPairsPerRound() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_PAIRS) || "", 10);
      if (PAIR_CHOICES.includes(n)) return n;
    } catch (_) {}
    return 4;
  }

  function loadLevelMode() {
    try {
      return localStorage.getItem(STORAGE_LEVEL_MODE) === "1";
    } catch (_) {}
    return false;
  }

  function loadPairsPerLevel() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_PAIRS_PER_LEVEL) || "", 10);
      if (PAIR_CHOICES.includes(n)) return n;
    } catch (_) {}
    return 4;
  }

  function loadTotalLevels() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_TOTAL_LEVELS) || "", 10);
      if (n >= 1 && n <= 20) return n;
    } catch (_) {}
    return 5;
  }

  function saveBankText(text) {
    try {
      localStorage.setItem(STORAGE_BANK, text);
    } catch (_) {}
  }

  function savePairsPerRound(n) {
    try {
      localStorage.setItem(STORAGE_PAIRS, String(n));
    } catch (_) {}
  }

  function saveLevelMode(on) {
    try {
      localStorage.setItem(STORAGE_LEVEL_MODE, on ? "1" : "0");
    } catch (_) {}
  }

  function savePairsPerLevel(n) {
    try {
      localStorage.setItem(STORAGE_PAIRS_PER_LEVEL, String(n));
    } catch (_) {}
  }

  function saveTotalLevels(n) {
    try {
      localStorage.setItem(STORAGE_TOTAL_LEVELS, String(n));
    } catch (_) {}
  }

  const els = {
    board: document.getElementById("board"),
    hint: document.getElementById("hint"),
    levelProgress: document.getElementById("level-progress"),
    btnSettings: document.getElementById("btn-settings"),
    modal: document.getElementById("settings-modal"),
    bankText: document.getElementById("bank-text"),
    pairsSelect: document.getElementById("pairs-select"),
    parseHint: document.getElementById("parse-hint"),
    btnSave: document.getElementById("btn-save-settings"),
    btnDemo: document.getElementById("btn-restore-demo"),
    btnClose: document.getElementById("btn-close-settings"),
    winLayer: document.getElementById("win-layer"),
    winTitle: document.getElementById("win-title"),
    winMsg: document.getElementById("win-msg"),
    btnAgain: document.getElementById("btn-play-again"),
    levelCompleteLayer: document.getElementById("level-complete-layer"),
    levelCompleteTitle: document.getElementById("level-complete-title"),
    levelCompleteMsg: document.getElementById("level-complete-msg"),
    excelInput: document.getElementById("excel-input"),
    btnPickExcel: document.getElementById("btn-pick-excel"),
    excelFilename: document.getElementById("excel-filename"),
    excelMsg: document.getElementById("excel-msg"),
    levelMode: document.getElementById("level-mode"),
    rowFreeRound: document.getElementById("row-free-round"),
    rowLevelSettings: document.getElementById("row-level-settings"),
    pairsPerLevel: document.getElementById("pairs-per-level"),
    totalLevels: document.getElementById("total-levels"),
    levelCapHint: document.getElementById("level-cap-hint"),
  };

  let bankText = loadBankText();
  let pairsPerRound = loadPairsPerRound();
  let levelMode = loadLevelMode();
  let pairsPerLevel = loadPairsPerLevel();
  let totalLevelsRequest = loadTotalLevels();

  /** @type {Pair[]} */
  let roundPairs = [];
  /** @type {Pair[]} */
  let masterPool = [];
  let numLevels = 0;
  let currentLevelIndex = 0;

  /** @type {{ el: HTMLElement, side: 'left'|'right', pairId: string } | null} */
  let selected = null;
  let inputLocked = false;

  function fillPairsSelect() {
    els.pairsSelect.innerHTML = PAIR_CHOICES.map(function (n) {
      return (
        '<option value="' + n + '"' + (n === pairsPerRound ? " selected" : "") + ">" + n + " 組</option>"
      );
    }).join("");
  }

  function fillPairsPerLevelSelect() {
    els.pairsPerLevel.innerHTML = PAIR_CHOICES.map(function (n) {
      return (
        '<option value="' +
        n +
        '"' +
        (n === pairsPerLevel ? " selected" : "") +
        ">" +
        n +
        " 組</option>"
      );
    }).join("");
  }

  function fillTotalLevelsSelect() {
    els.totalLevels.innerHTML = TOTAL_LEVEL_CHOICES.map(function (n) {
      return (
        '<option value="' +
        n +
        '"' +
        (n === totalLevelsRequest ? " selected" : "") +
        ">" +
        n +
        " 關</option>"
      );
    }).join("");
  }

  function syncSettingsLevelRows() {
    const on = els.levelMode.checked;
    els.rowFreeRound.hidden = on;
    els.rowLevelSettings.hidden = !on;
    updateLevelCapHint();
  }

  function updateLevelCapHint() {
    if (!els.levelMode.checked) {
      els.levelCapHint.textContent = "";
      return;
    }
    const { pairs } = parseBank(els.bankText.value);
    const n = pairs.length;
    const per = parseInt(els.pairsPerLevel.value, 10) || 4;
    const want = parseInt(els.totalLevels.value, 10) || 1;
    if (n === 0) {
      els.levelCapHint.textContent = "請先建立題庫";
      els.levelCapHint.className = "parse-hint level-cap-hint";
      return;
    }
    const maxByBank = Math.max(1, Math.ceil(n / per));
    const actual = Math.min(want, maxByBank);
    els.levelCapHint.textContent =
      "題庫 " +
      n +
      " 組：每關 " +
      per +
      " 組時，最多可排 " +
      maxByBank +
      " 關；實際將進行 " +
      actual +
      " 關（設定關數與題庫取較小值）。";
    els.levelCapHint.className = "parse-hint level-cap-hint parse-ok";
  }

  /**
   * @param {File} file
   * @returns {Promise<string[]>}
   */
  function parseExcelToLines(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          if (typeof XLSX === "undefined") {
            reject(new Error("Excel 函式庫尚未載入，請重新整理頁面後再試。"));
            return;
          }
          const buf = e.target && e.target.result;
          if (!buf) {
            reject(new Error("無法讀取檔案內容。"));
            return;
          }
          const wb = XLSX.read(buf, { type: "array" });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: "",
            raw: false,
          });
          const lines = [];
          for (let r = 0; r < rows.length; r++) {
            const row = rows[r];
            if (!row || !row.length) continue;
            const cells = row
              .map(function (c) {
                return String(c ?? "").trim();
              })
              .filter(function (c) {
                return c.length > 0;
              });
            if (!cells.length) continue;
            if (cells.length >= 2) {
              const h0 = cells[0].replace(/\s/g, "");
              const h1 = cells[1].replace(/\s/g, "");
              if (
                r === 0 &&
                (h0 === "詞語" || h0 === "词语") &&
                (h1 === "解釋" || h1 === "解释")
              ) {
                continue;
              }
            }
            if (cells.length >= 2) {
              const word = cells[0];
              const meaning = cells.slice(1).join(" ").trim();
              if (word && meaning) lines.push(word + "/" + meaning);
            } else if (cells.length === 1 && cells[0].indexOf("/") !== -1) {
              lines.push(cells[0]);
            }
          }
          resolve(lines);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = function () {
        reject(new Error("讀取檔案失敗。"));
      };
      reader.readAsArrayBuffer(file);
    });
  }

  function openSettings() {
    els.bankText.value = bankText;
    els.pairsSelect.value = String(pairsPerRound);
    els.levelMode.checked = levelMode;
    els.pairsPerLevel.value = String(pairsPerLevel);
    els.totalLevels.value = String(totalLevelsRequest);
    syncSettingsLevelRows();
    els.excelMsg.textContent = "";
    els.excelFilename.textContent = "";
    if (els.excelInput) els.excelInput.value = "";
    updateParsePreview();
    els.modal.hidden = false;
    els.modal.setAttribute("aria-hidden", "false");
  }

  function closeSettings() {
    els.modal.hidden = true;
    els.modal.setAttribute("aria-hidden", "true");
  }

  function updateParsePreview() {
    const { pairs, invalid } = parseBank(els.bankText.value);
    if (invalid > 0) {
      els.parseHint.textContent = "有 " + invalid + " 行格式不完整，已略過（需為：詞語/解釋）";
      els.parseHint.className = "parse-hint";
    } else if (pairs.length === 0) {
      els.parseHint.textContent = "尚未輸入有效題組";
      els.parseHint.className = "parse-hint";
    } else {
      els.parseHint.textContent = "目前可配對 " + pairs.length + " 組";
      els.parseHint.className = "parse-hint parse-ok";
    }
    updateLevelCapHint();
  }

  function pickRoundPairs(allPairs) {
    const want = pairsPerRound;
    const n = Math.min(want, allPairs.length);
    return shuffle(allPairs.map(function (p) {
      return { ...p };
    })).slice(0, n);
  }

  function updateLevelProgressUI() {
    if (!levelMode || numLevels <= 0) {
      els.levelProgress.hidden = true;
      els.levelProgress.textContent = "";
      return;
    }
    els.levelProgress.hidden = false;
    els.levelProgress.textContent =
      "第 " + (currentLevelIndex + 1) + " / " + numLevels + " 關";
  }

  function loadLevelBoard(levelIdx) {
    const start = levelIdx * pairsPerLevel;
    roundPairs = masterPool.slice(start, start + pairsPerLevel);
    selected = null;
    inputLocked = false;
    renderBoard();
  }

  function startSession() {
    els.winLayer.hidden = true;
    els.levelCompleteLayer.hidden = true;
    selected = null;
    inputLocked = false;

    const parsed = parseBank(bankText);
    const allPairs =
      parsed.pairs.length > 0 ? parsed.pairs : parseBank(DEMO_BANK).pairs;

    if (levelMode) {
      masterPool = shuffle(
        allPairs.map(function (p) {
          return { ...p };
        })
      );
      const maxByBank = Math.max(1, Math.ceil(masterPool.length / pairsPerLevel));
      numLevels = Math.min(totalLevelsRequest, maxByBank);
      currentLevelIndex = 0;
      updateLevelProgressUI();
      loadLevelBoard(0);
    } else {
      masterPool = [];
      numLevels = 0;
      currentLevelIndex = 0;
      roundPairs = pickRoundPairs(allPairs);
      updateLevelProgressUI();
      renderBoard();
    }
  }

  function showLevelCompleteThenAdvance() {
    inputLocked = true;
    els.levelCompleteTitle.textContent = "第 " + (currentLevelIndex + 1) + " 關完成！";
    els.levelCompleteMsg.textContent = "即將進入下一關…";
    els.levelCompleteLayer.hidden = false;
    window.setTimeout(function () {
      els.levelCompleteLayer.hidden = true;
      currentLevelIndex++;
      updateLevelProgressUI();
      loadLevelBoard(currentLevelIndex);
    }, 1400);
  }

  function clearSelectionVisual() {
    document.querySelectorAll(".card.selected").forEach(function (c) {
      c.classList.remove("selected");
    });
    selected = null;
  }

  function renderBoard() {
    const left = shuffle(
      roundPairs.map(function (p) {
        return { ...p };
      })
    );
    const right = shuffle(
      roundPairs.map(function (p) {
        return { ...p };
      })
    );

    els.board.innerHTML =
      '<div class="col" data-side="left">' +
      '<div class="col-label left">詞語</div>' +
      '<div class="col-cards" id="col-left"></div>' +
      "</div>" +
      '<div class="col" data-side="right">' +
      '<div class="col-label right">解釋</div>' +
      '<div class="col-cards" id="col-right"></div>' +
      "</div>";

    const colLeft = document.getElementById("col-left");
    const colRight = document.getElementById("col-right");

    left.forEach(function (p, i) {
      const div = document.createElement("div");
      div.className = "card left-side";
      div.dataset.pairId = p.id;
      div.dataset.side = "left";
      div.style.animationDelay = i * 0.05 + "s";
      div.textContent = p.word;
      colLeft.appendChild(div);
    });

    right.forEach(function (p, i) {
      const div = document.createElement("div");
      div.className = "card right-side";
      div.dataset.pairId = p.id;
      div.dataset.side = "right";
      div.style.animationDelay = i * 0.05 + "s";
      div.textContent = p.meaning;
      colRight.appendChild(div);
    });

    els.board.querySelectorAll(".card").forEach(function (card) {
      card.addEventListener("click", onCardClick);
    });
  }

  function onCardClick(ev) {
    const el = ev.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    if (inputLocked || el.classList.contains("popping") || el.classList.contains("matched")) return;

    const side = /** @type {'left'|'right'} */ (el.dataset.side);
    const pairId = el.dataset.pairId || "";

    if (!selected) {
      el.classList.add("selected");
      selected = { el, side, pairId };
      return;
    }

    if (selected.side === side) {
      document.querySelectorAll(".card.selected").forEach(function (c) {
        c.classList.remove("selected");
      });
      el.classList.add("selected");
      selected = { el, side, pairId };
      return;
    }

    const a = selected;
    const b = { el, side, pairId };

    if (a.pairId === b.pairId) {
      inputLocked = true;
      a.el.classList.remove("selected");
      b.el.classList.remove("selected");
      a.el.classList.add("popping");
      b.el.classList.add("popping");
      selected = null;
      playSfx(sfxSuccess);

      window.setTimeout(function () {
        a.el.classList.add("matched");
        b.el.classList.add("matched");
        a.el.classList.remove("popping");
        b.el.classList.remove("popping");
        inputLocked = false;
        if (!document.querySelector(".card:not(.matched)")) {
          if (levelMode && currentLevelIndex < numLevels - 1) {
            showLevelCompleteThenAdvance();
          } else {
            if (levelMode) {
              els.winTitle.textContent = "全部通關！";
              els.winMsg.textContent = "你完成了所有關卡！要再挑戰一次嗎？";
            } else {
              els.winTitle.textContent = "太棒了！";
              els.winMsg.textContent = "全部配對完成，要再玩一輪嗎？";
            }
            els.winLayer.hidden = false;
          }
        }
      }, 460);
    } else {
      inputLocked = true;
      a.el.classList.remove("selected");
      a.el.classList.add("shake");
      b.el.classList.add("shake");
      selected = null;
      playSfx(sfxError);

      const unlock = function () {
        a.el.classList.remove("shake");
        b.el.classList.remove("shake");
        inputLocked = false;
      };
      a.el.addEventListener("animationend", unlock, { once: true });
      window.setTimeout(unlock, 450);
    }
  }

  els.btnSettings.addEventListener("click", openSettings);
  els.btnClose.addEventListener("click", closeSettings);
  els.modal.addEventListener("click", function (e) {
    if (e.target === els.modal) closeSettings();
  });

  els.bankText.addEventListener("input", updateParsePreview);
  els.levelMode.addEventListener("change", syncSettingsLevelRows);
  els.pairsPerLevel.addEventListener("change", updateLevelCapHint);
  els.totalLevels.addEventListener("change", updateLevelCapHint);

  els.btnSave.addEventListener("click", function () {
    bankText = els.bankText.value;
    pairsPerRound = parseInt(els.pairsSelect.value, 10) || 4;
    levelMode = els.levelMode.checked;
    pairsPerLevel = parseInt(els.pairsPerLevel.value, 10) || 4;
    totalLevelsRequest = parseInt(els.totalLevels.value, 10) || 5;
    saveBankText(bankText);
    savePairsPerRound(pairsPerRound);
    saveLevelMode(levelMode);
    savePairsPerLevel(pairsPerLevel);
    saveTotalLevels(totalLevelsRequest);
    closeSettings();
    startSession();
  });

  els.btnDemo.addEventListener("click", function () {
    els.bankText.value = DEMO_BANK;
    updateParsePreview();
  });

  els.btnPickExcel.addEventListener("click", function () {
    els.excelInput.click();
  });

  els.excelInput.addEventListener("change", function () {
    const file = els.excelInput.files && els.excelInput.files[0];
    els.excelMsg.textContent = "";
    els.excelFilename.textContent = "";
    if (!file) return;
    els.excelFilename.textContent = "已選擇：" + file.name;
    parseExcelToLines(file)
      .then(function (lines) {
        if (!lines.length) {
          els.excelMsg.textContent =
            "未辨識到有效列（請確認第一欄詞語、第二欄解釋，或單欄使用 詞語/解釋）。";
          els.excelMsg.className = "parse-hint excel-msg";
          return;
        }
        els.bankText.value = lines.join("\n");
        els.excelMsg.textContent =
          "已匯入 " + lines.length + " 組，可再手動編輯後按「儲存並重新發牌」。";
        els.excelMsg.className = "parse-hint excel-msg parse-ok";
        updateParsePreview();
      })
      .catch(function (err) {
        els.excelMsg.textContent = err.message || "匯入失敗";
        els.excelMsg.className = "parse-hint excel-msg";
      });
    els.excelInput.value = "";
  });

  els.btnAgain.addEventListener("click", function () {
    startSession();
  });

  fillPairsSelect();
  fillPairsPerLevelSelect();
  fillTotalLevelsSelect();
  startSession();
})();

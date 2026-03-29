(function () {
  const STORAGE_BANK = "word-match-bank-text";
  const STORAGE_PAIRS = "word-match-pairs-per-round";

  const DEMO_BANK = `勇敢/遇到困難也不退縮
開心/心裡很快樂的感覺
專心/做事很認真、不分心
朋友/互相幫助、一起玩的人
春天/天氣變暖、花草長出來的季節`;

  const PAIR_CHOICES = [3, 4, 5, 6, 8];

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
        id: `p${pairs.length}`,
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

  const els = {
    board: document.getElementById("board"),
    hint: document.getElementById("hint"),
    btnSettings: document.getElementById("btn-settings"),
    modal: document.getElementById("settings-modal"),
    bankText: document.getElementById("bank-text"),
    pairsSelect: document.getElementById("pairs-select"),
    parseHint: document.getElementById("parse-hint"),
    btnSave: document.getElementById("btn-save-settings"),
    btnDemo: document.getElementById("btn-restore-demo"),
    btnClose: document.getElementById("btn-close-settings"),
    winLayer: document.getElementById("win-layer"),
    btnAgain: document.getElementById("btn-play-again"),
  };

  let bankText = loadBankText();
  let pairsPerRound = loadPairsPerRound();
  /** @type {Pair[]} */
  let roundPairs = [];
  /** @type {{ el: HTMLElement, side: 'left'|'right', pairId: string } | null} */
  let selected = null;
  let inputLocked = false;

  function fillPairsSelect() {
    els.pairsSelect.innerHTML = PAIR_CHOICES.map(
      (n) =>
        `<option value="${n}" ${n === pairsPerRound ? "selected" : ""}>${n} 組</option>`
    ).join("");
  }

  function openSettings() {
    els.bankText.value = bankText;
    els.pairsSelect.value = String(pairsPerRound);
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
      els.parseHint.textContent = `有 ${invalid} 行格式不完整，已略過（需為：詞語/解釋）`;
      els.parseHint.className = "parse-hint";
    } else if (pairs.length === 0) {
      els.parseHint.textContent = "尚未輸入有效題組";
      els.parseHint.className = "parse-hint";
    } else {
      els.parseHint.textContent = `目前可配對 ${pairs.length} 組`;
      els.parseHint.className = "parse-hint parse-ok";
    }
  }

  function pickRoundPairs(allPairs) {
    const want = pairsPerRound;
    const n = Math.min(want, allPairs.length);
    return shuffle([...allPairs]).slice(0, n);
  }

  function clearSelectionVisual() {
    document.querySelectorAll(".card.selected").forEach((c) => {
      c.classList.remove("selected");
    });
    selected = null;
  }

  function startRound() {
    const { pairs } = parseBank(bankText);
    roundPairs = pickRoundPairs(pairs.length ? pairs : parseBank(DEMO_BANK).pairs);
    selected = null;
    inputLocked = false;
    els.winLayer.hidden = true;
    renderBoard();
  }

  function renderBoard() {
    const left = shuffle(roundPairs.map((p) => ({ ...p })));
    const right = shuffle(roundPairs.map((p) => ({ ...p })));

    els.board.innerHTML = `
      <div class="col" data-side="left">
        <div class="col-label left">詞語</div>
        <div class="col-cards" id="col-left"></div>
      </div>
      <div class="col" data-side="right">
        <div class="col-label right">解釋</div>
        <div class="col-cards" id="col-right"></div>
      </div>
    `;

    const colLeft = document.getElementById("col-left");
    const colRight = document.getElementById("col-right");

    left.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "card left-side";
      div.dataset.pairId = p.id;
      div.dataset.side = "left";
      div.style.animationDelay = `${i * 0.05}s`;
      div.textContent = p.word;
      colLeft.appendChild(div);
    });

    right.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "card right-side";
      div.dataset.pairId = p.id;
      div.dataset.side = "right";
      div.style.animationDelay = `${i * 0.05}s`;
      div.textContent = p.meaning;
      colRight.appendChild(div);
    });

    els.board.querySelectorAll(".card").forEach((card) => {
      card.addEventListener("click", onCardClick);
    });
  }

  /**
   * @param {HTMLElement} el
   * @param {'left'|'right'} side
   * @param {string} pairId
   */
  function onCardClick(ev) {
    const el = ev.currentTarget;
    if (!(el instanceof HTMLElement)) return;
    if (inputLocked || el.classList.contains("popping") || el.classList.contains("matched"))
      return;

    const side = /** @type {'left'|'right'} */ (el.dataset.side);
    const pairId = el.dataset.pairId || "";

    if (!selected) {
      el.classList.add("selected");
      selected = { el, side, pairId };
      return;
    }

    if (selected.side === side) {
      document.querySelectorAll(".card.selected").forEach((c) => c.classList.remove("selected"));
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

      setTimeout(() => {
        a.el.classList.add("matched");
        b.el.classList.add("matched");
        a.el.classList.remove("popping");
        b.el.classList.remove("popping");
        inputLocked = false;
        if (!document.querySelector(".card:not(.matched)")) {
          els.winLayer.hidden = false;
        }
      }, 460);
    } else {
      inputLocked = true;
      a.el.classList.remove("selected");
      a.el.classList.add("shake");
      b.el.classList.add("shake");
      selected = null;
      const unlock = () => {
        a.el.classList.remove("shake");
        b.el.classList.remove("shake");
        inputLocked = false;
      };
      a.el.addEventListener("animationend", unlock, { once: true });
      setTimeout(unlock, 450);
    }
  }

  els.btnSettings.addEventListener("click", openSettings);
  els.btnClose.addEventListener("click", closeSettings);
  els.modal.addEventListener("click", (e) => {
    if (e.target === els.modal) closeSettings();
  });

  els.bankText.addEventListener("input", updateParsePreview);

  els.btnSave.addEventListener("click", () => {
    bankText = els.bankText.value;
    pairsPerRound = parseInt(els.pairsSelect.value, 10) || 4;
    saveBankText(bankText);
    savePairsPerRound(pairsPerRound);
    closeSettings();
    startRound();
  });

  els.btnDemo.addEventListener("click", () => {
    els.bankText.value = DEMO_BANK;
    updateParsePreview();
  });

  els.btnAgain.addEventListener("click", () => {
    startRound();
  });

  fillPairsSelect();
  startRound();
})();

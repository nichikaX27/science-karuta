/* =====================================
   医薬品構造式かるた — アプリロジック
===================================== */

const STORAGE_KEY = 'karuta_known';
const HINT_MODE_KEY = 'karuta_hint_mode';

// ---- 状態 ----
let allCards     = [];   // data.json から読み込んだ全カード
let playlist     = [];   // 現在の表示順リスト（card index の配列）
let playIndex    = 0;    // playlist 内の現在位置
let isFlipped    = false;
let knownIds     = new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
let hintFirst    = JSON.parse(localStorage.getItem(HINT_MODE_KEY) || 'false');
let unknownOnly  = false;
let shuffleMode  = false;

// ---- DOM ----
const cardEl       = document.getElementById('card');
const cardScene    = document.getElementById('cardScene');
const structureImg = document.getElementById('structureImg');
const hintImg      = document.getElementById('hintImg');
const cardNumFront = document.getElementById('cardNumFront');
const cardNumBack  = document.getElementById('cardNumBack');
const cardCounter  = document.getElementById('cardCounter');
const progressBar  = document.getElementById('progressBar');
const statsEl      = document.getElementById('stats');
const cardGrid     = document.getElementById('cardGrid');

const btnPrev        = document.getElementById('btnPrev');
const btnNext        = document.getElementById('btnNext');
const btnKnown       = document.getElementById('btnKnown');
const btnUnknown     = document.getElementById('btnUnknown');
const btnReset       = document.getElementById('btnReset');
const btnShowHint    = document.getElementById('btnShowHint');
const chkUnknownOnly = document.getElementById('chkUnknownOnly');
const chkShuffle     = document.getElementById('chkShuffle');

// ---- 初期化 ----
async function init() {
  const res = await fetch('data.json');
  allCards   = await res.json();

  buildPlaylist();
  buildGrid();
  renderCard();
  updateProgress();

  // ヒントモードボタン初期ラベル
  updateHintModeLabel();
}

// ---- プレイリスト構築 ----
function buildPlaylist() {
  let src = allCards.map((_, i) => i);
  if (unknownOnly) src = src.filter(i => !knownIds.has(allCards[i].id));
  if (shuffleMode) src = shuffle(src);
  playlist  = src;
  playIndex = 0;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- カード描画 ----
function renderCard() {
  if (playlist.length === 0) {
    structureImg.src = '';
    hintImg.src      = '';
    cardNumFront.textContent = cardNumBack.textContent = '';
    cardCounter.textContent  = '0 / 0';
    cardScene.className      = 'card-scene';
    return;
  }

  const idx  = playlist[playIndex];
  const card = allCards[idx];
  const num  = `医薬品 No.${String(card.id).padStart(2, '0')}`;

  // 表面と裏面を hintFirst モードで切り替え
  const frontLabel = cardEl.querySelector('.card-front .card-label');
  const backLabel  = cardEl.querySelector('.card-back .card-label');
  if (hintFirst) {
    frontLabel.textContent = '読み札（ヒント）';
    backLabel.textContent  = '取り札（構造式）';
    structureImg.src = card.hint;
    hintImg.src      = card.structure;
  } else {
    frontLabel.textContent = '取り札（構造式）';
    backLabel.textContent  = '読み札（ヒント）';
    structureImg.src = card.structure;
    hintImg.src      = card.hint;
  }

  cardNumFront.textContent = num;
  cardNumBack.textContent  = num;

  // 習得済みバッジ
  cardScene.className = 'card-scene' + (knownIds.has(card.id) ? ' known' : '');

  // フリップをリセット
  setFlipped(false);

  // カウンタ
  cardCounter.textContent = `${playIndex + 1} / ${playlist.length}`;

  // グリッドのアクティブ表示
  document.querySelectorAll('.grid-thumb').forEach(el => {
    el.classList.toggle('active', parseInt(el.dataset.id) === card.id);
  });
}

function setFlipped(v) {
  isFlipped = v;
  cardEl.classList.toggle('flipped', v);
}

// ---- ナビゲーション ----
function goNext() {
  if (playlist.length === 0) return;
  playIndex = (playIndex + 1) % playlist.length;
  renderCard();
}

function goPrev() {
  if (playlist.length === 0) return;
  playIndex = (playIndex - 1 + playlist.length) % playlist.length;
  renderCard();
}

function jumpToCard(id) {
  const idx = playlist.findIndex(i => allCards[i].id === id);
  if (idx !== -1) {
    playIndex = idx;
    renderCard();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

// ---- 習得マーク ----
function markKnown(id) {
  knownIds.add(id);
  saveKnown();
  updateProgress();
  updateGridThumb(id);
  cardScene.className = 'card-scene known';
}

function markUnknown(id) {
  knownIds.delete(id);
  saveKnown();
  updateProgress();
  updateGridThumb(id);
  cardScene.className = 'card-scene';
}

function saveKnown() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...knownIds]));
}

// ---- 進捗更新 ----
function updateProgress() {
  const pct = allCards.length > 0 ? (knownIds.size / allCards.length) * 100 : 0;
  progressBar.style.width = pct + '%';
  statsEl.textContent     = `${knownIds.size} / ${allCards.length} 習得`;
}

// ---- グリッド構築 ----
function buildGrid() {
  cardGrid.innerHTML = '';
  allCards.forEach(card => {
    const div = document.createElement('div');
    div.className  = 'grid-thumb' + (knownIds.has(card.id) ? ' known' : '');
    div.dataset.id = card.id;

    const img   = document.createElement('img');
    img.src     = card.structure;
    img.alt     = `医薬品 ${card.id}`;
    img.loading = 'lazy';

    const num   = document.createElement('div');
    num.className   = 'thumb-num';
    num.textContent = card.id;

    const check   = document.createElement('div');
    check.className   = 'thumb-check';
    check.textContent = '✓';

    div.appendChild(img);
    div.appendChild(num);
    div.appendChild(check);
    div.addEventListener('click', () => jumpToCard(card.id));
    cardGrid.appendChild(div);
  });
}

function updateGridThumb(id) {
  const thumb = cardGrid.querySelector(`[data-id="${id}"]`);
  if (thumb) thumb.classList.toggle('known', knownIds.has(id));
}

// ---- ヒントモード ----
function updateHintModeLabel() {
  btnShowHint.textContent = hintFirst ? '構造式を先に表示' : 'ヒントを先に表示';
}

// ---- イベント ----
cardScene.addEventListener('click', () => setFlipped(!isFlipped));

btnNext.addEventListener('click', (e) => { e.stopPropagation(); goNext(); });
btnPrev.addEventListener('click', (e) => { e.stopPropagation(); goPrev(); });

btnKnown.addEventListener('click', (e) => {
  e.stopPropagation();
  if (playlist.length === 0) return;
  const id = allCards[playlist[playIndex]].id;
  markKnown(id);
  goNext();
});

btnUnknown.addEventListener('click', (e) => {
  e.stopPropagation();
  if (playlist.length === 0) return;
  const id = allCards[playlist[playIndex]].id;
  markUnknown(id);
  goNext();
});

btnReset.addEventListener('click', () => {
  if (!confirm('学習の進捗をすべてリセットしますか？')) return;
  knownIds.clear();
  saveKnown();
  updateProgress();
  document.querySelectorAll('.grid-thumb').forEach(el => el.classList.remove('known'));
  renderCard();
});

btnShowHint.addEventListener('click', () => {
  hintFirst = !hintFirst;
  localStorage.setItem(HINT_MODE_KEY, JSON.stringify(hintFirst));
  updateHintModeLabel();
  renderCard();
});

chkUnknownOnly.addEventListener('change', () => {
  unknownOnly = chkUnknownOnly.checked;
  buildPlaylist();
  renderCard();
});

chkShuffle.addEventListener('change', () => {
  shuffleMode = chkShuffle.checked;
  buildPlaylist();
  renderCard();
});

// キーボード操作
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
  else if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    setFlipped(!isFlipped);
  } else if (e.key === 'k' || e.key === 'K') {
    if (playlist.length > 0) { markKnown(allCards[playlist[playIndex]].id); goNext(); }
  } else if (e.key === 'u' || e.key === 'U') {
    if (playlist.length > 0) { markUnknown(allCards[playlist[playIndex]].id); goNext(); }
  }
});

// スワイプ対応
let touchStartX = 0;
cardScene.addEventListener('touchstart', (e) => {
  touchStartX = e.changedTouches[0].clientX;
}, { passive: true });
cardScene.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (Math.abs(dx) > 50) {
    dx < 0 ? goNext() : goPrev();
  }
}, { passive: true });

// ---- 起動 ----
init();

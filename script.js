const KARUTA_DATA = [
  { id: 1, yomifuda: "ちはやぶる 神代もきかず 竜田川", torifuda: "からくれなゐに 水くくるとは" },
  { id: 2, yomifuda: "春過ぎて 夏来にけらし 白妙の", torifuda: "衣ほすてふ 天の香具山" },
  { id: 3, yomifuda: "あしびきの 山鳥の尾の しだり尾の", torifuda: "ながながし夜を ひとりかも寝む" },
  { id: 4, yomifuda: "田子の浦に うち出でてみれば 白妙の", torifuda: "富士の高嶺に 雪は降りつつ" },
  { id: 5, yomifuda: "奥山に 紅葉踏みわけ 鳴く鹿の", torifuda: "声きく時ぞ 秋は悲しき" },
  { id: 6, yomifuda: "かささぎの 渡せる橋に おく霜の", torifuda: "白きを見れば 夜ぞ更けにける" },
  { id: 7, yomifuda: "天の原 ふりさけ見れば 春日なる", torifuda: "三笠の山に 出でし月かも" },
  { id: 8, yomifuda: "わが庵は 都のたつみ しかぞ住む", torifuda: "世をうぢ山と 人はいふなり" },
  { id: 9, yomifuda: "花の色は うつりにけりな いたづらに", torifuda: "わが身世にふる ながめせしまに" },
  { id: 10, yomifuda: "これやこの 行くも帰るも 別れては", torifuda: "知るも知らぬも 逢坂の関" },
  { id: 11, yomifuda: "わたの原 八十島かけて 漕ぎ出でぬと", torifuda: "人には告げよ あまの釣舟" },
  { id: 12, yomifuda: "天つ風 雲の通ひ路 吹きとぢよ", torifuda: "をとめの姿 しばしとどめむ" },
  { id: 13, yomifuda: "筑波嶺の 峰より落つる みなの川", torifuda: "恋ぞつもりて 淵となりぬる" },
  { id: 14, yomifuda: "陸奥の しのぶもぢずり 誰ゆゑに", torifuda: "乱れそめにし 我ならなくに" },
  { id: 15, yomifuda: "君がため 春の野に出でて 若菜つむ", torifuda: "わが衣手に 雪は降りつつ" },
  { id: 16, yomifuda: "立ち別れ いなばの山の 峰に生ふる", torifuda: "まつとし聞かば 今帰り来む" },
  { id: 17, yomifuda: "ちはやぶる 神代もきかず 龍田川", torifuda: "からくれなゐに 水くくるとは" },
  { id: 18, yomifuda: "住の江の 岸に寄る波 よるさへや", torifuda: "夢の通ひ路 人目よくらむ" },
  { id: 19, yomifuda: "難波潟 短き蘆の ふしの間も", torifuda: "逢はでこの世を 過ぐしてよとや" },
  { id: 20, yomifuda: "わびぬれば 今はた同じ 難波なる", torifuda: "みをつくしても 逢はむとぞ思ふ" }
];

const TOTAL_QUESTIONS = 10;
const CHOICE_COUNT = 8;

const state = {
  pool: [],
  current: null,
  questionIndex: 0,
  score: 0,
  miss: 0,
  startedAt: null,
  timerId: null,
  finished: false
};

const roundEl = document.getElementById("round");
const scoreEl = document.getElementById("score");
const missEl = document.getElementById("miss");
const timeEl = document.getElementById("time");
const promptEl = document.getElementById("prompt");
const hintEl = document.getElementById("hint");
const cardsEl = document.getElementById("cards");
const resultEl = document.getElementById("result");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function formatTime(ms) {
  return (ms / 1000).toFixed(1).padStart(4, "0");
}

function updateStatus() {
  roundEl.textContent = `${state.questionIndex} / ${TOTAL_QUESTIONS}`;
  scoreEl.textContent = String(state.score);
  missEl.textContent = String(state.miss);
}

function updateTimer() {
  if (!state.startedAt) {
    timeEl.textContent = "00.0";
    return;
  }
  const elapsed = Date.now() - state.startedAt;
  timeEl.textContent = formatTime(elapsed);
}

function renderCards(choices) {
  cardsEl.innerHTML = "";

  choices.forEach((item) => {
    const button = document.createElement("button");
    button.className = "card";
    button.type = "button";
    button.setAttribute("role", "listitem");
    button.textContent = item.torifuda;

    button.addEventListener("click", () => {
      if (state.finished || !state.current) {
        return;
      }

      const isCorrect = item.id === state.current.id;
      if (isCorrect) {
        state.score += 1;
        hintEl.textContent = "正解！ 次の札へ。";
        button.classList.add("ok");
        disableCards();
        setTimeout(nextQuestion, 420);
      } else {
        state.miss += 1;
        hintEl.textContent = "お手つき！ もう一度。";
        button.classList.add("ng");
        setTimeout(() => {
          button.classList.remove("ng");
        }, 260);
      }

      updateStatus();
    });

    cardsEl.appendChild(button);
  });
}

function disableCards() {
  const buttons = cardsEl.querySelectorAll("button");
  buttons.forEach((btn) => {
    btn.disabled = true;
  });
}

function pickChoices(answer) {
  const others = shuffle(KARUTA_DATA.filter((item) => item.id !== answer.id)).slice(0, CHOICE_COUNT - 1);
  return shuffle([answer, ...others]);
}

function nextQuestion() {
  if (state.questionIndex >= TOTAL_QUESTIONS) {
    finishGame();
    return;
  }

  state.current = state.pool[state.questionIndex];
  state.questionIndex += 1;

  promptEl.textContent = `「${state.current.yomifuda}」`;
  hintEl.textContent = "取り札を選んでください";

  const choices = pickChoices(state.current);
  renderCards(choices);
  updateStatus();
}

function startGame() {
  state.pool = shuffle(KARUTA_DATA).slice(0, TOTAL_QUESTIONS);
  state.current = null;
  state.questionIndex = 0;
  state.score = 0;
  state.miss = 0;
  state.finished = false;
  state.startedAt = Date.now();

  if (state.timerId) {
    clearInterval(state.timerId);
  }

  state.timerId = setInterval(updateTimer, 100);
  updateTimer();
  updateStatus();

  resultEl.classList.add("hidden");
  resultEl.innerHTML = "";
  startBtn.disabled = true;
  restartBtn.disabled = false;

  nextQuestion();
}

function finishGame() {
  state.finished = true;
  disableCards();

  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }

  const elapsed = Date.now() - state.startedAt;
  const accuracy = Math.round((state.score / (state.score + state.miss || 1)) * 100);

  promptEl.textContent = "おつかれさま！";
  hintEl.textContent = "結果を確認してもう一度挑戦できます。";

  resultEl.classList.remove("hidden");
  resultEl.innerHTML = `
    <h3>結果</h3>
    <p>クリアタイム: <strong>${formatTime(elapsed)} 秒</strong></p>
    <p>正解: <strong>${state.score}</strong> / ${TOTAL_QUESTIONS}</p>
    <p>ミス: <strong>${state.miss}</strong></p>
    <p>正答率: <strong>${accuracy}%</strong></p>
  `;

  startBtn.disabled = false;
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
updateStatus();
updateTimer();

// ── State ──────────────────────────────────────────────────────────────────
let known = {};
try { known = JSON.parse(localStorage.getItem('vocab_known') || '{}'); } catch (e) {}
function saveKnown() { try { localStorage.setItem('vocab_known', JSON.stringify(known)); } catch (e) {} }

let fcPool = [], fcIdx = 0, fcFlipped = false, currentWord = null;
let qPool = [], qIdx = 0, qCorrect = 0, qAnswered = false;
let fPool = [], fIdx = 0, fCorrect = 0, fLastWord = null;
let activeSpeakBtnId = null;

// ── Helpers ────────────────────────────────────────────────────────────────
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getPool(selId) {
  const lv = parseInt(document.getElementById(selId).value);
  return lv === 0 ? [...VOCAB] : VOCAB.filter(w => w[3] === lv);
}

function openMW() {
  if (!currentWord) return;
  const url = 'https://www.merriam-webster.com/dictionary/' + encodeURIComponent(currentWord[0]);
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ── Speech ─────────────────────────────────────────────────────────────────
function speakText(text, btnId) {
  if (!window.speechSynthesis || !text) return;
  if (activeSpeakBtnId && activeSpeakBtnId !== btnId) {
    const prev = document.getElementById(activeSpeakBtnId);
    if (prev) prev.classList.remove('speaking');
  }
  const btn = document.getElementById(btnId);
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    if (activeSpeakBtnId === btnId) {
      if (btn) btn.classList.remove('speaking');
      activeSpeakBtnId = null;
      return;
    }
  }
  activeSpeakBtnId = btnId;
  if (btn) btn.classList.add('speaking');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US'; u.rate = 0.88;
  u.onend = () => { if (btn) btn.classList.remove('speaking'); if (activeSpeakBtnId === btnId) activeSpeakBtnId = null; };
  u.onerror = () => { if (btn) btn.classList.remove('speaking'); if (activeSpeakBtnId === btnId) activeSpeakBtnId = null; };
  window.speechSynthesis.speak(u);
}

function stopSpeech() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (activeSpeakBtnId) {
    const b = document.getElementById(activeSpeakBtnId);
    if (b) b.classList.remove('speaking');
    activeSpeakBtnId = null;
  }
}

// ── Flashcard ──────────────────────────────────────────────────────────────
function initFC() {
  fcPool = shuffle(getPool('fc-level'));
  fcIdx = 0; fcFlipped = false; showCard();
}

function showCard() {
  if (!fcPool.length) return;
  stopSpeech();
  const w = fcPool[fcIdx % fcPool.length];
  currentWord = w;
  const dir = document.getElementById('fc-dir').value;
  fcFlipped = false;
  document.getElementById('fc-front').style.display = 'block';
  document.getElementById('fc-back').style.display = 'none';
  document.getElementById('fc-speak-word').style.display = dir === 'en' ? 'inline-flex' : 'none';
  document.getElementById('fc-word').textContent = dir === 'en' ? w[0] : w[2];
  document.getElementById('fc-pos').textContent = w[1];
  document.getElementById('fc-meaning').textContent = dir === 'en' ? w[2] : w[0];
  document.getElementById('fc-ex-en').textContent = w[4];
  document.getElementById('fc-ex-zh').textContent = w[5];
  document.getElementById('fc-lv').textContent = 'Lv ' + w[3];
  const tot = fcPool.length, cur = (fcIdx % tot) + 1;
  document.getElementById('fc-prog').textContent = cur + ' / ' + tot;
  document.getElementById('fc-bar').style.width = (cur / tot * 100) + '%';
}

function flipCard() {
  fcFlipped = !fcFlipped;
  document.getElementById('fc-front').style.display = fcFlipped ? 'none' : 'block';
  const back = document.getElementById('fc-back');
  if (fcFlipped) {
    back.style.display = 'flex';
    const dir = document.getElementById('fc-dir').value;
    if (dir === 'zh' && currentWord) speakText(currentWord[0], 'fc-speak-word');
  } else {
    back.style.display = 'none';
  }
}

function nextFC() { stopSpeech(); fcIdx = (fcIdx + 1) % fcPool.length; showCard(); }

function markCard(ok) {
  if (currentWord) { known[currentWord[0]] = ok; saveKnown(); }
  nextFC(); updateProgress();
}

// ── Quiz ───────────────────────────────────────────────────────────────────
function startQuiz() {
  qPool = shuffle(getPool('q-level'));
  qIdx = 0; qCorrect = 0; qAnswered = false;
  document.getElementById('q-score').textContent = '';
  document.getElementById('q-feedback').textContent = '';
  showQuiz();
}

function showQuiz() {
  stopSpeech();
  if (qIdx >= qPool.length) {
    document.getElementById('q-word').textContent = '測驗結束！';
    document.getElementById('q-opts').innerHTML = '';
    document.getElementById('q-score').textContent = '得分：' + qCorrect + ' / ' + qPool.length;
    document.getElementById('q-feedback').textContent = '';
    return;
  }
  const w = qPool[qIdx];
  document.getElementById('q-word').textContent = w[0];
  document.getElementById('q-feedback').textContent = '';
  qAnswered = false;
  const distractors = shuffle(VOCAB.filter(x => x[0] !== w[0])).slice(0, 3);
  const opts = shuffle([w, ...distractors]);
  const container = document.getElementById('q-opts');
  container.innerHTML = '';
  opts.forEach(o => {
    const div = document.createElement('div');
    div.className = 'qopt';
    div.textContent = o[2];
    div.dataset.word = o[0];
    div.addEventListener('click', function () { handleQuizClick(this, w[0]); });
    container.appendChild(div);
  });
  document.getElementById('q-prog').textContent = (qIdx + 1) + ' / ' + qPool.length;
  document.getElementById('q-bar').style.width = ((qIdx + 1) / qPool.length * 100) + '%';
  document.getElementById('q-score').textContent = '答對：' + qCorrect + ' / ' + qIdx;
}

function handleQuizClick(el, correctWord) {
  if (qAnswered) return;
  qAnswered = true;
  document.querySelectorAll('.qopt').forEach(opt => {
    opt.classList.add('disabled');
    if (opt.dataset.word === correctWord) opt.classList.add('correct');
    else if (opt === el && opt.dataset.word !== correctWord) opt.classList.add('wrong');
  });
  const ok = el.dataset.word === correctWord;
  document.getElementById('q-feedback').textContent = ok ? '✓ 正確！' : '✕ 錯誤，正確答案已標示';
  document.getElementById('q-feedback').className = 'feedback ' + (ok ? 'ok' : 'bad');
  if (ok) { qCorrect++; known[correctWord] = true; saveKnown(); speakText(correctWord, 'q-speak-word'); }
  setTimeout(() => { qIdx++; showQuiz(); }, 1300);
}

// ── Fill ───────────────────────────────────────────────────────────────────
function startFill() {
  fPool = shuffle(getPool('f-level'));
  fIdx = 0; fCorrect = 0; fLastWord = null;
  document.getElementById('f-score').textContent = '';
  document.getElementById('f-speak-btn').style.display = 'none';
  showFill();
}

function showFill() {
  document.getElementById('f-speak-btn').style.display = 'none';
  if (fIdx >= fPool.length) {
    document.getElementById('f-meaning').textContent = '拼字測驗結束！';
    document.getElementById('f-pos').textContent = '';
    document.getElementById('f-hint').textContent = '';
    document.getElementById('f-input').value = '';
    document.getElementById('f-feedback').textContent = '';
    document.getElementById('f-score').textContent = '得分：' + fCorrect + ' / ' + fPool.length;
    return;
  }
  const w = fPool[fIdx];
  document.getElementById('f-meaning').textContent = w[2];
  document.getElementById('f-pos').textContent = w[1];
  document.getElementById('f-hint').textContent = '';
  document.getElementById('f-input').value = '';
  document.getElementById('f-feedback').textContent = '';
  document.getElementById('f-input').focus();
  document.getElementById('f-prog').textContent = (fIdx + 1) + ' / ' + fPool.length;
  document.getElementById('f-bar').style.width = ((fIdx + 1) / fPool.length * 100) + '%';
  document.getElementById('f-score').textContent = '答對：' + fCorrect + ' / ' + fIdx;
}

function checkFill() {
  if (fIdx >= fPool.length) return;
  const w = fPool[fIdx];
  const val = document.getElementById('f-input').value.trim().toLowerCase();
  const ok = val === w[0].toLowerCase();
  document.getElementById('f-feedback').textContent = ok ? '✓ 正確！' : '✕ 錯誤，正確拼法：' + w[0];
  document.getElementById('f-feedback').className = 'feedback ' + (ok ? 'ok' : 'bad');
  fLastWord = w;
  document.getElementById('f-speak-btn').style.display = 'inline-flex';
  if (ok) { fCorrect++; known[w[0]] = true; saveKnown(); speakText(w[0], 'f-speak-btn'); }
  fIdx++;
  setTimeout(() => { showFill(); }, 1500);
}

function revealFill() {
  if (fIdx >= fPool.length) return;
  const w = fPool[fIdx];
  document.getElementById('f-hint').textContent = '提示：' + w[0].substring(0, Math.ceil(w[0].length / 2)) + '...';
}

// ── Progress ───────────────────────────────────────────────────────────────
function updateProgress() {
  const learned = Object.values(known).filter(v => v).length;
  const review  = Object.values(known).filter(v => !v).length;
  document.getElementById('s-learned').textContent = learned;
  document.getElementById('s-review').textContent  = review;
  document.getElementById('s-total').textContent   = VOCAB.length;
  const html = [1, 2, 3, 4, 5, 6].map(lv => {
    const words = VOCAB.filter(w => w[3] === lv);
    const done  = words.filter(w => known[w[0]] === true).length;
    const pct   = words.length ? Math.round(done / words.length * 100) : 0;
    return `<div class="lvl-row">
      <span class="lvl-tag">Lv ${lv}</span>
      <div style="flex:1"><div class="pbar-wrap"><div class="pbar" style="width:${pct}%"></div></div></div>
      <span style="font-size:12px;color:var(--text-sec);min-width:72px;text-align:right">${done}/${words.length} (${pct}%)</span>
    </div>`;
  }).join('');
  document.getElementById('lvl-progress').innerHTML = html;
}

function resetProgress() { known = {}; saveKnown(); updateProgress(); }

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(name, el) {
  stopSpeech();
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  el.classList.add('active');
  document.getElementById('screen-' + name).classList.add('active');
  if (name === 'progress') updateProgress();
}

// ── Init ───────────────────────────────────────────────────────────────────
initFC();
startQuiz();
startFill();
updateProgress();

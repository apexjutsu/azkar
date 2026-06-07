const EVENING_START_HOUR = 15;
const STREAK_KEY = 'azkar_streak';
const SETTINGS_KEY = 'azkar_settings';
const ARABIC_SCALE_MIN = 0.8;
const ARABIC_SCALE_MAX = 1.8;
const ARABIC_SCALE_STEP = 0.1;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICON = {
  flame: '<svg class="ico-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
  check: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>'
};

function initialTab() {
  return new Date().getHours() >= EVENING_START_HOUR ? 'evening' : 'morning';
}

let currentTab = initialTab();

/* theme: single dark (graphite + gold) — light theme and toggle removed */

const STORAGE_KEY = 'azkar_progress';
const MORNING_DATE_KEY = 'azkar_m_date';
const EVENING_DATE_KEY = 'azkar_e_date';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

/* local calendar date (used for per-period resets, not UTC) */
function localDateStr(d) {
  d = d || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

/* Reset each set when its reading time arrives:
   morning azkars reset at local midnight (new day),
   evening azkars reset at local 15:00. Returns true if anything was cleared. */
function applyPeriodResets() {
  let progress;
  try { progress = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { progress = {}; }
  const today = localDateStr();
  const hour = new Date().getHours();
  let changed = false;

  if (localStorage.getItem(MORNING_DATE_KEY) !== today) {
    (azkar.morning || []).forEach(it => {
      if (it.id in progress) { delete progress[it.id]; changed = true; }
    });
    localStorage.setItem(MORNING_DATE_KEY, today);
  }
  if (hour >= EVENING_START_HOUR && localStorage.getItem(EVENING_DATE_KEY) !== today) {
    (azkar.evening || []).forEach(it => {
      if (it.id in progress) { delete progress[it.id]; changed = true; }
    });
    localStorage.setItem(EVENING_DATE_KEY, today);
  }
  if (changed) saveProgress(progress);
  return changed;
}

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

/* ── Settings: Arabic font size + transliteration ── */
function loadSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
  catch { return {}; }
}

function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function applyArabicSize(scale) {
  document.documentElement.style.setProperty('--arabic-scale', scale);
  const val = document.getElementById('arabic-size-val');
  if (val) val.textContent = Math.round(scale * 100) + '%';
}

function changeArabicSize(dir) {
  const s = loadSettings();
  let scale = s.arabicScale || 1;
  scale = Math.round((scale + dir * ARABIC_SCALE_STEP) * 10) / 10;
  scale = Math.min(ARABIC_SCALE_MAX, Math.max(ARABIC_SCALE_MIN, scale));
  s.arabicScale = scale;
  saveSettings(s);
  applyArabicSize(scale);
}

function applyTranslit(hidden) {
  document.body.classList.toggle('hide-translit', hidden);
  const btn = document.getElementById('translit-toggle');
  if (btn) btn.setAttribute('aria-checked', String(!hidden));
}

function toggleTranslit() {
  const s = loadSettings();
  const nowHidden = !s.hideTranslit;
  s.hideTranslit = nowHidden;
  saveSettings(s);
  applyTranslit(nowHidden);
}

function initSettings() {
  const s = loadSettings();
  applyArabicSize(s.arabicScale || 1);
  applyTranslit(!!s.hideTranslit);
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  const btn = document.getElementById('settings-toggle');
  if (!panel) return;
  if (panel.hasAttribute('hidden')) {
    panel.removeAttribute('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  } else {
    closeSettings();
  }
}

function closeSettings() {
  const panel = document.getElementById('settings-panel');
  const btn = document.getElementById('settings-toggle');
  if (panel && !panel.hasAttribute('hidden')) {
    panel.setAttribute('hidden', '');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

document.addEventListener('click', e => {
  const panel = document.getElementById('settings-panel');
  const btn = document.getElementById('settings-toggle');
  if (!panel || panel.hasAttribute('hidden')) return;
  if (panel.contains(e.target) || (btn && btn.contains(e.target))) return;
  closeSettings();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSettings();
});

/* ── Streak: consecutive days with a completed set ── */
function utcDateStr(d) {
  return d.toISOString().slice(0, 10);
}

function yesterdayStr() {
  return utcDateStr(new Date(Date.now() - 86400000));
}

function loadStreak() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { current: 0, best: 0, last: null }; }
  catch { return { current: 0, best: 0, last: null }; }
}

function saveStreak(s) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(s));
}

function displayStreak() {
  const s = loadStreak();
  const today = getTodayStr();
  if (s.last === today || s.last === yesterdayStr()) return s.current || 0;
  return 0;
}

function recordDayCompletion() {
  const s = loadStreak();
  const today = getTodayStr();
  if (s.last === today) return false;
  s.current = (s.last === yesterdayStr()) ? (s.current || 0) + 1 : 1;
  s.last = today;
  s.best = Math.max(s.best || 0, s.current);
  saveStreak(s);
  return true;
}

function dayWord(n) {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return 'день';
  if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return 'дня';
  return 'дней';
}

function zikrWord(n) {
  const d10 = n % 10, d100 = n % 100;
  if (d10 === 1 && d100 !== 11) return 'азкар';
  if (d10 >= 2 && d10 <= 4 && (d100 < 10 || d100 >= 20)) return 'азкара';
  return 'азкаров';
}

function renderStreak(bump) {
  const el = document.getElementById('streak');
  const countEl = document.getElementById('streak-count');
  if (!el || !countEl) return;
  const n = displayStreak();
  if (n >= 1) {
    countEl.textContent = n;
    el.hidden = false;
    el.setAttribute('title', n + ' ' + dayWord(n) + ' подряд');
    if (bump && !reduceMotion) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
  } else {
    el.hidden = true;
  }
}

/* ── Completion screen ── */
function showCompletion() {
  const screen = document.getElementById('completion-screen');
  if (!screen) return;
  const streakLine = document.getElementById('completion-streak');
  const n = displayStreak();
  if (streakLine) {
    if (n >= 1) {
      streakLine.innerHTML = ICON.flame + ' ' + n + ' ' + dayWord(n) + ' подряд';
      streakLine.hidden = false;
    } else {
      streakLine.hidden = true;
    }
  }
  screen.hidden = false;
  screen.setAttribute('aria-hidden', 'false');
}

function hideCompletion() {
  const screen = document.getElementById('completion-screen');
  if (!screen) return;
  screen.hidden = true;
  screen.setAttribute('aria-hidden', 'true');
}

function handleSetCompleted() {
  const newStreak = recordDayCompletion();
  renderStreak(newStreak);
  showCelebration();
  setTimeout(showCompletion, reduceMotion ? 0 : 350);
}

function syncTabUI() {
  document.querySelectorAll('.tab').forEach(t => {
    const on = t.dataset.tab === currentTab;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', String(on));
  });
}

/* ── Progress ── */
function computeProgress() {
  const items = azkar[currentTab];
  const progress = loadProgress();
  let done = 0;
  items.forEach(item => {
    if (item.count) {
      if ((progress[item.id] || 0) >= item.count.required) done++;
    } else if (progress[item.id]) {
      done++;
    }
  });
  return { done, total: items.length };
}

function updateOverallProgress() {
  const { done, total } = computeProgress();
  const pct = total ? Math.round((done / total) * 100) : 0;
  const fillEl = document.getElementById('progress-fill');
  const textEl = document.getElementById('progress-text');
  const barEl = document.getElementById('progress-bar');

  if (fillEl) fillEl.style.width = pct + '%';
  if (barEl) barEl.setAttribute('aria-valuenow', pct);

  if (textEl) {
    if (done === total) {
      textEl.textContent = 'все азкары выполнены';
      textEl.classList.add('all-done');
    } else {
      textEl.textContent = 'выполнено ' + done + ' из ' + total;
      textEl.classList.remove('all-done');
    }
  }

  return { done, total };
}

function showCelebration() {
  vibrate([50, 30, 50]);
  if (reduceMotion) return;

  const container = document.getElementById('celebration');
  if (!container) return;
  container.innerHTML = '';

  const colors = ['#c8a15a', '#e2c486', '#9c7c3d', '#f0ebe1', '#b5894a'];
  for (let i = 0; i < 30; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti';
    dot.style.left = Math.random() * 100 + '%';
    dot.style.top = '-5%';
    dot.style.background = colors[Math.floor(Math.random() * colors.length)];
    dot.style.animationDelay = Math.random() * 0.6 + 's';
    dot.style.width = (4 + Math.random() * 5) + 'px';
    dot.style.height = dot.style.width;
    container.appendChild(dot);
  }

  setTimeout(() => { container.innerHTML = ''; }, 2500);
}

/* ── Swipe deck ── */
const SWIPE_THRESHOLD = 70;
let currentIndex = 0;
let drag = null;

function firstUndoneIndex() {
  const items = azkar[currentTab];
  const progress = loadProgress();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const undone = it.count ? (progress[it.id] || 0) < it.count.required : !progress[it.id];
    if (undone) return i;
  }
  return items.length;
}

function startIndex() {
  return firstUndoneIndex();
}

function cardInnerHTML(item, index) {
  const progress = loadProgress();
  const saved = progress[item.id] || 0;
  const isDone = item.count ? saved >= item.count.required : !!saved;

  const pillHTML = item.count
    ? `<span class="card-pill">${item.count.required}×</span>`
    : `<span class="card-pill card-pill-read">чтение</span>`;
  const headHTML = `<div class="card-head"><span class="card-diamond">${index + 1}</span>${pillHTML}</div>`;

  let actionHTML = '';
  if (item.count) {
    const required = item.count.required;
    const pct = Math.min(100, Math.round((saved / required) * 100));
    actionHTML = `
      <hr class="divider" />
      <div class="counter-wrap">
        <div class="counter-progress-bar">
          <div class="counter-progress-fill" id="fill-${item.id}" style="width:${pct}%"></div>
        </div>
        <div class="counter-row">
          <div class="counter-display">
            <span id="cur-${item.id}">${saved}</span> / ${required}
            <span class="done-badge" id="badge-${item.id}"${isDone ? ' style="display:inline-flex"' : ''}>${ICON.check}выполнено</span>
          </div>
          <button class="counter-reset" onclick="resetCounter('${item.id}', ${required})" aria-label="Сбросить счётчик">сброс</button>
        </div>
        <button class="counter-btn-big" id="btn-${item.id}" onclick="increment('${item.id}', ${required})"${isDone ? ' disabled' : ''} aria-label="Добавить повторение">+ зикр</button>
        <div class="swipe-next-hint" id="hint-${item.id}"${isDone ? '' : ' hidden'}>готово ${ICON.check} — листай вправо →</div>
      </div>`;
  } else {
    actionHTML = `
      <hr class="divider" />
      <button class="read-next-btn${isDone ? ' is-read' : ''}" onclick="goNext()" aria-label="Прочитано, следующий">
        ${isDone ? ICON.check + ' прочитано — дальше' : 'прочитано — дальше →'}
      </button>`;
  }

  return `
    ${headHTML}
    ${item.note ? `<div class="note">${item.note}</div>` : ''}
    <div class="arabic">${item.arabic.replace(/\n/g, '<br>')}</div>
    ${item.transliteration ? `<div class="transliteration">${item.transliteration}</div><hr class="divider" />` : ''}
    <div class="translation">${item.translation}</div>
    ${item.source ? `<div class="source">${item.source}</div>` : ''}
    ${actionHTML}`;
}

function endCardHTML() {
  const { done, total } = computeProgress();
  const allDone = done === total;
  const n = displayStreak();

  if (allDone) {
    const streakHTML = n >= 1
      ? `<div class="end-streak">${ICON.flame} ${n} ${dayWord(n)} подряд</div>`
      : '';
    return `<div class="card swipe-card end-card enter">
      <div class="end-icon">${ICON.check}</div>
      <div class="end-title">ма ша Аллах</div>
      <div class="end-sub">все азкары выполнены</div>
      ${streakHTML}
      <div class="end-actions">
        <button class="end-btn end-btn-secondary" onclick="restartDeck()">пройти заново</button>
      </div>
    </div>`;
  }

  const left = total - done;
  return `<div class="card swipe-card end-card enter">
    <div class="end-icon end-icon-muted">•••</div>
    <div class="end-title">почти готово</div>
    <div class="end-sub">осталось ${left} ${zikrWord(left)}</div>
    <div class="end-actions">
      <button class="end-btn" onclick="goToFirstUndone()">к незавершённым</button>
      <button class="end-btn end-btn-secondary" onclick="restartDeck()">в начало</button>
    </div>
  </div>`;
}

function updateNav(index, total) {
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  const stack = document.getElementById('deck-stack');
  if (prev) prev.disabled = index <= 0;
  if (next) next.disabled = index >= total;
  if (stack) stack.dataset.stack = String(Math.max(0, Math.min(2, total - index - 1)));
  renderDots(index, total);
}

function renderDots(index, total) {
  const wrap = document.getElementById('deck-dots');
  if (!wrap) return;
  const items = azkar[currentTab];
  const progress = loadProgress();
  const half = Math.ceil(items.length / 2);
  let row1 = '', row2 = '';
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const done = it.count ? (progress[it.id] || 0) >= it.count.required : !!progress[it.id];
    let cls = 'dot';
    if (done) cls += ' done';
    if (i === index) cls += ' cur';
    const btn = `<button class="${cls}" onclick="jumpTo(${i})" aria-label="Азкар ${i + 1}"></button>`;
    if (i < half) row1 += btn; else row2 += btn;
  }
  wrap.innerHTML = '<div class="dot-row">' + row1 + '</div><div class="dot-row">' + row2 + '</div>';
}

function jumpTo(i) {
  const items = azkar[currentTab];
  if (i < 0 || i >= items.length || i === currentIndex) return;
  currentIndex = i;
  renderCard(i);
}

function renderCard(index) {
  const items = azkar[currentTab];
  const stack = document.getElementById('deck-stack');
  if (!stack) return;

  updateNav(index, items.length);
  updateOverallProgress();
  window.scrollTo({ top: 0, behavior: 'auto' });

  if (index >= items.length) {
    stack.innerHTML = endCardHTML();
    const endEl = stack.firstElementChild;
    if (endEl) { attachDrag(endEl); setTimeout(() => endEl.classList.remove('enter'), 450); }
    return;
  }

  const item = items[index];
  const card = document.createElement('div');
  card.className = 'card swipe-card enter';
  card.id = 'card-' + item.id;
  card.innerHTML = cardInnerHTML(item, index);
  stack.innerHTML = '';
  stack.appendChild(card);
  attachDrag(card);
  setTimeout(() => card.classList.remove('enter'), 450);
}

function markReadIfNeeded(item) {
  if (!item || item.count) return;
  const progress = loadProgress();
  if (progress[item.id]) return;
  progress[item.id] = 1;
  saveProgress(progress);
  vibrate([30, 20, 30]);
  const { done, total } = updateOverallProgress();
  if (done === total) handleSetCompleted();
}

function goNext(opts) {
  const items = azkar[currentTab];
  if (currentIndex >= items.length) return;
  markReadIfNeeded(items[currentIndex]);
  const style = opts && opts.swipe ? 'right' : 'genie';
  animateOut(style, () => {
    currentIndex = Math.min(items.length, currentIndex + 1);
    renderCard(currentIndex);
  });
}

function goPrev() {
  if (currentIndex <= 0) return;
  animateOut('left', () => {
    currentIndex = Math.max(0, currentIndex - 1);
    renderCard(currentIndex);
  });
}

function goToFirstUndone() {
  currentIndex = firstUndoneIndex();
  renderCard(currentIndex);
}

function restartDeck() {
  currentIndex = 0;
  renderCard(currentIndex);
}

function animateOut(style, cb) {
  const el = document.querySelector('.swipe-card');
  let ran = false;
  const run = () => { if (ran) return; ran = true; cb(); };
  if (!el || reduceMotion) { run(); return; }

  if (style === 'genie') {
    el.classList.add('genie-out');
    el.addEventListener('animationend', run, { once: true });
    setTimeout(run, 720);
    return;
  }

  el.classList.add('animating');
  requestAnimationFrame(() => {
    el.style.transform = style === 'right'
      ? 'translateX(120%) rotate(10deg)'
      : 'translateX(-120%) rotate(-10deg)';
    el.style.opacity = '0';
  });
  el.addEventListener('transitionend', run, { once: true });
  setTimeout(run, 380);
}

function snapBack(el) {
  if (!el) return;
  el.classList.add('animating');
  el.style.transform = '';
  el.style.opacity = '';
}

function attachDrag(card) {
  card.addEventListener('pointerdown', onPointerDown);
}

function onPointerDown(e) {
  if (e.button != null && e.button !== 0) return;
  if (e.target.closest('button, a')) return;
  const card = e.currentTarget;
  drag = { startX: e.clientX, startY: e.clientY, dx: 0, dy: 0, dir: null, el: card };
  card.classList.remove('animating');
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
}

function onPointerMove(e) {
  if (!drag) return;
  drag.dx = e.clientX - drag.startX;
  drag.dy = e.clientY - drag.startY;
  if (!drag.dir && (Math.abs(drag.dx) > 8 || Math.abs(drag.dy) > 8)) {
    drag.dir = Math.abs(drag.dx) > Math.abs(drag.dy) ? 'h' : 'v';
    if (drag.dir === 'h') drag.el.classList.add('dragging');
  }
  if (drag.dir === 'h') {
    const rot = reduceMotion ? 0 : drag.dx / 18;
    drag.el.style.transform = `translateX(${drag.dx}px) rotate(${rot}deg)`;
    drag.el.style.opacity = String(Math.max(0.35, 1 - Math.abs(drag.dx) / 700));
  }
}

function onPointerUp() {
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
  if (!drag) return;
  const { dx, dir, el } = drag;
  const items = azkar[currentTab];
  if (el) el.classList.remove('dragging');
  drag = null;

  if (dir === 'h' && dx >= SWIPE_THRESHOLD && currentIndex < items.length) {
    goNext({ swipe: true });
  } else if (dir === 'h' && dx <= -SWIPE_THRESHOLD && currentIndex > 0) {
    goPrev();
  } else {
    snapBack(el);
  }
}

function increment(id, required) {
  const progress = loadProgress();
  const current = (progress[id] || 0) + 1;
  progress[id] = current;
  saveProgress(progress);

  vibrate(15);

  const curEl = document.getElementById('cur-' + id);
  const fillEl = document.getElementById('fill-' + id);
  const btnEl = document.getElementById('btn-' + id);
  const badgeEl = document.getElementById('badge-' + id);
  const cardEl = document.getElementById('card-' + id);

  if (curEl) curEl.textContent = current;
  if (fillEl) fillEl.style.width = Math.min(100, Math.round((current / required) * 100)) + '%';

  if (current >= required) {
    if (btnEl) btnEl.disabled = true;
    if (badgeEl) badgeEl.style.display = 'inline-flex';
    if (cardEl && !reduceMotion) {
      cardEl.classList.add('just-done');
      setTimeout(() => cardEl.classList.remove('just-done'), 500);
    }
    vibrate([30, 20, 30]);
    const { done, total } = updateOverallProgress();
    if (done === total) handleSetCompleted();
    // auto-advance to the next azkar once the count is fully reached
    setTimeout(() => {
      const items = azkar[currentTab];
      const stillHere = items[currentIndex] && items[currentIndex].id === id;
      const stillDone = (loadProgress()[id] || 0) >= required;
      if (stillHere && stillDone && currentIndex < items.length) goNext();
    }, reduceMotion ? 300 : 480);
  } else {
    updateOverallProgress();
  }
}

function resetCounter(id, required) {
  const progress = loadProgress();
  progress[id] = 0;
  saveProgress(progress);

  const curEl = document.getElementById('cur-' + id);
  const fillEl = document.getElementById('fill-' + id);
  const btnEl = document.getElementById('btn-' + id);
  const badgeEl = document.getElementById('badge-' + id);
  const hintEl = document.getElementById('hint-' + id);

  if (curEl) curEl.textContent = 0;
  if (fillEl) fillEl.style.width = '0%';
  if (btnEl) btnEl.disabled = false;
  if (badgeEl) badgeEl.style.display = 'none';
  if (hintEl) hintEl.hidden = true;

  updateOverallProgress();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === currentTab) return;
    currentTab = btn.dataset.tab;
    applyPeriodResets();
    syncTabUI();
    currentIndex = startIndex();
    renderCard(currentIndex);
  });
});

document.addEventListener('keydown', e => {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  if (e.target && e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
  const panel = document.getElementById('settings-panel');
  if (panel && !panel.hasAttribute('hidden')) return;
  const items = azkar[currentTab];
  if (e.key === 'ArrowRight' && currentIndex < items.length) goNext();
  else if (e.key === 'ArrowLeft' && currentIndex > 0) goPrev();
});

initSettings();
applyPeriodResets();
syncTabUI();
renderStreak(false);
currentIndex = startIndex();
renderCard(currentIndex);

/* Re-check reset boundaries when returning to the app (e.g. opened in the
   morning, reopened in the evening). */
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  if (applyPeriodResets()) {
    currentIndex = startIndex();
    renderCard(currentIndex);
    renderStreak(false);
  }
});

const EVENING_START_HOUR = 15;
const STREAK_KEY = 'azkar_streak';
const SETTINGS_KEY = 'azkar_settings';
const ARABIC_SCALE_MIN = 0.8;
const ARABIC_SCALE_MAX = 1.8;
const ARABIC_SCALE_STEP = 0.1;
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function initialTab() {
  return new Date().getHours() >= EVENING_START_HOUR ? 'evening' : 'morning';
}

let currentTab = initialTab();

function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = saved === 'dark' ? '☀' : '☾';
}

function toggleTheme() {
  const current = document.body.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀' : '☾';
}

initTheme();

const STORAGE_KEY = 'azkar_progress';
const DATE_KEY = 'azkar_date';

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadProgress() {
  try {
    const saved = localStorage.getItem(DATE_KEY);
    const today = getTodayStr();
    if (saved !== today) {
      localStorage.setItem(DATE_KEY, today);
      localStorage.removeItem(STORAGE_KEY);
      return {};
    }
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
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
      streakLine.textContent = '\u{1F525} ' + n + ' ' + dayWord(n) + ' подряд';
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

function updateOverallProgress() {
  const items = azkar[currentTab];
  const progress = loadProgress();
  let done = 0;
  let total = items.length;

  items.forEach(item => {
    if (item.count) {
      if ((progress[item.id] || 0) >= item.count.required) done++;
    } else {
      if (progress[item.id]) done++;
    }
  });

  const pct = Math.round((done / total) * 100);
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

  const colors = ['#0fa86e', '#1a7a55', '#a8d5c0', '#ffffff', '#4d8a70'];
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

function scrollToNextUncompleted(completedId) {
  const items = azkar[currentTab];
  const progress = loadProgress();

  let foundCurrent = false;
  for (const item of items) {
    if (item.id === completedId) { foundCurrent = true; continue; }
    if (!foundCurrent) continue;
    const undone = item.count
      ? (progress[item.id] || 0) < item.count.required
      : !progress[item.id];
    if (undone) {
      const el = document.getElementById('card-' + item.id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
        }, 400);
      }
      return;
    }
  }
}

function renderAzkar(tab) {
  const list = document.getElementById('azkar-list');
  const items = azkar[tab];
  const progress = loadProgress();

  list.innerHTML = '';

  items.forEach((item, index) => {
    const saved = progress[item.id] || 0;
    const isDone = item.count ? saved >= item.count.required : !!saved;

    const card = document.createElement('div');
    card.className = 'card' + (isDone ? ' done' : '') + (item.theme === 'light' ? ' card-light' : '');
    card.id = 'card-' + item.id;
    card.style.animationDelay = (index * 0.04) + 's';

    let counterHTML = '';
    if (item.count) {
      const current = saved;
      const required = item.count.required;
      const pct = Math.min(100, Math.round((current / required) * 100));

      counterHTML = `
        <hr class="divider" />
        <div class="counter-wrap">
          <div class="counter-progress-bar">
            <div class="counter-progress-fill" id="fill-${item.id}" style="width:${pct}%"></div>
          </div>
          <div class="counter-row">
            <div class="counter-display">
              <span id="cur-${item.id}">${current}</span> / ${required}
              <span class="done-badge" id="badge-${item.id}"> ✓ выполнено</span>
            </div>
            <div style="display:flex;gap:10px;align-items:center;">
              <button class="counter-reset" onclick="resetCounter('${item.id}', ${required})" aria-label="Сбросить счётчик">сброс</button>
              <button class="counter-btn" id="btn-${item.id}" onclick="increment('${item.id}', ${required})" ${isDone ? 'disabled' : ''} aria-label="Добавить повторение">
                + зикр
              </button>
            </div>
          </div>
        </div>
      `;
    }

    let readHTML = '';
    if (!item.count) {
      readHTML = `
        <hr class="divider" />
        <div class="read-row">
          <button class="read-btn${isDone ? ' read-done' : ''}" id="read-${item.id}" onclick="toggleRead('${item.id}')" aria-pressed="${isDone}">
            ${isDone ? '✓ прочитано' : 'отметить прочитанным'}
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="card-number">${index + 1} / ${items.length}</div>
      ${item.note ? `<div class="note">${item.note}</div>` : ''}
      <div class="arabic">${item.arabic.replace(/\n/g, '<br>')}</div>
      ${item.transliteration ? `<div class="transliteration">${item.transliteration}</div><hr class="divider" />` : ''}
      <div class="translation">${item.translation}</div>
      ${item.source ? `<div class="source">${item.source}</div>` : ''}
      ${counterHTML}${readHTML}
    `;

    list.appendChild(card);
  });

  updateOverallProgress();
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
    if (badgeEl) badgeEl.style.display = 'inline';
    if (cardEl) {
      cardEl.classList.add('done', 'just-done');
      setTimeout(() => cardEl.classList.remove('just-done'), 500);
    }

    vibrate([30, 20, 30]);
    scrollToNextUncompleted(id);

    const { done, total } = updateOverallProgress();
    if (done === total) handleSetCompleted();
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
  const cardEl = document.getElementById('card-' + id);

  if (curEl) curEl.textContent = 0;
  if (fillEl) fillEl.style.width = '0%';
  if (btnEl) btnEl.disabled = false;
  if (badgeEl) badgeEl.style.display = 'none';
  if (cardEl) cardEl.classList.remove('done');

  updateOverallProgress();
}

function toggleRead(id) {
  const progress = loadProgress();
  const nowDone = !progress[id];
  if (nowDone) {
    progress[id] = 1;
  } else {
    delete progress[id];
  }
  saveProgress(progress);

  vibrate(nowDone ? [30, 20, 30] : 15);

  const btnEl = document.getElementById('read-' + id);
  const cardEl = document.getElementById('card-' + id);

  if (btnEl) {
    btnEl.textContent = nowDone ? '✓ прочитано' : 'отметить прочитанным';
    btnEl.classList.toggle('read-done', nowDone);
    btnEl.setAttribute('aria-pressed', String(nowDone));
  }
  if (cardEl) {
    cardEl.classList.toggle('done', nowDone);
    if (nowDone) {
      cardEl.classList.add('just-done');
      setTimeout(() => cardEl.classList.remove('just-done'), 500);
    }
  }

  if (nowDone) scrollToNextUncompleted(id);

  const { done, total } = updateOverallProgress();
  if (nowDone && done === total) handleSetCompleted();
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab === currentTab) return;

    document.querySelectorAll('.tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');

    const list = document.getElementById('azkar-list');
    list.classList.add('fade-out');

    setTimeout(() => {
      currentTab = btn.dataset.tab;
      renderAzkar(currentTab);
      list.classList.remove('fade-out');
      list.classList.add('fade-in');
      list.scrollTop = 0;
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
      setTimeout(() => list.classList.remove('fade-in'), 250);
    }, 150);
  });
});

initSettings();
syncTabUI();
renderStreak(false);
renderAzkar(currentTab);

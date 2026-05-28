let currentTab = 'morning';

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

function updateOverallProgress() {
  const items = azkar[currentTab];
  const progress = loadProgress();
  let done = 0;
  let total = items.length;

  items.forEach(item => {
    if (item.count) {
      if ((progress[item.id] || 0) >= item.count.required) done++;
    } else {
      done++;
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

  vibrate([50, 30, 50]);

  setTimeout(() => { container.innerHTML = ''; }, 2500);
}

function scrollToNextUncompleted(completedId) {
  const items = azkar[currentTab];
  const progress = loadProgress();

  let foundCurrent = false;
  for (const item of items) {
    if (item.id === completedId) { foundCurrent = true; continue; }
    if (!foundCurrent) continue;
    if (item.count && (progress[item.id] || 0) < item.count.required) {
      const el = document.getElementById('card-' + item.id);
      if (el) {
        setTimeout(() => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    const isDone = item.count ? saved >= item.count.required : false;

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

    card.innerHTML = `
      <div class="card-number">${index + 1} / ${items.length}</div>
      ${item.note ? `<div class="note">${item.note}</div>` : ''}
      <div class="arabic">${item.arabic.replace(/\n/g, '<br>')}</div>
      ${item.transliteration ? `<div class="transliteration">${item.transliteration}</div><hr class="divider" />` : ''}
      <div class="translation">${item.translation}</div>
      ${item.source ? `<div class="source">${item.source}</div>` : ''}
      ${counterHTML}
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
    if (done === total) showCelebration();
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => list.classList.remove('fade-in'), 250);
    }, 150);
  });
});

renderAzkar(currentTab);

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
              <button class="counter-reset" onclick="resetCounter('${item.id}', ${required})">сброс</button>
              <button class="counter-btn" id="btn-${item.id}" onclick="increment('${item.id}', ${required})" ${isDone ? 'disabled' : ''}>
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
}

function increment(id, required) {
  const progress = loadProgress();
  const current = (progress[id] || 0) + 1;
  progress[id] = current;
  saveProgress(progress);

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
    if (cardEl) cardEl.classList.add('done');
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
}

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;
    renderAzkar(currentTab);
  });
});

renderAzkar(currentTab);

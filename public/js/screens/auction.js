import { escapeHtml } from '../lib/util.js';

let contentCache = null;
async function getContent(ack) {
  if (contentCache) return contentCache;
  contentCache = await ack('meta:roles', {});
  return contentCache;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function formatMs(ms) {
  const totalCs = Math.floor(ms / 100);
  const s = Math.floor(totalCs / 10);
  const cs = totalCs % 10;
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}.${cs}`;
}

export function mountHost(ctx) {
  const { root, ack, toast, gotoLobby } = ctx;
  let content = { auctionCategories: [] };
  let tickHandle = null;
  let local = {
    contentReady: false,
    category: null,
    running: false,
    startedAt: 0,
    elapsedMs: 0,
    judged: false,
    tally: { success: 0, fail: 0 }
  };

  function render() {
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">L'ENCHÈRE</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <p class="faint center">Enchérissez à l'oral sur le nombre d'éléments que vous pouvez citer — le plus offrant doit livrer, chrono en main !</p>
        <div class="question-card">${local.category ? escapeHtml(local.category) : 'Prêt(e) ?'}</div>
        <div class="reveal-name" id="chrono">${formatMs(local.elapsedMs)}</div>

        ${!local.category ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-category" ${!local.contentReady ? 'disabled' : ''}>Nouvelle catégorie 🎲</button>
        ` : (!local.running && !local.judged) ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-go">Démarrer le chrono ▶</button>
        ` : local.running ? `
          <button class="btn btn--danger btn--block btn--lg" id="btn-stop">Stop ⏹</button>
        ` : `
          <div class="split-choice">
            <button class="btn btn--cool btn--lg" id="btn-success">✅ Réussi</button>
            <button class="btn btn--danger btn--lg" id="btn-fail">❌ Raté</button>
          </div>
        `}

        ${local.category ? `<button class="btn btn--ghost btn--block" id="btn-next-cat">Catégorie suivante 🔄</button>` : ''}

        <p class="center muted">✅ ${local.tally.success} réussite${local.tally.success > 1 ? 's' : ''} — ❌ ${local.tally.fail} échec${local.tally.fail > 1 ? 's' : ''}</p>
      </div>
    `;

    const catBtn = root.querySelector('#btn-category');
    if (catBtn) catBtn.addEventListener('click', newCategory);
    const goBtn = root.querySelector('#btn-go');
    if (goBtn) goBtn.addEventListener('click', startChrono);
    const stopBtn = root.querySelector('#btn-stop');
    if (stopBtn) stopBtn.addEventListener('click', stopChrono);
    const successBtn = root.querySelector('#btn-success');
    if (successBtn) successBtn.addEventListener('click', () => judge(true));
    const failBtn = root.querySelector('#btn-fail');
    if (failBtn) failBtn.addEventListener('click', () => judge(false));
    const nextCatBtn = root.querySelector('#btn-next-cat');
    if (nextCatBtn) nextCatBtn.addEventListener('click', newCategory);
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function newCategory() {
    stopTick();
    local.category = pick(content.auctionCategories);
    local.running = false;
    local.elapsedMs = 0;
    local.judged = false;
    render();
  }

  function startChrono() {
    local.running = true;
    local.startedAt = Date.now();
    render();
    tickHandle = setInterval(() => {
      local.elapsedMs = Date.now() - local.startedAt;
      const el = root.querySelector('#chrono');
      if (el) el.textContent = formatMs(local.elapsedMs);
    }, 100);
  }

  function stopChrono() {
    stopTick();
    local.running = false;
    local.judged = true;
    render();
  }

  function stopTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  function judge(success) {
    if (success) local.tally.success += 1; else local.tally.fail += 1;
    local.category = null;
    local.judged = false;
    local.elapsedMs = 0;
    render();
  }

  function quitGame() {
    if (confirm("Quitter L'Enchère et revenir au lobby ?")) { stopTick(); gotoLobby(); }
  }

  getContent(ack).then((c) => { content = c; local.contentReady = true; render(); }).catch(() => toast('Impossible de charger le contenu.', 'error'));
  render();

  return () => stopTick();
}

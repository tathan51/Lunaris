import { escapeHtml } from '../lib/util.js';
import { nameRosterMarkup, wireNameRoster } from '../lib/nameRoster.js';

let contentCache = null;
async function getContent(ack) {
  if (contentCache) return contentCache;
  contentCache = await ack('meta:roles', {});
  return contentCache;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const DURATIONS = [30, 45, 60, 90];

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let content = { tribunal: { accusations: [], sentences: [] } };
  let timerHandle = null;
  let local = {
    phase: 'config',
    contentReady: false,
    duration: 60,
    names: state.players.map((p) => p.name),
    stage: 'accusing', // 'accusing' | 'pleading' | 'voting' | 'verdict'
    current: null,
    timeLeft: 0,
    verdict: null,
    sentence: null
  };

  function render() {
    if (local.phase === 'config') return renderConfig();
    return renderPlaying();
  }

  function renderConfig() {
    const connectedExtra = state.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">⚖️ Le Tribunal — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Un accusé est désigné au hasard avec un chef d'accusation absurde. Il plaide sa cause, chrono en main, puis le groupe vote le verdict à main levée.</p>
          <div class="field">
            <label>Temps de plaidoirie</label>
            <div class="mode-picker">
              ${DURATIONS.map((d) => `<button class="mode-btn ${local.duration === d ? 'is-selected' : ''}" data-duration="${d}">${d}s</button>`).join('')}
            </div>
          </div>
          ${nameRosterMarkup(local.names, connectedExtra)}
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 || !local.contentReady ? 'disabled' : ''}>Ouvrir l'audience ⚖️</button>
        </div>
      </div>
    `;
    root.querySelectorAll('[data-duration]').forEach((btn) => btn.addEventListener('click', () => { local.duration = Number(btn.dataset.duration); render(); }));
    wireNameRoster(root, local.names, connectedExtra, render);
    root.querySelector('#btn-start').addEventListener('click', () => { local.phase = 'playing'; nextCase(); });
    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function nextCase() {
    stopTimer();
    local.current = { accused: pick(local.names), accusation: pick(content.tribunal.accusations) };
    local.stage = 'accusing';
    local.verdict = null;
    local.sentence = null;
    render();
  }

  function startPlea() {
    local.stage = 'pleading';
    local.timeLeft = local.duration;
    render();
    timerHandle = setInterval(() => {
      local.timeLeft -= 1;
      if (local.timeLeft <= 0) {
        stopTimer();
        local.stage = 'voting';
      }
      render();
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) { clearInterval(timerHandle); timerHandle = null; }
  }

  function renderPlaying() {
    const c = local.current;
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">LE TRIBUNAL</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${local.stage === 'accusing' ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">⚖️</div>
            <div class="phase-banner__title">${escapeHtml(c.accused)} est accusé(e)</div>
            <div class="phase-banner__text">« ${escapeHtml(c.accusation)} »</div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-plead">Commencer la plaidoirie (${local.duration}s) ▶</button>
        ` : local.stage === 'pleading' ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">🎤</div>
            <div class="phase-banner__title">${escapeHtml(c.accused)} plaide sa cause !</div>
            <div class="phase-banner__text">« ${escapeHtml(c.accusation)} »</div>
          </div>
          <div class="reveal-name">${local.timeLeft}s</div>
          <button class="btn btn--ghost btn--block" id="btn-skip">Terminer maintenant</button>
        ` : local.stage === 'voting' ? `
          <div class="phase-banner phase-banner--day">
            <div class="phase-banner__icon">🗳️</div>
            <div class="phase-banner__title">Le jury vote !</div>
            <div class="phase-banner__text">Coupable ou non coupable, à main levée ?</div>
          </div>
          <div class="split-choice">
            <button class="btn btn--danger btn--lg" id="btn-guilty">⚖️ Coupable</button>
            <button class="btn btn--cool btn--lg" id="btn-innocent">🙅 Non coupable</button>
          </div>
        ` : `
          <div class="winner-banner ${local.verdict === 'guilty' ? 'winner-banner--loups' : 'winner-banner--village'}">
            <div style="font-size:3rem;">${local.verdict === 'guilty' ? '⚖️' : '🙅'}</div>
            <div class="winner-banner__title">${local.verdict === 'guilty' ? 'COUPABLE !' : 'NON COUPABLE !'}</div>
            ${local.sentence ? `<p class="mt">Sentence : <strong>${escapeHtml(local.sentence)}</strong></p>` : ''}
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Affaire suivante ▶</button>
        `}
      </div>
    `;

    const pleadBtn = root.querySelector('#btn-plead');
    if (pleadBtn) pleadBtn.addEventListener('click', startPlea);
    const skipBtn = root.querySelector('#btn-skip');
    if (skipBtn) skipBtn.addEventListener('click', () => { stopTimer(); local.stage = 'voting'; render(); });
    const guiltyBtn = root.querySelector('#btn-guilty');
    if (guiltyBtn) guiltyBtn.addEventListener('click', () => { local.verdict = 'guilty'; local.sentence = pick(content.tribunal.sentences); local.stage = 'verdict'; render(); });
    const innocentBtn = root.querySelector('#btn-innocent');
    if (innocentBtn) innocentBtn.addEventListener('click', () => { local.verdict = 'innocent'; local.sentence = null; local.stage = 'verdict'; render(); });
    const nextBtn = root.querySelector('#btn-next');
    if (nextBtn) nextBtn.addEventListener('click', nextCase);
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function quitGame() {
    if (confirm('Quitter le Tribunal et revenir au lobby ?')) { stopTimer(); gotoLobby(); }
  }

  function onRoomUpdate(payload) { state.players = payload.players; if (local.phase === 'config') render(); }
  socket.on('room:update', onRoomUpdate);

  getContent(ack).then((c) => { content = c; local.contentReady = true; render(); }).catch(() => toast('Impossible de charger le contenu.', 'error'));
  render();

  return () => { stopTimer(); socket.off('room:update', onRoomUpdate); };
}

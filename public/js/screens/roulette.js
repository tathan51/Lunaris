import { escapeHtml } from '../lib/util.js';
import { nameRosterMarkup, wireNameRoster } from '../lib/nameRoster.js';
import { wheelMarkup, spinWheelTo } from '../lib/wheel.js';

const SPIN_DURATION_MS = 4500;
const MODES = [
  { id: 'soft', label: 'Soft', cls: 'mode-btn--soft' },
  { id: 'moyen', label: 'Moyen', cls: '' },
  { id: 'hot', label: 'Hot', cls: 'mode-btn--hot' }
];

// ---------------------------------------------------------------- HOST ----

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let local = {
    phase: 'config', mode: 'soft', rotation: 0, spinning: false, result: null, revealedAction: null,
    names: state.players.map((p) => p.name)
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
          <p class="eyebrow" style="margin:0;">🎡 Roulette — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Ambiance</label>
            <div class="mode-picker">
              ${MODES.map((m) => `<button class="mode-btn ${m.cls} ${local.mode === m.id ? 'is-selected' : ''}" data-mode="${m.id}">${m.label}</button>`).join('')}
            </div>
          </div>

          ${nameRosterMarkup(local.names, connectedExtra)}

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 ? 'disabled' : ''}>Lancer 🎡</button>
        </div>
      </div>
    `;
    root.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => { local.mode = btn.dataset.mode; render(); }));
    wireNameRoster(root, local.names, connectedExtra, render);

    root.querySelector('#btn-start').addEventListener('click', async () => {
      const res = await ack('roulette:start', { mode: local.mode, names: local.names });
      if (!res.ok) return toast('Impossible de lancer.', 'error');
      local.phase = 'playing';
      render();
    });
    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function renderPlaying() {
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">ROULETTE — ${local.mode.toUpperCase()}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${wheelMarkup(local.names, local.rotation)}

        ${!local.result ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-spin" ${local.spinning ? 'disabled' : ''}>${local.spinning ? 'Ça tourne...' : 'Tourner la roue 🎲'}</button>
        ` : `
          <div class="reveal-name">🎯 ${escapeHtml(local.result.playerName)}</div>
          <div class="card">
            <p class="eyebrow" style="text-align:left;">Vérité</p>
            <p style="font-size:1.1rem;font-weight:600;">${escapeHtml(local.result.verite)}</p>
          </div>
          <div class="mystery-card ${local.revealedAction ? 'is-revealed' : ''}" id="mystery">
            <div class="mystery-card__icon">${local.revealedAction ? '🎲' : '❓'}</div>
            <p class="mt" style="font-weight:600;">${local.revealedAction ? escapeHtml(local.revealedAction) : 'Action Mystère — toucher pour révéler'}</p>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-again">Tourner à nouveau 🔄</button>
        `}
      </div>
    `;

    const spinBtn = root.querySelector('#btn-spin');
    if (spinBtn) spinBtn.addEventListener('click', spin);
    const mystery = root.querySelector('#mystery');
    if (mystery && !local.revealedAction) mystery.addEventListener('click', () => socket.emit('roulette:revealAction'));
    const again = root.querySelector('#btn-again');
    if (again) again.addEventListener('click', spin);
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function spin() {
    if (local.spinning || local.names.length < 2) return;
    local.spinning = true;
    local.result = null;
    local.revealedAction = null;
    render();
    socket.emit('roulette:spin');
  }

  function quitGame() {
    if (confirm('Quitter la roulette et revenir au lobby ?')) { socket.emit('roulette:reset'); gotoLobby(); }
  }

  function onResult(result) {
    const wheelEl = root.querySelector('#wheel');
    if (wheelEl && local.names.length) {
      const idx = local.names.findIndex((n) => n === result.playerName);
      spinWheelTo(wheelEl, local.rotation, local.names, idx, (newRotation) => { local.rotation = newRotation; });
    }

    setTimeout(() => {
      local.spinning = false;
      local.result = result;
      local.revealedAction = null;
      render();
    }, SPIN_DURATION_MS);
  }
  function onActionRevealed(result) {
    local.revealedAction = result?.action || null;
    render();
  }

  function onRoomUpdate(payload) { state.players = payload.players; if (local.phase === 'config') render(); }

  socket.on('roulette:result', onResult);
  socket.on('roulette:actionRevealed', onActionRevealed);
  socket.on('room:update', onRoomUpdate);

  render();

  return () => {
    socket.off('roulette:result', onResult);
    socket.off('roulette:actionRevealed', onActionRevealed);
    socket.off('room:update', onRoomUpdate);
  };
}

// -------------------------------------------------------------- PLAYER ----

export function mountPlayer(ctx) {
  const { root, socket, gotoPlayerWaiting } = ctx;
  const resume = ctx.resume || {};
  let local = { result: resume.result || null, revealedAction: null, waiting: false };

  function render() {
    root.innerHTML = `
      <div class="screen">
        <p class="eyebrow">🎡 Roulette</p>
        ${local.waiting ? `
          <div class="card center"><p>La roue tourne...</p></div>
        ` : local.result ? `
          <div class="reveal-name">🎯 ${escapeHtml(local.result.playerName)}</div>
          <div class="card">
            <p class="eyebrow" style="text-align:left;">Vérité</p>
            <p style="font-size:1.05rem;font-weight:600;">${escapeHtml(local.result.verite)}</p>
          </div>
          <div class="mystery-card ${local.revealedAction ? 'is-revealed' : ''}">
            <div class="mystery-card__icon">${local.revealedAction ? '🎲' : '❓'}</div>
            <p class="mt" style="font-weight:600;">${local.revealedAction ? escapeHtml(local.revealedAction) : 'Action Mystère'}</p>
          </div>
        ` : `<div class="card center"><p class="muted">En attente du premier lancer...</p></div>`}
      </div>
    `;
  }

  function onResult() {
    local.waiting = true;
    local.result = null;
    render();
  }
  function onResultFinal(result) {
    setTimeout(() => { local.waiting = false; local.result = result; local.revealedAction = null; render(); }, SPIN_DURATION_MS);
  }
  function onActionRevealed(result) { local.revealedAction = result?.action || null; render(); }
  function onRoomUpdate(payload) { if (!payload.gameType) gotoPlayerWaiting(); }

  function onResultCombined(r) { onResult(); onResultFinal(r); }

  socket.on('roulette:result', onResultCombined);
  socket.on('roulette:actionRevealed', onActionRevealed);
  socket.on('room:update', onRoomUpdate);

  render();

  return () => {
    socket.off('roulette:result', onResultCombined);
    socket.off('roulette:actionRevealed', onActionRevealed);
    socket.off('room:update', onRoomUpdate);
  };
}

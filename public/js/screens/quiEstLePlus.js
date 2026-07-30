import { nameRosterMarkup, wireNameRoster } from '../lib/nameRoster.js';

const MODES = [
  { id: 'soft', label: 'Soft', cls: 'mode-btn--soft' },
  { id: 'moyen', label: 'Moyen', cls: '' },
  { id: 'hot', label: 'Hot', cls: 'mode-btn--hot' },
  { id: 'mix', label: 'Mix', cls: '' }
];

// ---------------------------------------------------------------- HOST ----

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let local = { phase: 'config', mode: 'soft', count: 15, question: null, names: state.players.map((p) => p.name) };

  function render() {
    if (local.phase === 'config') return renderConfig();
    if (local.phase === 'playing') return renderPlaying();
    if (local.phase === 'finished') return renderFinished();
  }

  function renderConfig() {
    const connectedExtra = state.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">🔥 Qui est le plus... — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Ambiance</label>
            <div class="mode-picker">
              ${MODES.map((m) => `<button class="mode-btn ${m.cls} ${local.mode === m.id ? 'is-selected' : ''}" data-mode="${m.id}">${m.label}</button>`).join('')}
            </div>
          </div>
          <div class="field">
            <label for="count">Nombre de questions</label>
            <input type="number" id="count" class="input" min="1" max="40" value="${local.count}" />
            <div class="btn-row">
              ${[10, 15, 20, 30].map((n) => `<button class="btn btn--ghost btn--sm" data-count="${n}">${n}</button>`).join('')}
            </div>
          </div>

          ${nameRosterMarkup(local.names, connectedExtra)}

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 ? 'disabled' : ''}>Lancer 🔥</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-mode]').forEach((btn) => btn.addEventListener('click', () => { local.mode = btn.dataset.mode; render(); }));
    root.querySelectorAll('[data-count]').forEach((btn) => btn.addEventListener('click', () => {
      local.count = Number(btn.dataset.count);
      root.querySelector('#count').value = local.count;
    }));
    root.querySelector('#count').addEventListener('input', (e) => { local.count = Number(e.target.value) || 1; });
    wireNameRoster(root, local.names, connectedExtra, render);

    root.querySelector('#btn-start').addEventListener('click', async () => {
      const res = await ack('quiz:start', { mode: local.mode, count: local.count });
      if (!res.ok) return toast('Impossible de lancer.', 'error');
    });
    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function renderPlaying() {
    const q = local.question;
    const pct = q ? Math.round(((q.index + 1) / q.total) * 100) : 0;
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">Question ${q.index + 1} / ${q.total}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="question-card">${q.text}</div>
        <p class="faint center">Tout le monde pointe du doigt en même temps !</p>
        <button class="btn btn--primary btn--block btn--lg" id="btn-next">Question suivante ▶</button>
      </div>
    `;
    root.querySelector('#btn-next').addEventListener('click', () => socket.emit('quiz:next'));
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function renderFinished() {
    root.innerHTML = `
      <div class="screen screen--host center">
        <div class="card flex-col gap">
          <div style="font-size:3rem;">🎉</div>
          <p class="title">Partie terminée !</p>
          <button class="btn btn--primary btn--block btn--lg" id="btn-replay">Rejouer</button>
          <button class="btn btn--ghost btn--block" id="btn-lobby">Retour au lobby</button>
        </div>
      </div>
    `;
    root.querySelector('#btn-replay').addEventListener('click', () => { local.phase = 'config'; render(); });
    root.querySelector('#btn-lobby').addEventListener('click', () => { socket.emit('quiz:reset'); gotoLobby(); });
  }

  function quitGame() {
    if (confirm('Quitter cette partie et revenir au lobby ?')) { socket.emit('quiz:reset'); gotoLobby(); }
  }

  function onQuestion(q) { local.phase = 'playing'; local.question = q; render(); }
  function onFinished() { local.phase = 'finished'; render(); }
  function onRoomUpdate(payload) { state.players = payload.players; if (local.phase === 'config') render(); }

  socket.on('quiz:question', onQuestion);
  socket.on('quiz:finished', onFinished);
  socket.on('room:update', onRoomUpdate);

  render();

  return () => {
    socket.off('quiz:question', onQuestion);
    socket.off('quiz:finished', onFinished);
    socket.off('room:update', onRoomUpdate);
  };
}

// -------------------------------------------------------------- PLAYER ----

export function mountPlayer(ctx) {
  const { root, socket, gotoPlayerWaiting } = ctx;
  let local = { question: ctx.resume || null, finished: false };

  function render() {
    if (local.finished) {
      root.innerHTML = `
        <div class="screen center">
          <div style="font-size:3rem;">🎉</div>
          <p class="title">Partie terminée !</p>
          <p class="faint">Regarde l'écran principal.</p>
        </div>`;
      return;
    }
    const q = local.question;
    const pct = q ? Math.round(((q.index + 1) / q.total) * 100) : 0;
    root.innerHTML = `
      <div class="screen">
        <p class="eyebrow">Qui est le plus...</p>
        ${q ? `
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="question-card" style="font-size:1.15rem;">${q.text}</div>
        ` : `<p class="muted center">En attente de la question...</p>`}
      </div>
    `;
  }

  function onQuestion(q) { local.question = q; render(); }
  function onFinished() { local.finished = true; render(); }
  function onRoomUpdate(payload) { if (!payload.gameType) gotoPlayerWaiting(); }

  socket.on('quiz:question', onQuestion);
  socket.on('quiz:finished', onFinished);
  socket.on('room:update', onRoomUpdate);

  render();

  return () => {
    socket.off('quiz:question', onQuestion);
    socket.off('quiz:finished', onFinished);
    socket.off('room:update', onRoomUpdate);
  };
}

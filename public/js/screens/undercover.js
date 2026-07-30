import { escapeHtml, initials } from '../lib/util.js';

const ROLE_LABELS = { civil: 'Civil', undercover: 'Undercover', mrwhite: 'Mr. White' };
const ROLE_ICONS = { civil: '🙂', undercover: '🕵️', mrwhite: '❓' };

let themeCache = null;
async function getThemes(ack) {
  if (themeCache) return themeCache;
  const res = await ack('meta:roles', {});
  themeCache = res.themes || [];
  return themeCache;
}

// ---------------------------------------------------------------- HOST ----

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let themes = [];
  let local = {
    phase: 'config', themeId: null, undercoverCount: 1, includeMrWhite: false, aliveIds: [], turnOrder: [],
    amPlaying: false, myWord: null, myDead: false, cardRevealed: false
  };

  if (ctx.resume?.game?.type === 'undercover') {
    const g = ctx.resume.game;
    local.phase = g.state.ended ? 'gameover' : 'playing';
    local.aliveIds = g.state.alive;
    local.theme = g.state.theme;
  }
  if (ctx.resume?.mine) { local.amPlaying = true; local.myWord = ctx.resume.mine.word; }

  function render() {
    if (local.phase === 'config') renderConfig();
    else if (local.phase === 'playing') renderPlaying();
    else if (local.phase === 'gameover') renderGameOver();
    renderMyCardWidget();
  }

  function renderMyCardWidget() {
    if (!local.amPlaying) return;
    const isBlank = !local.myWord;
    root.insertAdjacentHTML('beforeend', `
      <button id="my-card-fab" class="my-card-fab" title="Ton mot">🎴</button>
      ${local.cardRevealed ? `
        <div class="my-card-overlay" id="my-card-overlay">
          <div class="word-card" style="${local.myDead ? 'opacity:0.5;' : ''}">
            <div class="word-card__label">${isBlank ? 'Tu es Mr. White' : 'Ton mot secret'}</div>
            <div class="word-card__word">${isBlank ? '🤫' : escapeHtml(local.myWord)}</div>
            ${local.myDead ? `<p class="mt" style="color:var(--red);font-weight:700;">☠️ Éliminé(e)</p>` : ''}
          </div>
          <button class="btn btn--ghost btn--block" id="btn-hide-card" style="max-width:360px;">Cacher</button>
        </div>
      ` : ''}
    `);
    root.querySelector('#my-card-fab').addEventListener('click', () => { local.cardRevealed = !local.cardRevealed; render(); });
    const hideBtn = root.querySelector('#btn-hide-card');
    if (hideBtn) hideBtn.addEventListener('click', () => { local.cardRevealed = false; render(); });
    const overlay = root.querySelector('#my-card-overlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) { local.cardRevealed = false; render(); } });
  }

  function renderConfig() {
    const total = state.players.length;
    const maxUc = Math.max(1, Math.floor((total - 2) / 2));
    if (!local.themeId && themes.length) local.themeId = themes[0].id;

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">🕵️ Undercover — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Thème</label>
            <div class="game-grid">
              ${themes.map((t) => `
                <button class="game-card ${local.themeId === t.id ? 'is-selected' : ''}" data-theme="${t.id}" style="${local.themeId === t.id ? 'border-color:var(--violet);box-shadow:var(--shadow-glow-violet);' : ''}">
                  <span class="game-card__icon">${t.icon}</span>
                  <span class="game-card__title">${t.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="stepper">
            <span class="stepper__label">🕵️ Undercover</span>
            <div class="flex items-center gap-sm">
              <button class="stepper__btn" id="uc-dec">−</button>
              <span class="stepper__value">${local.undercoverCount}</span>
              <button class="stepper__btn" id="uc-inc">+</button>
            </div>
          </div>

          <label class="stepper" style="cursor:pointer;">
            <span class="stepper__label">❓ Inclure Mr. White</span>
            <input type="checkbox" id="mrwhite" ${local.includeMrWhite ? 'checked' : ''} ${total < 4 ? 'disabled' : ''} style="width:20px;height:20px;" />
          </label>

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${total < 3 ? 'disabled' : ''}>Distribuer les mots 🎭</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-theme]').forEach((btn) => btn.addEventListener('click', () => {
      local.themeId = btn.dataset.theme; render();
    }));
    root.querySelector('#uc-inc').addEventListener('click', () => {
      if (local.undercoverCount < maxUc) { local.undercoverCount += 1; render(); }
    });
    root.querySelector('#uc-dec').addEventListener('click', () => {
      if (local.undercoverCount > 1) { local.undercoverCount -= 1; render(); }
    });
    root.querySelector('#mrwhite').addEventListener('change', (e) => { local.includeMrWhite = e.target.checked; });

    root.querySelector('#btn-start').addEventListener('click', async () => {
      const res = await ack('uc:start', {
        themeId: local.themeId,
        undercoverCount: local.undercoverCount,
        includeMrWhite: local.includeMrWhite
      });
      if (!res.ok) return toast(res.error || 'Impossible de lancer.', 'error');
    });

    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function renderPlaying() {
    const alive = state.players.filter((p) => local.aliveIds.includes(p.id));
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">${local.theme ? local.theme.label.toUpperCase() : ''}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Ordre de passage</p>
          <p class="muted">${(local.turnOrder || []).map(escapeHtml).join(' → ') || '—'}</p>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Après le vote, touchez l'éliminé(e) (${alive.length} en jeu)</p>
          <div class="player-list">
            ${alive.map((p) => `
              <div class="player-chip player-chip--selectable" data-id="${p.id}">
                <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)} ✖
              </div>`).join('')}
          </div>
        </div>
      </div>
    `;
    root.querySelectorAll('.player-chip[data-id]').forEach((chip) => {
      chip.addEventListener('click', () => socket.emit('uc:eliminate', { playerId: chip.dataset.id }));
    });
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function renderGameOver() {
    const won = local.gameOver?.winner === 'civils';
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="winner-banner ${won ? 'winner-banner--village' : 'winner-banner--loups'}">
          <div style="font-size:3rem;">${won ? '🙂' : '🕵️'}</div>
          <div class="winner-banner__title">${won ? 'Les Civils gagnent !' : local.gameOver?.winner === 'mrwhite' ? 'Mr. White gagne !' : 'Les Undercover gagnent !'}</div>
          <p class="muted mt">Le mot était : <strong>${escapeHtml(local.gameOver?.pair?.main || '')}</strong> / <strong>${escapeHtml(local.gameOver?.pair?.undercover || '')}</strong></p>
        </div>
        <div class="card flex-col gap">
          <div class="player-list">
            ${Object.values(local.gameOver?.roles || {}).map((info) => `
              <div class="player-chip">${ROLE_ICONS[info.value]} ${escapeHtml(info.name)} — ${ROLE_LABELS[info.value]}</div>
            `).join('')}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-lobby">Retour au lobby</button>
      </div>
    `;
    root.querySelector('#btn-lobby').addEventListener('click', () => { socket.emit('uc:reset'); gotoLobby(); });
  }

  function quitGame() {
    if (confirm('Abandonner cette partie et revenir au lobby ?')) { socket.emit('uc:reset'); gotoLobby(); }
  }

  function onStarted({ theme, turnOrder }) {
    local.phase = 'playing';
    local.theme = theme;
    local.turnOrder = turnOrder;
    local.aliveIds = state.players.map((p) => p.id);
    render();
  }
  function onRevealed(info) {
    local.aliveIds = local.aliveIds.filter((id) => id !== info.id);
    if (info.id === socket.id) local.myDead = true;
    toast(`🎭 ${info.name} était ${ROLE_LABELS[info.role]}${info.word ? ` (${info.word})` : ''}`);
    render();
  }
  function onYourWord({ word }) { local.amPlaying = true; local.myWord = word; render(); }
  function onMrWhiteGuess({ name }) {
    setTimeout(() => {
      const correct = confirm(`${name} (Mr. White) tente de deviner le mot civil à l'oral. A-t-il/elle deviné juste ?`);
      socket.emit('uc:mrWhiteGuessResult', { correct });
    }, 200);
  }
  function onGameOver(payload) { local.phase = 'gameover'; local.gameOver = payload; render(); }
  function onRoomUpdate(payload) {
    const nameById = new Map(state.players.map((p) => [p.id, p.name]));
    const idByName = new Map(payload.players.map((p) => [p.name, p.id]));
    local.aliveIds = local.aliveIds.map((id) => idByName.get(nameById.get(id)) || id);
    state.players = payload.players;
    render();
  }

  socket.on('uc:started', onStarted);
  socket.on('uc:revealed', onRevealed);
  socket.on('uc:mrWhiteGuess', onMrWhiteGuess);
  socket.on('uc:gameOver', onGameOver);
  socket.on('room:update', onRoomUpdate);
  socket.on('uc:yourWord', onYourWord);

  getThemes(ack).then((t) => { themes = t; render(); });
  render();

  return () => {
    socket.off('uc:started', onStarted);
    socket.off('uc:revealed', onRevealed);
    socket.off('uc:mrWhiteGuess', onMrWhiteGuess);
    socket.off('uc:gameOver', onGameOver);
    socket.off('room:update', onRoomUpdate);
    socket.off('uc:yourWord', onYourWord);
  };
}

// -------------------------------------------------------------- PLAYER ----

export function mountPlayer(ctx) {
  const { root, socket, gotoPlayerWaiting } = ctx;
  const payload = ctx.resume || {};
  let local = { word: payload.word, dead: false, gameOver: null };

  function render() {
    if (local.gameOver) return renderGameOver();
    const isBlank = !local.word;
    root.innerHTML = `
      <div class="screen">
        <div class="brand" style="margin-bottom:0;">
          <span class="brand__moon">🌙</span><span class="brand__name" style="font-size:1.2rem;">Lunaris</span>
        </div>
        <div class="word-card" style="${local.dead ? 'opacity:0.5;' : ''}">
          <div class="word-card__label">${isBlank ? 'Tu es Mr. White' : 'Ton mot secret'}</div>
          <div class="word-card__word">${isBlank ? '🤫' : escapeHtml(local.word)}</div>
          ${isBlank ? '<p class="muted mt">Tu n\'as pas de mot. Bluffe en écoutant les autres, ne te fais pas démasquer !</p>' : ''}
          ${local.dead ? `<p class="mt" style="color:var(--red);font-weight:700;">☠️ Éliminé(e)</p>` : ''}
        </div>
        <p class="faint center">Ne montre ton mot à personne !</p>
      </div>
    `;
  }

  function renderGameOver() {
    const won = local.gameOver.winner === 'civils';
    root.innerHTML = `
      <div class="screen">
        <div class="winner-banner ${won ? 'winner-banner--village' : 'winner-banner--loups'}">
          <div style="font-size:3rem;">${won ? '🙂' : '🕵️'}</div>
          <div class="winner-banner__title">${won ? 'Les Civils gagnent !' : local.gameOver.winner === 'mrwhite' ? 'Mr. White gagne !' : 'Les Undercover gagnent !'}</div>
        </div>
        <p class="faint center">En attente du prochain jeu...</p>
      </div>
    `;
  }

  function onRevealed(info) { if (info.id === socket.id) { local.dead = true; render(); } }
  function onGameOver(payload) { local.gameOver = payload; render(); }
  function onRoomUpdate(payload) { if (!payload.gameType) gotoPlayerWaiting(); }

  socket.on('uc:revealed', onRevealed);
  socket.on('uc:gameOver', onGameOver);
  socket.on('room:update', onRoomUpdate);

  render();

  return () => {
    socket.off('uc:revealed', onRevealed);
    socket.off('uc:gameOver', onGameOver);
    socket.off('room:update', onRoomUpdate);
  };
}

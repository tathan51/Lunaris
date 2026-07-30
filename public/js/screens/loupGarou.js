import { escapeHtml, initials } from '../lib/util.js';

let roleMetaCache = null;
async function getRoleMeta(ack) {
  if (roleMetaCache) return roleMetaCache;
  const res = await ack('meta:roles', {});
  roleMetaCache = res.roles || [];
  return roleMetaCache;
}

function roleInfo(meta, roleId) {
  return meta.find((r) => r.id === roleId) || { name: roleId, icon: '❓', team: 'village', description: '' };
}

// ---------------------------------------------------------------- HOST ----

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let meta = [];
  let local = {
    phase: 'config', roleCounts: {}, night: 1, currentPhase: null, aliveIds: [], selectedLovers: [],
    myCard: null, myTurnPrompt: null, myLoveName: null, myDead: false, cardRevealed: false
  };

  if (ctx.resume?.game?.type === 'loup-garou') {
    const g = ctx.resume.game;
    local.phase = g.state.ended ? 'gameover' : 'playing-day';
    local.roleCounts = g.state.roleCounts;
    local.night = g.state.night;
    local.aliveIds = g.state.alive;
    local.ended = g.state.ended;
    local.winner = g.state.winner;
    local.assignments = g.state.assignments;
  }
  if (ctx.resume?.mine) local.myCard = ctx.resume.mine;

  function playerName(id) { return state.players.find((p) => p.id === id)?.name || '???'; }

  function render() {
    if (local.phase === 'config') renderConfig();
    else if (local.phase === 'playing-night') renderNight();
    else if (local.phase === 'playing-day') renderDay();
    else if (local.phase === 'gameover') renderGameOver();
    renderMyCardWidget();
  }

  function renderMyCardWidget() {
    if (!local.myCard) return;
    const r = roleInfo(meta, local.myCard.roleId);
    const teamClass = r.team === 'loups' ? 'role-card--loups' : 'role-card--village';

    root.insertAdjacentHTML('beforeend', `
      <button id="my-card-fab" class="my-card-fab ${local.myTurnPrompt ? 'has-ping' : ''}" title="Ta carte">🎴</button>
      ${local.cardRevealed ? `
        <div class="my-card-overlay" id="my-card-overlay">
          <div class="role-card ${teamClass}" style="${local.myDead ? 'opacity:0.5;' : ''}">
            <div class="role-card__icon">${r.icon}</div>
            <div class="role-card__name">${r.name}</div>
            <p class="role-card__desc">${r.description}</p>
            ${local.myCard.teammates?.length ? `<p class="mt muted">Autres loups : <strong>${local.myCard.teammates.map(escapeHtml).join(', ')}</strong></p>` : ''}
            ${local.myLoveName ? `<p class="mt" style="color:var(--pink);">💘 Amoureux(se) de <strong>${escapeHtml(local.myLoveName)}</strong></p>` : ''}
            ${local.myDead ? `<p class="mt" style="color:var(--red);font-weight:700;">☠️ Éliminé(e)</p>` : ''}
            ${local.myTurnPrompt ? `<p class="mt" style="color:var(--violet);font-weight:700;">👀 ${escapeHtml(local.myTurnPrompt)}</p>` : ''}
          </div>
          <button class="btn btn--ghost btn--block" id="btn-hide-card" style="max-width:360px;">Cacher</button>
        </div>
      ` : ''}
    `);

    root.querySelector('#my-card-fab').addEventListener('click', () => {
      local.cardRevealed = !local.cardRevealed;
      render();
    });
    const hideBtn = root.querySelector('#btn-hide-card');
    if (hideBtn) hideBtn.addEventListener('click', () => { local.cardRevealed = false; render(); });
    const overlay = root.querySelector('#my-card-overlay');
    if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) { local.cardRevealed = false; render(); } });
  }

  function renderConfig() {
    const configurable = meta.filter((r) => r.configurable);
    const total = state.players.length;
    const assigned = configurable.reduce((sum, r) => sum + (local.roleCounts[r.id] ?? r.default), 0);

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">🐺 Loup-Garou — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">${total} joueurs. Les rôles non attribués deviennent Villageois (<strong>${Math.max(0, total - assigned)}</strong> pour l'instant).</p>
          <div class="flex-col gap-sm">
            ${configurable.map((r) => {
              const val = local.roleCounts[r.id] ?? r.default;
              return `
                <div class="stepper" data-role="${r.id}">
                  <span class="stepper__label">${r.icon} ${r.name}</span>
                  <div class="flex items-center gap-sm">
                    <button class="stepper__btn" data-action="dec">−</button>
                    <span class="stepper__value">${val}</span>
                    <button class="stepper__btn" data-action="inc">+</button>
                  </div>
                </div>`;
            }).join('')}
          </div>
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${total < 3 ? 'disabled' : ''}>Distribuer les rôles 🌙</button>
        </div>
      </div>
    `;

    root.querySelectorAll('.stepper').forEach((row) => {
      const roleId = row.dataset.role;
      const r = configurable.find((x) => x.id === roleId);
      row.querySelector('[data-action="inc"]').addEventListener('click', () => {
        const cur = local.roleCounts[roleId] ?? r.default;
        const assignedNow = configurable.reduce((s, rr) => s + (local.roleCounts[rr.id] ?? rr.default), 0);
        if (cur < r.max && assignedNow < total) {
          local.roleCounts[roleId] = cur + 1;
          render();
        }
      });
      row.querySelector('[data-action="dec"]').addEventListener('click', () => {
        const cur = local.roleCounts[roleId] ?? r.default;
        if (cur > r.min) { local.roleCounts[roleId] = cur - 1; render(); }
      });
    });

    root.querySelector('#btn-start').addEventListener('click', async () => {
      const res = await ack('lg:start', { roleCounts: local.roleCounts });
      if (!res.ok) return toast(res.error || 'Impossible de lancer.', 'error');
      local.phase = 'playing-night';
      local.night = 1;
      local.currentPhase = null;
      render();
    });

    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function renderNight() {
    const isCupidonPhase = local.currentPhase?.roleId === 'cupidon';

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">NUIT ${local.night}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${local.currentPhase ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">${local.currentPhase.icon}</div>
            <div class="phase-banner__title">${local.currentPhase.name}</div>
            <div class="phase-banner__text">${local.currentPhase.prompt}</div>
          </div>
        ` : `
          <div class="phase-banner">
            <div class="phase-banner__icon">🌙</div>
            <div class="phase-banner__title">La nuit tombe sur le village</div>
            <div class="phase-banner__text">Tout le monde ferme les yeux.</div>
          </div>
        `}

        ${isCupidonPhase ? `
          <div class="card flex-col gap">
            <p class="muted">Touchez 2 joueurs qui tombent amoureux :</p>
            <div class="player-list">
              ${state.players.map((p) => `
                <div class="player-chip player-chip--selectable ${local.selectedLovers.includes(p.id) ? 'is-selected' : ''}" data-id="${p.id}" style="${local.selectedLovers.includes(p.id) ? 'border-color:var(--pink);box-shadow:var(--shadow-glow-pink);' : ''}">
                  <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)}
                </div>`).join('')}
            </div>
            <button class="btn btn--primary btn--block" id="btn-confirm-lovers" ${local.selectedLovers.length === 2 ? '' : 'disabled'}>Confirmer 💘</button>
          </div>
        ` : `
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Suivant ▶</button>
        `}
      </div>
    `;

    if (isCupidonPhase) {
      root.querySelectorAll('.player-chip[data-id]').forEach((chip) => {
        chip.addEventListener('click', () => {
          const id = chip.dataset.id;
          const idx = local.selectedLovers.indexOf(id);
          if (idx >= 0) local.selectedLovers.splice(idx, 1);
          else if (local.selectedLovers.length < 2) local.selectedLovers.push(id);
          render();
        });
      });
      const confirmBtn = root.querySelector('#btn-confirm-lovers');
      if (confirmBtn) confirmBtn.addEventListener('click', () => {
        socket.emit('lg:setLovers', { idA: local.selectedLovers[0], idB: local.selectedLovers[1] });
        local.selectedLovers = [];
        socket.emit('lg:nextPhase');
      });
    } else {
      root.querySelector('#btn-next').addEventListener('click', () => socket.emit('lg:nextPhase'));
    }
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function renderDay() {
    const alive = state.players.filter((p) => local.aliveIds.includes(p.id));
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">JOUR ${local.night}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="phase-banner phase-banner--day">
          <div class="phase-banner__icon">☀️</div>
          <div class="phase-banner__title">Le village se réveille</div>
          <div class="phase-banner__text">Débattez à l'oral, puis touchez un joueur pour l'éliminer (attaque de nuit ou vote).</div>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Joueurs vivants (${alive.length})</p>
          <div class="player-list">
            ${alive.map((p) => `
              <div class="player-chip player-chip--selectable" data-id="${p.id}">
                <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)} ✖
              </div>`).join('')}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-next-night">Nuit suivante 🌙</button>
      </div>
    `;

    root.querySelectorAll('.player-chip[data-id]').forEach((chip) => {
      chip.addEventListener('click', () => {
        socket.emit('lg:eliminate', { playerId: chip.dataset.id });
      });
    });
    root.querySelector('#btn-next-night').addEventListener('click', () => socket.emit('lg:nextNight'));
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function renderGameOver() {
    const isVillage = local.winner === 'village';
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="winner-banner ${isVillage ? 'winner-banner--village' : 'winner-banner--loups'}">
          <div style="font-size:3rem;">${isVillage ? '🧑‍🌾' : '🐺'}</div>
          <div class="winner-banner__title">${isVillage ? 'Le village gagne !' : 'Les Loups-Garous gagnent !'}</div>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Tous les rôles</p>
          <div class="player-list">
            ${Object.entries(local.reveal || {}).map(([id, info]) => {
              const r = roleInfo(meta, info.value);
              return `<div class="player-chip">${r.icon} ${escapeHtml(info.name)} — ${r.name}</div>`;
            }).join('')}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-lobby">Retour au lobby</button>
      </div>
    `;
    root.querySelector('#btn-lobby').addEventListener('click', () => {
      socket.emit('lg:reset');
      gotoLobby();
    });
  }

  function quitGame() {
    if (confirm('Abandonner cette partie de Loup-Garou et revenir au lobby ?')) {
      socket.emit('lg:reset');
      gotoLobby();
    }
  }

  function onPhase(payload) {
    local.myTurnPrompt = null;
    if (payload.stage === 'night') {
      local.phase = 'playing-night';
      local.currentPhase = payload.phase;
      local.night = payload.night;
    } else {
      local.phase = 'playing-day';
      local.night = payload.night;
      local.aliveIds = payload.alive.map((p) => p.id);
    }
    render();
  }
  function onEliminated({ eliminated }) {
    local.aliveIds = local.aliveIds.filter((id) => !eliminated.some((e) => e.id === id));
    if (eliminated.some((e) => e.id === socket.id)) {
      local.myDead = true;
      local.myTurnPrompt = null;
    }
    eliminated.forEach((e) => {
      const r = roleInfo(meta, e.role);
      toast(`☠️ ${e.name} était ${r.icon} ${r.name}`);
    });
    render();
  }
  function onGameOver({ winner, assignments }) {
    local.phase = 'gameover';
    local.winner = winner;
    local.reveal = assignments;
    render();
  }
  function onYourRole(payload) { local.myCard = payload; render(); }
  function onYourTurn({ prompt }) { local.myTurnPrompt = prompt; render(); }
  function onInLove({ partnerName }) { local.myLoveName = partnerName; render(); }

  function onRoomUpdate(payload) {
    const nameById = new Map(state.players.map((p) => [p.id, p.name]));
    const idByName = new Map(payload.players.map((p) => [p.name, p.id]));
    local.aliveIds = local.aliveIds.map((id) => idByName.get(nameById.get(id)) || id);
    if (local.selectedLovers.length) {
      local.selectedLovers = local.selectedLovers.map((id) => idByName.get(nameById.get(id)) || id);
    }
    state.players = payload.players;
    render();
  }

  socket.on('lg:phase', onPhase);
  socket.on('lg:eliminated', onEliminated);
  socket.on('lg:gameOver', onGameOver);
  socket.on('room:update', onRoomUpdate);
  socket.on('lg:yourRole', onYourRole);
  socket.on('lg:yourTurn', onYourTurn);
  socket.on('lg:youAreInLove', onInLove);

  getRoleMeta(ack).then((m) => { meta = m; render(); });
  render();

  return () => {
    socket.off('lg:phase', onPhase);
    socket.off('lg:eliminated', onEliminated);
    socket.off('lg:gameOver', onGameOver);
    socket.off('room:update', onRoomUpdate);
    socket.off('lg:yourRole', onYourRole);
    socket.off('lg:yourTurn', onYourTurn);
    socket.off('lg:youAreInLove', onInLove);
  };
}

// -------------------------------------------------------------- PLAYER ----

export function mountPlayer(ctx) {
  const { root, socket, ack, gotoPlayerWaiting } = ctx;
  let meta = [];
  const payload = ctx.resume || {};
  let local = { roleId: payload.roleId, teammates: payload.teammates || [], turnPrompt: null, dead: false, loveName: null, gameOver: null };

  function render() {
    if (local.gameOver) return renderGameOver();
    const r = roleInfo(meta, local.roleId);
    const teamClass = r.team === 'loups' ? 'role-card--loups' : 'role-card--village';

    root.innerHTML = `
      <div class="screen">
        <div class="brand" style="margin-bottom:0;">
          <span class="brand__moon">🌙</span><span class="brand__name" style="font-size:1.2rem;">Lunaris</span>
        </div>
        <div class="role-card ${teamClass}" style="${local.dead ? 'opacity:0.5;' : ''}">
          <div class="role-card__icon">${r.icon}</div>
          <div class="role-card__name">${r.name}</div>
          <p class="role-card__desc">${r.description}</p>
          ${local.teammates.length ? `<p class="mt muted">Autres loups : <strong>${local.teammates.map(escapeHtml).join(', ')}</strong></p>` : ''}
          ${local.loveName ? `<p class="mt" style="color:var(--pink);">💘 Amoureux(se) de <strong>${escapeHtml(local.loveName)}</strong></p>` : ''}
          ${local.dead ? `<p class="mt" style="color:var(--red);font-weight:700;">☠️ Éliminé(e)</p>` : ''}
        </div>
        ${local.turnPrompt ? `
          <div class="card center" style="border-color:var(--violet);box-shadow:var(--shadow-glow-violet);">
            <p style="font-weight:700;">👀 C'est ton tour</p>
            <p class="muted">${escapeHtml(local.turnPrompt)}</p>
          </div>
        ` : `<p class="faint center">Garde l'écran allumé, discrètement.</p>`}
      </div>
    `;
  }

  function renderGameOver() {
    const isVillage = local.gameOver.winner === 'village';
    root.innerHTML = `
      <div class="screen">
        <div class="winner-banner ${isVillage ? 'winner-banner--village' : 'winner-banner--loups'}">
          <div style="font-size:3rem;">${isVillage ? '🧑‍🌾' : '🐺'}</div>
          <div class="winner-banner__title">${isVillage ? 'Le village gagne !' : 'Les Loups-Garous gagnent !'}</div>
        </div>
        <p class="faint center">En attente du prochain jeu...</p>
      </div>
    `;
  }

  function onYourTurn({ prompt }) { local.turnPrompt = prompt; render(); if (navigator.vibrate) navigator.vibrate(200); }
  function onInLove({ partnerName }) { local.loveName = partnerName; render(); }
  function onEliminated({ eliminated }) {
    if (eliminated.some((e) => e.id === socket.id)) { local.dead = true; local.turnPrompt = null; render(); }
  }
  function onGameOver(payload) { local.gameOver = payload; render(); }
  function onRoomUpdate(payload) { if (!payload.gameType) gotoPlayerWaiting(); }
  function onPhase() { local.turnPrompt = null; }

  socket.on('lg:yourTurn', onYourTurn);
  socket.on('lg:youAreInLove', onInLove);
  socket.on('lg:eliminated', onEliminated);
  socket.on('lg:gameOver', onGameOver);
  socket.on('lg:phase', onPhase);
  socket.on('room:update', onRoomUpdate);

  getRoleMeta(ack).then((m) => { meta = m; render(); });
  render();

  return () => {
    socket.off('lg:yourTurn', onYourTurn);
    socket.off('lg:youAreInLove', onInLove);
    socket.off('lg:eliminated', onEliminated);
    socket.off('lg:gameOver', onGameOver);
    socket.off('lg:phase', onPhase);
    socket.off('room:update', onRoomUpdate);
  };
}

import { escapeHtml, initials } from '../lib/util.js';
import { wheelMarkup, spinWheelTo } from '../lib/wheel.js';

const SPIN_DURATION_MS = 4500;
const WHEEL_TYPES = [
  { id: 'enchere', label: '🔨 Enchère' },
  { id: 'detecteur', label: '🤥 Détecteur' },
  { id: 'qui-est-le-plus', label: '🔥 Qui est le plus' }
];

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
  const { root, ack, state, toast, gotoLobby } = ctx;
  let content = { auctionCategories: [], lieDetectorPrompts: [], quizQuestions: [], gages: [] };
  let tickHandle = null;
  let local = {
    phase: 'roster', // 'roster' -> 'teams' -> 'playing'
    contentReady: false,
    names: state.players.map((p) => p.name),
    teams: {}, // name -> 'A' | 'B'
    teamA: [],
    teamB: [],
    currentTeam: 'A',
    rotation: 0,
    gageCount: { A: 0, B: 0 },
    round: null
  };

  function render() {
    if (local.phase === 'roster') return renderRoster();
    if (local.phase === 'teams') return renderTeams();
    return renderPlaying();
  }

  // ---------------------------------------------------------- ROSTER ----

  function renderRoster() {
    const connectedExtra = state.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">⚔️ Défi d'Équipes — Joueurs</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Deux équipes s'affrontent manche après manche. Une roue tire au sort l'épreuve (Enchère, Détecteur de Mensonges ou Qui est le plus), l'équipe active tente sa chance — en cas d'échec, un(e) joueur(se) tiré(e) au sort reçoit un gage Hot.</p>
          <div class="field">
            <div class="flex justify-between items-center">
              <label style="margin:0;">Joueurs (${local.names.length})</label>
              ${connectedExtra.length ? `<button class="link-btn" id="roster-add-connected" style="padding:0;">+ Ajouter ${connectedExtra.length} connecté${connectedExtra.length > 1 ? 's' : ''}</button>` : ''}
            </div>
            <div class="flex gap-sm mt">
              <input id="roster-input" class="input" placeholder="Prénom" maxlength="20" autocomplete="off" />
              <button class="btn btn--cool" id="roster-add" type="button">Ajouter</button>
            </div>
            ${local.names.length ? `
              <div class="player-list mt">
                ${local.names.map((name, i) => `
                  <div class="player-chip">
                    <span class="player-chip__avatar">${initials(name)}</span>
                    ${escapeHtml(name)}
                    <button class="chip-remove" data-idx="${i}" type="button" aria-label="Retirer ${escapeHtml(name)}">✕</button>
                  </div>
                `).join('')}
              </div>
            ` : `<p class="faint mt">Ajoute au moins 4 prénoms (2 par équipe minimum).</p>`}
          </div>
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-next" ${local.names.length < 4 ? 'disabled' : ''}>Répartir les équipes ▶</button>
        </div>
      </div>
    `;

    const input = root.querySelector('#roster-input');
    const addBtn = root.querySelector('#roster-add');
    const add = () => {
      const val = input.value.trim().slice(0, 20);
      if (!val) return;
      if (local.names.some((n) => n.toLowerCase() === val.toLowerCase())) { input.value = ''; return; }
      local.names.push(val);
      render();
    };
    addBtn.addEventListener('click', add);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    root.querySelectorAll('.chip-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const name = local.names[Number(btn.dataset.idx)];
        delete local.teams[name];
        local.names.splice(Number(btn.dataset.idx), 1);
        render();
      });
    });
    const addConnectedBtn = root.querySelector('#roster-add-connected');
    if (addConnectedBtn) {
      addConnectedBtn.addEventListener('click', () => {
        connectedExtra.forEach((n) => { if (!local.names.some((x) => x.toLowerCase() === n.toLowerCase())) local.names.push(n); });
        render();
      });
    }
    root.querySelector('#btn-next').addEventListener('click', () => { local.phase = 'teams'; render(); });
    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  // ----------------------------------------------------------- TEAMS ----

  function renderTeams() {
    const countA = local.names.filter((n) => local.teams[n] === 'A').length;
    const countB = local.names.filter((n) => local.teams[n] === 'B').length;
    const ready = countA >= 2 && countB >= 2 && local.contentReady;

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">⚔️ Défi d'Équipes — Répartition</p>
          <button class="link-btn" id="btn-roster">← Joueurs</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Touche 🔵 A ou 🔴 B pour chaque joueur (2 minimum par équipe).</p>
          <div class="flex-col gap-sm">
            ${local.names.map((name) => `
              <div class="flex justify-between items-center" style="background:var(--surface); border:1px solid var(--border); padding:8px 10px 8px 14px; border-radius:999px;">
                <span style="font-weight:600;">${escapeHtml(name)}</span>
                <div class="flex gap-sm">
                  <button class="btn btn--sm ${local.teams[name] === 'A' ? 'btn--cool' : 'btn--ghost'}" data-assign="A" data-name="${escapeHtml(name)}" type="button">🔵 A</button>
                  <button class="btn btn--sm ${local.teams[name] === 'B' ? 'btn--danger' : 'btn--ghost'}" data-assign="B" data-name="${escapeHtml(name)}" type="button">🔴 B</button>
                </div>
              </div>
            `).join('')}
          </div>
          <p class="center muted mt">🔵 Équipe A : ${countA} · 🔴 Équipe B : ${countB}</p>
          <button class="btn btn--primary btn--block btn--lg" id="btn-start" ${ready ? '' : 'disabled'}>Lancer le duel ⚔️</button>
        </div>
      </div>
    `;

    root.querySelectorAll('[data-assign]').forEach((btn) => {
      btn.addEventListener('click', () => {
        local.teams[btn.dataset.name] = btn.dataset.assign;
        render();
      });
    });
    root.querySelector('#btn-start').addEventListener('click', startDuel);
    root.querySelector('#btn-roster').addEventListener('click', () => { local.phase = 'roster'; render(); });
  }

  function startDuel() {
    local.teamA = local.names.filter((n) => local.teams[n] === 'A');
    local.teamB = local.names.filter((n) => local.teams[n] === 'B');
    local.currentTeam = Math.random() < 0.5 ? 'A' : 'B';
    local.phase = 'playing';
    beginRound();
  }

  // ---------------------------------------------------------- PLAYING ----

  function opposingTeam() { return local.currentTeam === 'A' ? local.teamB : local.teamA; }
  function activeTeamMembers() { return local.currentTeam === 'A' ? local.teamA : local.teamB; }

  function beginRound() {
    stopTick();
    local.round = { stage: 'ready', gameType: null };
    render();
  }

  function spinForType() {
    if (!local.round || local.round.stage !== 'ready') return;
    local.round.stage = 'spinning';
    render();

    const wheelEl = root.querySelector('#wheel');
    const idx = Math.floor(Math.random() * WHEEL_TYPES.length);
    const labels = WHEEL_TYPES.map((t) => t.label);
    if (wheelEl) spinWheelTo(wheelEl, local.rotation, labels, idx, (newRotation) => { local.rotation = newRotation; });

    setTimeout(() => beginChallenge(WHEEL_TYPES[idx].id), SPIN_DURATION_MS);
  }

  function beginChallenge(gameType) {
    local.round.gameType = gameType;
    local.round.stage = 'challenge';
    local.round.resolved = null;

    if (gameType === 'enchere') {
      local.round.category = pick(content.auctionCategories);
      local.round.running = false;
      local.round.elapsedMs = 0;
      local.round.judged = false;
    } else if (gameType === 'detecteur') {
      local.round.storyteller = pick(activeTeamMembers());
      local.round.prompt = pick(content.lieDetectorPrompts);
      local.round.revealedTruth = null;
      local.round.guessedRight = null;
    } else {
      local.round.question = pick(content.quizQuestions);
      local.round.designated = null;
      local.round.confirmed = null;
    }
    render();
  }

  function resolveRound(success) {
    local.round.resolved = success ? 'success' : 'fail';
    if (!success) {
      local.gageCount[local.currentTeam] += 1;
      local.round.gageTarget = pick(activeTeamMembers());
      local.round.gage = pick(content.gages);
    }
    render();
  }

  function nextRound() {
    local.currentTeam = local.currentTeam === 'A' ? 'B' : 'A';
    beginRound();
  }

  function startChrono() {
    local.round.running = true;
    local.round.startedAt = Date.now();
    render();
    tickHandle = setInterval(() => {
      local.round.elapsedMs = Date.now() - local.round.startedAt;
      const el = root.querySelector('#chrono');
      if (el) el.textContent = formatMs(local.round.elapsedMs);
    }, 100);
  }
  function stopChrono() {
    stopTick();
    local.round.running = false;
    local.round.judged = true;
    render();
  }
  function stopTick() {
    if (tickHandle) { clearInterval(tickHandle); tickHandle = null; }
  }

  function renderPlaying() {
    const team = local.currentTeam;
    const teamLabel = team === 'A' ? '🔵 Équipe A' : '🔴 Équipe B';
    const r = local.round;

    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">DÉFI D'ÉQUIPES</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <p class="center muted">Gages reçus — 🔵 A : ${local.gageCount.A} · 🔴 B : ${local.gageCount.B}</p>

        ${r.stage === 'ready' || r.stage === 'spinning' ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">🎯</div>
            <div class="phase-banner__title">Au tour de ${teamLabel} !</div>
            <div class="phase-banner__text">${r.stage === 'spinning' ? 'La roue tourne...' : "Tournez la roue pour connaître l'épreuve."}</div>
          </div>
          ${wheelMarkup(WHEEL_TYPES.map((t) => t.label), local.rotation)}
          ${r.stage === 'ready' ? `<button class="btn btn--primary btn--block btn--lg" id="btn-spin">Tourner la roue 🎲</button>` : ''}
        ` : renderChallenge(r, team, teamLabel)}
      </div>
    `;

    const spinBtn = root.querySelector('#btn-spin');
    if (spinBtn) spinBtn.addEventListener('click', spinForType);
    wireChallengeEvents(r);
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function renderChallenge(r, team, teamLabel) {
    if (r.resolved) {
      const success = r.resolved === 'success';
      return `
        <div class="winner-banner ${success ? 'winner-banner--village' : 'winner-banner--loups'}">
          <div style="font-size:3rem;">${success ? '🎉' : '😬'}</div>
          <div class="winner-banner__title">${success ? `${teamLabel} s'en sort bien !` : `${teamLabel} doit payer !`}</div>
        </div>
        ${!success ? `
          <p class="center mt">🎯 <strong>${escapeHtml(r.gageTarget)}</strong> choisit :</p>
          <div class="split-choice">
            <div class="card center">
              <p class="eyebrow" style="margin:0;">🎭 Le gage</p>
              <p class="mt" style="font-weight:700;">${escapeHtml(r.gage.text)}</p>
            </div>
            <div class="card center">
              <p class="eyebrow" style="margin:0;">🥃 Ou boire</p>
              <p class="mt" style="font-weight:700; font-size:1.3rem;">${r.gage.sips} gorgée${r.gage.sips > 1 ? 's' : ''}</p>
            </div>
          </div>
        ` : ''}
        <button class="btn btn--primary btn--block btn--lg mt" id="btn-next-round">Manche suivante ▶</button>
      `;
    }

    if (r.gameType === 'enchere') {
      return `
        <div class="phase-banner">
          <div class="phase-banner__icon">🔨</div>
          <div class="phase-banner__title">${teamLabel} — L'Enchère</div>
          <div class="phase-banner__text">Catégorie : <strong>${escapeHtml(r.category)}</strong><br/><span class="faint">Enchérissez à l'oral, puis lancez le chrono pour la livraison !</span></div>
        </div>
        <div class="reveal-name" id="chrono">${formatMs(r.elapsedMs)}</div>
        ${(!r.running && !r.judged) ? `<button class="btn btn--primary btn--block btn--lg" id="btn-go">Démarrer le chrono ▶</button>`
          : r.running ? `<button class="btn btn--danger btn--block btn--lg" id="btn-stop">Stop ⏹</button>`
          : `<div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-success">✅ Réussi</button><button class="btn btn--danger btn--lg" id="btn-fail">❌ Raté</button></div>`}
      `;
    }

    if (r.gameType === 'detecteur') {
      if (r.revealedTruth === null) {
        return `
          <div class="phase-banner">
            <div class="phase-banner__icon">🤥</div>
            <div class="phase-banner__title">${escapeHtml(r.storyteller)} raconte...</div>
            <div class="phase-banner__text">${escapeHtml(r.prompt)}<br/><span class="faint">Vrai ou faux ? L'équipe adverse débat et vote à voix haute !</span></div>
          </div>
          <p class="center muted">Une fois le vote fait, ${escapeHtml(r.storyteller)} révèle la vérité :</p>
          <div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-true">✅ Vrai</button><button class="btn btn--danger btn--lg" id="btn-false">❌ Faux</button></div>
        `;
      }
      return `
        <div class="phase-banner">
          <div class="phase-banner__icon">${r.revealedTruth === 'vrai' ? '✅' : '❌'}</div>
          <div class="phase-banner__title">C'était ${r.revealedTruth === 'vrai' ? 'VRAI' : 'FAUX'} !</div>
          <div class="phase-banner__text">L'équipe adverse avait-elle deviné juste ?</div>
        </div>
        <div class="split-choice"><button class="btn btn--danger btn--lg" id="btn-guess-right">✅ Ils ont deviné juste</button><button class="btn btn--cool btn--lg" id="btn-guess-wrong">❌ Ils se sont trompés</button></div>
      `;
    }

    // qui-est-le-plus
    if (!r.designated) {
      const opponents = opposingTeam();
      return `
        <div class="phase-banner">
          <div class="phase-banner__icon">🔥</div>
          <div class="phase-banner__title">${teamLabel} doit deviner !</div>
          <div class="phase-banner__text">${escapeHtml(r.question)}<br/><span class="faint">Discutez et désignez quelqu'un de l'équipe adverse.</span></div>
        </div>
        <div class="player-list">
          ${opponents.map((n) => `<div class="player-chip player-chip--selectable" data-designate="${escapeHtml(n)}"><span class="player-chip__avatar">${initials(n)}</span>${escapeHtml(n)}</div>`).join('')}
        </div>
      `;
    }
    return `
      <div class="phase-banner">
        <div class="phase-banner__icon">🎯</div>
        <div class="phase-banner__title">${escapeHtml(r.designated)}, tu confirmes ?</div>
        <div class="phase-banner__text">${escapeHtml(r.question)}</div>
      </div>
      <div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-confirm-yes">✅ Je confirme</button><button class="btn btn--danger btn--lg" id="btn-confirm-no">❌ Je démens</button></div>
    `;
  }

  function wireChallengeEvents(r) {
    const nextBtn = root.querySelector('#btn-next-round');
    if (nextBtn) nextBtn.addEventListener('click', nextRound);

    const goBtn = root.querySelector('#btn-go');
    if (goBtn) goBtn.addEventListener('click', startChrono);
    const stopBtn = root.querySelector('#btn-stop');
    if (stopBtn) stopBtn.addEventListener('click', stopChrono);
    const successBtn = root.querySelector('#btn-success');
    if (successBtn) successBtn.addEventListener('click', () => resolveRound(true));
    const failBtn = root.querySelector('#btn-fail');
    if (failBtn) failBtn.addEventListener('click', () => resolveRound(false));

    const trueBtn = root.querySelector('#btn-true');
    if (trueBtn) trueBtn.addEventListener('click', () => { r.revealedTruth = 'vrai'; render(); });
    const falseBtn = root.querySelector('#btn-false');
    if (falseBtn) falseBtn.addEventListener('click', () => { r.revealedTruth = 'faux'; render(); });
    const guessRightBtn = root.querySelector('#btn-guess-right');
    if (guessRightBtn) guessRightBtn.addEventListener('click', () => resolveRound(false));
    const guessWrongBtn = root.querySelector('#btn-guess-wrong');
    if (guessWrongBtn) guessWrongBtn.addEventListener('click', () => resolveRound(true));

    root.querySelectorAll('[data-designate]').forEach((chip) => {
      chip.addEventListener('click', () => { r.designated = chip.dataset.designate; render(); });
    });
    const confirmYesBtn = root.querySelector('#btn-confirm-yes');
    if (confirmYesBtn) confirmYesBtn.addEventListener('click', () => resolveRound(true));
    const confirmNoBtn = root.querySelector('#btn-confirm-no');
    if (confirmNoBtn) confirmNoBtn.addEventListener('click', () => resolveRound(false));
  }

  function quitGame() {
    if (confirm('Quitter le Défi d\'Équipes et revenir au lobby ?')) { stopTick(); gotoLobby(); }
  }

  getContent(ack).then((c) => { content = c; local.contentReady = true; render(); }).catch(() => toast('Impossible de charger le contenu.', 'error'));
  render();

  return () => stopTick();
}

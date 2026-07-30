import { escapeHtml } from '../lib/util.js';
import { nameRosterMarkup, wireNameRoster } from '../lib/nameRoster.js';

let contentCache = null;
async function getContent(ack) {
  if (contentCache) return contentCache;
  contentCache = await ack('meta:roles', {});
  return contentCache;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export function mountHost(ctx) {
  const { root, socket, ack, state, toast, gotoLobby } = ctx;
  let content = { lieDetectorPrompts: [] };
  let local = {
    phase: 'config',
    contentReady: false,
    names: state.players.map((p) => p.name),
    current: null,
    revealed: null
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
          <p class="eyebrow" style="margin:0;">🤥 Détecteur de Mensonges — Configuration</p>
          <button class="link-btn" id="btn-back">← Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">L'écran désigne un joueur au hasard. Il raconte une anecdote — vraie ou fausse — à voix haute. Le groupe débat et vote à main levée, puis on révèle la vérité !</p>
          ${nameRosterMarkup(local.names, connectedExtra)}
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 || !local.contentReady ? 'disabled' : ''}>Lancer 🤥</button>
        </div>
      </div>
    `;
    wireNameRoster(root, local.names, connectedExtra, render);
    root.querySelector('#btn-start').addEventListener('click', () => { local.phase = 'playing'; pickPlayer(); });
    root.querySelector('#btn-back').addEventListener('click', gotoLobby);
  }

  function pickPlayer() {
    local.current = { name: pick(local.names), prompt: pick(content.lieDetectorPrompts) };
    local.revealed = null;
    render();
  }

  function renderPlaying() {
    const c = local.current;
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">DÉTECTEUR DE MENSONGES</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${!local.revealed ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">🎭</div>
            <div class="phase-banner__title">${escapeHtml(c.name)}</div>
            <div class="phase-banner__text">${escapeHtml(c.prompt)}<br/><span class="faint">Vrai ou faux ? Le groupe débat et vote à main levée !</span></div>
          </div>
          <p class="center muted">Une fois le vote fait, ${escapeHtml(c.name)} révèle la vérité :</p>
          <div class="split-choice">
            <button class="btn btn--cool btn--lg" id="btn-true">✅ C'était vrai</button>
            <button class="btn btn--danger btn--lg" id="btn-false">❌ C'était faux</button>
          </div>
        ` : `
          <div class="winner-banner ${local.revealed === 'vrai' ? 'winner-banner--village' : 'winner-banner--loups'}">
            <div style="font-size:3rem;">${local.revealed === 'vrai' ? '✅' : '❌'}</div>
            <div class="winner-banner__title">C'était ${local.revealed === 'vrai' ? 'VRAI' : 'FAUX'} !</div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Joueur suivant ▶</button>
        `}
      </div>
    `;

    const trueBtn = root.querySelector('#btn-true');
    if (trueBtn) trueBtn.addEventListener('click', () => { local.revealed = 'vrai'; render(); });
    const falseBtn = root.querySelector('#btn-false');
    if (falseBtn) falseBtn.addEventListener('click', () => { local.revealed = 'faux'; render(); });
    const nextBtn = root.querySelector('#btn-next');
    if (nextBtn) nextBtn.addEventListener('click', pickPlayer);
    root.querySelector('#btn-back').addEventListener('click', quitGame);
  }

  function quitGame() {
    if (confirm('Quitter le Détecteur de Mensonges et revenir au lobby ?')) gotoLobby();
  }

  function onRoomUpdate(payload) { state.players = payload.players; if (local.phase === 'config') render(); }
  socket.on('room:update', onRoomUpdate);

  getContent(ack).then((c) => { content = c; local.contentReady = true; render(); }).catch(() => toast('Impossible de charger le contenu.', 'error'));
  render();

  return () => socket.off('room:update', onRoomUpdate);
}

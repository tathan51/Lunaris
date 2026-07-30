import { escapeHtml } from '../lib/util.js';

const GAME_LABELS = {
  'loup-garou': '🐺 Loup-Garou',
  undercover: '🕵️ Undercover',
  'qui-est-le-plus': '🔥 Qui est le plus...',
  roulette: '🎡 Roulette'
};

export function mount(ctx) {
  const { root, socket, state, goto } = ctx;

  let playerCount = state.players?.length || 0;
  let preparing = null;

  function render() {
    root.innerHTML = `
      <div class="screen">
        <div class="brand">
          <span class="brand__moon">🌙</span>
          <span class="brand__name">Lunaris</span>
        </div>
        <div class="card center flex-col gap">
          <p class="eyebrow">Tu es dans la partie</p>
          <p class="title">Salut ${escapeHtml(state.name || '')} 👋</p>
          <p class="subtitle">${playerCount} joueur${playerCount > 1 ? 's' : ''} connecté${playerCount > 1 ? 's' : ''}</p>
          <div class="divider"></div>
          ${preparing
            ? `<p><span class="waiting-pulse"></span> &nbsp;L'hôte prépare <strong>${GAME_LABELS[preparing] || preparing}</strong>...</p>`
            : `<p class="muted"><span class="waiting-pulse"></span> &nbsp;En attente que l'hôte lance un jeu...</p>`}
        </div>
        <p class="faint center">Garde cet onglet ouvert, ton téléphone affichera tes infos secrètes ici.</p>
      </div>
    `;
  }

  function onRoomUpdate(payload) {
    playerCount = payload.players.length;
    state.players = payload.players;
    if (!payload.gameType) render();
  }
  function onGameSelected({ gameType }) {
    preparing = gameType;
    render();
  }

  function toGame(mountFn, resume) {
    return () => goto(mountFn, resume);
  }

  async function loadGameModules() {
    const [loupGarou, undercover, quiz, roulette] = await Promise.all([
      import('./loupGarou.js'), import('./undercover.js'), import('./quiEstLePlus.js'), import('./roulette.js')
    ]);

    const onYourRole = (payload) => goto(loupGarou.mountPlayer, payload);
    const onYourWord = (payload) => goto(undercover.mountPlayer, payload);
    const onQuizQuestion = (payload) => goto(quiz.mountPlayer, payload);
    const onRouletteReady = (payload) => goto(roulette.mountPlayer, { mode: payload.mode, result: null });

    socket.on('lg:yourRole', onYourRole);
    socket.on('uc:yourWord', onYourWord);
    socket.on('quiz:question', onQuizQuestion);
    socket.on('roulette:ready', onRouletteReady);

    cleanupFns.push(() => {
      socket.off('lg:yourRole', onYourRole);
      socket.off('uc:yourWord', onYourWord);
      socket.off('quiz:question', onQuizQuestion);
      socket.off('roulette:ready', onRouletteReady);
    });
  }

  const cleanupFns = [];
  socket.on('room:update', onRoomUpdate);
  socket.on('room:gameSelected', onGameSelected);
  cleanupFns.push(() => {
    socket.off('room:update', onRoomUpdate);
    socket.off('room:gameSelected', onGameSelected);
  });

  loadGameModules();
  render();

  return () => cleanupFns.forEach((fn) => fn());
}

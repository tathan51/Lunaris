import { socket, ack } from './lib/socket.js';
import { loadSession, saveSession, clearSession, toast } from './lib/util.js';

import * as home from './screens/home.js';
import * as join from './screens/join.js';
import * as hostLobby from './screens/hostLobby.js';
import * as playerWaiting from './screens/playerWaiting.js';
import * as loupGarou from './screens/loupGarou.js';
import * as undercover from './screens/undercover.js';
import * as quiz from './screens/quiEstLePlus.js';
import * as roulette from './screens/roulette.js';

const root = document.getElementById('app');

const state = {
  role: null,
  code: null,
  token: null,
  name: null,
  players: [],
  gameType: null
};

let currentUnmount = null;

function goto(mountFn, resume) {
  if (currentUnmount) {
    try { currentUnmount(); } catch (e) { /* ignore */ }
    currentUnmount = null;
  }
  root.innerHTML = '';
  window.scrollTo(0, 0);
  const cleanup = mountFn({ ...ctx, resume });
  currentUnmount = typeof cleanup === 'function' ? cleanup : null;
}

const ctx = {
  root, socket, ack, state, goto, toast, saveSession, clearSession,
  gotoLobby: () => goto(hostLobby.mount),
  gotoPlayerWaiting: () => goto(playerWaiting.mount),
  gotoHome: () => { clearSession(); goto(home.mount); }
};

export const screens = { home, join, hostLobby, playerWaiting, loupGarou, undercover, quiz, roulette };

socket.on('room:hostDisconnected', () => {
  if (state.role === 'player') {
    toast("L'hôte a été déconnecté, en attente de reconnexion...", 'error', 6000);
  }
});

async function boot() {
  const session = loadSession();

  if (session?.role === 'host' && session.code && session.token) {
    const res = await ack('host:rejoin', { code: session.code, token: session.token });
    if (res.ok) {
      state.role = 'host';
      state.code = session.code;
      state.token = session.token;
      state.players = res.snapshot.players;
      state.gameType = res.snapshot.gameType;
      resumeHost(res.game, res.mine);
      return;
    }
    clearSession();
  } else if (session?.role === 'player' && session.code && session.name) {
    const res = await ack('player:rejoin', { code: session.code, name: session.name });
    if (res.ok) {
      state.role = 'player';
      state.code = session.code;
      state.name = session.name;
      state.players = res.snapshot.players;
      state.gameType = res.gameType;
      resumePlayer(res.gameType, res.mine, res.publicState);
      return;
    }
    clearSession();
  }

  goto(home.mount);
}

function resumeHost(game, mine) {
  if (!game) return goto(hostLobby.mount);
  const map = {
    'loup-garou': loupGarou.mountHost,
    undercover: undercover.mountHost,
    'qui-est-le-plus': quiz.mountHost,
    roulette: roulette.mountHost
  };
  const fn = map[game.type];
  if (!fn) return goto(hostLobby.mount);
  goto(fn, { game, mine });
}

function resumePlayer(gameType, mine, publicState) {
  const map = {
    'loup-garou': loupGarou.mountPlayer,
    undercover: undercover.mountPlayer,
    'qui-est-le-plus': quiz.mountPlayer,
    roulette: roulette.mountPlayer
  };
  const fn = gameType && map[gameType];
  if (!fn) return goto(playerWaiting.mount);
  const resume = (gameType === 'loup-garou' || gameType === 'undercover') ? mine : publicState;
  goto(fn, resume);
}

boot();

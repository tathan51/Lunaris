const { getTheme } = require('../data/undercoverThemes');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function start(room, playerIds, { themeId, undercoverCount, includeMrWhite }) {
  const theme = getTheme(themeId) || getTheme('animaux');
  const pair = theme.pairs[Math.floor(Math.random() * theme.pairs.length)];

  const total = playerIds.length;
  let ucCount = Math.max(1, Math.min(undercoverCount || 1, Math.floor((total - 2) / 2) || 1));
  const mrWhite = !!includeMrWhite && total >= 4;
  if (ucCount + (mrWhite ? 1 : 0) >= total) ucCount = Math.max(1, total - (mrWhite ? 1 : 0) - 2);

  const shuffled = shuffle(playerIds);
  const roles = {};
  const words = {};

  let i = 0;
  for (; i < ucCount; i++) {
    roles[shuffled[i]] = 'undercover';
    words[shuffled[i]] = pair.undercover;
  }
  if (mrWhite) {
    roles[shuffled[i]] = 'mrwhite';
    words[shuffled[i]] = null;
    i += 1;
  }
  for (; i < shuffled.length; i++) {
    roles[shuffled[i]] = 'civil';
    words[shuffled[i]] = pair.main;
  }

  const state = {
    theme: { id: theme.id, label: theme.label },
    pair,
    roles,
    words,
    alive: new Set(playerIds),
    turnOrder: shuffle(playerIds),
    started: true,
    ended: false,
    winner: null,
    mrWhiteGuessPending: null
  };

  room.game = { type: 'undercover', state };
  return state;
}

function eliminate(state, playerId) {
  if (!state.alive.has(playerId)) return null;
  state.alive.delete(playerId);
  const role = state.roles[playerId];
  const word = state.words[playerId];
  if (role === 'mrwhite') {
    state.mrWhiteGuessPending = playerId;
  }
  return { id: playerId, role, word };
}

function resolveMrWhiteGuess(state, correct) {
  state.mrWhiteGuessPending = null;
  if (correct) {
    state.ended = true;
    state.winner = 'mrwhite';
    return true;
  }
  return false;
}

function checkWinCondition(state) {
  let civils = 0;
  let others = 0; // undercover + mr white
  for (const id of state.alive) {
    const role = state.roles[id];
    if (role === 'civil') civils += 1;
    else others += 1;
  }
  if (others === 0) return 'civils';
  if (others >= civils) return 'undercover';
  return null;
}

function migratePlayer(state, oldId, newId) {
  if (oldId === newId) return;
  if (state.roles[oldId] !== undefined) {
    state.roles[newId] = state.roles[oldId];
    delete state.roles[oldId];
  }
  if (state.words[oldId] !== undefined) {
    state.words[newId] = state.words[oldId];
    delete state.words[oldId];
  }
  if (state.alive.has(oldId)) {
    state.alive.delete(oldId);
    state.alive.add(newId);
  }
  state.turnOrder = state.turnOrder.map((id) => (id === oldId ? newId : id));
  if (state.mrWhiteGuessPending === oldId) state.mrWhiteGuessPending = newId;
}

module.exports = { start, eliminate, resolveMrWhiteGuess, checkWinCondition, migratePlayer };

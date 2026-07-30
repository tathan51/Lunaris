const { ROULETTE } = require('../data/rouletteContent');

function start(room, { mode, names }) {
  const roster = (names || [])
    .map((name) => String(name).trim().slice(0, 20))
    .filter(Boolean)
    .map((name, i) => ({ id: `local-${i}`, name }));

  const state = {
    mode: mode || 'soft',
    roster,
    lastPlayerId: null,
    result: null,
    started: true
  };
  room.game = { type: 'roulette', state };
  return state;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// hot.action entries carry a difficulty ({ text, sips }); soft/moyen are still plain strings.
function actionText(item) {
  return typeof item === 'string' ? item : item.text;
}

function spin(state) {
  if (!state.roster || !state.roster.length) return null;
  const chosen = pick(state.roster);
  const bank = ROULETTE[state.mode] || ROULETTE.soft;

  const result = {
    playerId: chosen.id,
    playerName: chosen.name,
    verite: pick(bank.verite),
    action: actionText(pick(bank.action)),
    actionRevealed: false
  };

  state.lastPlayerId = chosen.id;
  state.result = result;
  return result;
}

function revealAction(state) {
  if (state.result) state.result.actionRevealed = true;
  return state.result;
}

function migratePlayer(state, oldId, newId) {
  if (oldId === newId) return;
  if (state.lastPlayerId === oldId) state.lastPlayerId = newId;
  if (state.result && state.result.playerId === oldId) state.result.playerId = newId;
}

module.exports = { start, spin, revealAction, migratePlayer };

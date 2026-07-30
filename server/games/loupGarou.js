const { ROLES, buildRoleCounts, getNightPhases } = require('../data/loupGarouRoles');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function start(room, playerIds, requestedCounts) {
  const roleCounts = buildRoleCounts(playerIds.length, requestedCounts);

  const pool = [];
  for (const [roleId, count] of Object.entries(roleCounts)) {
    for (let i = 0; i < count; i++) pool.push(roleId);
  }
  const shuffledRoles = shuffle(pool);
  const shuffledPlayers = shuffle(playerIds);

  const assignments = {};
  shuffledPlayers.forEach((pid, idx) => {
    assignments[pid] = shuffledRoles[idx] || 'villageois';
  });

  const state = {
    roleCounts,
    assignments,
    alive: new Set(playerIds),
    lovers: null,
    night: 1,
    stage: 'night',
    currentPhases: getNightPhases(roleCounts, true),
    phaseIndex: -1,
    started: true,
    ended: false,
    winner: null,
    log: []
  };

  room.game = { type: 'loup-garou', state };
  return state;
}

function wolvesInPlay(state) {
  return Object.entries(state.assignments)
    .filter(([, roleId]) => roleId === 'loup-garou')
    .map(([id]) => id);
}

function advancePhase(state) {
  state.phaseIndex += 1;
  if (state.phaseIndex >= state.currentPhases.length) {
    state.stage = 'day';
    return { stage: 'day' };
  }
  return { stage: 'night', phase: state.currentPhases[state.phaseIndex], night: state.night };
}

function goToNextNight(state) {
  state.night += 1;
  state.stage = 'night';
  state.currentPhases = getNightPhases(state.roleCounts, false);
  state.phaseIndex = -1;
  return advancePhase(state);
}

function setLovers(state, idA, idB) {
  state.lovers = [idA, idB];
}

function eliminate(state, playerId) {
  const eliminated = [];
  if (state.alive.has(playerId)) {
    state.alive.delete(playerId);
    eliminated.push(playerId);

    if (state.lovers && state.lovers.includes(playerId)) {
      const otherLover = state.lovers.find((id) => id !== playerId);
      if (otherLover && state.alive.has(otherLover)) {
        state.alive.delete(otherLover);
        eliminated.push(otherLover);
      }
    }
  }
  return eliminated.map((id) => ({ id, role: state.assignments[id] }));
}

function checkWinCondition(state) {
  let wolves = 0;
  let others = 0;
  for (const id of state.alive) {
    if (state.assignments[id] === 'loup-garou') wolves += 1;
    else others += 1;
  }
  if (wolves === 0) return 'village';
  if (wolves >= others) return 'loups';
  return null;
}

function migratePlayer(state, oldId, newId) {
  if (oldId === newId) return;
  if (state.assignments[oldId] !== undefined) {
    state.assignments[newId] = state.assignments[oldId];
    delete state.assignments[oldId];
  }
  if (state.alive.has(oldId)) {
    state.alive.delete(oldId);
    state.alive.add(newId);
  }
  if (state.lovers) {
    state.lovers = state.lovers.map((id) => (id === oldId ? newId : id));
  }
}

module.exports = {
  start,
  wolvesInPlay,
  advancePhase,
  goToNextNight,
  setLovers,
  eliminate,
  checkWinCondition,
  migratePlayer
};

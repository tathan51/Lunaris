const { QUESTIONS } = require('../data/questions');

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildPool(mode) {
  if (mode === 'mix') return [...QUESTIONS.soft, ...QUESTIONS.moyen, ...QUESTIONS.hot];
  return QUESTIONS[mode] || QUESTIONS.soft;
}

function start(room, { mode, count }) {
  const pool = shuffle(buildPool(mode));
  const total = Math.max(1, Math.min(count || 10, pool.length));
  const state = {
    mode,
    questions: pool.slice(0, total),
    index: 0,
    started: true,
    ended: false
  };
  room.game = { type: 'qui-est-le-plus', state };
  return state;
}

function current(state) {
  if (state.index >= state.questions.length) return null;
  return { text: state.questions[state.index], index: state.index, total: state.questions.length };
}

function next(state) {
  state.index += 1;
  if (state.index >= state.questions.length) {
    state.ended = true;
    return null;
  }
  return current(state);
}

module.exports = { start, current, next };

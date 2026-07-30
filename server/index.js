const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

const roomsApi = require('./rooms');
const loupGarou = require('./games/loupGarou');
const undercover = require('./games/undercover');
const quiz = require('./games/quiEstLePlus');
const roulette = require('./games/roulette');
const { ROLE_LIST } = require('./data/loupGarouRoles');
const { THEMES } = require('./data/undercoverThemes');
const { PROMPTS: LIE_DETECTOR_PROMPTS } = require('./data/lieDetectorPrompts');
const { ACCUSATIONS, SENTENCES } = require('./data/tribunalContent');
const { CATEGORIES: AUCTION_CATEGORIES } = require('./data/auctionCategories');
const { QUESTIONS } = require('./data/questions');
const { ROULETTE } = require('./data/rouletteContent');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, '..', 'public')));

const GAME_MIGRATORS = {
  'loup-garou': loupGarou.migratePlayer,
  undercover: undercover.migratePlayer,
  roulette: roulette.migratePlayer
};

const HOST_GRACE_MS = 3 * 60 * 1000;
const PLAYER_GRACE_MS = 6000;
const pendingRoomDeletion = new Map(); // code -> timeout

function roomSnapshot(room) {
  return {
    code: room.code,
    players: roomsApi.publicPlayerList(room),
    gameType: room.game ? room.game.type : null
  };
}

function broadcastRoomUpdate(room) {
  io.to(room.code).emit('room:update', roomSnapshot(room));
}

function cancelPendingDeletion(code) {
  const t = pendingRoomDeletion.get(code);
  if (t) {
    clearTimeout(t);
    pendingRoomDeletion.delete(code);
  }
}

io.on('connection', (socket) => {
  socket.on('host:create', (_payload, ack) => {
    const room = roomsApi.createRoom(socket.id);
    socket.join(room.code);
    ack && ack({ ok: true, code: room.code, token: room.hostToken });
  });

  socket.on('host:rejoin', ({ code, token } = {}, ack) => {
    const result = roomsApi.rejoinHost(code, token, socket.id);
    if (result.error) return ack && ack({ ok: false, error: result.error });
    cancelPendingDeletion(result.room.code);
    socket.join(result.room.code);

    let mine = null;
    if (result.migratedPlayer && result.room.game) {
      if (result.oldId !== socket.id) {
        const migrate = GAME_MIGRATORS[result.room.game.type];
        if (migrate) migrate(result.room.game.state, result.oldId, socket.id);
      }
      mine = privatePayloadFor(result.room, socket.id);
    }

    ack && ack({ ok: true, snapshot: roomSnapshot(result.room), game: serializeGame(result.room), mine });
    broadcastRoomUpdate(result.room);
  });

  socket.on('host:joinAsPlayer', ({ name } = {}, ack) => {
    const room = requireHost(socket);
    if (!room) return ack && ack({ ok: false, error: 'Non autorisé.' });
    const result = roomsApi.joinRoom(room.code, socket.id, name);
    if (result.error) return ack && ack({ ok: false, error: result.error });
    ack && ack({ ok: true });
    broadcastRoomUpdate(result.room);
  });

  socket.on('player:join', ({ code, name } = {}, ack) => {
    const result = roomsApi.joinRoom(code, socket.id, name);
    if (result.error) return ack && ack({ ok: false, error: result.error });
    socket.join(result.room.code);
    ack && ack({ ok: true, code: result.room.code });
    broadcastRoomUpdate(result.room);
  });

  socket.on('player:rejoin', ({ code, name } = {}, ack) => {
    const result = roomsApi.rejoinPlayer(code, name, socket.id);
    if (result.error) return ack && ack({ ok: false, error: result.error });
    socket.join(result.room.code);

    if (result.room.game && result.oldId && result.oldId !== socket.id) {
      const migrate = GAME_MIGRATORS[result.room.game.type];
      if (migrate) migrate(result.room.game.state, result.oldId, socket.id);
    }

    let mine = null;
    let publicState = null;
    if (result.room.game) {
      mine = privatePayloadFor(result.room, result.player.id);
      publicState = publicStateFor(result.room);
    }
    ack && ack({
      ok: true,
      snapshot: roomSnapshot(result.room),
      gameType: result.room.game ? result.room.game.type : null,
      mine,
      publicState
    });
    broadcastRoomUpdate(result.room);
  });

  socket.on('host:selectGame', ({ gameType } = {}) => {
    const room = roomsApi.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    io.to(room.code).emit('room:gameSelected', { gameType });
  });

  socket.on('host:backToLobby', () => {
    const room = roomsApi.getRoomBySocket(socket.id);
    if (!room || room.hostSocketId !== socket.id) return;
    room.game = null;
    broadcastRoomUpdate(room);
  });

  socket.on('meta:roles', (_payload, ack) => {
    ack && ack({
      roles: ROLE_LIST,
      themes: THEMES.map((t) => ({ id: t.id, label: t.label, icon: t.icon })),
      lieDetectorPrompts: LIE_DETECTOR_PROMPTS,
      tribunal: { accusations: ACCUSATIONS, sentences: SENTENCES },
      auctionCategories: AUCTION_CATEGORIES,
      quizQuestions: [...QUESTIONS.soft, ...QUESTIONS.moyen, ...QUESTIONS.hot],
      gages: ROULETTE.hot.action
    });
  });

  // ---------- Loup-Garou ----------
  socket.on('lg:start', ({ roleCounts } = {}, ack) => {
    const room = requireHost(socket);
    if (!room) return ack && ack({ ok: false });
    const playerIds = roomsApi.publicPlayerList(room).map((p) => p.id);
    if (playerIds.length < 3) return ack && ack({ ok: false, error: 'Il faut au moins 3 joueurs.' });

    const state = loupGarou.start(room, playerIds, roleCounts || {});

    for (const pid of playerIds) {
      const roleId = state.assignments[pid];
      const payload = { roleId };
      if (roleId === 'loup-garou') {
        payload.teammates = playerIds
          .filter((id) => id !== pid && state.assignments[id] === 'loup-garou')
          .map((id) => room.players.get(id)?.name)
          .filter(Boolean);
      }
      io.to(pid).emit('lg:yourRole', payload);
    }

    io.to(room.code).emit('lg:started', { roleCounts: state.roleCounts, night: state.night });
    ack && ack({ ok: true });
  });

  socket.on('lg:nextPhase', (_payload, ack) => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'loup-garou') return;
    const state = room.game.state;
    const result = loupGarou.advancePhase(state);
    emitLgPhase(room, state, result);
    ack && ack({ ok: true });
  });

  socket.on('lg:nextNight', () => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'loup-garou') return;
    const state = room.game.state;
    const result = loupGarou.goToNextNight(state);
    emitLgPhase(room, state, result);
  });

  socket.on('lg:setLovers', ({ idA, idB } = {}) => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'loup-garou') return;
    const state = room.game.state;
    loupGarou.setLovers(state, idA, idB);
    const nameA = room.players.get(idA)?.name;
    const nameB = room.players.get(idB)?.name;
    io.to(idA).emit('lg:youAreInLove', { partnerName: nameB });
    io.to(idB).emit('lg:youAreInLove', { partnerName: nameA });
  });

  socket.on('lg:eliminate', ({ playerId } = {}) => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'loup-garou') return;
    const state = room.game.state;
    const eliminated = loupGarou.eliminate(state, playerId).map((e) => ({
      ...e,
      name: room.players.get(e.id)?.name || '???'
    }));
    io.to(room.code).emit('lg:eliminated', { eliminated });

    const winner = loupGarou.checkWinCondition(state);
    if (winner) {
      state.ended = true;
      state.winner = winner;
      io.to(room.code).emit('lg:gameOver', { winner, assignments: revealAll(room, state.assignments) });
    }
  });

  socket.on('lg:reset', () => {
    const room = requireHost(socket);
    if (!room) return;
    room.game = null;
    broadcastRoomUpdate(room);
  });

  // ---------- Undercover ----------
  socket.on('uc:start', (payload = {}, ack) => {
    const room = requireHost(socket);
    if (!room) return ack && ack({ ok: false });
    const playerIds = roomsApi.publicPlayerList(room).map((p) => p.id);
    if (playerIds.length < 3) return ack && ack({ ok: false, error: 'Il faut au moins 3 joueurs.' });

    const state = undercover.start(room, playerIds, payload);

    for (const pid of playerIds) {
      io.to(pid).emit('uc:yourWord', { word: state.words[pid] });
    }
    io.to(room.code).emit('uc:started', {
      theme: state.theme,
      turnOrder: state.turnOrder.map((id) => room.players.get(id)?.name)
    });
    ack && ack({ ok: true });
  });

  socket.on('uc:eliminate', ({ playerId } = {}) => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'undercover') return;
    const state = room.game.state;
    const result = undercover.eliminate(state, playerId);
    if (!result) return;
    const name = room.players.get(playerId)?.name || '???';
    io.to(room.code).emit('uc:revealed', { ...result, name });

    if (result.role === 'mrwhite') {
      io.to(room.hostSocketId).emit('uc:mrWhiteGuess', { playerId, name });
      return;
    }
    const winner = undercover.checkWinCondition(state);
    if (winner) {
      state.ended = true;
      state.winner = winner;
      io.to(room.code).emit('uc:gameOver', { winner, pair: state.pair, roles: revealAll(room, state.roles) });
    }
  });

  socket.on('uc:mrWhiteGuessResult', ({ correct } = {}) => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'undercover') return;
    const state = room.game.state;
    const won = undercover.resolveMrWhiteGuess(state, correct);
    if (won) {
      io.to(room.code).emit('uc:gameOver', { winner: 'mrwhite', pair: state.pair, roles: revealAll(room, state.roles) });
      return;
    }
    const winner = undercover.checkWinCondition(state);
    if (winner) {
      state.ended = true;
      state.winner = winner;
      io.to(room.code).emit('uc:gameOver', { winner, pair: state.pair, roles: revealAll(room, state.roles) });
    } else {
      io.to(room.code).emit('uc:mrWhiteGuessWrong', {});
    }
  });

  socket.on('uc:reset', () => {
    const room = requireHost(socket);
    if (!room) return;
    room.game = null;
    broadcastRoomUpdate(room);
  });

  // ---------- Qui est le plus ----------
  socket.on('quiz:start', (payload = {}, ack) => {
    const room = requireHost(socket);
    if (!room) return ack && ack({ ok: false });
    const state = quiz.start(room, payload);
    io.to(room.code).emit('quiz:question', quiz.current(state));
    ack && ack({ ok: true });
  });

  socket.on('quiz:next', () => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'qui-est-le-plus') return;
    const state = room.game.state;
    const q = quiz.next(state);
    if (q) io.to(room.code).emit('quiz:question', q);
    else io.to(room.code).emit('quiz:finished', {});
  });

  socket.on('quiz:reset', () => {
    const room = requireHost(socket);
    if (!room) return;
    room.game = null;
    broadcastRoomUpdate(room);
  });

  // ---------- Roulette ----------
  socket.on('roulette:start', (payload = {}, ack) => {
    const room = requireHost(socket);
    if (!room) return ack && ack({ ok: false });
    roulette.start(room, payload);
    io.to(room.code).emit('roulette:ready', { mode: payload.mode });
    ack && ack({ ok: true });
  });

  socket.on('roulette:spin', () => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'roulette') return;
    const result = roulette.spin(room.game.state);
    if (result) io.to(room.code).emit('roulette:result', result);
  });

  socket.on('roulette:revealAction', () => {
    const room = requireHost(socket);
    if (!room || !room.game || room.game.type !== 'roulette') return;
    const result = roulette.revealAction(room.game.state);
    io.to(room.code).emit('roulette:actionRevealed', result);
  });

  socket.on('roulette:reset', () => {
    const room = requireHost(socket);
    if (!room) return;
    room.game = null;
    broadcastRoomUpdate(room);
  });

  // ---------- Disconnect ----------
  socket.on('disconnect', () => {
    const result = roomsApi.removeBySocket(socket.id);
    if (!result) return;
    const { room, wasHost } = result;

    if (wasHost) {
      io.to(room.code).emit('room:hostDisconnected', {});
      const t = setTimeout(() => {
        roomsApi.deleteRoom(room.code);
        pendingRoomDeletion.delete(room.code);
      }, HOST_GRACE_MS);
      pendingRoomDeletion.set(room.code, t);
    } else {
      const disconnectedId = socket.id;
      setTimeout(() => {
        const stillGone = room.players.get(disconnectedId);
        if (stillGone && !stillGone.connected) broadcastRoomUpdate(room);
      }, PLAYER_GRACE_MS);
    }
  });

  function requireHost(sock) {
    const room = roomsApi.getRoomBySocket(sock.id);
    if (!room || room.hostSocketId !== sock.id) return null;
    return room;
  }

  function revealAll(room, map) {
    const out = {};
    for (const [id, val] of Object.entries(map)) {
      out[id] = { value: val, name: room.players.get(id)?.name || '???' };
    }
    return out;
  }

  function emitLgPhase(room, state, result) {
    if (result.stage === 'night') {
      io.to(room.hostSocketId).emit('lg:phase', { stage: 'night', phase: result.phase, night: result.night });
      const targets = roomsApi.publicPlayerList(room).filter((p) => state.assignments[p.id] === result.phase.roleId);
      for (const t of targets) io.to(t.id).emit('lg:yourTurn', { prompt: result.phase.prompt, roleName: result.phase.name });
    } else {
      const alive = roomsApi.publicPlayerList(room).filter((p) => state.alive.has(p.id));
      io.to(room.code).emit('lg:phase', { stage: 'day', night: state.night, alive });
    }
  }

  function serializeGame(room) {
    if (!room.game) return null;
    const { type, state } = room.game;
    if (type === 'loup-garou' || type === 'undercover') {
      return { type, state: { ...state, alive: [...state.alive] } };
    }
    return { type, state };
  }

  function publicStateFor(room) {
    if (!room.game) return null;
    if (room.game.type === 'qui-est-le-plus') {
      return quiz.current(room.game.state);
    }
    if (room.game.type === 'roulette') {
      return { mode: room.game.state.mode, result: room.game.state.result };
    }
    return null;
  }

  function privatePayloadFor(room, playerId) {
    if (!room.game) return null;
    if (room.game.type === 'loup-garou') {
      const { assignments } = room.game.state;
      const roleId = assignments[playerId];
      if (!roleId) return null;
      const payload = { type: 'loup-garou', roleId };
      if (roleId === 'loup-garou') {
        payload.teammates = Object.keys(assignments)
          .filter((id) => id !== playerId && assignments[id] === 'loup-garou')
          .map((id) => room.players.get(id)?.name)
          .filter(Boolean);
      }
      return payload;
    }
    if (room.game.type === 'undercover') {
      const word = room.game.state.words[playerId];
      return playerId in room.game.state.words ? { type: 'undercover', word } : null;
    }
    return null;
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n  Lunaris tourne sur http://localhost:${PORT}\n`);
});

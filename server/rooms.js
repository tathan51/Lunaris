const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // sans I/O pour éviter la confusion

const rooms = new Map(); // code -> room
const socketIndex = new Map(); // socketId -> code

function generateCode() {
  let code;
  do {
    code = Array.from({ length: 4 }, () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function createRoom(hostSocketId) {
  const code = generateCode();
  const room = {
    code,
    hostSocketId,
    hostToken: generateToken(),
    players: new Map(), // socketId -> { id, name, connected }
    game: null,
    createdAt: Date.now()
  };
  rooms.set(code, room);
  socketIndex.set(hostSocketId, code);
  return room;
}

function getRoom(code) {
  if (!code) return undefined;
  return rooms.get(code.toUpperCase());
}

function getRoomBySocket(socketId) {
  const code = socketIndex.get(socketId);
  return code ? rooms.get(code) : undefined;
}

function nameTaken(room, name) {
  const lower = name.trim().toLowerCase();
  for (const p of room.players.values()) {
    if (p.connected && p.name.toLowerCase() === lower) return true;
  }
  return false;
}

function joinRoom(code, socketId, name) {
  const room = getRoom(code);
  if (!room) return { error: "Cette soirée n'existe pas (vérifie le code)." };
  const clean = (name || '').trim().slice(0, 20);
  if (!clean) return { error: 'Choisis un prénom.' };
  if (nameTaken(room, clean)) return { error: 'Ce prénom est déjà pris dans cette soirée.' };

  room.players.set(socketId, { id: socketId, name: clean, connected: true });
  socketIndex.set(socketId, room.code);
  return { room };
}

function rejoinPlayer(code, name, newSocketId) {
  const room = getRoom(code);
  if (!room) return { error: 'Soirée introuvable.' };
  const clean = (name || '').trim().slice(0, 20);
  const existing = [...room.players.values()].find((p) => p.name.toLowerCase() === clean.toLowerCase());
  if (!existing) return { error: 'Joueur introuvable dans cette soirée.' };

  const oldId = existing.id;
  room.players.delete(oldId);
  socketIndex.delete(oldId);
  existing.id = newSocketId;
  existing.connected = true;
  room.players.set(newSocketId, existing);
  socketIndex.set(newSocketId, room.code);
  return { room, player: existing, oldId };
}

function rejoinHost(code, token, newSocketId) {
  const room = getRoom(code);
  if (!room) return { error: 'Soirée introuvable.' };
  if (room.hostToken !== token) return { error: 'Jeton hôte invalide.' };
  const oldId = room.hostSocketId;
  socketIndex.delete(oldId);
  room.hostSocketId = newSocketId;
  socketIndex.set(newSocketId, room.code);

  // The host may have also joined their own room as a player (same socket, dual role).
  let migratedPlayer = null;
  if (oldId !== newSocketId && room.players.has(oldId)) {
    const player = room.players.get(oldId);
    room.players.delete(oldId);
    player.id = newSocketId;
    player.connected = true;
    room.players.set(newSocketId, player);
    migratedPlayer = player;
  }

  return { room, oldId, migratedPlayer };
}

function removeBySocket(socketId) {
  const code = socketIndex.get(socketId);
  if (!code) return null;
  const room = rooms.get(code);
  if (!room) return null;

  if (room.players.has(socketId)) {
    const player = room.players.get(socketId);
    player.connected = false;
    socketIndex.delete(socketId);
    return { room, wasHost: false, player };
  }
  if (room.hostSocketId === socketId) {
    socketIndex.delete(socketId);
    return { room, wasHost: true };
  }
  return null;
}

function deleteRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  for (const id of room.players.keys()) socketIndex.delete(id);
  socketIndex.delete(room.hostSocketId);
  rooms.delete(code);
}

function publicPlayerList(room) {
  return [...room.players.values()]
    .filter((p) => p.connected)
    .map((p) => ({ id: p.id, name: p.name }));
}

module.exports = {
  rooms,
  createRoom,
  getRoom,
  getRoomBySocket,
  joinRoom,
  rejoinPlayer,
  rejoinHost,
  removeBySocket,
  deleteRoom,
  publicPlayerList
};

// Définition des rôles Loup-Garou disponibles.
// nightOrder: ordre de passage la nuit (null = pas d'action de nuit active).
// firstNightOnly: le rôle n'agit que la première nuit.

const ROLES = {
  'loup-garou': {
    id: 'loup-garou',
    name: 'Loup-Garou',
    team: 'loups',
    icon: '🐺',
    description: 'Chaque nuit, tu te réveilles avec les autres loups pour désigner une victime à dévorer.',
    configurable: true,
    min: 1,
    max: 8,
    default: 1,
    always: true,
    nightOrder: 10,
    nightPrompt: 'Les Loups-Garous se réveillent, se reconnaissent et désignent en silence une victime.'
  },
  villageois: {
    id: 'villageois',
    name: 'Villageois',
    team: 'village',
    icon: '🧑‍🌾',
    description: "Tu n'as aucun pouvoir. Ta seule arme : ton discours pour démasquer les loups.",
    configurable: false,
    always: true,
    nightOrder: null
  },
  voyante: {
    id: 'voyante',
    name: 'Voyante',
    team: 'village',
    icon: '🔮',
    description: "Chaque nuit, tu peux découvrir en secret l'identité d'un joueur de ton choix.",
    configurable: true,
    min: 0,
    max: 1,
    default: 1,
    nightOrder: 30,
    nightPrompt: 'La Voyante se réveille et désigne un joueur : le Meneur de jeu lui indique en privé son camp.'
  },
  sorciere: {
    id: 'sorciere',
    name: 'Sorcière',
    team: 'village',
    icon: '🧪',
    description: "Tu as deux potions à usage unique : une pour sauver la victime des loups, une pour éliminer un joueur.",
    configurable: true,
    min: 0,
    max: 1,
    default: 1,
    nightOrder: 40,
    nightPrompt: "La Sorcière se réveille. Le Meneur de jeu lui montre la victime des loups. Veut-elle utiliser sa potion de vie ? Et sa potion de mort ?"
  },
  cupidon: {
    id: 'cupidon',
    name: 'Cupidon',
    team: 'village',
    icon: '💘',
    description: "La première nuit uniquement, tu désignes deux amoureux (toi y compris possible). S'ils meurent, l'autre meurt de chagrin.",
    configurable: true,
    min: 0,
    max: 1,
    default: 0,
    nightOrder: 5,
    firstNightOnly: true,
    nightPrompt: 'Cupidon se réveille et désigne en silence deux joueurs qui tomberont amoureux.'
  },
  'petite-fille': {
    id: 'petite-fille',
    name: 'Petite Fille',
    team: 'village',
    icon: '👧',
    description: "Pendant que les loups se réveillent, tu peux discrètement entrouvrir les yeux pour espionner.",
    configurable: true,
    min: 0,
    max: 1,
    default: 0,
    nightOrder: 11,
    nightPrompt: 'La Petite Fille peut risquer un œil pendant le réveil des loups (sans se faire remarquer).'
  },
  chasseur: {
    id: 'chasseur',
    name: 'Chasseur',
    team: 'village',
    icon: '🏹',
    description: "Si tu meurs (loups ou vote), tu emportes immédiatement un autre joueur de ton choix avec toi.",
    configurable: true,
    min: 0,
    max: 1,
    default: 0,
    nightOrder: null
  }
};

const ROLE_LIST = Object.values(ROLES);

function buildRoleCounts(playerCount, requestedCounts = {}) {
  const counts = {};
  let used = 0;

  for (const role of ROLE_LIST) {
    if (!role.configurable) continue;
    const raw = requestedCounts[role.id];
    const n = Number.isFinite(raw) ? Math.max(role.min, Math.min(role.max, raw)) : role.default;
    counts[role.id] = n;
    used += n;
  }

  // Les loups-garous ont au moins 1, borné par les joueurs restants.
  const remainingForVillage = playerCount - used;
  counts['villageois'] = Math.max(0, remainingForVillage);

  return counts;
}

function getNightPhases(roleCounts, isFirstNight) {
  const phases = [];
  for (const role of ROLE_LIST) {
    if (role.nightOrder === null) continue;
    if (role.firstNightOnly && !isFirstNight) continue;
    const count = role.always ? (roleCounts[role.id] || 0) : (roleCounts[role.id] || 0);
    if (count > 0) {
      phases.push({ roleId: role.id, name: role.name, icon: role.icon, prompt: role.nightPrompt });
    }
  }
  return phases.sort((a, b) => (ROLES[a.roleId].nightOrder - ROLES[b.roleId].nightOrder));
}

module.exports = { ROLES, ROLE_LIST, buildRoleCounts, getNightPhases };

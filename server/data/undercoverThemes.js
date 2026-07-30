// Thèmes Undercover : chaque paire { main, undercover } donne le mot majoritaire
// et le mot proche (mais différent) donné aux Undercover.

const THEMES = [
  {
    id: 'animaux',
    label: 'Animaux',
    icon: '🐾',
    pairs: [
      { main: 'Chat', undercover: 'Tigre' },
      { main: 'Chien', undercover: 'Loup' },
      { main: 'Dauphin', undercover: 'Requin' },
      { main: 'Aigle', undercover: 'Faucon' },
      { main: 'Cheval', undercover: 'Âne' },
      { main: 'Grenouille', undercover: 'Crapaud' },
      { main: 'Abeille', undercover: 'Guêpe' },
      { main: 'Lion', undercover: 'Panthère' },
      { main: 'Perroquet', undercover: 'Toucan' },
      { main: 'Hérisson', undercover: 'Porc-épic' }
    ]
  },
  {
    id: 'nourriture',
    label: 'Nourriture',
    icon: '🍔',
    pairs: [
      { main: 'Pizza', undercover: 'Tarte flambée' },
      { main: 'Croissant', undercover: 'Pain au chocolat' },
      { main: 'Frites', undercover: 'Chips' },
      { main: 'Sushi', undercover: 'Maki' },
      { main: 'Crêpe', undercover: 'Gaufre' },
      { main: 'Burger', undercover: 'Hot-dog' },
      { main: 'Chocolat', undercover: 'Caramel' },
      { main: 'Glace', undercover: 'Sorbet' },
      { main: 'Fromage', undercover: 'Yaourt' },
      { main: 'Raclette', undercover: 'Fondue' }
    ]
  },
  {
    id: 'objets',
    label: 'Objets du quotidien',
    icon: '🧦',
    pairs: [
      { main: 'Parapluie', undercover: 'Imperméable' },
      { main: 'Lunettes', undercover: 'Jumelles' },
      { main: 'Valise', undercover: 'Sac à dos' },
      { main: 'Oreiller', undercover: 'Coussin' },
      { main: 'Brosse à dents', undercover: 'Peigne' },
      { main: 'Télécommande', undercover: 'Manette' },
      { main: 'Bougie', undercover: 'Lampe de poche' },
      { main: 'Miroir', undercover: 'Fenêtre' },
      { main: 'Chaussette', undercover: 'Gant' },
      { main: 'Clé', undercover: 'Badge' }
    ]
  },
  {
    id: 'metiers',
    label: 'Métiers',
    icon: '💼',
    pairs: [
      { main: 'Boulanger', undercover: 'Pâtissier' },
      { main: 'Pompier', undercover: 'Policier' },
      { main: 'Professeur', undercover: 'Directeur d\'école' },
      { main: 'Chirurgien', undercover: 'Infirmier' },
      { main: 'Pilote', undercover: 'Steward' },
      { main: 'Avocat', undercover: 'Juge' },
      { main: 'Chanteur', undercover: 'Danseur' },
      { main: 'Jardinier', undercover: 'Fleuriste' },
      { main: 'Pêcheur', undercover: 'Marin' },
      { main: 'Coiffeur', undercover: 'Esthéticienne' }
    ]
  },
  {
    id: 'films-series',
    label: 'Films & Séries',
    icon: '🎬',
    pairs: [
      { main: 'Titanic', undercover: 'Avatar' },
      { main: 'Harry Potter', undercover: 'Le Seigneur des Anneaux' },
      { main: 'Squid Game', undercover: 'Hunger Games' },
      { main: 'Star Wars', undercover: 'Star Trek' },
      { main: 'Friends', undercover: 'How I Met Your Mother' },
      { main: 'Spider-Man', undercover: 'Batman' },
      { main: 'La Reine des Neiges', undercover: 'Raiponce' },
      { main: 'Stranger Things', undercover: 'Dark' },
      { main: 'Le Roi Lion', undercover: 'Madagascar' },
      { main: 'Breaking Bad', undercover: 'Narcos' }
    ]
  },
  {
    id: 'lieux',
    label: 'Lieux',
    icon: '🗺️',
    pairs: [
      { main: 'Plage', undercover: 'Piscine' },
      { main: 'Montagne', undercover: 'Colline' },
      { main: 'Aéroport', undercover: 'Gare' },
      { main: 'Bibliothèque', undercover: 'Librairie' },
      { main: 'Hôpital', undercover: 'Pharmacie' },
      { main: 'Forêt', undercover: 'Jungle' },
      { main: 'Restaurant', undercover: 'Café' },
      { main: 'Supermarché', undercover: 'Marché' },
      { main: 'Désert', undercover: 'Savane' },
      { main: 'Château', undercover: 'Manoir' }
    ]
  }
];

function getTheme(id) {
  return THEMES.find((t) => t.id === id);
}

module.exports = { THEMES, getTheme };

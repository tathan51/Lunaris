// Banque Vérité (visible à la révélation) / Action (carte mystère cachée) pour la roulette.

const ROULETTE = {
  soft: {
    verite: [
      "Quel est ton pire souvenir de vacances ?",
      "Quelle est la chose la plus bête que tu aies crue enfant ?",
      "Quel est ton plus grand défaut selon toi ?",
      "Quelle est la note la plus basse que tu aies eue à l'école ?",
      "Quel est le mensonge le plus récent que tu as dit ?",
      "Quelle est ta plus grande peur ridicule ?",
      "Quel est l'aliment que tu détestes mais que tu manges pour faire plaisir ?",
      "Quelle chanson as-tu honte d'adorer ?",
      "Quel est ton talent le plus inutile ?",
      "Quelle est la chose la plus gênante que tu aies faite devant un prof ?"
    ],
    action: [
      "Imite un animal de ton choix pendant 15 secondes.",
      "Parle avec un accent au choix du groupe jusqu'à ton prochain tour.",
      "Fais 10 pompes ou 20 secondes de gainage.",
      "Chante le refrain de la dernière chanson que tu as écoutée.",
      "Laisse le groupe te coiffer n'importe comment pendant 2 minutes.",
      "Raconte une blague, si personne ne rit tu bois une gorgée.",
      "Fais une déclaration d'amour théâtrale à ton verre.",
      "Danse 15 secondes sans musique.",
      "Fais deviner un mot en mimant, sans parler.",
      "Échange un vêtement avec ton voisin pour le reste du tour."
    ]
  },
  moyen: {
    verite: [
      "Quelle est la chose la plus honteuse que tu aies faite pour impressionner quelqu'un ?",
      "As-tu déjà menti à tout le monde ici ? À propos de quoi ?",
      "Quel est ton plus grand regret amoureux ?",
      "Qui, dans ta vie, t'énerve le plus en ce moment ?",
      "Quelle est la pire chose que tu aies dite derrière le dos de quelqu'un ?",
      "As-tu déjà triché à un examen ou un jeu ?",
      "Quel est le secret le plus fou que tu caches à tes parents ?",
      "Quelle est la chose la plus stupide que tu aies faite par amour ?",
      "As-tu déjà eu le béguin pour l'ami(e) de quelqu'un ici ?",
      "Quelle appli/notification n'aimerais-tu pas que l'on voie sur ton téléphone ?"
    ],
    action: [
      "Envoie un message random du genre 'je pense à toi' à un contact tiré au sort par le groupe.",
      "Laisse quelqu'un du groupe poster un statut sur ton téléphone.",
      "Fais un compliment sincère à chaque personne présente.",
      "Montre la dernière photo de ta galerie (sans tricher).",
      "Appelle un contact et chante-lui joyeux anniversaire, même si ce n'est pas le sien.",
      "Raconte ton pire rendez-vous amoureux en détail.",
      "Laisse le groupe lire ton dernier message envoyé à voix haute.",
      "Imite la personne à ta droite pendant une minute.",
      "Bois une gorgée cul sec sous les encouragements du groupe.",
      "Avoue la dernière fois que tu as menti à quelqu'un dans la pièce."
    ]
  },
  hot: {
    verite: [
      "Quelle est la chose la plus coquine que tu aies faite dans un lieu public ?",
      "As-tu déjà eu un fantasme sur quelqu'un dans cette pièce ?",
      "Quel est ton fantasme le plus inavouable ?",
      "As-tu déjà envoyé une photo un peu trop osée à quelqu'un ?",
      "Quelle est ta position préférée ?",
      "As-tu déjà simulé un orgasme ?",
      "Quel est l'endroit le plus insolite où tu l'as déjà fait ?",
      "À peu près combien de partenaires as-tu eus ?",
      "As-tu déjà eu (ou rêvé d'avoir) un plan à trois ?",
      "Quel est ton pire ET ton meilleur coup d'un soir ?",
      "As-tu déjà craqué pour quelqu'un d'interdit (ex d'un(e) proche, collègue...) ?",
      "As-tu déjà utilisé un jouet coquin ?",
      "Quelle est la première partie du corps que tu regardes chez quelqu'un ?",
      "Quel est le message le plus chaud que tu aies envoyé ou reçu ?",
      "Quel est le surnom le plus intime qu'on t'ait donné ?"
    ],
    // Chaque action a un niveau de difficulté (en gorgées) : sert d'alternative
    // "je bois plutôt que de faire le gage" dans le Défi d'Équipes.
    action: [
      { text: "Fais un mini strip-tease de 10 secondes (un seul vêtement du dessus, on reste correct).", sips: 3 },
      { text: "Donne un massage sensuel de 20 secondes à la personne de ton choix, si elle est d'accord.", sips: 3 },
      { text: "Chuchote ton fantasme à l'oreille de la personne de ton choix.", sips: 2 },
      { text: "Simule un gémissement de plaisir pendant 5 secondes, le plus sérieusement du monde.", sips: 3 },
      { text: "Fais un lap dance impro de 10 secondes sur une chaise (ou sur quelqu'un qui accepte).", sips: 4 },
      { text: "Mime ta position préférée, habillé(e) bien sûr.", sips: 2 },
      { text: "Fais un compliment très cru sur le physique de la personne à ta droite.", sips: 2 },
      { text: "Envoie un texto coquin à la dernière personne dans tes contacts.", sips: 4 },
      { text: "Raconte ton fantasme ultime devant tout le monde.", sips: 3 },
      { text: "Laisse la personne à ta gauche te donner un surnom coquin pour le reste de la soirée.", sips: 1 },
      { text: "Assieds-toi sur les genoux de la personne de ton choix pendant le tour suivant, si elle est d'accord.", sips: 3 },
      { text: "Fais deviner un mot coquin en le mimant, sans un mot.", sips: 2 },
      { text: "Raconte ta pire (ou meilleure) expérience sous la couette.", sips: 3 },
      { text: "Fixe la personne en face de toi dans les yeux pendant 20 secondes en pensant à voix haute à quel point elle est irrésistible.", sips: 2 },
      { text: "Propose un rencard torride à la personne de ton choix, le plus sérieusement possible.", sips: 3 },
      { text: "Cul sec ! Termine ton verre maintenant.", sips: 5 },
      { text: "Bois 3 gorgées de ton verre.", sips: 3 },
      { text: "Choisis qui doit boire son verre à ta place.", sips: 1 },
      { text: "Distribue une gorgée à chaque personne du groupe (une chacun).", sips: 2 },
      { text: "Le voisin de gauche décide combien de gorgées tu bois.", sips: 3 },
      { text: "Bois une gorgée pour chaque ex que tu as eu(e) (ou cul sec si tu perds le compte).", sips: 3 },
      { text: "Lance un 'cheers' général : tout le monde trinque et boit une gorgée.", sips: 1 },
      { text: "Cul sec si tu as déjà menti à quelqu'un dans cette pièce, sinon fais boire ton/ta voisin(e).", sips: 3 }
    ]
  }
};

module.exports = { ROULETTE };

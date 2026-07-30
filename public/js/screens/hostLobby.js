import { escapeHtml, initials } from '../lib/util.js';
import * as loupGarou from './loupGarou.js';
import * as undercover from './undercover.js';
import * as quiz from './quiEstLePlus.js';
import * as roulette from './roulette.js';
import * as lieDetector from './lieDetector.js';
import * as tribunal from './tribunal.js';
import * as auction from './auction.js';
import * as teamDuel from './teamDuel.js';

const GAMES = [
  { id: 'loup-garou', icon: '🐺', title: 'Loup-Garou', desc: 'Rôles secrets + guide de nuit à l\'écran.', min: 3 },
  { id: 'undercover', icon: '🕵️', title: 'Undercover', desc: 'Mots secrets, démasquez les imposteurs.', min: 3 },
  { id: 'qui-est-le-plus', icon: '🔥', title: 'Qui est le plus...', desc: 'Pointez du doigt, 3 ambiances au choix.', min: 0 },
  { id: 'roulette', icon: '🎡', title: 'Roulette', desc: 'Action ou Vérité, au hasard. Prénoms à ajouter sur cet écran.', min: 0 },
  { id: 'lie-detector', icon: '🤥', title: 'Détecteur de Mensonges', desc: 'Anecdote vraie ou fausse, le groupe vote à main levée.', min: 0 },
  { id: 'tribunal', icon: '⚖️', title: 'Le Tribunal', desc: 'Accusation absurde, plaidoirie chronométrée, verdict du jury.', min: 0 },
  { id: 'auction', icon: '🔨', title: "L'Enchère", desc: 'Une catégorie, une surenchère à l\'oral, chrono en main.', min: 0 },
  { id: 'team-duel', icon: '⚔️', title: "Défi d'Équipes", desc: '2 équipes, roue au hasard entre 3 mini-jeux, gage Hot en cas d\'échec.', min: 0 }
];

export function mount(ctx) {
  const { root, socket, state, goto } = ctx;

  function render() {
    const players = state.players || [];
    const me = players.find((p) => p.id === socket.id);
    root.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <div class="brand" style="margin:0;">
            <span class="brand__moon">🌙</span>
            <span class="brand__name" style="font-size:1.3rem;">Lunaris</span>
          </div>
          <button class="link-btn" id="btn-quit">Fermer la soirée</button>
        </div>

        <div class="card center flex-col gap">
          <p class="eyebrow">Code de la soirée</p>
          <div class="code-display">${state.code}</div>
          <p class="muted">Les joueurs ouvrent le site et entrent ce code sur leur téléphone.</p>
        </div>

        <div class="card flex-col gap">
          <div class="flex justify-between items-center">
            <p class="eyebrow" style="margin:0;">Joueurs</p>
            <span class="badge badge--soft">${players.length} connecté${players.length > 1 ? 's' : ''}</span>
          </div>
          ${players.length
            ? `<div class="player-list">${players.map((p) => `
                <div class="player-chip">
                  <span class="player-chip__avatar">${initials(p.name)}</span>
                  ${escapeHtml(p.name)}${p.id === socket.id ? ' <span class="faint">(toi)</span>' : ''}
                </div>`).join('')}</div>`
            : `<div class="empty-hint">En attente de joueurs...</div>`}
        </div>

        <div class="card flex-col gap">
          ${me ? `
            <p class="muted" style="margin:0;">🎴 Tu joues aussi, sous le nom <strong>${escapeHtml(me.name)}</strong>. Pendant Loup-Garou/Undercover, ta carte secrète apparaîtra via un bouton flottant — garde-la cachée des regards.</p>
          ` : `
            <p class="eyebrow" style="text-align:left; margin:0;">Tu joues aussi depuis cet écran ?</p>
            <p class="faint" style="margin:0;">Si chacun a son téléphone, inutile — rejoins plutôt normalement depuis le tien.</p>
            <div class="flex gap-sm">
              <input id="my-name" class="input" placeholder="Ton prénom" maxlength="20" />
              <button class="btn btn--cool" id="btn-join-too">Rejoindre</button>
            </div>
          `}
        </div>

        <div class="flex-col gap-sm">
          <p class="eyebrow" style="text-align:left;">Choisir un jeu</p>
          <div class="game-grid">
            ${GAMES.map((g) => `
              <button class="game-card" data-game="${g.id}" ${players.length < g.min ? 'disabled style="opacity:.45;cursor:not-allowed;"' : ''}>
                <span class="game-card__icon">${g.icon}</span>
                <span class="game-card__title">${g.title}</span>
                <span class="game-card__desc">${g.desc}</span>
                ${players.length < g.min ? `<span class="faint">${g.min} joueurs min.</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    const joinTooBtn = root.querySelector('#btn-join-too');
    if (joinTooBtn) {
      const nameInput = root.querySelector('#my-name');
      const submit = async () => {
        const name = nameInput.value.trim();
        if (!name) return ctx.toast('Entre ton prénom.', 'error');
        joinTooBtn.disabled = true;
        const res = await ctx.ack('host:joinAsPlayer', { name });
        joinTooBtn.disabled = false;
        if (!res.ok) return ctx.toast(res.error || 'Impossible de rejoindre.', 'error');
      };
      joinTooBtn.addEventListener('click', submit);
      nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }

    root.querySelectorAll('.game-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const id = btn.dataset.game;
        socket.emit('host:selectGame', { gameType: id });
        const map = {
          'loup-garou': loupGarou.mountHost,
          undercover: undercover.mountHost,
          'qui-est-le-plus': quiz.mountHost,
          roulette: roulette.mountHost,
          'lie-detector': lieDetector.mountHost,
          tribunal: tribunal.mountHost,
          auction: auction.mountHost,
          'team-duel': teamDuel.mountHost
        };
        goto(map[id]);
      });
    });

    root.querySelector('#btn-quit').addEventListener('click', () => {
      if (confirm('Fermer la soirée pour tout le monde ?')) {
        ctx.clearSession();
        location.reload();
      }
    });
  }

  function onRoomUpdate(payload) {
    state.players = payload.players;
    render();
  }
  socket.on('room:update', onRoomUpdate);

  render();

  return () => socket.off('room:update', onRoomUpdate);
}

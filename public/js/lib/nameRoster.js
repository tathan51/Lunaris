import { escapeHtml, initials } from './util.js';

export function nameRosterMarkup(names, connectedExtra = []) {
  return `
    <div class="field">
      <div class="flex justify-between items-center">
        <label style="margin:0;">Joueurs (${names.length})</label>
        ${connectedExtra.length ? `<button class="link-btn" id="roster-add-connected" style="padding:0;">+ Ajouter ${connectedExtra.length} connecté${connectedExtra.length > 1 ? 's' : ''}</button>` : ''}
      </div>
      <div class="flex gap-sm mt">
        <input id="roster-input" class="input" placeholder="Prénom" maxlength="20" autocomplete="off" />
        <button class="btn btn--cool" id="roster-add" type="button">Ajouter</button>
      </div>
      ${names.length ? `
        <div class="player-list mt">
          ${names.map((name, i) => `
            <div class="player-chip">
              <span class="player-chip__avatar">${initials(name)}</span>
              ${escapeHtml(name)}
              <button class="chip-remove" data-idx="${i}" type="button" aria-label="Retirer ${escapeHtml(name)}">✕</button>
            </div>
          `).join('')}
        </div>
      ` : `<p class="faint mt">Ajoute au moins 2 prénoms pour commencer — pas besoin que les joueurs rejoignent depuis leur téléphone.</p>`}
    </div>
  `;
}

export function wireNameRoster(root, names, connectedExtra, onChange) {
  const input = root.querySelector('#roster-input');
  const addBtn = root.querySelector('#roster-add');

  const add = () => {
    const val = input.value.trim().slice(0, 20);
    if (!val) return;
    if (names.some((n) => n.toLowerCase() === val.toLowerCase())) { input.value = ''; return; }
    names.push(val);
    onChange();
  };

  addBtn.addEventListener('click', add);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } });

  root.querySelectorAll('.chip-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      names.splice(Number(btn.dataset.idx), 1);
      onChange();
    });
  });

  const addConnectedBtn = root.querySelector('#roster-add-connected');
  if (addConnectedBtn) {
    addConnectedBtn.addEventListener('click', () => {
      connectedExtra.forEach((n) => {
        if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
      });
      onChange();
    });
  }
}

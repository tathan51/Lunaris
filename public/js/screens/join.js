import * as home from './home.js';
import * as playerWaiting from './playerWaiting.js';

export function mount(ctx) {
  const { root, ack, state, goto, toast, saveSession } = ctx;

  root.insertAdjacentHTML('beforeend', `
    <div class="screen">
      <div class="brand">
        <span class="brand__moon">🌙</span>
        <span class="brand__name">Lunaris</span>
      </div>
      <p class="eyebrow">Rejoindre une soirée</p>

      <div class="card flex-col gap">
        <div class="field">
          <label for="code">Code de la soirée</label>
          <input id="code" class="input input--code" maxlength="4" placeholder="XXXX" autocomplete="off" autocapitalize="characters" />
        </div>
        <div class="field">
          <label for="name">Ton prénom</label>
          <input id="name" class="input" maxlength="20" placeholder="Ex : Léa" autocomplete="off" />
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-submit">Rejoindre 🚀</button>
        <button class="link-btn" id="btn-back">← Retour</button>
      </div>
    </div>
  `);

  const codeInput = root.querySelector('#code');
  const nameInput = root.querySelector('#name');
  const btn = root.querySelector('#btn-submit');

  codeInput.addEventListener('input', () => {
    codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  });

  async function submit() {
    const code = codeInput.value.trim();
    const name = nameInput.value.trim();
    if (code.length !== 4) return toast('Le code fait 4 lettres.', 'error');
    if (!name) return toast('Entre ton prénom.', 'error');

    btn.disabled = true;
    const res = await ack('player:join', { code, name });
    btn.disabled = false;
    if (!res.ok) return toast(res.error || 'Impossible de rejoindre.', 'error');

    state.role = 'player';
    state.code = code;
    state.name = name;
    saveSession({ role: 'player', code, name });
    goto(playerWaiting.mount);
  }

  btn.addEventListener('click', submit);
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  codeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') nameInput.focus(); });

  root.querySelector('#btn-back').addEventListener('click', () => goto(home.mount));
}

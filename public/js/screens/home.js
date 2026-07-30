import * as join from './join.js';
import * as hostLobby from './hostLobby.js';

export function mount(ctx) {
  const { root, ack, state, goto, toast, saveSession } = ctx;

  root.insertAdjacentHTML('beforeend', `
    <div class="screen">
      <div class="brand">
        <span class="brand__moon">🌙</span>
        <span class="brand__name">Lunaris</span>
      </div>
      <p class="subtitle">Le hub de jeux pour vos soirées entre amis.<br/>Créez une soirée sur l'écran principal, les autres rejoignent depuis leur téléphone.</p>

      <div class="card flex-col gap">
        <button class="btn btn--primary btn--block btn--lg" id="btn-create">🎉 Créer une soirée</button>
        <button class="btn btn--ghost btn--block btn--lg" id="btn-join">📱 Rejoindre une soirée</button>
      </div>

      <p class="faint center">Astuce : gardez cet écran sur un laptop/TV et jouez avec vos téléphones.</p>
    </div>
  `);

  const btnCreate = root.querySelector('#btn-create');
  const btnJoin = root.querySelector('#btn-join');

  async function onCreate() {
    btnCreate.disabled = true;
    const res = await ack('host:create', {});
    btnCreate.disabled = false;
    if (!res.ok) return toast("Impossible de créer la soirée.", 'error');
    state.role = 'host';
    state.code = res.code;
    state.token = res.token;
    state.players = [];
    state.gameType = null;
    saveSession({ role: 'host', code: res.code, token: res.token });
    goto(hostLobby.mount);
  }

  function onJoin() {
    goto(join.mount);
  }

  btnCreate.addEventListener('click', onCreate);
  btnJoin.addEventListener('click', onJoin);
}

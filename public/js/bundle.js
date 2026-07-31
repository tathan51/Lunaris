(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res, err) => function __init() {
    if (err) throw err[0];
    try {
      return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
    } catch (e) {
      throw err = [e], e;
    }
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // public/js/lib/util.js
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]);
  }
  function initials(name) {
    return (name || "?").trim().slice(0, 1).toUpperCase();
  }
  function saveSession(data) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
    }
  }
  function loadSession() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (e) {
    }
  }
  function toast(message, type = "info", duration = 3200) {
    const host = document.getElementById("toasts");
    if (!host) return;
    const el = document.createElement("div");
    el.className = `toast${type === "error" ? " toast--error" : ""}`;
    el.textContent = message;
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = "opacity 0.3s ease";
      el.style.opacity = "0";
      setTimeout(() => el.remove(), 300);
    }, duration);
  }
  var STORAGE_KEY;
  var init_util = __esm({
    "public/js/lib/util.js"() {
      STORAGE_KEY = "lunaris-session";
    }
  });

  // public/js/screens/loupGarou.js
  var loupGarou_exports = {};
  __export(loupGarou_exports, {
    mountHost: () => mountHost,
    mountPlayer: () => mountPlayer
  });
  async function getRoleMeta(ack2) {
    if (roleMetaCache) return roleMetaCache;
    const res = await ack2("meta:roles", {});
    roleMetaCache = res.roles || [];
    return roleMetaCache;
  }
  function roleInfo(meta, roleId) {
    return meta.find((r) => r.id === roleId) || { name: roleId, icon: "\u2753", team: "village", description: "" };
  }
  function mountHost(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let meta = [];
    let local = {
      phase: "config",
      roleCounts: {},
      night: 1,
      currentPhase: null,
      aliveIds: [],
      selectedLovers: [],
      myCard: null,
      myTurnPrompt: null,
      myLoveName: null,
      myDead: false,
      cardRevealed: false
    };
    if (ctx2.resume?.game?.type === "loup-garou") {
      const g = ctx2.resume.game;
      local.phase = g.state.ended ? "gameover" : "playing-day";
      local.roleCounts = g.state.roleCounts;
      local.night = g.state.night;
      local.aliveIds = g.state.alive;
      local.ended = g.state.ended;
      local.winner = g.state.winner;
      local.assignments = g.state.assignments;
    }
    if (ctx2.resume?.mine) local.myCard = ctx2.resume.mine;
    function playerName(id) {
      return state2.players.find((p) => p.id === id)?.name || "???";
    }
    function render() {
      if (local.phase === "config") renderConfig();
      else if (local.phase === "playing-night") renderNight();
      else if (local.phase === "playing-day") renderDay();
      else if (local.phase === "gameover") renderGameOver();
      renderMyCardWidget();
    }
    function renderMyCardWidget() {
      if (!local.myCard) return;
      const r = roleInfo(meta, local.myCard.roleId);
      const teamClass = r.team === "loups" ? "role-card--loups" : "role-card--village";
      root2.insertAdjacentHTML("beforeend", `
      <button id="my-card-fab" class="my-card-fab ${local.myTurnPrompt ? "has-ping" : ""}" title="Ta carte">\u{1F3B4}</button>
      ${local.cardRevealed ? `
        <div class="my-card-overlay" id="my-card-overlay">
          <div class="role-card ${teamClass}" style="${local.myDead ? "opacity:0.5;" : ""}">
            <div class="role-card__icon">${r.icon}</div>
            <div class="role-card__name">${r.name}</div>
            <p class="role-card__desc">${r.description}</p>
            ${local.myCard.teammates?.length ? `<p class="mt muted">Autres loups : <strong>${local.myCard.teammates.map(escapeHtml).join(", ")}</strong></p>` : ""}
            ${local.myLoveName ? `<p class="mt" style="color:var(--pink);">\u{1F498} Amoureux(se) de <strong>${escapeHtml(local.myLoveName)}</strong></p>` : ""}
            ${local.myDead ? `<p class="mt" style="color:var(--red);font-weight:700;">\u2620\uFE0F \xC9limin\xE9(e)</p>` : ""}
            ${local.myTurnPrompt ? `<p class="mt" style="color:var(--violet);font-weight:700;">\u{1F440} ${escapeHtml(local.myTurnPrompt)}</p>` : ""}
          </div>
          <button class="btn btn--ghost btn--block" id="btn-hide-card" style="max-width:360px;">Cacher</button>
        </div>
      ` : ""}
    `);
      root2.querySelector("#my-card-fab").addEventListener("click", () => {
        local.cardRevealed = !local.cardRevealed;
        render();
      });
      const hideBtn = root2.querySelector("#btn-hide-card");
      if (hideBtn) hideBtn.addEventListener("click", () => {
        local.cardRevealed = false;
        render();
      });
      const overlay = root2.querySelector("#my-card-overlay");
      if (overlay) overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          local.cardRevealed = false;
          render();
        }
      });
    }
    function renderConfig() {
      const configurable = meta.filter((r) => r.configurable);
      const total = state2.players.length;
      const assigned = configurable.reduce((sum, r) => sum + (local.roleCounts[r.id] ?? r.default), 0);
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u{1F43A} Loup-Garou \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">${total} joueurs. Les r\xF4les non attribu\xE9s deviennent Villageois (<strong>${Math.max(0, total - assigned)}</strong> pour l'instant).</p>
          <div class="flex-col gap-sm">
            ${configurable.map((r) => {
        const val = local.roleCounts[r.id] ?? r.default;
        return `
                <div class="stepper" data-role="${r.id}">
                  <span class="stepper__label">${r.icon} ${r.name}</span>
                  <div class="flex items-center gap-sm">
                    <button class="stepper__btn" data-action="dec">\u2212</button>
                    <span class="stepper__value">${val}</span>
                    <button class="stepper__btn" data-action="inc">+</button>
                  </div>
                </div>`;
      }).join("")}
          </div>
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${total < 3 ? "disabled" : ""}>Distribuer les r\xF4les \u{1F319}</button>
        </div>
      </div>
    `;
      root2.querySelectorAll(".stepper").forEach((row) => {
        const roleId = row.dataset.role;
        const r = configurable.find((x) => x.id === roleId);
        row.querySelector('[data-action="inc"]').addEventListener("click", () => {
          const cur = local.roleCounts[roleId] ?? r.default;
          const assignedNow = configurable.reduce((s, rr) => s + (local.roleCounts[rr.id] ?? rr.default), 0);
          if (cur < r.max && assignedNow < total) {
            local.roleCounts[roleId] = cur + 1;
            render();
          }
        });
        row.querySelector('[data-action="dec"]').addEventListener("click", () => {
          const cur = local.roleCounts[roleId] ?? r.default;
          if (cur > r.min) {
            local.roleCounts[roleId] = cur - 1;
            render();
          }
        });
      });
      root2.querySelector("#btn-start").addEventListener("click", async () => {
        const res = await ack2("lg:start", { roleCounts: local.roleCounts });
        if (!res.ok) return toast2(res.error || "Impossible de lancer.", "error");
        local.phase = "playing-night";
        local.night = 1;
        local.currentPhase = null;
        render();
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function renderNight() {
      const isCupidonPhase = local.currentPhase?.roleId === "cupidon";
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">NUIT ${local.night}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${local.currentPhase ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">${local.currentPhase.icon}</div>
            <div class="phase-banner__title">${local.currentPhase.name}</div>
            <div class="phase-banner__text">${local.currentPhase.prompt}</div>
          </div>
        ` : `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u{1F319}</div>
            <div class="phase-banner__title">La nuit tombe sur le village</div>
            <div class="phase-banner__text">Tout le monde ferme les yeux.</div>
          </div>
        `}

        ${isCupidonPhase ? `
          <div class="card flex-col gap">
            <p class="muted">Touchez 2 joueurs qui tombent amoureux :</p>
            <div class="player-list">
              ${state2.players.map((p) => `
                <div class="player-chip player-chip--selectable ${local.selectedLovers.includes(p.id) ? "is-selected" : ""}" data-id="${p.id}" style="${local.selectedLovers.includes(p.id) ? "border-color:var(--pink);box-shadow:var(--shadow-glow-pink);" : ""}">
                  <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)}
                </div>`).join("")}
            </div>
            <button class="btn btn--primary btn--block" id="btn-confirm-lovers" ${local.selectedLovers.length === 2 ? "" : "disabled"}>Confirmer \u{1F498}</button>
          </div>
        ` : `
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Suivant \u25B6</button>
        `}
      </div>
    `;
      if (isCupidonPhase) {
        root2.querySelectorAll(".player-chip[data-id]").forEach((chip) => {
          chip.addEventListener("click", () => {
            const id = chip.dataset.id;
            const idx = local.selectedLovers.indexOf(id);
            if (idx >= 0) local.selectedLovers.splice(idx, 1);
            else if (local.selectedLovers.length < 2) local.selectedLovers.push(id);
            render();
          });
        });
        const confirmBtn = root2.querySelector("#btn-confirm-lovers");
        if (confirmBtn) confirmBtn.addEventListener("click", () => {
          socket2.emit("lg:setLovers", { idA: local.selectedLovers[0], idB: local.selectedLovers[1] });
          local.selectedLovers = [];
          socket2.emit("lg:nextPhase");
        });
      } else {
        root2.querySelector("#btn-next").addEventListener("click", () => socket2.emit("lg:nextPhase"));
      }
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function renderDay() {
      const alive = state2.players.filter((p) => local.aliveIds.includes(p.id));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">JOUR ${local.night}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="phase-banner phase-banner--day">
          <div class="phase-banner__icon">\u2600\uFE0F</div>
          <div class="phase-banner__title">Le village se r\xE9veille</div>
          <div class="phase-banner__text">D\xE9battez \xE0 l'oral, puis touchez un joueur pour l'\xE9liminer (attaque de nuit ou vote).</div>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Joueurs vivants (${alive.length})</p>
          <div class="player-list">
            ${alive.map((p) => `
              <div class="player-chip player-chip--selectable" data-id="${p.id}">
                <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)} \u2716
              </div>`).join("")}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-next-night">Nuit suivante \u{1F319}</button>
      </div>
    `;
      root2.querySelectorAll(".player-chip[data-id]").forEach((chip) => {
        chip.addEventListener("click", () => {
          socket2.emit("lg:eliminate", { playerId: chip.dataset.id });
        });
      });
      root2.querySelector("#btn-next-night").addEventListener("click", () => socket2.emit("lg:nextNight"));
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function renderGameOver() {
      const isVillage = local.winner === "village";
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="winner-banner ${isVillage ? "winner-banner--village" : "winner-banner--loups"}">
          <div style="font-size:3rem;">${isVillage ? "\u{1F9D1}\u200D\u{1F33E}" : "\u{1F43A}"}</div>
          <div class="winner-banner__title">${isVillage ? "Le village gagne !" : "Les Loups-Garous gagnent !"}</div>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Tous les r\xF4les</p>
          <div class="player-list">
            ${Object.entries(local.reveal || {}).map(([id, info]) => {
        const r = roleInfo(meta, info.value);
        return `<div class="player-chip">${r.icon} ${escapeHtml(info.name)} \u2014 ${r.name}</div>`;
      }).join("")}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-lobby">Retour au lobby</button>
      </div>
    `;
      root2.querySelector("#btn-lobby").addEventListener("click", () => {
        socket2.emit("lg:reset");
        gotoLobby();
      });
    }
    function quitGame() {
      if (confirm("Abandonner cette partie de Loup-Garou et revenir au lobby ?")) {
        socket2.emit("lg:reset");
        gotoLobby();
      }
    }
    function onPhase(payload) {
      local.myTurnPrompt = null;
      if (payload.stage === "night") {
        local.phase = "playing-night";
        local.currentPhase = payload.phase;
        local.night = payload.night;
      } else {
        local.phase = "playing-day";
        local.night = payload.night;
        local.aliveIds = payload.alive.map((p) => p.id);
      }
      render();
    }
    function onEliminated({ eliminated }) {
      local.aliveIds = local.aliveIds.filter((id) => !eliminated.some((e) => e.id === id));
      if (eliminated.some((e) => e.id === socket2.id)) {
        local.myDead = true;
        local.myTurnPrompt = null;
      }
      eliminated.forEach((e) => {
        const r = roleInfo(meta, e.role);
        toast2(`\u2620\uFE0F ${e.name} \xE9tait ${r.icon} ${r.name}`);
      });
      render();
    }
    function onGameOver({ winner, assignments }) {
      local.phase = "gameover";
      local.winner = winner;
      local.reveal = assignments;
      render();
    }
    function onYourRole(payload) {
      local.myCard = payload;
      render();
    }
    function onYourTurn({ prompt }) {
      local.myTurnPrompt = prompt;
      render();
    }
    function onInLove({ partnerName }) {
      local.myLoveName = partnerName;
      render();
    }
    function onRoomUpdate(payload) {
      const nameById = new Map(state2.players.map((p) => [p.id, p.name]));
      const idByName = new Map(payload.players.map((p) => [p.name, p.id]));
      local.aliveIds = local.aliveIds.map((id) => idByName.get(nameById.get(id)) || id);
      if (local.selectedLovers.length) {
        local.selectedLovers = local.selectedLovers.map((id) => idByName.get(nameById.get(id)) || id);
      }
      state2.players = payload.players;
      render();
    }
    socket2.on("lg:phase", onPhase);
    socket2.on("lg:eliminated", onEliminated);
    socket2.on("lg:gameOver", onGameOver);
    socket2.on("room:update", onRoomUpdate);
    socket2.on("lg:yourRole", onYourRole);
    socket2.on("lg:yourTurn", onYourTurn);
    socket2.on("lg:youAreInLove", onInLove);
    getRoleMeta(ack2).then((m) => {
      meta = m;
      render();
    });
    render();
    return () => {
      socket2.off("lg:phase", onPhase);
      socket2.off("lg:eliminated", onEliminated);
      socket2.off("lg:gameOver", onGameOver);
      socket2.off("room:update", onRoomUpdate);
      socket2.off("lg:yourRole", onYourRole);
      socket2.off("lg:yourTurn", onYourTurn);
      socket2.off("lg:youAreInLove", onInLove);
    };
  }
  function mountPlayer(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, gotoPlayerWaiting } = ctx2;
    let meta = [];
    const payload = ctx2.resume || {};
    let local = { roleId: payload.roleId, teammates: payload.teammates || [], turnPrompt: null, dead: false, loveName: null, gameOver: null };
    function render() {
      if (local.gameOver) return renderGameOver();
      const r = roleInfo(meta, local.roleId);
      const teamClass = r.team === "loups" ? "role-card--loups" : "role-card--village";
      root2.innerHTML = `
      <div class="screen">
        <div class="brand" style="margin-bottom:0;">
          <span class="brand__moon">\u{1F319}</span><span class="brand__name" style="font-size:1.2rem;">Lunaris</span>
        </div>
        <div class="role-card ${teamClass}" style="${local.dead ? "opacity:0.5;" : ""}">
          <div class="role-card__icon">${r.icon}</div>
          <div class="role-card__name">${r.name}</div>
          <p class="role-card__desc">${r.description}</p>
          ${local.teammates.length ? `<p class="mt muted">Autres loups : <strong>${local.teammates.map(escapeHtml).join(", ")}</strong></p>` : ""}
          ${local.loveName ? `<p class="mt" style="color:var(--pink);">\u{1F498} Amoureux(se) de <strong>${escapeHtml(local.loveName)}</strong></p>` : ""}
          ${local.dead ? `<p class="mt" style="color:var(--red);font-weight:700;">\u2620\uFE0F \xC9limin\xE9(e)</p>` : ""}
        </div>
        ${local.turnPrompt ? `
          <div class="card center" style="border-color:var(--violet);box-shadow:var(--shadow-glow-violet);">
            <p style="font-weight:700;">\u{1F440} C'est ton tour</p>
            <p class="muted">${escapeHtml(local.turnPrompt)}</p>
          </div>
        ` : `<p class="faint center">Garde l'\xE9cran allum\xE9, discr\xE8tement.</p>`}
      </div>
    `;
    }
    function renderGameOver() {
      const isVillage = local.gameOver.winner === "village";
      root2.innerHTML = `
      <div class="screen">
        <div class="winner-banner ${isVillage ? "winner-banner--village" : "winner-banner--loups"}">
          <div style="font-size:3rem;">${isVillage ? "\u{1F9D1}\u200D\u{1F33E}" : "\u{1F43A}"}</div>
          <div class="winner-banner__title">${isVillage ? "Le village gagne !" : "Les Loups-Garous gagnent !"}</div>
        </div>
        <p class="faint center">En attente du prochain jeu...</p>
      </div>
    `;
    }
    function onYourTurn({ prompt }) {
      local.turnPrompt = prompt;
      render();
      if (navigator.vibrate) navigator.vibrate(200);
    }
    function onInLove({ partnerName }) {
      local.loveName = partnerName;
      render();
    }
    function onEliminated({ eliminated }) {
      if (eliminated.some((e) => e.id === socket2.id)) {
        local.dead = true;
        local.turnPrompt = null;
        render();
      }
    }
    function onGameOver(payload2) {
      local.gameOver = payload2;
      render();
    }
    function onRoomUpdate(payload2) {
      if (!payload2.gameType) gotoPlayerWaiting();
    }
    function onPhase() {
      local.turnPrompt = null;
    }
    socket2.on("lg:yourTurn", onYourTurn);
    socket2.on("lg:youAreInLove", onInLove);
    socket2.on("lg:eliminated", onEliminated);
    socket2.on("lg:gameOver", onGameOver);
    socket2.on("lg:phase", onPhase);
    socket2.on("room:update", onRoomUpdate);
    getRoleMeta(ack2).then((m) => {
      meta = m;
      render();
    });
    render();
    return () => {
      socket2.off("lg:yourTurn", onYourTurn);
      socket2.off("lg:youAreInLove", onInLove);
      socket2.off("lg:eliminated", onEliminated);
      socket2.off("lg:gameOver", onGameOver);
      socket2.off("lg:phase", onPhase);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  var roleMetaCache;
  var init_loupGarou = __esm({
    "public/js/screens/loupGarou.js"() {
      init_util();
      roleMetaCache = null;
    }
  });

  // public/js/screens/undercover.js
  var undercover_exports = {};
  __export(undercover_exports, {
    mountHost: () => mountHost2,
    mountPlayer: () => mountPlayer2
  });
  async function getThemes(ack2) {
    if (themeCache) return themeCache;
    const res = await ack2("meta:roles", {});
    themeCache = res.themes || [];
    return themeCache;
  }
  function mountHost2(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let themes = [];
    let local = {
      phase: "config",
      themeId: null,
      undercoverCount: 1,
      includeMrWhite: false,
      aliveIds: [],
      turnOrder: [],
      amPlaying: false,
      myWord: null,
      myDead: false,
      cardRevealed: false
    };
    if (ctx2.resume?.game?.type === "undercover") {
      const g = ctx2.resume.game;
      local.phase = g.state.ended ? "gameover" : "playing";
      local.aliveIds = g.state.alive;
      local.theme = g.state.theme;
    }
    if (ctx2.resume?.mine) {
      local.amPlaying = true;
      local.myWord = ctx2.resume.mine.word;
    }
    function render() {
      if (local.phase === "config") renderConfig();
      else if (local.phase === "playing") renderPlaying();
      else if (local.phase === "gameover") renderGameOver();
      renderMyCardWidget();
    }
    function renderMyCardWidget() {
      if (!local.amPlaying) return;
      const isBlank = !local.myWord;
      root2.insertAdjacentHTML("beforeend", `
      <button id="my-card-fab" class="my-card-fab" title="Ton mot">\u{1F3B4}</button>
      ${local.cardRevealed ? `
        <div class="my-card-overlay" id="my-card-overlay">
          <div class="word-card" style="${local.myDead ? "opacity:0.5;" : ""}">
            <div class="word-card__label">${isBlank ? "Tu es Mr. White" : "Ton mot secret"}</div>
            <div class="word-card__word">${isBlank ? "\u{1F92B}" : escapeHtml(local.myWord)}</div>
            ${local.myDead ? `<p class="mt" style="color:var(--red);font-weight:700;">\u2620\uFE0F \xC9limin\xE9(e)</p>` : ""}
          </div>
          <button class="btn btn--ghost btn--block" id="btn-hide-card" style="max-width:360px;">Cacher</button>
        </div>
      ` : ""}
    `);
      root2.querySelector("#my-card-fab").addEventListener("click", () => {
        local.cardRevealed = !local.cardRevealed;
        render();
      });
      const hideBtn = root2.querySelector("#btn-hide-card");
      if (hideBtn) hideBtn.addEventListener("click", () => {
        local.cardRevealed = false;
        render();
      });
      const overlay = root2.querySelector("#my-card-overlay");
      if (overlay) overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          local.cardRevealed = false;
          render();
        }
      });
    }
    function renderConfig() {
      const total = state2.players.length;
      const maxUc = Math.max(1, Math.floor((total - 2) / 2));
      if (!local.themeId && themes.length) local.themeId = themes[0].id;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u{1F575}\uFE0F Undercover \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Th\xE8me</label>
            <div class="game-grid">
              ${themes.map((t) => `
                <button class="game-card ${local.themeId === t.id ? "is-selected" : ""}" data-theme="${t.id}" style="${local.themeId === t.id ? "border-color:var(--violet);box-shadow:var(--shadow-glow-violet);" : ""}">
                  <span class="game-card__icon">${t.icon}</span>
                  <span class="game-card__title">${t.label}</span>
                </button>
              `).join("")}
            </div>
          </div>

          <div class="stepper">
            <span class="stepper__label">\u{1F575}\uFE0F Undercover</span>
            <div class="flex items-center gap-sm">
              <button class="stepper__btn" id="uc-dec">\u2212</button>
              <span class="stepper__value">${local.undercoverCount}</span>
              <button class="stepper__btn" id="uc-inc">+</button>
            </div>
          </div>

          <label class="stepper" style="cursor:pointer;">
            <span class="stepper__label">\u2753 Inclure Mr. White</span>
            <input type="checkbox" id="mrwhite" ${local.includeMrWhite ? "checked" : ""} ${total < 4 ? "disabled" : ""} style="width:20px;height:20px;" />
          </label>

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${total < 3 ? "disabled" : ""}>Distribuer les mots \u{1F3AD}</button>
        </div>
      </div>
    `;
      root2.querySelectorAll("[data-theme]").forEach((btn) => btn.addEventListener("click", () => {
        local.themeId = btn.dataset.theme;
        render();
      }));
      root2.querySelector("#uc-inc").addEventListener("click", () => {
        if (local.undercoverCount < maxUc) {
          local.undercoverCount += 1;
          render();
        }
      });
      root2.querySelector("#uc-dec").addEventListener("click", () => {
        if (local.undercoverCount > 1) {
          local.undercoverCount -= 1;
          render();
        }
      });
      root2.querySelector("#mrwhite").addEventListener("change", (e) => {
        local.includeMrWhite = e.target.checked;
      });
      root2.querySelector("#btn-start").addEventListener("click", async () => {
        const res = await ack2("uc:start", {
          themeId: local.themeId,
          undercoverCount: local.undercoverCount,
          includeMrWhite: local.includeMrWhite
        });
        if (!res.ok) return toast2(res.error || "Impossible de lancer.", "error");
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function renderPlaying() {
      const alive = state2.players.filter((p) => local.aliveIds.includes(p.id));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">${local.theme ? local.theme.label.toUpperCase() : ""}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Ordre de passage</p>
          <p class="muted">${(local.turnOrder || []).map(escapeHtml).join(" \u2192 ") || "\u2014"}</p>
        </div>
        <div class="card flex-col gap">
          <p class="eyebrow" style="text-align:left;">Apr\xE8s le vote, touchez l'\xE9limin\xE9(e) (${alive.length} en jeu)</p>
          <div class="player-list">
            ${alive.map((p) => `
              <div class="player-chip player-chip--selectable" data-id="${p.id}">
                <span class="player-chip__avatar">${initials(p.name)}</span>${escapeHtml(p.name)} \u2716
              </div>`).join("")}
          </div>
        </div>
      </div>
    `;
      root2.querySelectorAll(".player-chip[data-id]").forEach((chip) => {
        chip.addEventListener("click", () => socket2.emit("uc:eliminate", { playerId: chip.dataset.id }));
      });
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function renderGameOver() {
      const won = local.gameOver?.winner === "civils";
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="winner-banner ${won ? "winner-banner--village" : "winner-banner--loups"}">
          <div style="font-size:3rem;">${won ? "\u{1F642}" : "\u{1F575}\uFE0F"}</div>
          <div class="winner-banner__title">${won ? "Les Civils gagnent !" : local.gameOver?.winner === "mrwhite" ? "Mr. White gagne !" : "Les Undercover gagnent !"}</div>
          <p class="muted mt">Le mot \xE9tait : <strong>${escapeHtml(local.gameOver?.pair?.main || "")}</strong> / <strong>${escapeHtml(local.gameOver?.pair?.undercover || "")}</strong></p>
        </div>
        <div class="card flex-col gap">
          <div class="player-list">
            ${Object.values(local.gameOver?.roles || {}).map((info) => `
              <div class="player-chip">${ROLE_ICONS[info.value]} ${escapeHtml(info.name)} \u2014 ${ROLE_LABELS[info.value]}</div>
            `).join("")}
          </div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-lobby">Retour au lobby</button>
      </div>
    `;
      root2.querySelector("#btn-lobby").addEventListener("click", () => {
        socket2.emit("uc:reset");
        gotoLobby();
      });
    }
    function quitGame() {
      if (confirm("Abandonner cette partie et revenir au lobby ?")) {
        socket2.emit("uc:reset");
        gotoLobby();
      }
    }
    function onStarted({ theme, turnOrder }) {
      local.phase = "playing";
      local.theme = theme;
      local.turnOrder = turnOrder;
      local.aliveIds = state2.players.map((p) => p.id);
      render();
    }
    function onRevealed(info) {
      local.aliveIds = local.aliveIds.filter((id) => id !== info.id);
      if (info.id === socket2.id) local.myDead = true;
      toast2(`\u{1F3AD} ${info.name} \xE9tait ${ROLE_LABELS[info.role]}${info.word ? ` (${info.word})` : ""}`);
      render();
    }
    function onYourWord({ word }) {
      local.amPlaying = true;
      local.myWord = word;
      render();
    }
    function onMrWhiteGuess({ name }) {
      setTimeout(() => {
        const correct = confirm(`${name} (Mr. White) tente de deviner le mot civil \xE0 l'oral. A-t-il/elle devin\xE9 juste ?`);
        socket2.emit("uc:mrWhiteGuessResult", { correct });
      }, 200);
    }
    function onGameOver(payload) {
      local.phase = "gameover";
      local.gameOver = payload;
      render();
    }
    function onRoomUpdate(payload) {
      const nameById = new Map(state2.players.map((p) => [p.id, p.name]));
      const idByName = new Map(payload.players.map((p) => [p.name, p.id]));
      local.aliveIds = local.aliveIds.map((id) => idByName.get(nameById.get(id)) || id);
      state2.players = payload.players;
      render();
    }
    socket2.on("uc:started", onStarted);
    socket2.on("uc:revealed", onRevealed);
    socket2.on("uc:mrWhiteGuess", onMrWhiteGuess);
    socket2.on("uc:gameOver", onGameOver);
    socket2.on("room:update", onRoomUpdate);
    socket2.on("uc:yourWord", onYourWord);
    getThemes(ack2).then((t) => {
      themes = t;
      render();
    });
    render();
    return () => {
      socket2.off("uc:started", onStarted);
      socket2.off("uc:revealed", onRevealed);
      socket2.off("uc:mrWhiteGuess", onMrWhiteGuess);
      socket2.off("uc:gameOver", onGameOver);
      socket2.off("room:update", onRoomUpdate);
      socket2.off("uc:yourWord", onYourWord);
    };
  }
  function mountPlayer2(ctx2) {
    const { root: root2, socket: socket2, gotoPlayerWaiting } = ctx2;
    const payload = ctx2.resume || {};
    let local = { word: payload.word, dead: false, gameOver: null };
    function render() {
      if (local.gameOver) return renderGameOver();
      const isBlank = !local.word;
      root2.innerHTML = `
      <div class="screen">
        <div class="brand" style="margin-bottom:0;">
          <span class="brand__moon">\u{1F319}</span><span class="brand__name" style="font-size:1.2rem;">Lunaris</span>
        </div>
        <div class="word-card" style="${local.dead ? "opacity:0.5;" : ""}">
          <div class="word-card__label">${isBlank ? "Tu es Mr. White" : "Ton mot secret"}</div>
          <div class="word-card__word">${isBlank ? "\u{1F92B}" : escapeHtml(local.word)}</div>
          ${isBlank ? `<p class="muted mt">Tu n'as pas de mot. Bluffe en \xE9coutant les autres, ne te fais pas d\xE9masquer !</p>` : ""}
          ${local.dead ? `<p class="mt" style="color:var(--red);font-weight:700;">\u2620\uFE0F \xC9limin\xE9(e)</p>` : ""}
        </div>
        <p class="faint center">Ne montre ton mot \xE0 personne !</p>
      </div>
    `;
    }
    function renderGameOver() {
      const won = local.gameOver.winner === "civils";
      root2.innerHTML = `
      <div class="screen">
        <div class="winner-banner ${won ? "winner-banner--village" : "winner-banner--loups"}">
          <div style="font-size:3rem;">${won ? "\u{1F642}" : "\u{1F575}\uFE0F"}</div>
          <div class="winner-banner__title">${won ? "Les Civils gagnent !" : local.gameOver.winner === "mrwhite" ? "Mr. White gagne !" : "Les Undercover gagnent !"}</div>
        </div>
        <p class="faint center">En attente du prochain jeu...</p>
      </div>
    `;
    }
    function onRevealed(info) {
      if (info.id === socket2.id) {
        local.dead = true;
        render();
      }
    }
    function onGameOver(payload2) {
      local.gameOver = payload2;
      render();
    }
    function onRoomUpdate(payload2) {
      if (!payload2.gameType) gotoPlayerWaiting();
    }
    socket2.on("uc:revealed", onRevealed);
    socket2.on("uc:gameOver", onGameOver);
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => {
      socket2.off("uc:revealed", onRevealed);
      socket2.off("uc:gameOver", onGameOver);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  var ROLE_LABELS, ROLE_ICONS, themeCache;
  var init_undercover = __esm({
    "public/js/screens/undercover.js"() {
      init_util();
      ROLE_LABELS = { civil: "Civil", undercover: "Undercover", mrwhite: "Mr. White" };
      ROLE_ICONS = { civil: "\u{1F642}", undercover: "\u{1F575}\uFE0F", mrwhite: "\u2753" };
      themeCache = null;
    }
  });

  // public/js/lib/nameRoster.js
  function nameRosterMarkup(names, connectedExtra = []) {
    return `
    <div class="field">
      <div class="flex justify-between items-center">
        <label style="margin:0;">Joueurs (${names.length})</label>
        ${connectedExtra.length ? `<button class="link-btn" id="roster-add-connected" style="padding:0;">+ Ajouter ${connectedExtra.length} connect\xE9${connectedExtra.length > 1 ? "s" : ""}</button>` : ""}
      </div>
      <div class="flex gap-sm mt">
        <input id="roster-input" class="input" placeholder="Pr\xE9nom" maxlength="20" autocomplete="off" />
        <button class="btn btn--cool" id="roster-add" type="button">Ajouter</button>
      </div>
      ${names.length ? `
        <div class="player-list mt">
          ${names.map((name, i) => `
            <div class="player-chip">
              <span class="player-chip__avatar">${initials(name)}</span>
              ${escapeHtml(name)}
              <button class="chip-remove" data-idx="${i}" type="button" aria-label="Retirer ${escapeHtml(name)}">\u2715</button>
            </div>
          `).join("")}
        </div>
      ` : `<p class="faint mt">Ajoute au moins 2 pr\xE9noms pour commencer \u2014 pas besoin que les joueurs rejoignent depuis leur t\xE9l\xE9phone.</p>`}
    </div>
  `;
  }
  function wireNameRoster(root2, names, connectedExtra, onChange) {
    const input = root2.querySelector("#roster-input");
    const addBtn = root2.querySelector("#roster-add");
    const add = () => {
      const val = input.value.trim().slice(0, 20);
      if (!val) return;
      if (names.some((n) => n.toLowerCase() === val.toLowerCase())) {
        input.value = "";
        return;
      }
      names.push(val);
      onChange();
    };
    addBtn.addEventListener("click", add);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        add();
      }
    });
    root2.querySelectorAll(".chip-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        names.splice(Number(btn.dataset.idx), 1);
        onChange();
      });
    });
    const addConnectedBtn = root2.querySelector("#roster-add-connected");
    if (addConnectedBtn) {
      addConnectedBtn.addEventListener("click", () => {
        connectedExtra.forEach((n) => {
          if (!names.some((x) => x.toLowerCase() === n.toLowerCase())) names.push(n);
        });
        onChange();
      });
    }
  }
  var init_nameRoster = __esm({
    "public/js/lib/nameRoster.js"() {
      init_util();
    }
  });

  // public/js/screens/quiEstLePlus.js
  var quiEstLePlus_exports = {};
  __export(quiEstLePlus_exports, {
    mountHost: () => mountHost3,
    mountPlayer: () => mountPlayer3
  });
  function mountHost3(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let local = { phase: "config", mode: "soft", count: 15, question: null, names: state2.players.map((p) => p.name) };
    function render() {
      if (local.phase === "config") return renderConfig();
      if (local.phase === "playing") return renderPlaying();
      if (local.phase === "finished") return renderFinished();
    }
    function renderConfig() {
      const connectedExtra = state2.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u{1F525} Qui est le plus... \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Ambiance</label>
            <div class="mode-picker">
              ${MODES.map((m) => `<button class="mode-btn ${m.cls} ${local.mode === m.id ? "is-selected" : ""}" data-mode="${m.id}">${m.label}</button>`).join("")}
            </div>
          </div>
          <div class="field">
            <label for="count">Nombre de questions</label>
            <input type="number" id="count" class="input" min="1" max="40" value="${local.count}" />
            <div class="btn-row">
              ${[10, 15, 20, 30].map((n) => `<button class="btn btn--ghost btn--sm" data-count="${n}">${n}</button>`).join("")}
            </div>
          </div>

          ${nameRosterMarkup(local.names, connectedExtra)}

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 ? "disabled" : ""}>Lancer \u{1F525}</button>
        </div>
      </div>
    `;
      root2.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => {
        local.mode = btn.dataset.mode;
        render();
      }));
      root2.querySelectorAll("[data-count]").forEach((btn) => btn.addEventListener("click", () => {
        local.count = Number(btn.dataset.count);
        root2.querySelector("#count").value = local.count;
      }));
      root2.querySelector("#count").addEventListener("input", (e) => {
        local.count = Number(e.target.value) || 1;
      });
      wireNameRoster(root2, local.names, connectedExtra, render);
      root2.querySelector("#btn-start").addEventListener("click", async () => {
        const res = await ack2("quiz:start", { mode: local.mode, count: local.count });
        if (!res.ok) return toast2("Impossible de lancer.", "error");
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function renderPlaying() {
      const q = local.question;
      const pct = q ? Math.round((q.index + 1) / q.total * 100) : 0;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">Question ${q.index + 1} / ${q.total}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="question-card">${q.text}</div>
        <p class="faint center">Tout le monde pointe du doigt en m\xEAme temps !</p>
        <button class="btn btn--primary btn--block btn--lg" id="btn-next">Question suivante \u25B6</button>
      </div>
    `;
      root2.querySelector("#btn-next").addEventListener("click", () => socket2.emit("quiz:next"));
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function renderFinished() {
      root2.innerHTML = `
      <div class="screen screen--host center">
        <div class="card flex-col gap">
          <div style="font-size:3rem;">\u{1F389}</div>
          <p class="title">Partie termin\xE9e !</p>
          <button class="btn btn--primary btn--block btn--lg" id="btn-replay">Rejouer</button>
          <button class="btn btn--ghost btn--block" id="btn-lobby">Retour au lobby</button>
        </div>
      </div>
    `;
      root2.querySelector("#btn-replay").addEventListener("click", () => {
        local.phase = "config";
        render();
      });
      root2.querySelector("#btn-lobby").addEventListener("click", () => {
        socket2.emit("quiz:reset");
        gotoLobby();
      });
    }
    function quitGame() {
      if (confirm("Quitter cette partie et revenir au lobby ?")) {
        socket2.emit("quiz:reset");
        gotoLobby();
      }
    }
    function onQuestion(q) {
      local.phase = "playing";
      local.question = q;
      render();
    }
    function onFinished() {
      local.phase = "finished";
      render();
    }
    function onRoomUpdate(payload) {
      state2.players = payload.players;
      if (local.phase === "config") render();
    }
    socket2.on("quiz:question", onQuestion);
    socket2.on("quiz:finished", onFinished);
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => {
      socket2.off("quiz:question", onQuestion);
      socket2.off("quiz:finished", onFinished);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  function mountPlayer3(ctx2) {
    const { root: root2, socket: socket2, gotoPlayerWaiting } = ctx2;
    let local = { question: ctx2.resume || null, finished: false };
    function render() {
      if (local.finished) {
        root2.innerHTML = `
        <div class="screen center">
          <div style="font-size:3rem;">\u{1F389}</div>
          <p class="title">Partie termin\xE9e !</p>
          <p class="faint">Regarde l'\xE9cran principal.</p>
        </div>`;
        return;
      }
      const q = local.question;
      const pct = q ? Math.round((q.index + 1) / q.total * 100) : 0;
      root2.innerHTML = `
      <div class="screen">
        <p class="eyebrow">Qui est le plus...</p>
        ${q ? `
          <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="question-card" style="font-size:1.15rem;">${q.text}</div>
        ` : `<p class="muted center">En attente de la question...</p>`}
      </div>
    `;
    }
    function onQuestion(q) {
      local.question = q;
      render();
    }
    function onFinished() {
      local.finished = true;
      render();
    }
    function onRoomUpdate(payload) {
      if (!payload.gameType) gotoPlayerWaiting();
    }
    socket2.on("quiz:question", onQuestion);
    socket2.on("quiz:finished", onFinished);
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => {
      socket2.off("quiz:question", onQuestion);
      socket2.off("quiz:finished", onFinished);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  var MODES;
  var init_quiEstLePlus = __esm({
    "public/js/screens/quiEstLePlus.js"() {
      init_nameRoster();
      MODES = [
        { id: "soft", label: "Soft", cls: "mode-btn--soft" },
        { id: "moyen", label: "Moyen", cls: "" },
        { id: "hot", label: "Hot", cls: "mode-btn--hot" },
        { id: "mix", label: "Mix", cls: "" }
      ];
    }
  });

  // public/js/lib/wheel.js
  function wheelMarkup(labels, rotation) {
    const n = Math.max(labels.length, 1);
    const slice = 360 / n;
    const gradient = labels.length ? labels.map((_, i) => `${WHEEL_COLORS[i % WHEEL_COLORS.length]} ${(slice * i).toFixed(2)}deg ${(slice * (i + 1)).toFixed(2)}deg`).join(", ") : "#1a1a2e 0deg 360deg";
    return `
    <div class="wheel-wrap">
      <div class="wheel-pointer">\u{1F4CD}</div>
      <div class="wheel" id="wheel" style="transform: rotate(${rotation}deg); background: conic-gradient(${gradient});">
        ${labels.map((label, i) => {
      const angle = slice * (i + 0.5);
      return `<div class="wheel__name" style="transform: rotate(${angle}deg) translate(0, -${Math.min(130, 40 + n * 6)}px);">${escapeHtml(label)}</div>`;
    }).join("")}
        <div class="wheel__center">\u{1F3A1}</div>
      </div>
    </div>
  `;
  }
  function targetRotationDelta(currentRotation, labels, winnerIndex) {
    const n = labels.length;
    const slice = 360 / n;
    const targetMod = winnerIndex >= 0 ? ((360 - slice * (winnerIndex + 0.5)) % 360 + 360) % 360 : Math.random() * 360;
    const currentMod = (currentRotation % 360 + 360) % 360;
    let delta = targetMod - currentMod;
    if (delta < 0) delta += 360;
    const extraSpins = 3 + Math.floor(Math.random() * 3);
    return extraSpins * 360 + delta;
  }
  function spinWheelTo(wheelEl, currentRotation, labels, winnerIndex, onRotated) {
    setTimeout(() => {
      const delta = targetRotationDelta(currentRotation, labels, winnerIndex);
      const newRotation = currentRotation + delta;
      wheelEl.style.transform = `rotate(${newRotation}deg)`;
      onRotated(newRotation);
    }, 30);
  }
  var WHEEL_COLORS;
  var init_wheel = __esm({
    "public/js/lib/wheel.js"() {
      init_util();
      WHEEL_COLORS = ["#a855f7", "#ec4899", "#22d3ee", "#34d399", "#fbbf24", "#f43f5e", "#818cf8", "#fb923c"];
    }
  });

  // public/js/screens/roulette.js
  var roulette_exports = {};
  __export(roulette_exports, {
    mountHost: () => mountHost4,
    mountPlayer: () => mountPlayer4
  });
  function mountHost4(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let local = {
      phase: "config",
      mode: "soft",
      rotation: 0,
      spinning: false,
      result: null,
      revealedAction: null,
      names: state2.players.map((p) => p.name)
    };
    function render() {
      if (local.phase === "config") return renderConfig();
      return renderPlaying();
    }
    function renderConfig() {
      const connectedExtra = state2.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u{1F3A1} Roulette \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <div class="field">
            <label>Ambiance</label>
            <div class="mode-picker">
              ${MODES2.map((m) => `<button class="mode-btn ${m.cls} ${local.mode === m.id ? "is-selected" : ""}" data-mode="${m.id}">${m.label}</button>`).join("")}
            </div>
          </div>

          ${nameRosterMarkup(local.names, connectedExtra)}

          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 ? "disabled" : ""}>Lancer \u{1F3A1}</button>
        </div>
      </div>
    `;
      root2.querySelectorAll("[data-mode]").forEach((btn) => btn.addEventListener("click", () => {
        local.mode = btn.dataset.mode;
        render();
      }));
      wireNameRoster(root2, local.names, connectedExtra, render);
      root2.querySelector("#btn-start").addEventListener("click", async () => {
        const res = await ack2("roulette:start", { mode: local.mode, names: local.names });
        if (!res.ok) return toast2("Impossible de lancer.", "error");
        local.phase = "playing";
        render();
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function renderPlaying() {
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">ROULETTE \u2014 ${local.mode.toUpperCase()}</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${wheelMarkup(local.names, local.rotation)}

        ${!local.result ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-spin" ${local.spinning ? "disabled" : ""}>${local.spinning ? "\xC7a tourne..." : "Tourner la roue \u{1F3B2}"}</button>
        ` : `
          <div class="reveal-name">\u{1F3AF} ${escapeHtml(local.result.playerName)}</div>
          <div class="card">
            <p class="eyebrow" style="text-align:left;">V\xE9rit\xE9</p>
            <p style="font-size:1.1rem;font-weight:600;">${escapeHtml(local.result.verite)}</p>
          </div>
          <div class="mystery-card ${local.revealedAction ? "is-revealed" : ""}" id="mystery">
            <div class="mystery-card__icon">${local.revealedAction ? "\u{1F3B2}" : "\u2753"}</div>
            <p class="mt" style="font-weight:600;">${local.revealedAction ? escapeHtml(local.revealedAction) : "Action Myst\xE8re \u2014 toucher pour r\xE9v\xE9ler"}</p>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-again">Tourner \xE0 nouveau \u{1F504}</button>
        `}
      </div>
    `;
      const spinBtn = root2.querySelector("#btn-spin");
      if (spinBtn) spinBtn.addEventListener("click", spin);
      const mystery = root2.querySelector("#mystery");
      if (mystery && !local.revealedAction) mystery.addEventListener("click", () => socket2.emit("roulette:revealAction"));
      const again = root2.querySelector("#btn-again");
      if (again) again.addEventListener("click", spin);
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function spin() {
      if (local.spinning || local.names.length < 2) return;
      local.spinning = true;
      local.result = null;
      local.revealedAction = null;
      render();
      socket2.emit("roulette:spin");
    }
    function quitGame() {
      if (confirm("Quitter la roulette et revenir au lobby ?")) {
        socket2.emit("roulette:reset");
        gotoLobby();
      }
    }
    function onResult(result) {
      const wheelEl = root2.querySelector("#wheel");
      if (wheelEl && local.names.length) {
        const idx = local.names.findIndex((n) => n === result.playerName);
        spinWheelTo(wheelEl, local.rotation, local.names, idx, (newRotation) => {
          local.rotation = newRotation;
        });
      }
      setTimeout(() => {
        local.spinning = false;
        local.result = result;
        local.revealedAction = null;
        render();
      }, SPIN_DURATION_MS);
    }
    function onActionRevealed(result) {
      local.revealedAction = result?.action || null;
      render();
    }
    function onRoomUpdate(payload) {
      state2.players = payload.players;
      if (local.phase === "config") render();
    }
    socket2.on("roulette:result", onResult);
    socket2.on("roulette:actionRevealed", onActionRevealed);
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => {
      socket2.off("roulette:result", onResult);
      socket2.off("roulette:actionRevealed", onActionRevealed);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  function mountPlayer4(ctx2) {
    const { root: root2, socket: socket2, gotoPlayerWaiting } = ctx2;
    const resume = ctx2.resume || {};
    let local = { result: resume.result || null, revealedAction: null, waiting: false };
    function render() {
      root2.innerHTML = `
      <div class="screen">
        <p class="eyebrow">\u{1F3A1} Roulette</p>
        ${local.waiting ? `
          <div class="card center"><p>La roue tourne...</p></div>
        ` : local.result ? `
          <div class="reveal-name">\u{1F3AF} ${escapeHtml(local.result.playerName)}</div>
          <div class="card">
            <p class="eyebrow" style="text-align:left;">V\xE9rit\xE9</p>
            <p style="font-size:1.05rem;font-weight:600;">${escapeHtml(local.result.verite)}</p>
          </div>
          <div class="mystery-card ${local.revealedAction ? "is-revealed" : ""}">
            <div class="mystery-card__icon">${local.revealedAction ? "\u{1F3B2}" : "\u2753"}</div>
            <p class="mt" style="font-weight:600;">${local.revealedAction ? escapeHtml(local.revealedAction) : "Action Myst\xE8re"}</p>
          </div>
        ` : `<div class="card center"><p class="muted">En attente du premier lancer...</p></div>`}
      </div>
    `;
    }
    function onResult() {
      local.waiting = true;
      local.result = null;
      render();
    }
    function onResultFinal(result) {
      setTimeout(() => {
        local.waiting = false;
        local.result = result;
        local.revealedAction = null;
        render();
      }, SPIN_DURATION_MS);
    }
    function onActionRevealed(result) {
      local.revealedAction = result?.action || null;
      render();
    }
    function onRoomUpdate(payload) {
      if (!payload.gameType) gotoPlayerWaiting();
    }
    function onResultCombined(r) {
      onResult();
      onResultFinal(r);
    }
    socket2.on("roulette:result", onResultCombined);
    socket2.on("roulette:actionRevealed", onActionRevealed);
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => {
      socket2.off("roulette:result", onResultCombined);
      socket2.off("roulette:actionRevealed", onActionRevealed);
      socket2.off("room:update", onRoomUpdate);
    };
  }
  var SPIN_DURATION_MS, MODES2;
  var init_roulette = __esm({
    "public/js/screens/roulette.js"() {
      init_util();
      init_nameRoster();
      init_wheel();
      SPIN_DURATION_MS = 4500;
      MODES2 = [
        { id: "soft", label: "Soft", cls: "mode-btn--soft" },
        { id: "moyen", label: "Moyen", cls: "" },
        { id: "hot", label: "Hot", cls: "mode-btn--hot" }
      ];
    }
  });

  // public/js/lib/socket.js
  var socket = io();
  function ack(event, payload = {}) {
    return new Promise((resolve) => {
      socket.emit(event, payload, (response) => resolve(response || { ok: false }));
    });
  }

  // public/js/main.js
  init_util();

  // public/js/screens/home.js
  var home_exports = {};
  __export(home_exports, {
    mount: () => mount2
  });

  // public/js/screens/join.js
  var join_exports = {};
  __export(join_exports, {
    mount: () => mount3
  });

  // public/js/screens/playerWaiting.js
  var playerWaiting_exports = {};
  __export(playerWaiting_exports, {
    mount: () => mount
  });
  init_util();
  var GAME_LABELS = {
    "loup-garou": "\u{1F43A} Loup-Garou",
    undercover: "\u{1F575}\uFE0F Undercover",
    "qui-est-le-plus": "\u{1F525} Qui est le plus...",
    roulette: "\u{1F3A1} Roulette"
  };
  function mount(ctx2) {
    const { root: root2, socket: socket2, state: state2, goto: goto2 } = ctx2;
    let playerCount = state2.players?.length || 0;
    let preparing = null;
    function render() {
      root2.innerHTML = `
      <div class="screen">
        <div class="brand">
          <span class="brand__moon">\u{1F319}</span>
          <span class="brand__name">Lunaris</span>
        </div>
        <div class="card center flex-col gap">
          <p class="eyebrow">Tu es dans la partie</p>
          <p class="title">Salut ${escapeHtml(state2.name || "")} \u{1F44B}</p>
          <p class="subtitle">${playerCount} joueur${playerCount > 1 ? "s" : ""} connect\xE9${playerCount > 1 ? "s" : ""}</p>
          <div class="divider"></div>
          ${preparing ? `<p><span class="waiting-pulse"></span> &nbsp;L'h\xF4te pr\xE9pare <strong>${GAME_LABELS[preparing] || preparing}</strong>...</p>` : `<p class="muted"><span class="waiting-pulse"></span> &nbsp;En attente que l'h\xF4te lance un jeu...</p>`}
        </div>
        <p class="faint center">Garde cet onglet ouvert, ton t\xE9l\xE9phone affichera tes infos secr\xE8tes ici.</p>
      </div>
    `;
    }
    function onRoomUpdate(payload) {
      playerCount = payload.players.length;
      state2.players = payload.players;
      if (!payload.gameType) render();
    }
    function onGameSelected({ gameType }) {
      preparing = gameType;
      render();
    }
    function toGame(mountFn, resume) {
      return () => goto2(mountFn, resume);
    }
    async function loadGameModules() {
      const [loupGarou, undercover, quiz, roulette] = await Promise.all([
        Promise.resolve().then(() => (init_loupGarou(), loupGarou_exports)),
        Promise.resolve().then(() => (init_undercover(), undercover_exports)),
        Promise.resolve().then(() => (init_quiEstLePlus(), quiEstLePlus_exports)),
        Promise.resolve().then(() => (init_roulette(), roulette_exports))
      ]);
      const onYourRole = (payload) => goto2(loupGarou.mountPlayer, payload);
      const onYourWord = (payload) => goto2(undercover.mountPlayer, payload);
      const onQuizQuestion = (payload) => goto2(quiz.mountPlayer, payload);
      const onRouletteReady = (payload) => goto2(roulette.mountPlayer, { mode: payload.mode, result: null });
      socket2.on("lg:yourRole", onYourRole);
      socket2.on("uc:yourWord", onYourWord);
      socket2.on("quiz:question", onQuizQuestion);
      socket2.on("roulette:ready", onRouletteReady);
      cleanupFns.push(() => {
        socket2.off("lg:yourRole", onYourRole);
        socket2.off("uc:yourWord", onYourWord);
        socket2.off("quiz:question", onQuizQuestion);
        socket2.off("roulette:ready", onRouletteReady);
      });
    }
    const cleanupFns = [];
    socket2.on("room:update", onRoomUpdate);
    socket2.on("room:gameSelected", onGameSelected);
    cleanupFns.push(() => {
      socket2.off("room:update", onRoomUpdate);
      socket2.off("room:gameSelected", onGameSelected);
    });
    loadGameModules();
    render();
    return () => cleanupFns.forEach((fn) => fn());
  }

  // public/js/screens/join.js
  function mount3(ctx2) {
    const { root: root2, ack: ack2, state: state2, goto: goto2, toast: toast2, saveSession: saveSession2 } = ctx2;
    root2.insertAdjacentHTML("beforeend", `
    <div class="screen">
      <div class="brand">
        <span class="brand__moon">\u{1F319}</span>
        <span class="brand__name">Lunaris</span>
      </div>
      <p class="eyebrow">Rejoindre une soir\xE9e</p>

      <div class="card flex-col gap">
        <div class="field">
          <label for="code">Code de la soir\xE9e</label>
          <input id="code" class="input input--code" maxlength="4" placeholder="XXXX" autocomplete="off" autocapitalize="characters" />
        </div>
        <div class="field">
          <label for="name">Ton pr\xE9nom</label>
          <input id="name" class="input" maxlength="20" placeholder="Ex : L\xE9a" autocomplete="off" />
        </div>
        <button class="btn btn--primary btn--block btn--lg" id="btn-submit">Rejoindre \u{1F680}</button>
        <button class="link-btn" id="btn-back">\u2190 Retour</button>
      </div>
    </div>
  `);
    const codeInput = root2.querySelector("#code");
    const nameInput = root2.querySelector("#name");
    const btn = root2.querySelector("#btn-submit");
    codeInput.addEventListener("input", () => {
      codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    });
    async function submit() {
      const code = codeInput.value.trim();
      const name = nameInput.value.trim();
      if (code.length !== 4) return toast2("Le code fait 4 lettres.", "error");
      if (!name) return toast2("Entre ton pr\xE9nom.", "error");
      btn.disabled = true;
      const res = await ack2("player:join", { code, name });
      btn.disabled = false;
      if (!res.ok) return toast2(res.error || "Impossible de rejoindre.", "error");
      state2.role = "player";
      state2.code = code;
      state2.name = name;
      saveSession2({ role: "player", code, name });
      goto2(mount);
    }
    btn.addEventListener("click", submit);
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") submit();
    });
    codeInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") nameInput.focus();
    });
    root2.querySelector("#btn-back").addEventListener("click", () => goto2(mount2));
  }

  // public/js/screens/hostLobby.js
  var hostLobby_exports = {};
  __export(hostLobby_exports, {
    mount: () => mount4
  });
  init_util();
  init_loupGarou();
  init_undercover();
  init_quiEstLePlus();
  init_roulette();

  // public/js/screens/lieDetector.js
  init_util();
  init_nameRoster();
  var contentCache = null;
  async function getContent(ack2) {
    if (contentCache) return contentCache;
    contentCache = await ack2("meta:roles", {});
    return contentCache;
  }
  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function mountHost5(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let content = { lieDetectorPrompts: [] };
    let local = {
      phase: "config",
      contentReady: false,
      names: state2.players.map((p) => p.name),
      current: null,
      revealed: null
    };
    function render() {
      if (local.phase === "config") return renderConfig();
      return renderPlaying();
    }
    function renderConfig() {
      const connectedExtra = state2.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u{1F925} D\xE9tecteur de Mensonges \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">L'\xE9cran d\xE9signe un joueur au hasard. Il raconte une anecdote \u2014 vraie ou fausse \u2014 \xE0 voix haute. Le groupe d\xE9bat et vote \xE0 main lev\xE9e, puis on r\xE9v\xE8le la v\xE9rit\xE9 !</p>
          ${nameRosterMarkup(local.names, connectedExtra)}
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 || !local.contentReady ? "disabled" : ""}>Lancer \u{1F925}</button>
        </div>
      </div>
    `;
      wireNameRoster(root2, local.names, connectedExtra, render);
      root2.querySelector("#btn-start").addEventListener("click", () => {
        local.phase = "playing";
        pickPlayer();
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function pickPlayer() {
      local.current = { name: pick(local.names), prompt: pick(content.lieDetectorPrompts) };
      local.revealed = null;
      render();
    }
    function renderPlaying() {
      const c = local.current;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">D\xC9TECTEUR DE MENSONGES</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${!local.revealed ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u{1F3AD}</div>
            <div class="phase-banner__title">${escapeHtml(c.name)}</div>
            <div class="phase-banner__text">${escapeHtml(c.prompt)}<br/><span class="faint">Vrai ou faux ? Le groupe d\xE9bat et vote \xE0 main lev\xE9e !</span></div>
          </div>
          <p class="center muted">Une fois le vote fait, ${escapeHtml(c.name)} r\xE9v\xE8le la v\xE9rit\xE9 :</p>
          <div class="split-choice">
            <button class="btn btn--cool btn--lg" id="btn-true">\u2705 C'\xE9tait vrai</button>
            <button class="btn btn--danger btn--lg" id="btn-false">\u274C C'\xE9tait faux</button>
          </div>
        ` : `
          <div class="winner-banner ${local.revealed === "vrai" ? "winner-banner--village" : "winner-banner--loups"}">
            <div style="font-size:3rem;">${local.revealed === "vrai" ? "\u2705" : "\u274C"}</div>
            <div class="winner-banner__title">C'\xE9tait ${local.revealed === "vrai" ? "VRAI" : "FAUX"} !</div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Joueur suivant \u25B6</button>
        `}
      </div>
    `;
      const trueBtn = root2.querySelector("#btn-true");
      if (trueBtn) trueBtn.addEventListener("click", () => {
        local.revealed = "vrai";
        render();
      });
      const falseBtn = root2.querySelector("#btn-false");
      if (falseBtn) falseBtn.addEventListener("click", () => {
        local.revealed = "faux";
        render();
      });
      const nextBtn = root2.querySelector("#btn-next");
      if (nextBtn) nextBtn.addEventListener("click", pickPlayer);
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function quitGame() {
      if (confirm("Quitter le D\xE9tecteur de Mensonges et revenir au lobby ?")) gotoLobby();
    }
    function onRoomUpdate(payload) {
      state2.players = payload.players;
      if (local.phase === "config") render();
    }
    socket2.on("room:update", onRoomUpdate);
    getContent(ack2).then((c) => {
      content = c;
      local.contentReady = true;
      render();
    }).catch(() => toast2("Impossible de charger le contenu.", "error"));
    render();
    return () => socket2.off("room:update", onRoomUpdate);
  }

  // public/js/screens/tribunal.js
  init_util();
  init_nameRoster();
  var contentCache2 = null;
  async function getContent2(ack2) {
    if (contentCache2) return contentCache2;
    contentCache2 = await ack2("meta:roles", {});
    return contentCache2;
  }
  function pick2(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  var DURATIONS = [30, 45, 60, 90];
  function mountHost6(ctx2) {
    const { root: root2, socket: socket2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let content = { tribunal: { accusations: [], sentences: [] } };
    let timerHandle = null;
    let local = {
      phase: "config",
      contentReady: false,
      duration: 60,
      names: state2.players.map((p) => p.name),
      stage: "accusing",
      // 'accusing' | 'pleading' | 'voting' | 'verdict'
      current: null,
      timeLeft: 0,
      verdict: null,
      sentence: null
    };
    function render() {
      if (local.phase === "config") return renderConfig();
      return renderPlaying();
    }
    function renderConfig() {
      const connectedExtra = state2.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u2696\uFE0F Le Tribunal \u2014 Configuration</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Un accus\xE9 est d\xE9sign\xE9 au hasard avec un chef d'accusation absurde. Il plaide sa cause, chrono en main, puis le groupe vote le verdict \xE0 main lev\xE9e.</p>
          <div class="field">
            <label>Temps de plaidoirie</label>
            <div class="mode-picker">
              ${DURATIONS.map((d) => `<button class="mode-btn ${local.duration === d ? "is-selected" : ""}" data-duration="${d}">${d}s</button>`).join("")}
            </div>
          </div>
          ${nameRosterMarkup(local.names, connectedExtra)}
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-start" ${local.names.length < 2 || !local.contentReady ? "disabled" : ""}>Ouvrir l'audience \u2696\uFE0F</button>
        </div>
      </div>
    `;
      root2.querySelectorAll("[data-duration]").forEach((btn) => btn.addEventListener("click", () => {
        local.duration = Number(btn.dataset.duration);
        render();
      }));
      wireNameRoster(root2, local.names, connectedExtra, render);
      root2.querySelector("#btn-start").addEventListener("click", () => {
        local.phase = "playing";
        nextCase();
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function nextCase() {
      stopTimer();
      local.current = { accused: pick2(local.names), accusation: pick2(content.tribunal.accusations) };
      local.stage = "accusing";
      local.verdict = null;
      local.sentence = null;
      render();
    }
    function startPlea() {
      local.stage = "pleading";
      local.timeLeft = local.duration;
      render();
      timerHandle = setInterval(() => {
        local.timeLeft -= 1;
        if (local.timeLeft <= 0) {
          stopTimer();
          local.stage = "voting";
        }
        render();
      }, 1e3);
    }
    function stopTimer() {
      if (timerHandle) {
        clearInterval(timerHandle);
        timerHandle = null;
      }
    }
    function renderPlaying() {
      const c = local.current;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">LE TRIBUNAL</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>

        ${local.stage === "accusing" ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u2696\uFE0F</div>
            <div class="phase-banner__title">${escapeHtml(c.accused)} est accus\xE9(e)</div>
            <div class="phase-banner__text">\xAB ${escapeHtml(c.accusation)} \xBB</div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-plead">Commencer la plaidoirie (${local.duration}s) \u25B6</button>
        ` : local.stage === "pleading" ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u{1F3A4}</div>
            <div class="phase-banner__title">${escapeHtml(c.accused)} plaide sa cause !</div>
            <div class="phase-banner__text">\xAB ${escapeHtml(c.accusation)} \xBB</div>
          </div>
          <div class="reveal-name">${local.timeLeft}s</div>
          <button class="btn btn--ghost btn--block" id="btn-skip">Terminer maintenant</button>
        ` : local.stage === "voting" ? `
          <div class="phase-banner phase-banner--day">
            <div class="phase-banner__icon">\u{1F5F3}\uFE0F</div>
            <div class="phase-banner__title">Le jury vote !</div>
            <div class="phase-banner__text">Coupable ou non coupable, \xE0 main lev\xE9e ?</div>
          </div>
          <div class="split-choice">
            <button class="btn btn--danger btn--lg" id="btn-guilty">\u2696\uFE0F Coupable</button>
            <button class="btn btn--cool btn--lg" id="btn-innocent">\u{1F645} Non coupable</button>
          </div>
        ` : `
          <div class="winner-banner ${local.verdict === "guilty" ? "winner-banner--loups" : "winner-banner--village"}">
            <div style="font-size:3rem;">${local.verdict === "guilty" ? "\u2696\uFE0F" : "\u{1F645}"}</div>
            <div class="winner-banner__title">${local.verdict === "guilty" ? "COUPABLE !" : "NON COUPABLE !"}</div>
            ${local.sentence ? `<p class="mt">Sentence : <strong>${escapeHtml(local.sentence)}</strong></p>` : ""}
          </div>
          <button class="btn btn--primary btn--block btn--lg" id="btn-next">Affaire suivante \u25B6</button>
        `}
      </div>
    `;
      const pleadBtn = root2.querySelector("#btn-plead");
      if (pleadBtn) pleadBtn.addEventListener("click", startPlea);
      const skipBtn = root2.querySelector("#btn-skip");
      if (skipBtn) skipBtn.addEventListener("click", () => {
        stopTimer();
        local.stage = "voting";
        render();
      });
      const guiltyBtn = root2.querySelector("#btn-guilty");
      if (guiltyBtn) guiltyBtn.addEventListener("click", () => {
        local.verdict = "guilty";
        local.sentence = pick2(content.tribunal.sentences);
        local.stage = "verdict";
        render();
      });
      const innocentBtn = root2.querySelector("#btn-innocent");
      if (innocentBtn) innocentBtn.addEventListener("click", () => {
        local.verdict = "innocent";
        local.sentence = null;
        local.stage = "verdict";
        render();
      });
      const nextBtn = root2.querySelector("#btn-next");
      if (nextBtn) nextBtn.addEventListener("click", nextCase);
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function quitGame() {
      if (confirm("Quitter le Tribunal et revenir au lobby ?")) {
        stopTimer();
        gotoLobby();
      }
    }
    function onRoomUpdate(payload) {
      state2.players = payload.players;
      if (local.phase === "config") render();
    }
    socket2.on("room:update", onRoomUpdate);
    getContent2(ack2).then((c) => {
      content = c;
      local.contentReady = true;
      render();
    }).catch(() => toast2("Impossible de charger le contenu.", "error"));
    render();
    return () => {
      stopTimer();
      socket2.off("room:update", onRoomUpdate);
    };
  }

  // public/js/screens/auction.js
  init_util();
  var contentCache3 = null;
  async function getContent3(ack2) {
    if (contentCache3) return contentCache3;
    contentCache3 = await ack2("meta:roles", {});
    return contentCache3;
  }
  function pick3(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function formatMs(ms) {
    const totalCs = Math.floor(ms / 100);
    const s = Math.floor(totalCs / 10);
    const cs = totalCs % 10;
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${cs}`;
  }
  function mountHost7(ctx2) {
    const { root: root2, ack: ack2, toast: toast2, gotoLobby } = ctx2;
    let content = { auctionCategories: [] };
    let tickHandle = null;
    let local = {
      contentReady: false,
      category: null,
      running: false,
      startedAt: 0,
      elapsedMs: 0,
      judged: false,
      tally: { success: 0, fail: 0 }
    };
    function render() {
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">L'ENCH\xC8RE</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <p class="faint center">Ench\xE9rissez \xE0 l'oral sur le nombre d'\xE9l\xE9ments que vous pouvez citer \u2014 le plus offrant doit livrer, chrono en main !</p>
        <div class="question-card">${local.category ? escapeHtml(local.category) : "Pr\xEAt(e) ?"}</div>
        <div class="reveal-name" id="chrono">${formatMs(local.elapsedMs)}</div>

        ${!local.category ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-category" ${!local.contentReady ? "disabled" : ""}>Nouvelle cat\xE9gorie \u{1F3B2}</button>
        ` : !local.running && !local.judged ? `
          <button class="btn btn--primary btn--block btn--lg" id="btn-go">D\xE9marrer le chrono \u25B6</button>
        ` : local.running ? `
          <button class="btn btn--danger btn--block btn--lg" id="btn-stop">Stop \u23F9</button>
        ` : `
          <div class="split-choice">
            <button class="btn btn--cool btn--lg" id="btn-success">\u2705 R\xE9ussi</button>
            <button class="btn btn--danger btn--lg" id="btn-fail">\u274C Rat\xE9</button>
          </div>
        `}

        ${local.category ? `<button class="btn btn--ghost btn--block" id="btn-next-cat">Cat\xE9gorie suivante \u{1F504}</button>` : ""}

        <p class="center muted">\u2705 ${local.tally.success} r\xE9ussite${local.tally.success > 1 ? "s" : ""} \u2014 \u274C ${local.tally.fail} \xE9chec${local.tally.fail > 1 ? "s" : ""}</p>
      </div>
    `;
      const catBtn = root2.querySelector("#btn-category");
      if (catBtn) catBtn.addEventListener("click", newCategory);
      const goBtn = root2.querySelector("#btn-go");
      if (goBtn) goBtn.addEventListener("click", startChrono);
      const stopBtn = root2.querySelector("#btn-stop");
      if (stopBtn) stopBtn.addEventListener("click", stopChrono);
      const successBtn = root2.querySelector("#btn-success");
      if (successBtn) successBtn.addEventListener("click", () => judge(true));
      const failBtn = root2.querySelector("#btn-fail");
      if (failBtn) failBtn.addEventListener("click", () => judge(false));
      const nextCatBtn = root2.querySelector("#btn-next-cat");
      if (nextCatBtn) nextCatBtn.addEventListener("click", newCategory);
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function newCategory() {
      stopTick();
      local.category = pick3(content.auctionCategories);
      local.running = false;
      local.elapsedMs = 0;
      local.judged = false;
      render();
    }
    function startChrono() {
      local.running = true;
      local.startedAt = Date.now();
      render();
      tickHandle = setInterval(() => {
        local.elapsedMs = Date.now() - local.startedAt;
        const el = root2.querySelector("#chrono");
        if (el) el.textContent = formatMs(local.elapsedMs);
      }, 100);
    }
    function stopChrono() {
      stopTick();
      local.running = false;
      local.judged = true;
      render();
    }
    function stopTick() {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
    }
    function judge(success) {
      if (success) local.tally.success += 1;
      else local.tally.fail += 1;
      local.category = null;
      local.judged = false;
      local.elapsedMs = 0;
      render();
    }
    function quitGame() {
      if (confirm("Quitter L'Ench\xE8re et revenir au lobby ?")) {
        stopTick();
        gotoLobby();
      }
    }
    getContent3(ack2).then((c) => {
      content = c;
      local.contentReady = true;
      render();
    }).catch(() => toast2("Impossible de charger le contenu.", "error"));
    render();
    return () => stopTick();
  }

  // public/js/screens/teamDuel.js
  init_util();
  init_wheel();
  var SPIN_DURATION_MS2 = 4500;
  var WHEEL_TYPES = [
    { id: "enchere", label: "\u{1F528} Ench\xE8re" },
    { id: "detecteur", label: "\u{1F925} D\xE9tecteur" },
    { id: "qui-est-le-plus", label: "\u{1F525} Qui est le plus" }
  ];
  var contentCache4 = null;
  async function getContent4(ack2) {
    if (contentCache4) return contentCache4;
    contentCache4 = await ack2("meta:roles", {});
    return contentCache4;
  }
  function pick4(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }
  function formatMs2(ms) {
    const totalCs = Math.floor(ms / 100);
    const s = Math.floor(totalCs / 10);
    const cs = totalCs % 10;
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}.${cs}`;
  }
  function mountHost8(ctx2) {
    const { root: root2, ack: ack2, state: state2, toast: toast2, gotoLobby } = ctx2;
    let content = { auctionCategories: [], lieDetectorPrompts: [], quizQuestions: [], gages: [] };
    let tickHandle = null;
    let local = {
      phase: "roster",
      // 'roster' -> 'teams' -> 'playing'
      contentReady: false,
      names: state2.players.map((p) => p.name),
      teams: {},
      // name -> 'A' | 'B'
      teamA: [],
      teamB: [],
      currentTeam: "A",
      rotation: 0,
      gageCount: { A: 0, B: 0 },
      round: null
    };
    function render() {
      if (local.phase === "roster") return renderRoster();
      if (local.phase === "teams") return renderTeams();
      return renderPlaying();
    }
    function renderRoster() {
      const connectedExtra = state2.players.map((p) => p.name).filter((n) => !local.names.some((x) => x.toLowerCase() === n.toLowerCase()));
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u2694\uFE0F D\xE9fi d'\xC9quipes \u2014 Joueurs</p>
          <button class="link-btn" id="btn-back">\u2190 Lobby</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Deux \xE9quipes s'affrontent manche apr\xE8s manche. Une roue tire au sort l'\xE9preuve (Ench\xE8re, D\xE9tecteur de Mensonges ou Qui est le plus), l'\xE9quipe active tente sa chance \u2014 en cas d'\xE9chec, un(e) joueur(se) tir\xE9(e) au sort re\xE7oit un gage Hot.</p>
          <div class="field">
            <div class="flex justify-between items-center">
              <label style="margin:0;">Joueurs (${local.names.length})</label>
              ${connectedExtra.length ? `<button class="link-btn" id="roster-add-connected" style="padding:0;">+ Ajouter ${connectedExtra.length} connect\xE9${connectedExtra.length > 1 ? "s" : ""}</button>` : ""}
            </div>
            <div class="flex gap-sm mt">
              <input id="roster-input" class="input" placeholder="Pr\xE9nom" maxlength="20" autocomplete="off" />
              <button class="btn btn--cool" id="roster-add" type="button">Ajouter</button>
            </div>
            ${local.names.length ? `
              <div class="player-list mt">
                ${local.names.map((name, i) => `
                  <div class="player-chip">
                    <span class="player-chip__avatar">${initials(name)}</span>
                    ${escapeHtml(name)}
                    <button class="chip-remove" data-idx="${i}" type="button" aria-label="Retirer ${escapeHtml(name)}">\u2715</button>
                  </div>
                `).join("")}
              </div>
            ` : `<p class="faint mt">Ajoute au moins 4 pr\xE9noms (2 par \xE9quipe minimum).</p>`}
          </div>
          <button class="btn btn--primary btn--block btn--lg mt" id="btn-next" ${local.names.length < 4 ? "disabled" : ""}>R\xE9partir les \xE9quipes \u25B6</button>
        </div>
      </div>
    `;
      const input = root2.querySelector("#roster-input");
      const addBtn = root2.querySelector("#roster-add");
      const add = () => {
        const val = input.value.trim().slice(0, 20);
        if (!val) return;
        if (local.names.some((n) => n.toLowerCase() === val.toLowerCase())) {
          input.value = "";
          return;
        }
        local.names.push(val);
        render();
      };
      addBtn.addEventListener("click", add);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          add();
        }
      });
      root2.querySelectorAll(".chip-remove").forEach((btn) => {
        btn.addEventListener("click", () => {
          const name = local.names[Number(btn.dataset.idx)];
          delete local.teams[name];
          local.names.splice(Number(btn.dataset.idx), 1);
          render();
        });
      });
      const addConnectedBtn = root2.querySelector("#roster-add-connected");
      if (addConnectedBtn) {
        addConnectedBtn.addEventListener("click", () => {
          connectedExtra.forEach((n) => {
            if (!local.names.some((x) => x.toLowerCase() === n.toLowerCase())) local.names.push(n);
          });
          render();
        });
      }
      root2.querySelector("#btn-next").addEventListener("click", () => {
        local.phase = "teams";
        render();
      });
      root2.querySelector("#btn-back").addEventListener("click", gotoLobby);
    }
    function renderTeams() {
      const countA = local.names.filter((n) => local.teams[n] === "A").length;
      const countB = local.names.filter((n) => local.teams[n] === "B").length;
      const ready = countA >= 2 && countB >= 2 && local.contentReady;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="eyebrow" style="margin:0;">\u2694\uFE0F D\xE9fi d'\xC9quipes \u2014 R\xE9partition</p>
          <button class="link-btn" id="btn-roster">\u2190 Joueurs</button>
        </div>
        <div class="card flex-col gap">
          <p class="muted">Touche \u{1F535} A ou \u{1F534} B pour chaque joueur (2 minimum par \xE9quipe).</p>
          <div class="flex-col gap-sm">
            ${local.names.map((name) => `
              <div class="flex justify-between items-center" style="background:var(--surface); border:1px solid var(--border); padding:8px 10px 8px 14px; border-radius:999px;">
                <span style="font-weight:600;">${escapeHtml(name)}</span>
                <div class="flex gap-sm">
                  <button class="btn btn--sm ${local.teams[name] === "A" ? "btn--cool" : "btn--ghost"}" data-assign="A" data-name="${escapeHtml(name)}" type="button">\u{1F535} A</button>
                  <button class="btn btn--sm ${local.teams[name] === "B" ? "btn--danger" : "btn--ghost"}" data-assign="B" data-name="${escapeHtml(name)}" type="button">\u{1F534} B</button>
                </div>
              </div>
            `).join("")}
          </div>
          <p class="center muted mt">\u{1F535} \xC9quipe A : ${countA} \xB7 \u{1F534} \xC9quipe B : ${countB}</p>
          <button class="btn btn--primary btn--block btn--lg" id="btn-start" ${ready ? "" : "disabled"}>Lancer le duel \u2694\uFE0F</button>
        </div>
      </div>
    `;
      root2.querySelectorAll("[data-assign]").forEach((btn) => {
        btn.addEventListener("click", () => {
          local.teams[btn.dataset.name] = btn.dataset.assign;
          render();
        });
      });
      root2.querySelector("#btn-start").addEventListener("click", startDuel);
      root2.querySelector("#btn-roster").addEventListener("click", () => {
        local.phase = "roster";
        render();
      });
    }
    function startDuel() {
      local.teamA = local.names.filter((n) => local.teams[n] === "A");
      local.teamB = local.names.filter((n) => local.teams[n] === "B");
      local.currentTeam = Math.random() < 0.5 ? "A" : "B";
      local.phase = "playing";
      beginRound();
    }
    function opposingTeam() {
      return local.currentTeam === "A" ? local.teamB : local.teamA;
    }
    function activeTeamMembers() {
      return local.currentTeam === "A" ? local.teamA : local.teamB;
    }
    function beginRound() {
      stopTick();
      local.round = { stage: "ready", gameType: null };
      render();
    }
    function spinForType() {
      if (!local.round || local.round.stage !== "ready") return;
      local.round.stage = "spinning";
      render();
      const wheelEl = root2.querySelector("#wheel");
      const idx = Math.floor(Math.random() * WHEEL_TYPES.length);
      const labels = WHEEL_TYPES.map((t) => t.label);
      if (wheelEl) spinWheelTo(wheelEl, local.rotation, labels, idx, (newRotation) => {
        local.rotation = newRotation;
      });
      setTimeout(() => beginChallenge(WHEEL_TYPES[idx].id), SPIN_DURATION_MS2);
    }
    function beginChallenge(gameType) {
      local.round.gameType = gameType;
      local.round.stage = "challenge";
      local.round.resolved = null;
      if (gameType === "enchere") {
        local.round.category = pick4(content.auctionCategories);
        local.round.running = false;
        local.round.elapsedMs = 0;
        local.round.judged = false;
      } else if (gameType === "detecteur") {
        local.round.storyteller = pick4(activeTeamMembers());
        local.round.prompt = pick4(content.lieDetectorPrompts);
        local.round.revealedTruth = null;
        local.round.guessedRight = null;
      } else {
        local.round.question = pick4(content.quizQuestions);
        local.round.designated = null;
        local.round.confirmed = null;
      }
      render();
    }
    function resolveRound(success) {
      local.round.resolved = success ? "success" : "fail";
      if (!success) {
        local.gageCount[local.currentTeam] += 1;
        local.round.gageTarget = pick4(activeTeamMembers());
        local.round.gage = pick4(content.gages);
      }
      render();
    }
    function nextRound() {
      local.currentTeam = local.currentTeam === "A" ? "B" : "A";
      beginRound();
    }
    function startChrono() {
      local.round.running = true;
      local.round.startedAt = Date.now();
      render();
      tickHandle = setInterval(() => {
        local.round.elapsedMs = Date.now() - local.round.startedAt;
        const el = root2.querySelector("#chrono");
        if (el) el.textContent = formatMs2(local.round.elapsedMs);
      }, 100);
    }
    function stopChrono() {
      stopTick();
      local.round.running = false;
      local.round.judged = true;
      render();
    }
    function stopTick() {
      if (tickHandle) {
        clearInterval(tickHandle);
        tickHandle = null;
      }
    }
    function renderPlaying() {
      const team = local.currentTeam;
      const teamLabel = team === "A" ? "\u{1F535} \xC9quipe A" : "\u{1F534} \xC9quipe B";
      const r = local.round;
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <p class="top-bar__code">D\xC9FI D'\xC9QUIPES</p>
          <button class="link-btn" id="btn-back">Quitter</button>
        </div>
        <p class="center muted">Gages re\xE7us \u2014 \u{1F535} A : ${local.gageCount.A} \xB7 \u{1F534} B : ${local.gageCount.B}</p>

        ${r.stage === "ready" || r.stage === "spinning" ? `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u{1F3AF}</div>
            <div class="phase-banner__title">Au tour de ${teamLabel} !</div>
            <div class="phase-banner__text">${r.stage === "spinning" ? "La roue tourne..." : "Tournez la roue pour conna\xEEtre l'\xE9preuve."}</div>
          </div>
          ${wheelMarkup(WHEEL_TYPES.map((t) => t.label), local.rotation)}
          ${r.stage === "ready" ? `<button class="btn btn--primary btn--block btn--lg" id="btn-spin">Tourner la roue \u{1F3B2}</button>` : ""}
        ` : renderChallenge(r, team, teamLabel)}
      </div>
    `;
      const spinBtn = root2.querySelector("#btn-spin");
      if (spinBtn) spinBtn.addEventListener("click", spinForType);
      wireChallengeEvents(r);
      root2.querySelector("#btn-back").addEventListener("click", quitGame);
    }
    function renderChallenge(r, team, teamLabel) {
      if (r.resolved) {
        const success = r.resolved === "success";
        return `
        <div class="winner-banner ${success ? "winner-banner--village" : "winner-banner--loups"}">
          <div style="font-size:3rem;">${success ? "\u{1F389}" : "\u{1F62C}"}</div>
          <div class="winner-banner__title">${success ? `${teamLabel} s'en sort bien !` : `${teamLabel} doit payer !`}</div>
        </div>
        ${!success ? `
          <p class="center mt">\u{1F3AF} <strong>${escapeHtml(r.gageTarget)}</strong> choisit :</p>
          <div class="split-choice">
            <div class="card center">
              <p class="eyebrow" style="margin:0;">\u{1F3AD} Le gage</p>
              <p class="mt" style="font-weight:700;">${escapeHtml(r.gage.text)}</p>
            </div>
            <div class="card center">
              <p class="eyebrow" style="margin:0;">\u{1F943} Ou boire</p>
              <p class="mt" style="font-weight:700; font-size:1.3rem;">${r.gage.sips} gorg\xE9e${r.gage.sips > 1 ? "s" : ""}</p>
            </div>
          </div>
        ` : ""}
        <button class="btn btn--primary btn--block btn--lg mt" id="btn-next-round">Manche suivante \u25B6</button>
      `;
      }
      if (r.gameType === "enchere") {
        return `
        <div class="phase-banner">
          <div class="phase-banner__icon">\u{1F528}</div>
          <div class="phase-banner__title">${teamLabel} \u2014 L'Ench\xE8re</div>
          <div class="phase-banner__text">Cat\xE9gorie : <strong>${escapeHtml(r.category)}</strong><br/><span class="faint">Ench\xE9rissez \xE0 l'oral, puis lancez le chrono pour la livraison !</span></div>
        </div>
        <div class="reveal-name" id="chrono">${formatMs2(r.elapsedMs)}</div>
        ${!r.running && !r.judged ? `<button class="btn btn--primary btn--block btn--lg" id="btn-go">D\xE9marrer le chrono \u25B6</button>` : r.running ? `<button class="btn btn--danger btn--block btn--lg" id="btn-stop">Stop \u23F9</button>` : `<div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-success">\u2705 R\xE9ussi</button><button class="btn btn--danger btn--lg" id="btn-fail">\u274C Rat\xE9</button></div>`}
      `;
      }
      if (r.gameType === "detecteur") {
        if (r.revealedTruth === null) {
          return `
          <div class="phase-banner">
            <div class="phase-banner__icon">\u{1F925}</div>
            <div class="phase-banner__title">${escapeHtml(r.storyteller)} raconte...</div>
            <div class="phase-banner__text">${escapeHtml(r.prompt)}<br/><span class="faint">Vrai ou faux ? L'\xE9quipe adverse d\xE9bat et vote \xE0 voix haute !</span></div>
          </div>
          <p class="center muted">Une fois le vote fait, ${escapeHtml(r.storyteller)} r\xE9v\xE8le la v\xE9rit\xE9 :</p>
          <div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-true">\u2705 Vrai</button><button class="btn btn--danger btn--lg" id="btn-false">\u274C Faux</button></div>
        `;
        }
        return `
        <div class="phase-banner">
          <div class="phase-banner__icon">${r.revealedTruth === "vrai" ? "\u2705" : "\u274C"}</div>
          <div class="phase-banner__title">C'\xE9tait ${r.revealedTruth === "vrai" ? "VRAI" : "FAUX"} !</div>
          <div class="phase-banner__text">L'\xE9quipe adverse avait-elle devin\xE9 juste ?</div>
        </div>
        <div class="split-choice"><button class="btn btn--danger btn--lg" id="btn-guess-right">\u2705 Ils ont devin\xE9 juste</button><button class="btn btn--cool btn--lg" id="btn-guess-wrong">\u274C Ils se sont tromp\xE9s</button></div>
      `;
      }
      if (!r.designated) {
        const opponents = opposingTeam();
        return `
        <div class="phase-banner">
          <div class="phase-banner__icon">\u{1F525}</div>
          <div class="phase-banner__title">${teamLabel} doit deviner !</div>
          <div class="phase-banner__text">${escapeHtml(r.question)}<br/><span class="faint">Discutez et d\xE9signez quelqu'un de l'\xE9quipe adverse.</span></div>
        </div>
        <div class="player-list">
          ${opponents.map((n) => `<div class="player-chip player-chip--selectable" data-designate="${escapeHtml(n)}"><span class="player-chip__avatar">${initials(n)}</span>${escapeHtml(n)}</div>`).join("")}
        </div>
      `;
      }
      return `
      <div class="phase-banner">
        <div class="phase-banner__icon">\u{1F3AF}</div>
        <div class="phase-banner__title">${escapeHtml(r.designated)}, tu confirmes ?</div>
        <div class="phase-banner__text">${escapeHtml(r.question)}</div>
      </div>
      <div class="split-choice"><button class="btn btn--cool btn--lg" id="btn-confirm-yes">\u2705 Je confirme</button><button class="btn btn--danger btn--lg" id="btn-confirm-no">\u274C Je d\xE9mens</button></div>
    `;
    }
    function wireChallengeEvents(r) {
      const nextBtn = root2.querySelector("#btn-next-round");
      if (nextBtn) nextBtn.addEventListener("click", nextRound);
      const goBtn = root2.querySelector("#btn-go");
      if (goBtn) goBtn.addEventListener("click", startChrono);
      const stopBtn = root2.querySelector("#btn-stop");
      if (stopBtn) stopBtn.addEventListener("click", stopChrono);
      const successBtn = root2.querySelector("#btn-success");
      if (successBtn) successBtn.addEventListener("click", () => resolveRound(true));
      const failBtn = root2.querySelector("#btn-fail");
      if (failBtn) failBtn.addEventListener("click", () => resolveRound(false));
      const trueBtn = root2.querySelector("#btn-true");
      if (trueBtn) trueBtn.addEventListener("click", () => {
        r.revealedTruth = "vrai";
        render();
      });
      const falseBtn = root2.querySelector("#btn-false");
      if (falseBtn) falseBtn.addEventListener("click", () => {
        r.revealedTruth = "faux";
        render();
      });
      const guessRightBtn = root2.querySelector("#btn-guess-right");
      if (guessRightBtn) guessRightBtn.addEventListener("click", () => resolveRound(false));
      const guessWrongBtn = root2.querySelector("#btn-guess-wrong");
      if (guessWrongBtn) guessWrongBtn.addEventListener("click", () => resolveRound(true));
      root2.querySelectorAll("[data-designate]").forEach((chip) => {
        chip.addEventListener("click", () => {
          r.designated = chip.dataset.designate;
          render();
        });
      });
      const confirmYesBtn = root2.querySelector("#btn-confirm-yes");
      if (confirmYesBtn) confirmYesBtn.addEventListener("click", () => resolveRound(true));
      const confirmNoBtn = root2.querySelector("#btn-confirm-no");
      if (confirmNoBtn) confirmNoBtn.addEventListener("click", () => resolveRound(false));
    }
    function quitGame() {
      if (confirm("Quitter le D\xE9fi d'\xC9quipes et revenir au lobby ?")) {
        stopTick();
        gotoLobby();
      }
    }
    getContent4(ack2).then((c) => {
      content = c;
      local.contentReady = true;
      render();
    }).catch(() => toast2("Impossible de charger le contenu.", "error"));
    render();
    return () => stopTick();
  }

  // public/js/screens/hostLobby.js
  var GAMES = [
    { id: "loup-garou", icon: "\u{1F43A}", title: "Loup-Garou", desc: "R\xF4les secrets + guide de nuit \xE0 l'\xE9cran.", min: 3 },
    { id: "undercover", icon: "\u{1F575}\uFE0F", title: "Undercover", desc: "Mots secrets, d\xE9masquez les imposteurs.", min: 3 },
    { id: "qui-est-le-plus", icon: "\u{1F525}", title: "Qui est le plus...", desc: "Pointez du doigt, 3 ambiances au choix.", min: 0 },
    { id: "roulette", icon: "\u{1F3A1}", title: "Roulette", desc: "Action ou V\xE9rit\xE9, au hasard. Pr\xE9noms \xE0 ajouter sur cet \xE9cran.", min: 0 },
    { id: "lie-detector", icon: "\u{1F925}", title: "D\xE9tecteur de Mensonges", desc: "Anecdote vraie ou fausse, le groupe vote \xE0 main lev\xE9e.", min: 0 },
    { id: "tribunal", icon: "\u2696\uFE0F", title: "Le Tribunal", desc: "Accusation absurde, plaidoirie chronom\xE9tr\xE9e, verdict du jury.", min: 0 },
    { id: "auction", icon: "\u{1F528}", title: "L'Ench\xE8re", desc: "Une cat\xE9gorie, une surench\xE8re \xE0 l'oral, chrono en main.", min: 0 },
    { id: "team-duel", icon: "\u2694\uFE0F", title: "D\xE9fi d'\xC9quipes", desc: "2 \xE9quipes, roue au hasard entre 3 mini-jeux, gage Hot en cas d'\xE9chec.", min: 0 }
  ];
  function mount4(ctx2) {
    const { root: root2, socket: socket2, state: state2, goto: goto2 } = ctx2;
    function render() {
      const players = state2.players || [];
      const me = players.find((p) => p.id === socket2.id);
      root2.innerHTML = `
      <div class="screen screen--host">
        <div class="top-bar">
          <div class="brand" style="margin:0;">
            <span class="brand__moon">\u{1F319}</span>
            <span class="brand__name" style="font-size:1.3rem;">Lunaris</span>
          </div>
          <button class="link-btn" id="btn-quit">Fermer la soir\xE9e</button>
        </div>

        <div class="card center flex-col gap">
          <p class="eyebrow">Code de la soir\xE9e</p>
          <div class="code-display">${state2.code}</div>
          <p class="muted">Les joueurs ouvrent le site et entrent ce code sur leur t\xE9l\xE9phone.</p>
        </div>

        <div class="card flex-col gap">
          <div class="flex justify-between items-center">
            <p class="eyebrow" style="margin:0;">Joueurs</p>
            <span class="badge badge--soft">${players.length} connect\xE9${players.length > 1 ? "s" : ""}</span>
          </div>
          ${players.length ? `<div class="player-list">${players.map((p) => `
                <div class="player-chip">
                  <span class="player-chip__avatar">${initials(p.name)}</span>
                  ${escapeHtml(p.name)}${p.id === socket2.id ? ' <span class="faint">(toi)</span>' : ""}
                </div>`).join("")}</div>` : `<div class="empty-hint">En attente de joueurs...</div>`}
        </div>

        <div class="card flex-col gap">
          ${me ? `
            <p class="muted" style="margin:0;">\u{1F3B4} Tu joues aussi, sous le nom <strong>${escapeHtml(me.name)}</strong>. Pendant Loup-Garou/Undercover, ta carte secr\xE8te appara\xEEtra via un bouton flottant \u2014 garde-la cach\xE9e des regards.</p>
          ` : `
            <p class="eyebrow" style="text-align:left; margin:0;">Tu joues aussi depuis cet \xE9cran ?</p>
            <p class="faint" style="margin:0;">Si chacun a son t\xE9l\xE9phone, inutile \u2014 rejoins plut\xF4t normalement depuis le tien.</p>
            <div class="flex gap-sm">
              <input id="my-name" class="input" placeholder="Ton pr\xE9nom" maxlength="20" />
              <button class="btn btn--cool" id="btn-join-too">Rejoindre</button>
            </div>
          `}
        </div>

        <div class="flex-col gap-sm">
          <p class="eyebrow" style="text-align:left;">Choisir un jeu</p>
          <div class="game-grid">
            ${GAMES.map((g) => `
              <button class="game-card" data-game="${g.id}" ${players.length < g.min ? 'disabled style="opacity:.45;cursor:not-allowed;"' : ""}>
                <span class="game-card__icon">${g.icon}</span>
                <span class="game-card__title">${g.title}</span>
                <span class="game-card__desc">${g.desc}</span>
                ${players.length < g.min ? `<span class="faint">${g.min} joueurs min.</span>` : ""}
              </button>
            `).join("")}
          </div>
        </div>
      </div>
    `;
      const joinTooBtn = root2.querySelector("#btn-join-too");
      if (joinTooBtn) {
        const nameInput = root2.querySelector("#my-name");
        const submit = async () => {
          const name = nameInput.value.trim();
          if (!name) return ctx2.toast("Entre ton pr\xE9nom.", "error");
          joinTooBtn.disabled = true;
          const res = await ctx2.ack("host:joinAsPlayer", { name });
          joinTooBtn.disabled = false;
          if (!res.ok) return ctx2.toast(res.error || "Impossible de rejoindre.", "error");
        };
        joinTooBtn.addEventListener("click", submit);
        nameInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter") submit();
        });
      }
      root2.querySelectorAll(".game-card").forEach((btn) => {
        btn.addEventListener("click", () => {
          if (btn.disabled) return;
          const id = btn.dataset.game;
          socket2.emit("host:selectGame", { gameType: id });
          const map = {
            "loup-garou": mountHost,
            undercover: mountHost2,
            "qui-est-le-plus": mountHost3,
            roulette: mountHost4,
            "lie-detector": mountHost5,
            tribunal: mountHost6,
            auction: mountHost7,
            "team-duel": mountHost8
          };
          goto2(map[id]);
        });
      });
      root2.querySelector("#btn-quit").addEventListener("click", () => {
        if (confirm("Fermer la soir\xE9e pour tout le monde ?")) {
          ctx2.clearSession();
          location.reload();
        }
      });
    }
    function onRoomUpdate(payload) {
      state2.players = payload.players;
      render();
    }
    socket2.on("room:update", onRoomUpdate);
    render();
    return () => socket2.off("room:update", onRoomUpdate);
  }

  // public/js/screens/home.js
  function mount2(ctx2) {
    const { root: root2, ack: ack2, state: state2, goto: goto2, toast: toast2, saveSession: saveSession2 } = ctx2;
    root2.insertAdjacentHTML("beforeend", `
    <div class="screen">
      <div class="brand">
        <span class="brand__moon">\u{1F319}</span>
        <span class="brand__name">Lunaris</span>
      </div>
      <p class="subtitle">Le hub de jeux pour vos soir\xE9es entre amis.<br/>Cr\xE9ez une soir\xE9e sur l'\xE9cran principal, les autres rejoignent depuis leur t\xE9l\xE9phone.</p>

      <div class="card flex-col gap">
        <button class="btn btn--primary btn--block btn--lg" id="btn-create">\u{1F389} Cr\xE9er une soir\xE9e</button>
        <button class="btn btn--ghost btn--block btn--lg" id="btn-join">\u{1F4F1} Rejoindre une soir\xE9e</button>
      </div>

      <p class="faint center">Astuce : gardez cet \xE9cran sur un laptop/TV et jouez avec vos t\xE9l\xE9phones.</p>
    </div>
  `);
    const btnCreate = root2.querySelector("#btn-create");
    const btnJoin = root2.querySelector("#btn-join");
    async function onCreate() {
      btnCreate.disabled = true;
      const res = await ack2("host:create", {});
      btnCreate.disabled = false;
      if (!res.ok) return toast2("Impossible de cr\xE9er la soir\xE9e.", "error");
      state2.role = "host";
      state2.code = res.code;
      state2.token = res.token;
      state2.players = [];
      state2.gameType = null;
      saveSession2({ role: "host", code: res.code, token: res.token });
      goto2(mount4);
    }
    function onJoin() {
      goto2(mount3);
    }
    btnCreate.addEventListener("click", onCreate);
    btnJoin.addEventListener("click", onJoin);
  }

  // public/js/main.js
  init_loupGarou();
  init_undercover();
  init_quiEstLePlus();
  init_roulette();
  var root = document.getElementById("app");
  var state = {
    role: null,
    code: null,
    token: null,
    name: null,
    players: [],
    gameType: null
  };
  var currentUnmount = null;
  function goto(mountFn, resume) {
    if (currentUnmount) {
      try {
        currentUnmount();
      } catch (e) {
      }
      currentUnmount = null;
    }
    root.innerHTML = "";
    window.scrollTo(0, 0);
    const cleanup = mountFn({ ...ctx, resume });
    currentUnmount = typeof cleanup === "function" ? cleanup : null;
  }
  var ctx = {
    root,
    socket,
    ack,
    state,
    goto,
    toast,
    saveSession,
    clearSession,
    gotoLobby: () => goto(mount4),
    gotoPlayerWaiting: () => goto(mount),
    gotoHome: () => {
      clearSession();
      goto(mount2);
    }
  };
  var screens = { home: home_exports, join: join_exports, hostLobby: hostLobby_exports, playerWaiting: playerWaiting_exports, loupGarou: loupGarou_exports, undercover: undercover_exports, quiz: quiEstLePlus_exports, roulette: roulette_exports };
  socket.on("room:hostDisconnected", () => {
    if (state.role === "player") {
      toast("L'h\xF4te a \xE9t\xE9 d\xE9connect\xE9, en attente de reconnexion...", "error", 6e3);
    }
  });
  async function boot() {
    const session = loadSession();
    if (session?.role === "host" && session.code && session.token) {
      const res = await ack("host:rejoin", { code: session.code, token: session.token });
      if (res.ok) {
        state.role = "host";
        state.code = session.code;
        state.token = session.token;
        state.players = res.snapshot.players;
        state.gameType = res.snapshot.gameType;
        resumeHost(res.game, res.mine);
        return;
      }
      clearSession();
    } else if (session?.role === "player" && session.code && session.name) {
      const res = await ack("player:rejoin", { code: session.code, name: session.name });
      if (res.ok) {
        state.role = "player";
        state.code = session.code;
        state.name = session.name;
        state.players = res.snapshot.players;
        state.gameType = res.gameType;
        resumePlayer(res.gameType, res.mine, res.publicState);
        return;
      }
      clearSession();
    }
    goto(mount2);
  }
  function resumeHost(game, mine) {
    if (!game) return goto(mount4);
    const map = {
      "loup-garou": mountHost,
      undercover: mountHost2,
      "qui-est-le-plus": mountHost3,
      roulette: mountHost4
    };
    const fn = map[game.type];
    if (!fn) return goto(mount4);
    goto(fn, { game, mine });
  }
  function resumePlayer(gameType, mine, publicState) {
    const map = {
      "loup-garou": mountPlayer,
      undercover: mountPlayer2,
      "qui-est-le-plus": mountPlayer3,
      roulette: mountPlayer4
    };
    const fn = gameType && map[gameType];
    if (!fn) return goto(mount);
    const resume = gameType === "loup-garou" || gameType === "undercover" ? mine : publicState;
    goto(fn, resume);
  }
  boot();
})();

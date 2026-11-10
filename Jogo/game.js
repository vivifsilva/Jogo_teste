"use strict";

(() => {
  // O mapa usa células de 40 px. As coordenadas de entidades apontam para o centro da célula.
  const TILE = 40;
  const COLS = 24;
  const ROWS = 15;
  const ORIGIN_X = 24;
  const ORIGIN_Y = 28;
  const SAVE_KEY = "starbound.farol.v1";
  const MATTER = 0;
  const ECHO = 1;
  const BOTH = -1;
  const COLORS = ["#76f2cf", "#c9a0ff"];
  const canvas = document.querySelector("#world");
  const ctx = canvas.getContext("2d");
  const $ = (id) => document.getElementById(id);
  const ui = Object.fromEntries([
    "sector-number", "sector-name", "phase-badge", "hint", "toast", "cover", "cover-title",
    "cover-kicker", "cover-text", "start", "fresh", "pause", "sound", "health-text",
    "energy-text", "health-bar", "energy-bar", "cores", "scrap", "echo-count",
    "objective-title", "objective-text", "route", "log-text", "journal", "save-status",
    "modal", "modal-title", "modal-content", "modal-close", "touch"
  ].map((id) => [id, $(id)]));

  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const center = (x, y) => ({ x: (x + .5) * TILE, y: (y + .5) * TILE });
  const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const noise = (x, y, seed = 0) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + seed * 73.4) * 43758.5453;
    return n - Math.floor(n);
  };

  const item = (type, id, x, y, data = {}) => ({
    type, id, ...center(x, y), phase: BOTH, ...data
  });
  const gate = (id, x, y, target, label) => item("gate", id, x, y, { target, label });
  const memory = (id, x, y, phase, title, text) => item("echo", id, x, y, { phase, title, text });
  const cache = (id, x, y, phase, value) => item("cache", id, x, y, { phase, value });
  const relay = (id, x, y, phase, label) => item("relay", id, x, y, { phase, label });
  const core = (id, x, y, phase, needs, label) => item("core", id, x, y, { phase, needs, label });
  const drone = (id, x, y, phase, kind) => ({ id, ...center(x, y), phase, kind });

  // # é parede fixa, M bloqueia em Matéria, E bloqueia em Eco, ~ é um campo instável.
  // Cada retângulo é [coluna, linha, largura, altura, símbolo]. Os últimos prevalecem.
  const SECTORS = {
    dock: {
      number: 0, name: "O Ancoradouro", tint: "#163d4d", theme: "dock", entry: [11, 11],
      arrival: "NARA // Estação sem sinal. Três núcleos ainda respondem. Comece pela Estufa.",
      walls: [[2, 3, 3, 2, "#"], [19, 3, 3, 2, "#"], [2, 10, 2, 2, "#"], [20, 10, 2, 2, "#"],
              [9, 5, 6, 1, "#"], [10, 6, 4, 1, "#"], [5, 8, 2, 1, "M"], [17, 8, 2, 1, "E"]],
      objects: [
        gate("dock-garden", 5, 4, "garden", "Estufa de Vidro"),
        gate("dock-foundry", 11, 3, "foundry", "Fundição Rubra"),
        gate("dock-vault", 18, 4, "vault", "Arquivo Submerso"),
        gate("dock-tower", 11, 1, "tower", "Torre do Farol"),
        item("workshop", "forge", 8, 10),
        item("med", "medbay", 15, 10),
        memory("origin", 7, 4, ECHO, "01 · A última vigília",
          "NARA // O farol foi construído para guiar as naves pelos vazios do cinturão. Na última noite, ele começou a responder às vozes da tripulação.")
      ],
      enemies: []
    },
    garden: {
      number: 1, name: "Estufa de Vidro", tint: "#1a4639", theme: "garden", entry: [11, 12],
      arrival: "NARA // Há uma passagem violeta e outra verde. Observe qual delas é sólida na sua fase.",
      walls: [[1, 7, 22, 1, "#"], [8, 7, 1, 1, "M"], [15, 7, 1, 1, "E"], [3, 3, 3, 2, "#"],
              [18, 3, 3, 2, "#"], [4, 10, 2, 3, "#"], [18, 10, 2, 3, "#"], [10, 4, 4, 1, "M"]],
      objects: [
        gate("garden-dock", 11, 13, "dock", "Ancoradouro"),
        relay("pump", 5, 5, ECHO, "Bomba de irrigação"),
        core("garden", 11, 2, MATTER, ["pump"], "Núcleo da Estufa"),
        cache("garden-cache", 3, 10, MATTER, 24), cache("garden-loft", 19, 5, ECHO, 16),
        memory("garden-log", 20, 2, ECHO, "02 · Jardim sem céu",
          "LIA // Enterrei os gravadores sob as raízes. Se o farol repetir a minha voz, procurem aqui a versão que eu escolhi deixar.")
      ],
      enemies: [
        drone("g1", 8, 10, MATTER, "hunter"), drone("g2", 17, 5, ECHO, "hunter"),
        drone("g3", 12, 3, MATTER, "sentry")
      ]
    },
    foundry: {
      number: 2, name: "Fundição Rubra", tint: "#4c302a", theme: "foundry", entry: [2, 7],
      arrival: "NARA // O piso instável está ativo em Matéria. Em Eco, você consegue cruzá-lo.",
      walls: [[7, 1, 1, 13, "~"], [8, 1, 1, 13, "~"], [15, 1, 1, 13, "#"], [15, 4, 1, 1, "M"],
              [15, 10, 1, 1, "E"], [10, 6, 4, 2, "#"], [17, 6, 4, 2, "#"], [3, 3, 2, 2, "#"],
              [3, 10, 2, 2, "#"]],
      objects: [
        gate("foundry-dock", 1, 7, "dock", "Ancoradouro"),
        relay("coolant", 11, 3, MATTER, "Regulador térmico"),
        relay("pressure", 11, 11, ECHO, "Regulador de pressão"),
        core("foundry", 21, 4, ECHO, ["coolant", "pressure"], "Núcleo da Fundição"),
        cache("foundry-cache", 5, 12, ECHO, 22), cache("foundry-east", 20, 11, MATTER, 25),
        memory("foundry-log", 21, 12, MATTER, "03 · Ordem de desligamento",
          "CASS // A administração mandou manter o feixe ligado durante a evacuação. Eu desviei a energia e fechei o corredor antes que ele chamasse outra nave.")
      ],
      enemies: [
        drone("f1", 5, 5, MATTER, "sentry"), drone("f2", 12, 9, ECHO, "hunter"),
        drone("f3", 20, 3, ECHO, "sentry"), drone("f4", 19, 11, MATTER, "hunter")
      ]
    },
    vault: {
      number: 3, name: "Arquivo Submerso", tint: "#34315b", theme: "vault", entry: [11, 12],
      arrival: "NARA // Três selos guardam o Arquivo. A transmissão no centro contém a sequência.",
      walls: [[4, 6, 5, 1, "#"], [15, 6, 5, 1, "#"], [9, 2, 1, 4, "#"], [14, 2, 1, 4, "#"],
              [10, 5, 2, 1, "M"], [12, 5, 2, 1, "E"], [5, 9, 3, 2, "#"], [16, 9, 3, 2, "#"],
              [2, 3, 3, 1, "M"], [19, 3, 3, 1, "E"]],
      objects: [
        gate("vault-dock", 11, 13, "dock", "Ancoradouro"),
        relay("tide", 5, 4, ECHO, "Selo da Maré"),
        relay("star", 19, 4, MATTER, "Selo da Estrela"),
        relay("moon", 12, 3, ECHO, "Selo da Lua"),
        core("vault", 12, 1, MATTER, ["tide", "star", "moon"], "Núcleo do Arquivo"),
        cache("vault-cache", 3, 11, ECHO, 26), cache("vault-east", 21, 8, MATTER, 20),
        memory("sequence", 11, 8, BOTH, "04 · A ordem dos selos",
          "LIA // Primeiro a Maré em Eco, depois a Estrela em Matéria, por fim a Lua em Eco. A fechadura apaga a sequência se ouvir um nome fora de ordem."),
        memory("vault-log", 3, 2, ECHO, "05 · O que guardamos",
          "LIA // O feixe era feito de lembranças. Quanto mais a estação brilhava, menos a gente lembrava de quem tinha partido.")
      ],
      enemies: [
        drone("v1", 5, 7, ECHO, "hunter"), drone("v2", 18, 7, MATTER, "hunter"),
        drone("v3", 10, 3, MATTER, "sentry"), drone("v4", 20, 11, ECHO, "sentry")
      ]
    },
    tower: {
      number: 4, name: "Torre do Farol", tint: "#32284f", theme: "tower", entry: [11, 12],
      arrival: "NARA // Quando a sentinela acender, mude para a cor dela e responda com um pulso.",
      walls: [[3, 4, 2, 2, "#"], [19, 4, 2, 2, "#"], [3, 9, 2, 2, "#"], [19, 9, 2, 2, "#"],
              [6, 2, 3, 1, "E"], [15, 2, 3, 1, "M"]],
      objects: [
        gate("tower-dock", 11, 13, "dock", "Ancoradouro"),
        memory("tower-log", 21, 2, ECHO, "06 · A voz do farol",
          "NARA // Eu sou a operadora que ficou para trás. Deixei minha voz no farol para que ninguém mais precisasse ficar."),
        item("terminal", "beacon", 11, 2)
      ],
      enemies: []
    }
  };

  const ORDER = ["tide", "star", "moon"];
  const CORE_NAMES = ["Estufa de Vidro", "Fundição Rubra", "Arquivo Submerso"];
  const CORE_IDS = ["garden", "foundry", "vault"];
  const MEMORIES = Object.values(SECTORS).flatMap((sector) => sector.objects.filter((o) => o.type === "echo"));
  const UPGRADES = [
    { id: "plating", name: "Blindagem de basalto", cost: 35, description: "Aumenta a integridade máxima de 100 para 140 e repara o traje." },
    { id: "resonator", name: "Ressonador duplo", cost: 50, description: "Aumenta o raio de pulso e reduz seu custo de energia." },
    { id: "battery", name: "Bateria de vidro", cost: 40, description: "Acelera a regeneração de energia do traje." }
  ];
  const ENEMY_TYPES = {
    hunter: { speed: 104, health: 2, radius: 15, reward: 9 },
    sentry: { speed: 57, health: 3, radius: 18, reward: 13 }
  };
  const KEYMAP = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right",
    KeyQ: "phase", KeyE: "interact", Space: "pulse",
    ShiftLeft: "dash", ShiftRight: "dash", Escape: "pause"
  };
  const DIRECTIONS = new Set(["up", "down", "left", "right"]);
  const keyboard = new Map();
  const pointers = new Map();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const canPlay = () => state.mode === "play" && !ui.modal.open;

  function makeGrid(sector) {
    const grid = Array.from({ length: ROWS }, (_, row) =>
      Array.from({ length: COLS }, (_, col) =>
        row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1 ? "#" : "."
      )
    );
    for (const [x, y, w, h, type] of sector.walls) {
      for (let row = y; row < y + h; row++) {
        for (let col = x; col < x + w; col++) grid[row][col] = type;
      }
    }
    return grid;
  }

  for (const sector of Object.values(SECTORS)) sector.grid = makeGrid(sector);

  function newProgress() {
    return { version: 1, scrap: 0, cores: [], relays: [], echoes: [], caches: [],
      upgrades: [], defeated: [], bossDown: false, ending: null, deaths: 0 };
  }

  function readProgress() {
    try {
      const data = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!data || data.version !== 1) return null;
      const result = newProgress();
      for (const key of ["cores", "relays", "echoes", "caches", "upgrades", "defeated"]) {
        if (Array.isArray(data[key])) result[key] = [...new Set(data[key].filter((v) => typeof v === "string"))];
      }
      result.scrap = Number.isSafeInteger(data.scrap) ? clamp(data.scrap, 0, 9999) : 0;
      result.deaths = Number.isSafeInteger(data.deaths) ? clamp(data.deaths, 0, 9999) : 0;
      result.bossDown = data.bossDown === true;
      result.ending = ["signal", "voices"].includes(data.ending) ? data.ending : null;
      return result;
    } catch {
      return null;
    }
  }

  const savedProgress = readProgress();
  let progress = savedProgress ?? newProgress();
  const player = { ...center(11, 11), radius: 12, health: 100, energy: 100,
    facingX: 0, facingY: -1, dash: 0, dashX: 0, dashY: 0, dashCooldown: 0,
    invincible: 0, pulseCooldown: 0, phaseCooldown: 0, hazardCooldown: 0, walking: false };
  const state = { mode: "menu", sector: "dock", phase: MATTER, clock: 0, uiTimer: 0,
    toastUntil: 0, checkpoint: "dock", enemies: [], bullets: [], effects: [], boss: null,
    log: "Aguardando o início da expedição." };

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(progress));
      ui["save-status"].textContent = "CHECKPOINT GRAVADO";
    } catch {
      ui["save-status"].textContent = "SALVAMENTO INDISPONÍVEL";
    }
  }

  const maxHealth = () => progress.upgrades.includes("plating") ? 140 : 100;
  const activeSector = () => SECTORS[state.sector];
  const visible = (object, phase = state.phase) => object.phase === BOTH || object.phase === phase;

  function enterSector(id, origin = null) {
    state.sector = id;
    state.checkpoint = id;
    state.phase = MATTER;
    const sector = activeSector();
    const returnGate = id === "dock" && origin && sector.objects.find((o) => o.target === origin);
    const position = returnGate ? { x: returnGate.x, y: returnGate.y + TILE } : center(...sector.entry);
    Object.assign(player, position, { facingX: 0, facingY: -1, dash: 0, invincible: .65, hazardCooldown: 0, walking: false });
    state.bullets = [];
    state.effects = [];
    state.enemies = sector.enemies.filter((e) => !progress.defeated.includes(e.id)).map((e) => ({
      ...e, ...ENEMY_TYPES[e.kind], homeX: e.x, homeY: e.y, cooldown: .8, stun: 0
    }));
    state.boss = id === "tower" && !progress.bossDown ? {
      ...center(11, 6), health: 11, maxHealth: 11, phase: MATTER, age: 0, shotIndex: 0, stage: "sealed"
    } : null;
    state.log = sector.arrival;
    state.toastUntil = 0;
    ui.toast.hidden = true;
    syncUI();
  }

  function tileAt(x, y) {
    return activeSector().grid[Math.floor(y / TILE)]?.[Math.floor(x / TILE)] ?? "#";
  }

  function blocks(type, phase) {
    return type === "#" || (type === "M" && phase === MATTER) || (type === "E" && phase === ECHO);
  }

  function canStand(x, y, radius, phase = state.phase) {
    const minCol = Math.floor((x - radius) / TILE);
    const maxCol = Math.floor((x + radius) / TILE);
    const minRow = Math.floor((y - radius) / TILE);
    const maxRow = Math.floor((y + radius) / TILE);
    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (!blocks(activeSector().grid[row]?.[col] ?? "#", phase)) continue;
        const dx = x - clamp(x, col * TILE, (col + 1) * TILE);
        const dy = y - clamp(y, row * TILE, (row + 1) * TILE);
        if (dx * dx + dy * dy < radius * radius) return false;
      }
    }
    return true;
  }

  function move(body, dx, dy, phase = state.phase) {
    const oldX = body.x;
    const oldY = body.y;
    if (canStand(body.x + dx, body.y, body.radius, phase)) body.x += dx;
    if (canStand(body.x, body.y + dy, body.radius, phase)) body.y += dy;
    return body.x !== oldX || body.y !== oldY;
  }

  function clearPath(from, to, phase) {
    const steps = Math.ceil(distance(from, to) / 15);
    for (let index = 1; index < steps; index++) {
      const x = from.x + (to.x - from.x) * index / steps;
      const y = from.y + (to.y - from.y) * index / steps;
      if (blocks(tileAt(x, y), phase)) return false;
    }
    return true;
  }

  function note(text) {
    state.log = text;
    syncUI();
  }

  function notify(text) {
    ui.toast.textContent = text;
    ui.toast.hidden = false;
    state.toastUntil = state.clock + 2.8;
  }

  let soundOn = false;
  let audio;
  function beep(kind) {
    if (!soundOn) return;
    const frequencies = { phase: [310, 620], pulse: [185, 85], loot: [540, 860],
      hit: [145, 48], gate: [280, 470], dash: [240, 120], win: [440, 880] };
    const pair = frequencies[kind];
    if (!pair) return;
    try {
      const AudioEngine = window.AudioContext || window.webkitAudioContext;
      if (!AudioEngine) return;
      audio ??= new AudioEngine();
      if (audio.state === "suspended") audio.resume().catch(() => {});
      const now = audio.currentTime;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = kind === "hit" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(pair[0], now);
      oscillator.frequency.exponentialRampToValueAtTime(pair[1], now + .19);
      gain.gain.setValueAtTime(.0001, now);
      gain.gain.exponentialRampToValueAtTime(.13, now + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .23);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + .25);
    } catch {
      // A falta de áudio não interrompe a partida.
    }
  }

  function ring(x, y, color, radius, life = .36) {
    state.effects.push({ kind: "ring", x, y, color, radius, life, maxLife: life });
  }

  function burst(x, y, color, amount = 12) {
    const count = reducedMotion.matches ? Math.min(5, amount) : amount;
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2 + Math.random() * .35;
      const speed = 28 + Math.random() * 100;
      const life = .22 + Math.random() * .3;
      state.effects.push({ kind: "spark", x, y, color, life, maxLife: life,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed });
    }
  }

  function shiftPhase() {
    if (player.phaseCooldown > 0) return;
    const next = 1 - state.phase;
    if (!canStand(player.x, player.y, player.radius, next)) {
      notify("O espaço está bloqueado na outra fase. Dê um passo para fora.");
      return;
    }
    state.phase = next;
    player.phaseCooldown = .27;
    ring(player.x, player.y, COLORS[next], 95, .42);
    burst(player.x, player.y, COLORS[next]);
    beep("phase");
    syncUI();
  }

  function dash() {
    if (player.dashCooldown > 0) return;
    if (player.energy < 18) {
      notify("Energia insuficiente para esquivar.");
      return;
    }
    const direction = movement();
    player.dashX = direction.x || direction.y ? direction.x : player.facingX;
    player.dashY = direction.x || direction.y ? direction.y : player.facingY;
    player.energy -= 18;
    player.dash = .17;
    player.dashCooldown = .65;
    player.invincible = Math.max(.21, player.invincible);
    ring(player.x, player.y, COLORS[state.phase], 38, .22);
    beep("dash");
  }

  function pulse() {
    if (player.pulseCooldown > 0) return;
    const enhanced = progress.upgrades.includes("resonator");
    const cost = enhanced ? 17 : 26;
    const radius = enhanced ? 155 : 119;
    if (player.energy < cost) {
      notify("Pulso sem energia. Aguarde o traje recarregar.");
      return;
    }
    player.energy -= cost;
    player.pulseCooldown = .27;
    ring(player.x, player.y, COLORS[state.phase], radius);
    beep("pulse");

    for (const enemy of state.enemies) {
      if (!visible(enemy) || enemy.health <= 0 || distance(player, enemy) > radius ||
          !clearPath(player, enemy, state.phase)) continue;
      enemy.health--;
      enemy.stun = .35;
      burst(enemy.x, enemy.y, "#ff9b87", enemy.health ? 6 : 16);
      if (enemy.health === 0) {
        progress.defeated.push(enemy.id);
        progress.scrap += enemy.reward;
        notify("Drone desativado · +" + enemy.reward + " sucata");
        save();
      }
    }
    state.enemies = state.enemies.filter((enemy) => enemy.health > 0);
    state.bullets = state.bullets.filter((bullet) => {
      if (!visible(bullet) || distance(player, bullet) > radius || !clearPath(player, bullet, state.phase)) return true;
      burst(bullet.x, bullet.y, COLORS[state.phase], 4);
      return false;
    });

    const boss = state.boss;
    if (boss && distance(player, boss) < radius + 35) {
      if (boss.stage === "open" && boss.phase === state.phase) {
        boss.health -= enhanced ? 2 : 1;
        burst(boss.x, boss.y, COLORS[boss.phase], 22);
        if (boss.health <= 0) {
          state.boss = null;
          state.bullets = [];
          progress.bossDown = true;
          progress.scrap += 45;
          save();
          notify("Sentinela desativada · +45 sucata");
          note("NARA // O terminal do Farol está livre. Eu consigo ouvir as vozes outra vez.");
          beep("win");
        }
      } else {
        notify(boss.stage === "open" ? "Mude para a cor da Sentinela." : "Escudo fechado. Aguarde a abertura.");
      }
    }
    syncUI();
  }

  function damage(amount) {
    if (player.invincible > 0) return;
    player.health = Math.max(0, player.health - amount);
    player.invincible = .68;
    burst(player.x, player.y, "#ff8b85", 10);
    beep("hit");
    if (player.health === 0) {
      progress.deaths++;
      save();
      state.mode = "dead";
      keyboard.clear();
      pointers.clear();
      showCover();
    }
    syncUI();
  }

  function shoot(source, angle, phase, speed, damageValue, large = false) {
    state.bullets.push({
      x: source.x + Math.cos(angle) * 23, y: source.y + Math.sin(angle) * 23,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      radius: large ? 6 : 4, phase, damageValue, life: 3.2
    });
  }

  function updateEnemies(dt) {
    for (const enemy of state.enemies) {
      if (!visible(enemy)) continue;
      enemy.stun = Math.max(0, enemy.stun - dt);
      enemy.cooldown -= dt;
      const range = distance(enemy, player);
      if (enemy.stun > 0) continue;
      if (range < 280 && clearPath(enemy, player, state.phase)) {
        const angle = Math.atan2(player.y - enemy.y, player.x - enemy.x);
        if (enemy.kind === "sentry" && enemy.cooldown <= 0) {
          shoot(enemy, angle, enemy.phase, 210, 12);
          enemy.cooldown = 1.45;
        }
        const targetDistance = enemy.kind === "sentry" ? 155 : 20;
        if (range > targetDistance) move(enemy, Math.cos(angle) * enemy.speed * dt, Math.sin(angle) * enemy.speed * dt);
      } else {
        const target = { x: enemy.homeX + Math.sin(state.clock * .85 + enemy.homeY) * 32,
          y: enemy.homeY + Math.cos(state.clock * .8 + enemy.homeX) * 29 };
        const angle = Math.atan2(target.y - enemy.y, target.x - enemy.x);
        if (distance(enemy, target) > 4) move(enemy, Math.cos(angle) * 36 * dt, Math.sin(angle) * 36 * dt);
      }
      if (range < player.radius + enemy.radius) damage(enemy.kind === "hunter" ? 18 : 12);
      if (!canPlay()) break;
    }
  }

  function updateBoss(dt) {
    const boss = state.boss;
    if (!boss) return;
    if (distance(player, boss) < 43) damage(16);
    if (!canPlay()) return;
    boss.age += dt;
    const cycle = Math.floor(boss.age / 4.8);
    const time = boss.age % 4.8;
    boss.phase = cycle % 2;
    boss.stage = time >= 2.55 ? "open" : time >= .85 ? "attack" : "sealed";
    const thresholds = boss.health <= 5 ? [.85, 1.28, 1.72, 2.16] : [1, 1.55, 2.14];
    let shot = thresholds.length - 1;
    while (shot >= 0 && time < thresholds[shot]) shot--;
    const serial = cycle * 5 + shot + 1;
    if (shot < 0 || serial <= boss.shotIndex || boss.stage !== "attack") return;
    boss.shotIndex = serial;
    if (shot % 2 === 0) {
      const count = boss.health <= 5 ? 16 : 12;
      for (let index = 0; index < count; index++) {
        const angle = index / count * Math.PI * 2 + cycle * .3 + shot * .19;
        shoot(boss, angle, boss.phase, 165 + shot * 10, 14, true);
      }
    } else {
      const angle = Math.atan2(player.y - boss.y, player.x - boss.x);
      for (const offset of [-.22, 0, .22]) shoot(boss, angle + offset, 1 - boss.phase, 245, 15, true);
    }
  }

  function updateBullets(dt) {
    state.bullets = state.bullets.filter((bullet) => {
      bullet.life -= dt;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      if (bullet.life <= 0 || blocks(tileAt(bullet.x, bullet.y), bullet.phase)) return false;
      if (visible(bullet) && distance(player, bullet) < player.radius + bullet.radius) {
        damage(bullet.damageValue);
        return false;
      }
      return true;
    });
  }

  function objectPresent(object) {
    if (object.type === "cache") return !progress.caches.includes(object.id);
    if (object.type === "echo") return !progress.echoes.includes(object.id);
    if (object.type === "core") return !progress.cores.includes(object.id);
    return true;
  }

  function targetInReach() {
    let best = null;
    let bestRange = 51;
    for (const object of activeSector().objects) {
      if (!objectPresent(object) || !visible(object)) continue;
      const range = distance(player, object);
      if (range < bestRange && clearPath(player, object, state.phase)) {
        best = object;
        bestRange = range;
      }
    }
    return best;
  }

  function objectLabel(object) {
    if (object.type === "gate") return "Viajar · " + object.label;
    if (object.type === "cache") return "Vasculhar caixa";
    if (object.type === "echo") return "Ler transmissão";
    if (object.type === "relay") return object.label + (progress.relays.includes(object.id) ? " · ativo" : " · ligar");
    if (object.type === "core") return "Extrair · " + object.label;
    if (object.type === "workshop") return "Abrir oficina";
    if (object.type === "med") return "Reparar traje";
    return "Abrir terminal do Farol";
  }

  function interact() {
    const object = targetInReach();
    if (!object) return;
    switch (object.type) {
      case "gate":
        if (object.target === "tower" && progress.cores.length < 3) {
          notify("Torre selada. Encontre os três núcleos.");
          return;
        }
        enterSector(object.target, state.sector);
        beep("gate");
        return;
      case "med":
        player.health = maxHealth();
        player.energy = 100;
        beep("loot");
        notify("Traje reparado e energia restaurada.");
        return;
      case "workshop":
        openWorkshop();
        return;
      case "terminal":
        if (!progress.bossDown) notify("A Sentinela mantém o terminal bloqueado.");
        else openEnding();
        return;
      case "echo":
        progress.echoes.push(object.id);
        note(object.title + " — " + object.text);
        openTransmission(object);
        break;
      case "cache":
        progress.caches.push(object.id);
        progress.scrap += object.value;
        notify("Caixa recuperada · +" + object.value + " sucata");
        break;
      case "relay":
        if (progress.relays.includes(object.id)) {
          notify(object.label + " já está ativo.");
          return;
        }
        if (ORDER.includes(object.id)) {
          const position = ORDER.filter((id) => progress.relays.includes(id)).length;
          if (ORDER[position] !== object.id) {
            progress.relays = progress.relays.filter((id) => !ORDER.includes(id));
            notify("Sequência apagada. Consulte a transmissão no centro.");
            save();
            syncUI();
            return;
          }
        }
        progress.relays.push(object.id);
        notify(object.label + " ativado.");
        break;
      case "core":
        if (!object.needs.every((id) => progress.relays.includes(id))) {
          notify("Circuito incompleto. Ative os controles deste setor.");
          return;
        }
        progress.cores.push(object.id);
        player.health = Math.min(maxHealth(), player.health + 35);
        player.energy = 100;
        note(progress.cores.length === 3 ? "NARA // Todos os núcleos respondem. A Torre abriu."
          : "NARA // Núcleo recuperado. O portal de retorno continua no ponto de entrada.");
        notify(object.label + " recuperado.");
        break;
    }
    save();
    burst(object.x, object.y, COLORS[state.phase], 18);
    beep("loot");
    syncUI();
  }

  function element(tag, text, className = "") {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
  }

  function openDialog(title) {
    keyboard.clear();
    pointers.clear();
    ui["modal-title"].textContent = title;
    ui["modal-content"].replaceChildren();
    if (!ui.modal.open) ui.modal.showModal();
    return ui["modal-content"];
  }

  function openTransmission(object) {
    const content = openDialog(object.title);
    content.append(element("p", object.text));
  }

  function openJournal() {
    const content = openDialog("Transmissões recuperadas");
    if (!progress.echoes.length) {
      content.append(element("p", "Nenhuma transmissão coletada. Procure diamantes dourados no mapa e experimente a fase Eco."));
    }
    for (const memory of MEMORIES) {
      if (!progress.echoes.includes(memory.id)) continue;
      const card = element("article", "", "dialog-item");
      card.append(element("h3", memory.title), element("p", memory.text));
      content.append(card);
    }
  }

  function openWorkshop() {
    const content = openDialog("Oficina de campo");
    content.append(element("p", "Sucata disponível · " + progress.scrap));
    for (const upgrade of UPGRADES) {
      const owned = progress.upgrades.includes(upgrade.id);
      const card = element("article", "", "dialog-item");
      const buy = element("button", owned ? "Instalado" : "Instalar · " + upgrade.cost + " sucata", "button quiet");
      buy.disabled = owned || progress.scrap < upgrade.cost;
      buy.addEventListener("click", () => {
        if (progress.scrap < upgrade.cost || progress.upgrades.includes(upgrade.id)) return;
        progress.scrap -= upgrade.cost;
        progress.upgrades.push(upgrade.id);
        if (upgrade.id === "plating") player.health = maxHealth();
        save();
        syncUI();
        beep("loot");
        openWorkshop();
        ui["modal-close"].focus();
      });
      card.append(element("h3", upgrade.name), element("p", upgrade.description), buy);
      content.append(card);
    }
  }

  const ENDINGS = {
    signal: { name: "O caminho de volta", text: "O feixe cruzou o cinturão. Uma nave respondeu ao sinal e abriu caminho para as outras. Nara guardou o que restava das vozes em uma frequência só sua." },
    voices: { name: "Constelação de vozes", text: "Você transmitiu cada uma das seis memórias no lugar do antigo feixe. As naves passaram a se orientar pelas vozes, e Nara ouviu seu nome ser chamado de volta." }
  };

  function finish(id) {
    progress.ending = id;
    save();
    ui.modal.close();
    state.mode = "won";
    beep("win");
    showCover();
    syncUI();
  }

  function openEnding() {
    const content = openDialog("O que o Farol deve transmitir?");
    content.append(element("p", "Escolha uma transmissão para concluir a campanha. O sinal de navegação está disponível agora. As seis memórias liberam outra escolha."));
    const signal = element("button", "Religar o sinal de navegação", "button primary");
    const voices = element("button", "Transmitir as seis memórias", "button quiet");
    voices.disabled = progress.echoes.length < MEMORIES.length;
    signal.addEventListener("click", () => finish("signal"));
    voices.addEventListener("click", () => finish("voices"));
    const actions = element("div", "", "cover-actions");
    actions.append(signal, voices);
    content.append(actions);
    if (voices.disabled) {
      content.append(element("p", "Memórias encontradas · " + progress.echoes.length + " / " + MEMORIES.length + ". Você pode voltar aos setores antes de escolher."));
    }
  }

  function movement() {
    const active = (control) => keyboardHas(control) || [...pointers.values()].includes(control);
    const x = Number(active("right")) - Number(active("left"));
    const y = Number(active("down")) - Number(active("up"));
    const size = Math.hypot(x, y) || 1;
    return { x: x / size, y: y / size };
  }

  function keyboardHas(control) {
    for (const value of keyboard.values()) {
      if (value === control) return true;
    }
    return false;
  }

  function update(dt) {
    state.clock += dt;
    for (const timer of ["dash", "dashCooldown", "invincible", "pulseCooldown", "phaseCooldown", "hazardCooldown"]) {
      player[timer] = Math.max(0, player[timer] - dt);
    }
    const direction = movement();
    if (direction.x || direction.y) {
      player.facingX = direction.x;
      player.facingY = direction.y;
    }
    const speed = player.dash > 0 ? 520 : 186;
    const dx = player.dash > 0 ? player.dashX : direction.x;
    const dy = player.dash > 0 ? player.dashY : direction.y;
    player.walking = move(player, dx * speed * dt, dy * speed * dt);
    if (player.dash > 0 && player.walking && Math.random() < .65) burst(player.x, player.y, COLORS[state.phase], 2);
    const recharge = progress.upgrades.includes("battery") ? 32 : 22;
    player.energy = Math.min(100, player.energy + recharge * dt);
    if (state.phase === MATTER && tileAt(player.x, player.y) === "~" && player.hazardCooldown === 0) {
      player.hazardCooldown = .52;
      damage(12);
      notify("Piso instável · atravesse em Eco.");
    }
    if (!canPlay()) return;
    updateEnemies(dt);
    if (!canPlay()) return;
    updateBoss(dt);
    if (!canPlay()) return;
    updateBullets(dt);
    for (const effect of state.effects) {
      effect.life -= dt;
      if (effect.kind === "spark") {
        effect.x += effect.vx * dt;
        effect.y += effect.vy * dt;
      }
    }
    state.effects = state.effects.filter((effect) => effect.life > 0);
    if (!ui.toast.hidden && state.clock > state.toastUntil) ui.toast.hidden = true;
    state.uiTimer += dt;
    if (state.uiTimer >= .09) {
      syncVitals();
      syncHint();
      state.uiTimer = 0;
    }
  }

  function syncVitals() {
    const health = Math.ceil(player.health);
    const energy = Math.floor(player.energy);
    ui["health-text"].textContent = health + " / " + maxHealth();
    ui["energy-text"].textContent = energy + "%";
    ui["health-bar"].style.width = 100 * health / maxHealth() + "%";
    ui["energy-bar"].style.width = energy + "%";
    ui.cores.textContent = progress.cores.length + " / 3";
    ui.scrap.textContent = String(progress.scrap).padStart(2, "0");
    ui["echo-count"].textContent = progress.echoes.length + " / " + MEMORIES.length;
  }

  function syncHint() {
    const target = canPlay() ? targetInReach() : null;
    ui.hint.hidden = !target;
    if (target) ui.hint.textContent = "E / Usar · " + objectLabel(target);
  }

  function currentObjective() {
    const sector = activeSector();
    const locate = (id, title, instruction) => {
      const target = sector.objects.find((object) => object.id === id);
      const phase = target.phase === BOTH ? "" : target.phase === ECHO ? " Fase Eco (Q)." : " Fase Matéria (Q).";
      return { target, title, text: instruction + phase };
    };
    if (state.sector === "dock") {
      const pending = CORE_IDS.findIndex((id) => !progress.cores.includes(id));
      if (pending === -1) {
        return locate("dock-tower", "Entre na Torre do Farol", "Siga o marcador dourado e pressione E no portal ao norte.");
      }
      return locate("dock-" + CORE_IDS[pending], "Vá para " + CORE_NAMES[pending], "Siga o marcador dourado e pressione E perto do portal.");
    }
    if (state.sector === "tower") {
      if (progress.bossDown) {
        return locate("beacon", "Conclua a expedição", "Use E no terminal ao norte. Religar o sinal encerra a campanha. As memórias liberam um segundo final.");
      }
      return {
        target: null,
        title: "Derrote a Sentinela",
        text: "Aproxime-se sem encostar nela. Quando aparecer JANELA DE PULSO, use Q para igualar a fase (verde = Matéria, violeta = Eco) e ataque com Espaço."
      };
    }
    if (progress.cores.includes(state.sector)) {
      return locate(state.sector + "-dock", "Núcleo recuperado", "Volte ao Ancoradouro pelo portal marcado. Os ecos e as caixas são opcionais.");
    }
    if (state.sector === "vault" && !progress.echoes.includes("sequence") &&
        !ORDER.every((id) => progress.relays.includes(id))) {
      return locate("sequence", "Leia a transmissão central", "Use E no marcador dourado para descobrir a ordem dos selos.");
    }
    const core = sector.objects.find((object) => object.type === "core");
    const missing = core.needs.find((id) => !progress.relays.includes(id));
    if (missing) {
      const control = sector.objects.find((object) => object.id === missing);
      const instruction = state.sector === "foundry"
        ? "Use E no controle marcado. Atravesse o piso instável em Eco."
        : "Use E no controle marcado depois de chegar na fase indicada.";
      return locate(missing, "Ative " + control.label, instruction);
    }
    return locate(core.id, "Extraia " + core.label, "O circuito está ativo. Pressione E no núcleo marcado.");
  }

  function syncUI() {
    const sector = activeSector();
    ui["sector-number"].textContent = "SETOR " + String(sector.number).padStart(2, "0");
    ui["sector-name"].textContent = sector.name;
    ui["phase-badge"].textContent = state.phase === MATTER ? "● MATÉRIA" : "◇ ECO";
    ui["phase-badge"].classList.toggle("echo", state.phase === ECHO);
    const objective = currentObjective();
    state.objectiveTarget = objective.target;
    ui["objective-title"].textContent = objective.title;
    ui["objective-text"].textContent = objective.text;
    const steps = CORE_NAMES.map((name, index) => {
      const done = progress.cores.includes(CORE_IDS[index]);
      return element("li", name + (done ? " ✓" : ""), done ? "done" : "");
    });
    ui.route.replaceChildren(...steps);
    ui["log-text"].textContent = state.log;
    ui.pause.disabled = !["play", "pause"].includes(state.mode);
    ui.pause.textContent = state.mode === "pause" ? "Retomar" : "Pausar";
    ui.journal.disabled = state.mode !== "play";
    syncVitals();
    syncHint();
  }

  function showCover() {
    const mode = state.mode;
    ui.cover.hidden = mode === "play";
    if (mode === "play") return;
    ui.fresh.hidden = true;
    if (mode === "menu") {
      ui.start.textContent = savedProgress ? "Continuar expedição ↗" : "Iniciar expedição ↗";
      ui.fresh.hidden = !savedProgress;
    }
    if (mode === "pause") {
      ui["cover-kicker"].textContent = "EXPEDIÇÃO EM PAUSA";
      ui["cover-title"].textContent = "Em espera.";
      ui["cover-text"].textContent = "O mapa está congelado. Retome para continuar de onde parou.";
      ui.start.textContent = "Retomar expedição ↗";
    }
    if (mode === "dead") {
      ui["cover-kicker"].textContent = "SINAL INTERROMPIDO";
      ui["cover-title"].textContent = "Traje avariado.";
      ui["cover-text"].textContent = "Volte à entrada do setor com integridade e energia restauradas. Seus itens e melhorias foram preservados.";
      ui.start.textContent = "Voltar ao setor ↗";
    }
    if (mode === "won") {
      const ending = ENDINGS[progress.ending];
      ui["cover-kicker"].textContent = "EXPEDIÇÃO CONCLUÍDA / " + progress.echoes.length + " ECOS";
      ui["cover-title"].textContent = ending.name;
      ui["cover-text"].textContent = ending.text;
      ui.start.textContent = "Voltar à exploração ↗";
      ui.fresh.hidden = false;
    }
  }

  function start() {
    if (state.mode === "menu") {
      player.health = maxHealth();
      player.energy = 100;
      enterSector("dock");
      save();
      state.mode = progress.ending ? "won" : "play";
    } else if (state.mode === "dead") {
      player.health = maxHealth();
      player.energy = 100;
      player.dashCooldown = 0;
      player.pulseCooldown = 0;
      player.phaseCooldown = 0;
      enterSector(state.checkpoint);
      state.mode = "play";
    } else {
      state.mode = "play";
    }
    showCover();
    syncUI();
    if (canPlay()) canvas.focus({ preventScroll: true });
  }

  function togglePause() {
    if (ui.modal.open) return;
    if (state.mode === "pause") start();
    else if (state.mode === "play") {
      state.mode = "pause";
      keyboard.clear();
      pointers.clear();
      showCover();
      syncUI();
      ui.start.focus({ preventScroll: true });
    }
  }

  function action(control) {
    if (control === "pause") {
      togglePause();
      return;
    }
    if (!canPlay()) return;
    if (control === "phase") shiftPhase();
    if (control === "interact") interact();
    if (control === "pulse") pulse();
    if (control === "dash") dash();
  }

  canvas.tabIndex = -1;
  ui.start.addEventListener("click", start);
  ui.pause.addEventListener("click", togglePause);
  ui.fresh.addEventListener("click", () => {
    const content = openDialog("Começar um novo jogo?");
    content.append(element("p", "Esta escolha substitui o progresso desta expedição."));
    const button = element("button", "Reiniciar expedição", "button primary");
    button.addEventListener("click", () => {
      progress = newProgress();
      Object.assign(player, { health: 100, energy: 100, phaseCooldown: 0, pulseCooldown: 0, dashCooldown: 0 });
      ui.modal.close();
      state.mode = "play";
      enterSector("dock");
      save();
      showCover();
      syncUI();
      canvas.focus({ preventScroll: true });
    });
    content.append(button);
  });
  ui.journal.addEventListener("click", openJournal);
  ui["modal-close"].addEventListener("click", () => ui.modal.close());
  ui.modal.addEventListener("close", () => {
    if (canPlay()) canvas.focus({ preventScroll: true });
    syncHint();
  });
  ui.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    ui.sound.setAttribute("aria-pressed", String(soundOn));
    ui.sound.textContent = soundOn ? "Som ligado" : "Som desligado";
    if (soundOn) beep("loot");
  });
  document.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || ui.modal.open) return;
    const control = KEYMAP[event.code];
    if (!control || (event.code === "Space" && event.target instanceof HTMLButtonElement)) return;
    if (canPlay() || (control === "pause" && state.mode === "pause")) event.preventDefault();
    if (DIRECTIONS.has(control)) {
      if (canPlay()) keyboard.set(event.code, control);
    } else if (!event.repeat) action(control);
  });
  document.addEventListener("keyup", (event) => keyboard.delete(event.code));
  window.addEventListener("blur", () => {
    keyboard.clear();
    pointers.clear();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && canPlay()) togglePause();
  });
  for (const button of ui.touch.querySelectorAll("[data-control]")) {
    const control = button.dataset.control;
    button.addEventListener("pointerdown", (event) => {
      if (!canPlay()) return;
      button.setPointerCapture(event.pointerId);
      if (DIRECTIONS.has(control)) pointers.set(event.pointerId, control);
      else action(control);
    });
    button.addEventListener("click", (event) => {
      if (event.detail === 0 && !DIRECTIONS.has(control)) action(control);
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
      button.addEventListener(type, (event) => pointers.delete(event.pointerId));
    }
  }

  // Renderização. Os pisos de cada fase são pré-renderizados para poupar trabalho por quadro.
  const floorLayers = new Map();
  const TAU = Math.PI * 2;
  const AMBER = "#ffcb84";
  const STARFIELD = Array.from({ length: 165 }, (_, i) => ({
    x: noise(i, 1) * canvas.width, y: noise(i, 2) * canvas.height,
    r: .4 + noise(i, 3) * 1.35, alpha: .12 + noise(i, 4) * .6
  }));

  function polygon(g, sides, radius, angle = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + i * TAU / sides;
      const x = Math.cos(a) * radius;
      const y = Math.sin(a) * radius;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
  }

  function circle(g, x, y, radius) {
    g.beginPath();
    g.arc(x, y, radius, 0, TAU);
  }

  function lamp(g, x, y, radius, color) {
    const glow = g.createRadialGradient(x, y, 0, x, y, radius);
    glow.addColorStop(0, color + "55");
    glow.addColorStop(1, color + "00");
    g.fillStyle = glow;
    g.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  function scenery(g, sector, col, row, phase) {
    const value = noise(col, row, sector.number);
    const x = col * TILE;
    const y = row * TILE;
    if (value < .13 && sector.theme === "garden") {
      g.save();
      g.translate(x + 11, y + 30);
      for (let i = 0; i < 5; i++) {
        const angle = i * 1.18 + value * 9;
        g.strokeStyle = phase === ECHO ? "#7953a4" : "#347b61";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(Math.cos(angle) * 7, -9, Math.cos(angle) * 14, -8 - i * 3);
        g.stroke();
        g.fillStyle = phase === ECHO ? "#ae7bdb" : "#65bf83";
        circle(g, Math.cos(angle) * 14, -8 - i * 3, 1.7);
        g.fill();
      }
      g.restore();
    } else if (value > .79 && sector.theme === "vault") {
      g.strokeStyle = phase === ECHO ? "#b198d65c" : "#618eb561";
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.ellipse(x + 20, y + 20, 5 + i * 5, 2 + i * 2, -.2, 0, TAU);
        g.stroke();
      }
    } else if (value > .75 && sector.theme === "foundry") {
      g.fillStyle = "#090d18";
      g.fillRect(x + 8, y + 10, 24, 19);
      g.fillStyle = phase === ECHO ? "#6c5c86" : "#a7684e";
      for (let i = 0; i < 5; i++) g.fillRect(x + 10 + i * 5, y + 13, 1, 13);
    } else if (value > .83) {
      g.strokeStyle = phase === ECHO ? "#a579ce55" : "#6594aa55";
      g.beginPath();
      g.moveTo(x + 7, y + 27);
      g.lineTo(x + 19, y + 14);
      g.lineTo(x + 31, y + 14);
      g.stroke();
      g.fillStyle = phase === ECHO ? "#b88deb8c" : "#74b6c78c";
      g.fillRect(x + 30, y + 12, 3, 3);
    }
  }

  function drawTile(g, sector, col, row, phase) {
    const type = sector.grid[row][col];
    const x = col * TILE;
    const y = row * TILE;
    const cell = noise(col, row, sector.number);
    const isWall = blocks(type, phase);
    g.fillStyle = phase === ECHO ? "#27203b" : sector.tint;
    g.globalAlpha = .43 + cell * .24;
    g.fillRect(x, y, TILE - 1, TILE - 1);
    g.globalAlpha = 1;

    if (isWall) {
      const phaseWall = type !== "#";
      const color = phaseWall ? COLORS[phase] : "#5d748e";
      g.fillStyle = "#080c17";
      g.fillRect(x + 1, y + 3, TILE - 2, TILE - 4);
      g.fillStyle = phaseWall ? (phase === ECHO ? "#573877" : "#28594f") : "#25334a";
      g.fillRect(x + 2, y + 2, TILE - 4, TILE - 11);
      g.strokeStyle = color + (phaseWall ? "c8" : "81");
      g.strokeRect(x + 2.5, y + 2.5, TILE - 5, TILE - 12);
      g.fillStyle = color + "98";
      g.fillRect(x + 6, y + 5, TILE - 12, 2);
      g.fillStyle = phaseWall ? color : "#526684";
      g.fillRect(x + 16, y + 14, 8, 2);
      g.fillRect(x + 18, y + 17, 4, 4);
      return;
    }

    if (type === "M" || type === "E") {
      const color = COLORS[type === "M" ? MATTER : ECHO];
      g.strokeStyle = color + "96";
      g.setLineDash([3, 4]);
      g.strokeRect(x + 4.5, y + 4.5, TILE - 9, TILE - 9);
      g.setLineDash([]);
      return;
    }

    if (type === "~") {
      g.fillStyle = phase === MATTER ? "#e667454b" : "#9d7ad72b";
      g.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      g.strokeStyle = phase === MATTER ? "#ff916bb2" : "#9e7bd86b";
      for (let i = 0; i < 4; i++) {
        g.beginPath();
        g.moveTo(x + 5 + i * 8, y + 28);
        g.lineTo(x + 12 + i * 8, y + 13);
        g.stroke();
      }
      return;
    }

    scenery(g, sector, col, row, phase);
  }

  function drawEmblem(g, x, y, radius, color) {
    g.save();
    g.translate(x, y);
    g.strokeStyle = color + "60";
    g.lineWidth = 1;
    for (const size of [radius, radius - 8, radius * .59]) {
      circle(g, 0, 0, size);
      g.stroke();
    }
    for (let i = 0; i < 24; i++) {
      g.rotate(TAU / 24);
      g.beginPath();
      g.moveTo(radius - 6, 0);
      g.lineTo(radius + (i % 6 === 0 ? 7 : 1), 0);
      g.stroke();
    }
    polygon(g, 4, radius * .48);
    g.stroke();
    g.restore();
  }

  function floorLayer(phase) {
    const key = state.sector + ":" + phase;
    if (floorLayers.has(key)) return floorLayers.get(key);
    const layer = document.createElement("canvas");
    layer.width = COLS * TILE;
    layer.height = ROWS * TILE;
    const g = layer.getContext("2d");
    const sector = activeSector();
    const gradient = g.createLinearGradient(0, 0, layer.width, layer.height);
    gradient.addColorStop(0, phase === ECHO ? "#211632" : "#142234");
    gradient.addColorStop(1, "#080c19");
    g.fillStyle = gradient;
    g.fillRect(0, 0, layer.width, layer.height);
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) drawTile(g, sector, col, row, phase);
    }
    if (sector.theme === "dock") drawEmblem(g, 460, 336, 54, COLORS[phase]);
    if (sector.theme === "tower") drawEmblem(g, 460, 260, 92, COLORS[phase]);
    floorLayers.set(key, layer);
    return layer;
  }

  function drawSpace(t) {
    ctx.fillStyle = "#070a16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const star of STARFIELD) {
      ctx.globalAlpha = star.alpha * (.84 + .16 * Math.sin(t * 1.6 + star.x));
      ctx.fillStyle = "#d4e3ff";
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = COLORS[state.phase] + "44";
    ctx.strokeRect(ORIGIN_X - 2.5, ORIGIN_Y - 2.5, COLS * TILE + 5, ROWS * TILE + 5);
    ctx.font = "10px monospace";
    ctx.fillStyle = "#aebcd7";
    ctx.fillText("FAROL // GRID " + activeSector().number, ORIGIN_X, canvas.height - 10);
  }

  function canvasLabel(label, x, y, color = "#e5edf9") {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "700 11px monospace";
    const width = ctx.measureText(label).width + 12;
    ctx.fillStyle = "#090f1bea";
    ctx.fillRect(x - width / 2, y - 11, width, 15);
    ctx.fillStyle = color;
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function drawGate(object, t) {
    const locked = object.target === "tower" && progress.cores.length < 3;
    const color = locked ? "#fc9d89" : "#78dcff";
    lamp(ctx, 0, 0, 45, color);
    ctx.strokeStyle = color;
    ctx.fillStyle = color + "22";
    ctx.lineWidth = 2;
    polygon(ctx, 6, 17, Math.PI / 6);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(t * .9);
    ctx.strokeStyle = color + "75";
    ctx.setLineDash([4, 7]);
    circle(ctx, 0, 0, 23);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-t * .9);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.font = "700 14px monospace";
    ctx.fillText(locked ? "×" : "↗", 0, 5);
    canvasLabel(locked ? "TORRE SELADA" : object.label.toUpperCase(), 0, 35, color);
  }

  function drawObject(object, t) {
    if (!objectPresent(object)) return;
    const active = visible(object);
    if (!active && distance(player, object) > 140) return;
    ctx.save();
    ctx.translate(object.x, object.y);
    ctx.globalAlpha = active ? 1 : .28;
    if (object.type === "gate") {
      drawGate(object, t);
      ctx.restore();
      return;
    }
    const relayOn = progress.relays.includes(object.id);
    const ready = object.type !== "core" || object.needs.every((id) => progress.relays.includes(id));
    const palette = { workshop: AMBER, med: "#8fffd9", terminal: "#a6d8ff",
      relay: relayOn ? "#8affc6" : "#ff9e7e", core: ready ? "#8befff" : "#8190a7", cache: AMBER, echo: AMBER };
    const color = palette[object.type];
    lamp(ctx, 0, 0, 36, color);
    ctx.fillStyle = "#0b1324";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;

    if (object.type === "echo" || object.type === "core") {
      ctx.save();
      ctx.translate(0, Math.sin(t * 3 + object.x) * 3);
      polygon(ctx, object.type === "echo" ? 4 : 6, object.type === "echo" ? 10 : 17);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      polygon(ctx, 4, object.type === "echo" ? 4 : 8);
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.roundRect(-12, -10, 24, 20, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.textAlign = "center";
      ctx.font = "700 13px monospace";
      const icons = { workshop: "⚙", med: "+", terminal: "✦", relay: relayOn ? "✓" : "◌", cache: "▣" };
      ctx.fillText(icons[object.type], 0, 5);
    }
    const labels = { workshop: "OFICINA", med: "REPARO", terminal: "FAROL", relay: relayOn ? "ATIVO" : "CONTROLE",
      core: ready ? "NÚCLEO" : "NÚCLEO SELADO" };
    if (active && labels[object.type]) canvasLabel(labels[object.type], 0, 27, color);
    ctx.restore();
  }

  function drawEnemy(enemy, t) {
    const active = visible(enemy);
    if (!active && distance(player, enemy) > 220) return;
    const color = enemy.kind === "hunter" ? "#ff9b88" : "#ffbb78";
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.globalAlpha = active ? 1 : .25;
    lamp(ctx, 0, 0, 36, color);
    ctx.rotate(t * (enemy.kind === "hunter" ? 1.4 : .5));
    ctx.fillStyle = "#231828";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    polygon(ctx, enemy.kind === "hunter" ? 4 : 6, enemy.radius);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-t * (enemy.kind === "hunter" ? 1.4 : .5));
    ctx.fillStyle = color;
    ctx.fillRect(-5, -2, 10, 4);
    ctx.fillStyle = "#ffe2bf";
    ctx.fillRect(-1, -1, 2, 2);
    if (active) {
      ctx.fillStyle = "#080b14";
      ctx.fillRect(-15, -24, 30, 3);
      ctx.fillStyle = color;
      ctx.fillRect(-15, -24, 30 * enemy.health / ENEMY_TYPES[enemy.kind].health, 3);
    }
    ctx.restore();
  }

  function drawBoss(t) {
    const boss = state.boss;
    if (!boss) return;
    const color = COLORS[boss.phase];
    ctx.save();
    ctx.translate(boss.x, boss.y);
    lamp(ctx, 0, 0, 106, color);
    ctx.lineWidth = boss.stage === "open" ? 2 : 4;
    ctx.strokeStyle = color;
    ctx.fillStyle = "#17152b";
    ctx.rotate(t * .48);
    polygon(ctx, 6, 33);
    ctx.fill();
    ctx.stroke();
    ctx.rotate(-t * .48);
    ctx.setLineDash(boss.stage === "open" ? [2, 6] : [11, 4]);
    circle(ctx, 0, 0, 43 + Math.sin(t * 5) * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = boss.stage === "open" ? "#fff7d2" : color + "91";
    polygon(ctx, 4, 12 + Math.sin(t * 4) * 2);
    ctx.fill();
    const status = { sealed: "ESCUDO FECHADO", attack: "RAJADA", open: "JANELA DE PULSO" };
    canvasLabel(status[boss.stage], 0, -57, color);
    ctx.fillStyle = "#090d19";
    ctx.fillRect(-49, 53, 98, 6);
    ctx.fillStyle = color;
    ctx.fillRect(-48, 54, 96 * boss.health / boss.maxHealth, 4);
    ctx.restore();
  }

  function drawPlayer(t) {
    const color = COLORS[state.phase];
    const bob = player.walking ? Math.sin(t * 20) * 1.7 : Math.sin(t * 3) * .6;
    ctx.save();
    ctx.translate(player.x, player.y);
    lamp(ctx, 0, 0, 53, color);
    ctx.fillStyle = "#080b16b5";
    ctx.beginPath();
    ctx.ellipse(0, 9, 15, 7, 0, 0, TAU);
    ctx.fill();
    if (player.invincible > 0 && !reducedMotion.matches && Math.floor(t * 15) % 2 === 0) ctx.globalAlpha = .55;
    ctx.translate(0, bob);
    ctx.rotate(Math.atan2(player.facingY, player.facingX) + Math.PI / 2);
    ctx.fillStyle = "#425b83";
    ctx.beginPath();
    ctx.roundRect(-11, 0, 22, 12, 5);
    ctx.fill();
    ctx.fillStyle = "#b8cbe7";
    ctx.fillRect(-8, 9, 5, 5);
    ctx.fillRect(3, 9, 5, 5);
    ctx.fillStyle = "#e9f3ff";
    ctx.strokeStyle = "#85a5c7";
    ctx.lineWidth = 2;
    circle(ctx, 0, -3, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#101a2d";
    ctx.beginPath();
    ctx.roundRect(-7, -8, 14, 8, 3);
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(-4, -5);
    ctx.lineTo(4, -5);
    ctx.stroke();
    ctx.restore();
  }

  function drawEffects() {
    ctx.save();
    for (const effect of state.effects) {
      const ratio = effect.life / effect.maxLife;
      ctx.globalAlpha = ratio;
      if (effect.kind === "ring") {
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 1 + ratio * 2;
        const radius = 7 + effect.radius * (1 - Math.pow(ratio, 2));
        circle(ctx, effect.x, effect.y, radius);
        ctx.stroke();
      } else {
        ctx.fillStyle = effect.color;
        ctx.fillRect(effect.x, effect.y, 2 + ratio * 2, 2 + ratio * 2);
      }
    }
    ctx.restore();
  }

  function drawObjectiveMarker(t) {
    const target = state.objectiveTarget;
    if (!target || state.mode !== "play") return;
    const offset = reducedMotion.matches ? 0 : Math.sin(t * 5) * 3;
    ctx.save();
    ctx.translate(target.x, Math.max(47, target.y - 31) + offset);
    ctx.fillStyle = AMBER;
    ctx.strokeStyle = "#171020";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, -6);
    ctx.lineTo(8, -6);
    ctx.lineTo(0, 6);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.restore();
  }

  function draw(t) {
    drawSpace(t);
    ctx.save();
    ctx.translate(ORIGIN_X, ORIGIN_Y);
    ctx.drawImage(floorLayer(state.phase), 0, 0);
    for (const object of activeSector().objects) drawObject(object, t);
    for (const enemy of state.enemies) drawEnemy(enemy, t);
    drawBoss(t);
    for (const bullet of state.bullets) {
      ctx.globalAlpha = visible(bullet) ? 1 : .26;
      const color = COLORS[bullet.phase];
      lamp(ctx, bullet.x, bullet.y, bullet.radius * 3, color);
      ctx.fillStyle = color;
      circle(ctx, bullet.x, bullet.y, bullet.radius);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPlayer(t);
    drawEffects();
    drawObjectiveMarker(t);
    ctx.restore();
  }

  let previous = performance.now();
  function frame(now) {
    const dt = Math.min(.034, (now - previous) / 1000);
    previous = now;
    if (canPlay()) update(dt);
    draw(state.mode === "menu" && !reducedMotion.matches ? now / 1000 : state.clock);
    requestAnimationFrame(frame);
  }

  enterSector("dock");
  state.log = "Aguardando o início da expedição.";
  showCover();
  syncUI();
  requestAnimationFrame(frame);
})();

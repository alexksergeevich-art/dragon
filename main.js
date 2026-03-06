const VER = "dragon-polish-20260306b";

const stageFrame = document.getElementById("stageFrame");
const stage = document.getElementById("stage");
const ringsLayer = document.getElementById("ringsLayer");
const entitiesLayer = document.getElementById("entitiesLayer");
const fxLayer = document.getElementById("fxLayer");
const dragonEl = document.getElementById("dragon");
const dragonSpriteEl = document.getElementById("dragonSprite");
const dragonHPFill = document.getElementById("dragonHP");
const dragonLabel = document.getElementById("dragonLabel");
const moveMarker = document.getElementById("moveMarker");
const statusText = document.getElementById("statusText");
const spawnButtons = [...document.querySelectorAll(".spawnBtn")];

const hitSfx = new Audio(`assets/sound/hit.mp3?v=${VER}`);
const dragonHitSfx = new Audio(`assets/sound/dragon_hit.mp3?v=${VER}`);
const dragonRoarSfx = new Audio(`assets/sound/dragon_roar.mp3?v=${VER}`);
const audioPool = [hitSfx, dragonHitSfx, dragonRoarSfx];
audioPool.forEach((audio) => {
  audio.preload = "auto";
  audio.load();
});
hitSfx.volume = 0.52;
dragonHitSfx.volume = 0.70;
dragonRoarSfx.volume = 0.78;
let audioUnlocked = false;
let audioCtx = null;
function ensureAudioCtx(){
  if (!audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) audioCtx = new Ctx();
  }
  if (audioCtx?.state === "suspended") audioCtx.resume().catch(() => {});
  return audioCtx;
}
function toneAt(time, freqStart, freqEnd, duration, gainStart, gainEnd, type = "sine"){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, time);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), time + duration);
  gain.gain.setValueAtTime(gainStart, time);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, gainEnd), time + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(time);
  osc.stop(time + duration);
}
function noiseBurst(duration = 0.12, gainValue = 0.05, highpass = 420){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = highpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainValue, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + duration);
}
function playSynth(kind){
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const t = ctx.currentTime + 0.005;
  if (kind === "spawn"){
    toneAt(t, 140, 260, 0.18, 0.001, 0.055, "triangle");
    toneAt(t + 0.03, 280, 520, 0.22, 0.001, 0.038, "sine");
    noiseBurst(0.16, 0.018, 600);
  } else if (kind === "move"){
    toneAt(t, 420, 520, 0.06, 0.001, 0.018, "triangle");
  } else if (kind === "slash"){
    toneAt(t, 600, 180, 0.07, 0.001, 0.035, "sawtooth");
    noiseBurst(0.06, 0.02, 900);
  } else if (kind === "death"){
    toneAt(t, 180, 70, 0.26, 0.001, 0.045, "sawtooth");
    noiseBurst(0.22, 0.026, 260);
  }
}
function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  ensureAudioCtx();
  for (const audio of audioPool){
    try{
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {});
    }catch{}
  }
}
document.addEventListener("pointerdown", unlockAudio, { once:true });
document.addEventListener("touchstart", unlockAudio, { once:true, passive:true });
function playQuick(audio){
  try{
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }catch{}
}

const BG_ANALYSIS = {
  size: { w: 832, h: 1248 },
  notes: {
    spawnBand: "нижняя каменная платформа с пятью кратерами",
    centerRoad: "дорога и мост идут строго по центру",
    dragonField: "лужайка в верхней центральной части кадра"
  },
  rings: [
    { level: 1, x: 0.112, y: 0.797, w: 0.107, h: 0.036, power: 1.0 },
    { level: 2, x: 0.307, y: 0.798, w: 0.120, h: 0.037, power: 1.32 },
    { level: 3, x: 0.500, y: 0.799, w: 0.121, h: 0.037, power: 1.56 },
    { level: 4, x: 0.693, y: 0.798, w: 0.115, h: 0.036, power: 1.84 },
    { level: 5, x: 0.888, y: 0.796, w: 0.109, h: 0.035, power: 2.1 },
  ],
  dragon: { x: 0.57, y: 0.455 },
  walkable: { minY: 0.34, maxY: 0.87, marginX: 0.055 }
};

const SPRITES = {
  lvl1: {
    down:      { url:`assets/LVL1/sprite_down_lvl1.png?v=${VER}`,       frameW:354, frameH:346, frames:6,  fps:10 },
    right:     { url:`assets/LVL1/sprite_right_lvl1.png?v=${VER}`,      frameW:398, frameH:356, frames:6,  fps:10 },
    downRight: { url:`assets/LVL1/sprite_downright_lvl1.png?v=${VER}`,  frameW:493, frameH:358, frames:6,  fps:10 },
    upRight:   { url:`assets/LVL1/sprite_upright_lvl1.png?v=${VER}`,    frameW:306, frameH:306, frames:6,  fps:10 },
    up:        { url:`assets/LVL1/sprite_up_lvl1.png?v=${VER}`,         frameW:284, frameH:326, frames:8,  fps:10 },
    idleFront: { url:`assets/LVL1/sprite_idlefront_lvl1.png?v=${VER}`,  frameW:287, frameH:344, frames:6,  fps:6 },
    idleBack:  { url:`assets/LVL1/sprite_idleback_lvl1.png?v=${VER}`,   frameW:237, frameH:338, frames:6,  fps:6 },
    attack:    { url:`assets/LVL1/sprite_attack_lvl1.png?v=${VER}`,     frameW:251, frameH:386, frames:8, fps:16, renderScale:1.18 },
    death:     { url:`assets/LVL1/sprite_death_lvl1.png?v=${VER}`,      frameW:344, frameH:400, frames:10, fps:12, renderScale:1.02 },
    drawScale: 0.43,
    uiName: "LVL 1"
  },
  lvl2: {
    down:      { url:`assets/LVL2/sprite_down.png?v=${VER}`,            frameW:688, frameH:464, frames:10, fps:12 },
    right:     { url:`assets/LVL2/sprite_righ.png?v=${VER}`,            frameW:292, frameH:293, frames:30, fps:12 },
    downRight: { url:`assets/LVL2/sprite_down_right.png?v=${VER}`,      frameW:688, frameH:464, frames:6,  fps:12 },
    upRight:   { url:`assets/LVL2/sprite_up_right.png?v=${VER}`,        frameW:688, frameH:464, frames:24, fps:14 },
    up:        { url:`assets/LVL2/sprite_up.png?v=${VER}`,              frameW:332, frameH:302, frames:12, fps:12 },
    idleFront: { url:`assets/LVL2/sprite_idle_front.png?v=${VER}`,      frameW:688, frameH:464, frames:7,  fps:6 },
    idleBack:  { url:`assets/LVL2/sprite_idle_back.png?v=${VER}`,       frameW:353, frameH:342, frames:12, fps:6 },
    attack:    { url:`assets/LVL2/sprite_attack.png?v=${VER}`,          frameW:459, frameH:392, frames:24, fps:16, renderScale:1.05 },
    death:     { url:`assets/LVL2/sprite_death.png?v=${VER}`,           frameW:688, frameH:464, frames:23, fps:12 },
    drawScale: 0.40,
    uiName: "LVL 2"
  },
  dragon: {
    idle:      { url:`assets/dragon/sprite_dragon.png?v=${VER}`,        frameW:256, frameH:256, frames:24, fps:12 },
    drawScale: 0.64,
    uiName: "Dragon"
  }
};



function validateSpriteManifest(){
  const checks = [];
  const groups = [SPRITES.lvl1, SPRITES.lvl2, SPRITES.dragon];
  for (const group of groups){
    for (const [key, meta] of Object.entries(group)){
      if (!meta || !meta.url || !meta.frameW || !meta.frameH || !meta.frames) continue;
      const img = new Image();
      img.onload = () => {
        const expectedW = meta.frameW * meta.frames;
        const expectedH = meta.frameH;
        if (img.naturalWidth !== expectedW || img.naturalHeight !== expectedH){
          console.warn(`[sprite-manifest] ${key}: expected ${expectedW}x${expectedH}, got ${img.naturalWidth}x${img.naturalHeight}`);
        }
      };
      img.src = meta.url;
      checks.push(img);
    }
  }
  return checks;
}

const HERO_CONFIG = {
  1: { id:"lvl1", ringIndex:0, maxHp:120, damage:16, speed:185, attackRange:82, attackCooldown:0.92, dragonThreat:19 },
  2: { id:"lvl2", ringIndex:1, maxHp:180, damage:28, speed:170, attackRange:88, attackCooldown:0.84, dragonThreat:28 },
};

const state = {
  width: 0,
  height: 0,
  selectedLevel: null,
  heroes: new Map(),
  ringEls: new Map(),
  now: performance.now(),
  dragon: {
    x: 0,
    y: 0,
    maxHp: 800,
    hp: 800,
    alive: true,
    frame: 0,
    frameAcc: 0,
    hitFx: 0,
    attackTimer: 0,
  }
};

function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t){ return a + (b - a) * t; }
function distance(a, b){ return Math.hypot(a.x - b.x, a.y - b.y); }
function depthScale(yPx){
  const t = clamp(yPx / state.height, 0, 1);
  return lerp(0.25, 0.92, Math.pow(t, 1.22));
}
function depthSpeed(yPx){
  const t = clamp(yPx / state.height, 0, 1);
  return lerp(0.52, 1.0, Math.pow(t, 1.12));
}
function laneCenterX(yPx){
  const t = clamp(yPx / state.height, 0, 1);
  return lerp(state.width * 0.57, state.width * 0.50, Math.pow(t, 1.04));
}
function laneHalfWidth(yPx){
  const t = clamp(yPx / state.height, 0, 1);
  return lerp(state.width * 0.055, state.width * 0.37, Math.pow(t, 1.18));
}
function worldToStage(x, y){ return { x: x * state.width, y: y * state.height }; }
function clampToWalkable(pos){
  const minY = BG_ANALYSIS.walkable.minY * state.height;
  const maxY = BG_ANALYSIS.walkable.maxY * state.height;
  const y = clamp(pos.y, minY, maxY);
  const centerX = laneCenterX(y);
  const halfWidth = laneHalfWidth(y);
  return {
    x: clamp(pos.x, centerX - halfWidth, centerX + halfWidth),
    y,
  };
}
function status(text){ statusText.textContent = text; }

function dir8FromVector(dx, dy){
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 4;
  let idx = Math.floor((ang + step / 2) / step);
  idx = (idx % 8 + 8) % 8;
  return idx;
}
function spriteForDir8(dir8){
  switch(dir8){
    case 0: return { key:"right",     flipX:false };
    case 1: return { key:"downRight", flipX:false };
    case 2: return { key:"down",      flipX:false };
    case 3: return { key:"downRight", flipX:true  };
    case 4: return { key:"right",     flipX:true  };
    case 5: return { key:"upRight",   flipX:true  };
    case 6: return { key:"up",        flipX:false };
    case 7: return { key:"upRight",   flipX:false };
    default:return { key:"down",      flipX:false };
  }
}

function makeRingAnchors(){
  ringsLayer.innerHTML = "";
  state.ringEls.clear();
  for (const ring of BG_ANALYSIS.rings){
    const el = document.createElement("div");
    el.className = "ring-anchor";
    positionRingEl(el, ring);
    ringsLayer.appendChild(el);
    state.ringEls.set(ring.level, el);
  }
}
function positionRingEl(el, ring){
  el.style.left = `${ring.x * state.width}px`;
  el.style.top = `${ring.y * state.height}px`;
  el.style.width = `${ring.w * state.width}px`;
  el.style.height = `${ring.h * state.height}px`;
}

function makeHeroDom(level){
  const heroEl = document.createElement("div");
  heroEl.className = "entity hero";
  heroEl.dataset.level = String(level);

  const label = document.createElement("div");
  label.className = "hplabel";
  const hpbar = document.createElement("div");
  hpbar.className = "hpbar";
  const hpfill = document.createElement("div");
  hpfill.className = "hpfill";
  hpbar.appendChild(hpfill);
  const selectionCircle = document.createElement("div");
  selectionCircle.className = "selectionCircle";
  const spawnGlow = document.createElement("div");
  spawnGlow.className = "spawnGlow";
  const teleportRays = document.createElement("div");
  teleportRays.className = "teleportRays";
  const sprite = document.createElement("div");
  sprite.className = "sprite";

  heroEl.append(label, hpbar, selectionCircle, spawnGlow, teleportRays, sprite);
  entitiesLayer.appendChild(heroEl);

  return { heroEl, labelEl:label, hpFillEl:hpfill, spriteEl:sprite };
}

function createHero(level){
  const heroCfg = HERO_CONFIG[level];
  const spriteCfg = SPRITES[heroCfg.id];
  const ring = BG_ANALYSIS.rings[heroCfg.ringIndex];
  const spawnPos = worldToStage(ring.x, ring.y + 0.003);
  const dom = makeHeroDom(level);

  const hero = {
    level,
    cfg: heroCfg,
    sprites: spriteCfg,
    ...dom,
    x: spawnPos.x,
    y: spawnPos.y,
    spawnX: spawnPos.x,
    spawnY: spawnPos.y,
    targetX: spawnPos.x,
    targetY: spawnPos.y,
    dir8: 6,
    mode: "idle",
    flipX: false,
    hp: heroCfg.maxHp,
    maxHp: heroCfg.maxHp,
    alive: true,
    spawned: true,
    spawningUntil: performance.now() + 620,
    attackCd: 0,
    deadHold: false,
    spriteKey: "idleFront",
    frame: 0,
    frameAcc: 0,
    frameFrozen: false,
  };

  state.heroes.set(level, hero);
  spawnRingGlow(level);
  spawnTeleportFx(hero.x, hero.y + 2, hero.level);
  playSynth("spawn");
  selectHero(level);
  status(`Уровень ${level} заспавнен. Тапни по фону, чтобы отправить героя.`);
  return hero;
}

function respawnHero(hero){
  hero.x = hero.spawnX;
  hero.y = hero.spawnY;
  hero.targetX = hero.spawnX;
  hero.targetY = hero.spawnY;
  hero.dir8 = 6;
  hero.mode = "idle";
  hero.hp = hero.maxHp;
  hero.alive = true;
  hero.deadHold = false;
  hero.spawningUntil = performance.now() + 620;
  hero.frame = 0;
  hero.frameAcc = 0;
  hero.frameFrozen = false;
  hero.heroEl.classList.remove("dead");
  hero.heroEl.classList.add("spawning");
  spawnRingGlow(hero.level);
  spawnTeleportFx(hero.x, hero.y + 2, hero.level);
  playSynth("spawn");
  selectHero(hero.level);
  status(`Уровень ${hero.level} снова в строю.`);
}

function selectHero(level){
  state.selectedLevel = level;
  for (const [heroLevel, hero] of state.heroes){
    hero.heroEl.classList.toggle("selected", heroLevel === level);
  }
  for (const [ringLevel, ringEl] of state.ringEls){
    ringEl.classList.toggle("selected", ringLevel === level);
  }
  spawnButtons.forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.level) === level));
}

function getSelectedHero(){
  return state.selectedLevel ? state.heroes.get(state.selectedLevel) || null : null;
}

function spawnRingGlow(level){
  const ring = BG_ANALYSIS.rings[level - 1];
  const ringEl = state.ringEls.get(level);
  if (!ringEl) return;
  ringEl.classList.remove("activeGlow");
  void ringEl.offsetWidth;
  ringEl.classList.add("activeGlow");
  ringEl.style.filter = `brightness(${1 + ring.power * 0.24}) saturate(${1 + ring.power * 0.18})`;
  setTimeout(() => {
    ringEl.style.filter = "";
    ringEl.classList.remove("activeGlow");
  }, 900);
}

function animateSpriteFrame(entity, spriteMeta, dt){
  if (entity.frameFrozen) return;
  entity.frameAcc += dt;
  const frameDuration = 1 / spriteMeta.fps;
  while (entity.frameAcc >= frameDuration){
    entity.frameAcc -= frameDuration;
    entity.frame += 1;
    if (entity.mode === "death"){
      if (entity.frame >= spriteMeta.frames - 1){
        entity.frame = spriteMeta.frames - 1;
        entity.frameFrozen = true;
        break;
      }
    } else if (entity.mode === "attack"){
      if (entity.frame >= spriteMeta.frames){
        entity.frame = 0;
      }
    } else {
      entity.frame %= spriteMeta.frames;
    }
  }
}

function applySpriteToEl(spriteEl, spriteMeta, scale, frame, flipX){
  const renderScale = scale * (spriteMeta.renderScale || 1);
  spriteEl.style.width = `${spriteMeta.frameW * renderScale}px`;
  spriteEl.style.height = `${spriteMeta.frameH * renderScale}px`;
  spriteEl.style.backgroundImage = `url("${spriteMeta.url}")`;
  spriteEl.style.backgroundSize = `${spriteMeta.frameW * spriteMeta.frames * renderScale}px ${spriteMeta.frameH * renderScale}px`;
  spriteEl.style.backgroundPosition = `${-frame * spriteMeta.frameW * renderScale}px 0px`;
  spriteEl.style.transform = `translateX(-50%) scaleX(${flipX ? -1 : 1})`;
}

function heroCurrentSprite(hero){
  if (!hero.alive) return { key:"death", flipX:hero.flipX };
  if (hero.mode === "attack") return { key:"attack", flipX:hero.flipX };
  if (hero.mode === "walk") return spriteForDir8(hero.dir8);
  if (hero.dir8 === 6 || hero.dir8 === 7 || hero.dir8 === 5) return { key:"idleBack", flipX:hero.flipX };
  return { key:"idleFront", flipX:hero.flipX };
}

function updateHero(hero, dt){
  const dragon = state.dragon;
  const ring = BG_ANALYSIS.rings[hero.level - 1];
  hero.heroEl.classList.toggle("spawning", performance.now() < hero.spawningUntil);

  if (hero.alive){
    const dx = hero.targetX - hero.x;
    const dy = hero.targetY - hero.y;
    const dist = Math.hypot(dx, dy);
    hero.attackCd = Math.max(0, hero.attackCd - dt);

    if (dist > 5 && hero.mode !== "attack"){
      hero.mode = "walk";
      hero.dir8 = dir8FromVector(dx, dy);
      const move = Math.min(dist, hero.cfg.speed * dt * depthSpeed(hero.y));
      hero.x += (dx / dist) * move;
      hero.y += (dy / dist) * move;
    } else if (hero.mode !== "attack"){
      hero.mode = "idle";
    }

    if (dragon.alive){
      const distToDragon = distance(hero, dragon);
      if (distToDragon <= hero.cfg.attackRange && hero.attackCd <= 0){
        hero.mode = "attack";
        hero.attackCd = hero.cfg.attackCooldown;
        hero.frame = 0;
        hero.frameAcc = 0;
        hero.frameFrozen = false;
        hero.flipX = hero.x > dragon.x;
        hero.dir8 = hero.y > dragon.y ? 6 : 2;
        const damage = hero.cfg.damage;
        dragon.hp = Math.max(0, dragon.hp - damage);
        dragon.hitFx = 0.18;
        playSynth("slash");
        playQuick(hitSfx);
        playQuick(dragonHitSfx);
        spawnDamageFx(dragon.x, dragon.y - 66, damage, true);
        spawnImpactFx(dragon.x + (hero.flipX ? -18 : 18), dragon.y - 34, "enemy");
        if (dragon.hp <= 0){
          dragon.alive = false;
          dragon.attackTimer = 999;
          status(`Дракон повержен уровнем ${hero.level}.`);
        }
      }
    }
  }

  const spriteState = heroCurrentSprite(hero);
  hero.spriteKey = spriteState.key;
  hero.flipX = spriteState.flipX;
  const spriteMeta = hero.sprites[spriteState.key];
  animateSpriteFrame(hero, spriteMeta, dt);

  if (hero.mode === "attack" && hero.alive && hero.attackCd < hero.cfg.attackCooldown * 0.52){
    hero.mode = "idle";
  }

  const scale = depthScale(hero.y) * hero.sprites.drawScale;
  hero.heroEl.style.left = `${hero.x}px`;
  hero.heroEl.style.top = `${hero.y}px`;
  hero.heroEl.style.zIndex = String(Math.round(hero.y));
  hero.labelEl.textContent = `${hero.sprites.uiName} · ${Math.max(0, Math.ceil(hero.hp))}/${hero.maxHp}`;
  hero.hpFillEl.style.width = `${(hero.hp / hero.maxHp) * 100}%`;
  applySpriteToEl(hero.spriteEl, spriteMeta, scale, hero.frame, hero.flipX);

  const ringEl = state.ringEls.get(hero.level);
  if (ringEl){
    ringEl.style.opacity = hero.alive ? "0.82" : "0.55";
  }
}

function killHero(hero){
  hero.alive = false;
  hero.deadHold = true;
  hero.mode = "death";
  hero.frame = 0;
  hero.frameAcc = 0;
  hero.frameFrozen = false;
  hero.targetX = hero.x;
  hero.targetY = hero.y;
  hero.heroEl.classList.add("dead");
  playSynth("death");
  spawnDamageFx(hero.x, hero.y - 56, 0, false, "ПОВЕРЖЕН");
  spawnImpactFx(hero.x, hero.y - 18, "death");
  if (state.selectedLevel === hero.level){
    status(`Герой ${hero.level} погиб. Повторный спавн только кнопкой ${hero.level}.`);
  }
}

function updateDragon(dt){
  const dragonMeta = SPRITES.dragon.idle;
  state.dragon.frameAcc += dt;
  const frameDuration = 1 / dragonMeta.fps;
  while (state.dragon.frameAcc >= frameDuration){
    state.dragon.frameAcc -= frameDuration;
    state.dragon.frame = (state.dragon.frame + 1) % dragonMeta.frames;
  }
  state.dragon.hitFx = Math.max(0, state.dragon.hitFx - dt);

  if (state.dragon.alive){
    state.dragon.attackTimer -= dt;
    if (state.dragon.attackTimer <= 0){
      const livingHeroes = [...state.heroes.values()].filter((hero) => hero.alive);
      const target = livingHeroes.sort((a, b) => distance(a, state.dragon) - distance(b, state.dragon))[0];
      if (target && distance(target, state.dragon) < 112){
        const damage = target.cfg.dragonThreat;
        target.hp = Math.max(0, target.hp - damage);
        playQuick(dragonRoarSfx);
        spawnDamageFx(target.x, target.y - 70, damage, false);
        spawnImpactFx(target.x, target.y - 36, "hero");
        if (target.hp <= 0){
          killHero(target);
        }
      }
      state.dragon.attackTimer = 1.18;
    }
  }

  const scale = depthScale(state.dragon.y) * SPRITES.dragon.drawScale;
  dragonEl.style.left = `${state.dragon.x}px`;
  dragonEl.style.top = `${state.dragon.y}px`;
  dragonEl.style.zIndex = String(Math.round(state.dragon.y) + 2);
  dragonLabel.textContent = `Dragon (1lvl) ${Math.max(0, Math.ceil(state.dragon.hp))}/${state.dragon.maxHp}`;
  dragonHPFill.style.width = `${(state.dragon.hp / state.dragon.maxHp) * 100}%`;
  dragonSpriteEl.style.filter = state.dragon.hitFx > 0 ? "brightness(1.4) drop-shadow(0 0 18px rgba(255,90,70,.6))" : "";
  applySpriteToEl(dragonSpriteEl, dragonMeta, scale, state.dragon.frame, false);
}

function spawnDamageFx(x, y, amount, enemy = false, customText = ""){
  const el = document.createElement("div");
  el.className = `damage-float${enemy ? " enemy" : ""}`;
  el.textContent = customText || `-${Math.round(amount)}`;
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  fxLayer.appendChild(el);
  el.addEventListener("animationend", () => el.remove(), { once:true });
}


function spawnImpactFx(x, y, kind = "enemy"){
  const burst = document.createElement("div");
  burst.className = `impact-burst ${kind}`;
  burst.style.left = `${x}px`;
  burst.style.top = `${y}px`;
  fxLayer.appendChild(burst);
  burst.addEventListener("animationend", () => burst.remove(), { once:true });

  const sparks = kind === "death" ? 10 : 6;
  for (let i = 0; i < sparks; i++){
    const spark = document.createElement("div");
    spark.className = `spark ${kind}`;
    const ang = (-0.9 + (i / Math.max(1, sparks - 1)) * 1.8) + (Math.random() - 0.5) * 0.35;
    const dist = (kind === "death" ? 42 : 28) + Math.random() * (kind === "death" ? 30 : 16);
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;
    spark.style.setProperty("--dx", `${Math.cos(ang) * dist}px`);
    spark.style.setProperty("--dy", `${Math.sin(ang) * dist - 12}px`);
    fxLayer.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once:true });
  }
}

function spawnTeleportFx(x, y, level){
  const pulse = document.createElement("div");
  pulse.className = `teleport-pulse lvl${level}`;
  pulse.style.left = `${x}px`;
  pulse.style.top = `${y}px`;
  fxLayer.appendChild(pulse);
  pulse.addEventListener("animationend", () => pulse.remove(), { once:true });
}

function updateMoveMarker(x, y){
  moveMarker.style.left = `${x}px`;
  moveMarker.style.top = `${y}px`;
  moveMarker.classList.remove("show");
  void moveMarker.offsetWidth;
  moveMarker.classList.add("show");
  playSynth("move");
}

function resize(){
  const prevW = state.width || stage.clientWidth;
  const prevH = state.height || stage.clientHeight;
  state.width = stage.clientWidth;
  state.height = stage.clientHeight;
  makeRingAnchors();
  const dragonPos = worldToStage(BG_ANALYSIS.dragon.x, BG_ANALYSIS.dragon.y);
  state.dragon.x = dragonPos.x;
  state.dragon.y = dragonPos.y;

  for (const hero of state.heroes.values()){
    const ring = BG_ANALYSIS.rings[hero.level - 1];
    const targetRingPos = worldToStage(ring.x, ring.y + 0.003);
    const ratioX = hero.x / Math.max(prevW, 1);
    const ratioY = hero.y / Math.max(prevH, 1);
    const targetRatioX = hero.targetX / Math.max(prevW, 1);
    const targetRatioY = hero.targetY / Math.max(prevH, 1);
    hero.spawnX = targetRingPos.x;
    hero.spawnY = targetRingPos.y;
    hero.x = clamp(ratioX * state.width, 0, state.width);
    hero.y = clamp(ratioY * state.height, 0, state.height);
    hero.targetX = clamp(targetRatioX * state.width, 0, state.width);
    hero.targetY = clamp(targetRatioY * state.height, 0, state.height);
    if (!hero.alive){
      hero.spawnX = targetRingPos.x;
      hero.spawnY = targetRingPos.y;
    }
  }
}

function onSpawnButton(level){
  if (level >= 3){
    status(`Кнопка ${level} пока заглушка.`);
    return;
  }

  const existing = state.heroes.get(level);
  if (!existing){
    createHero(level);
    return;
  }
  if (!existing.alive){
    respawnHero(existing);
    return;
  }
  selectHero(level);
  status(`Выбран герой уровня ${level}.`);
}

function bindUi(){
  spawnButtons.forEach((btn) => {
    btn.addEventListener("click", () => onSpawnButton(Number(btn.dataset.level)));
  });

  stage.addEventListener("pointerdown", (ev) => {
    unlockAudio();
    const hero = getSelectedHero();
    if (!hero){
      status("Сначала заспавни героя кнопкой 1 или 2.");
      return;
    }
    if (!hero.alive){
      status(`Герой ${hero.level} мертв. Нажми кнопку ${hero.level}, чтобы вернуть его.`);
      return;
    }
    const rect = stage.getBoundingClientRect();
    const raw = { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
    const pos = clampToWalkable(raw);
    hero.targetX = pos.x;
    hero.targetY = pos.y;
    hero.mode = "walk";
    updateMoveMarker(pos.x, pos.y);
    status(`Герой ${hero.level} движется к новой точке.`);
  });

  window.addEventListener("resize", resize, { passive:true });
  window.visualViewport?.addEventListener("resize", resize, { passive:true });
}

function tick(now){
  const dt = clamp((now - state.now) / 1000, 0, 0.033);
  state.now = now;

  updateDragon(dt);
  for (const hero of state.heroes.values()){
    updateHero(hero, dt);
  }

  requestAnimationFrame(tick);
}

bindUi();
resize();
status(`Анализ фона: ${BG_ANALYSIS.notes.spawnBand}, центр дороги и верхняя лужайка выделены.`);
validateSpriteManifest();

requestAnimationFrame((t) => {
  state.now = t;
  requestAnimationFrame(tick);
});

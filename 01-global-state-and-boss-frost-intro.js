
// ================================================================
//  RED VS SHADOW — Full 2026 v2 + Mobile/PC Mode
// ================================================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Running via file:// triggers stricter browser security policies (blocked
// touch/gesture handling in some mobile browsers, blocked module/script
// features in others). Surface this instead of letting controls silently
// fail with no explanation.
const _runningFromFile = location.protocol === 'file:';
if (_runningFromFile) {
  window.addEventListener('DOMContentLoaded', () => {
    const warn = document.createElement('div');
    warn.textContent = '⚠️ Đang mở trực tiếp từ file (file://) — một số trình duyệt di động sẽ chặn cảm ứng/tương tác. Hãy chạy qua một local server (vd: "npx serve" hoặc mở qua http://) để game hoạt động đầy đủ.';
    warn.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:#552200;color:#ffcc66;font:12px Arial;padding:6px 10px;text-align:center;';
    document.body.appendChild(warn);
  });
}

// ================================================================
//  GLOBAL STATE
// ================================================================
const _isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
let platformMode = _isTouchDevice ? "MOBILE" : "PC"; // "PC" or "MOBILE" - auto-detected, user can override in Settings
let gameState    = "MENU";
let gameMode     = "PVE"; // PVP mode has been removed — always bot/PVE now
const MAP_SCALE  = 1;     // world width multiplier for GAMEPLAY/CHALLENGE arenas (Road mode has its own, already-scrolling world)
const CHAR_VISUAL_SCALE = 1/1.5; // visual shrink for character bodies + attached skill FX (1.5x smaller), anchored at their feet
const SR = CHAR_VISUAL_SCALE;    // "skill range" scale — shrinks skill hit/AOE ranges by the same factor so tiny characters don't keep giant-sized hitboxes
let campX        = 0;     // camera x offset shared by GAMEPLAY & CHALLENGE (only one active at a time)
let botLevel     = 0;
let MAX_HP       = 200;
let showSettings = false;
let selectedP1   = "shadow";
let selectedP2   = "shadow";
let selectingPlayer = 1;
let screenShake  = 0;

// ================================================================
//  CHARACTER PORTAL ENTRANCE — state used by the pre-battle intro
//  (see PORTAL ENTRANCE SYSTEM block further down for the logic)
// ================================================================
let portalEntrants     = [];   // active entrants for the running PORTAL_INTRO
let pendingGameState   = null; // gameState to switch into once the intro finishes
let pendingAfterIntro  = null; // optional fn() run exactly at BATTLE_START (e.g. spawns waves)
let pendingIntroFloorY = 0;
let projectiles  = [];
let puppets      = [];
let frameCount   = 0;

// ================================================================
//  GLOBAL TIME FREEZE — generic, reusable "stop time" mechanism.
//  Any skill can call startTimeFreeze(frames, caster) (see
//  07-fx-ticks-ui-and-main-menu.js) to freeze everyone/everything EXCEPT
//  `caster` for `frames` frames: enemies/bosses stop updating, projectiles
//  stop moving, the other fighter stops moving — while the caster keeps
//  animating normally (e.g. mid transform wind-up). Currently used by
//  SHADOW's V4 wind-up; built generic on purpose so a future skill (e.g. a
//  THUNDER time-stop ultimate) can call the exact same function.
let globalTimeFreeze       = 0;    // frames remaining; >0 means time is frozen
let globalTimeFreezeCaster = null; // the one Fighter exempt from the freeze


// ================================================================
//  PERF: in-place array compaction (replaces `arr = arr.filter(pred)`)
// ----------------------------------------------------------------
//  `.filter()` allocates and returns a brand-new array every call.
//  These particle/trail/entity-pruning filters run every single
//  frame (60x/sec) across dozens of live characters, projectiles
//  and FX systems, so the old code was generating a large amount
//  of garbage every second — a common cause of periodic GC micro
//  stutters, especially in ROAD mode where many systems run at
//  once. `_compact` keeps the SAME array object and just shifts
//  the surviving elements down, preserving order and calling
//  `pred` on every element exactly once (identical semantics to
//  `.filter`), but with zero extra allocation.
// ================================================================
function _compact(arr, pred) {
  let w = 0;
  for (let i = 0; i < arr.length; i++) {
    const item = arr[i];
    if (pred(item, i, arr)) {
      if (w !== i) arr[w] = item;
      w++;
    }
  }
  arr.length = w;
  return arr;
}

// ---------- Combat feel: combo counter, crit hits, floating damage numbers ----------
let dmgNumbers        = [];   // floating damage number popups
let comboCount         = 0;   // consecutive hits landed by the human player (p1) without a timeout/being-hit reset
let comboTimer         = 0;   // frames left before the combo decays back to 0
let comboMaxThisRun    = 0;   // best combo reached in the current run (shown on victory/defeat screens)
let _hitSfxCooldown    = 0;   // throttles the hit "thwack" sound so multi-tick ultimates don't machine-gun the audio
const CRIT_CHANCE      = 0.15;
const CRIT_MULT        = 1.6;

// ---------- Road mode session stats (in-memory only, resets on page reload) ----------
let roadBestDistance   = 0;   // longest distance reached this session across all runs
let roadNewRecord      = false;
let roadKillCount      = 0;   // trash enemies defeated in the current run
let roadRunStartFrame  = 0;   // frameCount when the current run began, for an elapsed-time stat

// Challenge
let challengeState    = "IDLE";
let challengeStage    = 1;
let challengeEnemies  = [];
let challengeBosses   = [];
let challengeWaveIdx  = 0;
let challengeWaveSched = [];
let challengeBossSpawned = false;
let challengeResult   = "";
let challengeBossIntroState = "IDLE"; // INTRO_RUNNING, INTRO_DONE, BATTLE

// ================================================================
//  BOSS INTRO MANAGER — FROST KING CINEMATIC (Boss 1 only)
//  ----------------------------------------------------------------
//  This does NOT draw any placeholder. The doomed character in the
//  cinematic is a real `new Fighter(x,y,"frost",dir)` — the exact
//  same class, same reset(), same draw()/_drawInner() code path the
//  playable Frost fighter uses. Its rendering is 100% identical to
//  the player's Frost character because it IS a Frost character,
//  just with player input disabled and its position driven by this
//  manager instead of the keyboard/touch controls.
//
//  The revealed boss is the real `Boss` class (bossId 1), which
//  already has a full hand-drawn "Frost King" body (crown, horns,
//  crystal shoulders, glowing core, aura, footstep-frost trail) —
//  also not a placeholder.
// ================================================================

// ---- small fixed-capacity object pool for ice shards / snow / mist FX ----
// Reused every intro instead of allocating/discarding particle objects,
// so long cinematics never cause GC/frame hitching.
class IceFxPool {
  constructor(size) {
    this.items = new Array(size).fill(null).map(() => ({ active: false }));
  }
  spawn(props) {
    for (const it of this.items) {
      if (!it.active) {
        for (const k in it) delete it[k];
        Object.assign(it, props);
        it.maxLife = props.life;
        it.active = true;
        return it;
      }
    }
    return null; // pool full — drop silently, never grow unbounded
  }
  update() {
    for (const it of this.items) {
      if (!it.active) continue;
      it.x += it.vx || 0;
      it.y += it.vy || 0;
      if (it.grav) it.vy = (it.vy || 0) + it.grav;
      if (it.rotSpeed) it.rot = (it.rot || 0) + it.rotSpeed;
      if (it.drag) { it.vx *= it.drag; it.vy *= it.drag; }
      it.life--;
      if (it.life <= 0) it.active = false;
    }
  }
  forEachActive(fn) { for (const it of this.items) if (it.active) fn(it); }
  clear() { for (const it of this.items) it.active = false; }
}

class BossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.iceCharacter = null;      // the real playable Fighter("frost") stand-in
    this.magicCircleAlpha = 0;
    this.prison = { visible: false, formProgress: 0, crackList: [], crackProgress: 0, glow: 0 };
    this.shockwave = null;
    this.boss = null;              // the real Boss(1,...) — Frost King
    this.mistAlpha = 0;
    this.bossRevealAlpha = 0;
    this.auraBurst = 0;
    this.flash = null;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(140);
    this._audioThrottle = 0;

    // Finite State Machine — durations in frames (~60fps, this codebase's
    // existing frame-counter convention doubles as its delta-time system;
    // no setTimeout anywhere here, everything advances via update()).
    this.FSM = {
      Walking:      { duration: 120, next: "Pause" },        // ~2.0s
      Pause:        { duration: 30,  next: "Freezing" },     // ~0.5s
      Freezing:     { duration: 180, next: "IcePrison" },    // ~3.0s
      IcePrison:    { duration: 90,  next: "Cracking" },     // form + 1s tension
      Cracking:     { duration: 144, next: "Explosion" },    // ~2.4s shaking/cracking
      Explosion:    { duration: 36,  next: "Mist" },         // violent shatter beat
      Mist:         { duration: 80,  next: "BossEntrance" }, // ~1.3s cold fog
      BossEntrance: { duration: 90,  next: "Roar" },         // 3 steps
      Roar:         { duration: 170, next: "BattleStart" },  // roar + title card
      BattleStart:  { duration: 20,  next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Walking";
    this.stateTimer = 0;
    const walkSpeed = 4.3125 * 0.4; // exactly 40% of the playable movement speed
    const dist = walkSpeed * this.FSM.Walking.duration;
    // Reuse the EXACT playable Fighter class/draw code for charType "frost".
    this.iceCharacter = new Fighter(this.spawnX - dist, this.spawnY, "frost", 1);
    this.iceCharacter.targetX = this.spawnX;
    this.iceCharacter.walkSpeed = walkSpeed;
    this.iceCharacter.walking = true;
    this.iceCharacter.frozenProgress = 0;
    this.focusX = this.iceCharacter.x;
  }

  update() {
    this.internalFrame++;
    this.stateTimer++;
    if (this.state !== "IDLE" && this.state !== "COMPLETE") {
      const cfg = this.FSM[this.state];
      if (cfg && this.stateTimer >= cfg.duration) {
        this.state = cfg.next;
        this.stateTimer = 0;
        this._onEnterState(this.state);
        if (this.state === "COMPLETE") return { finished: true };
      }
    }
    switch (this.state) {
      case "Walking":      this._updateWalking(); break;
      case "Pause":        this._updatePause(); break;
      case "Freezing":     this._updateFreezing(); break;
      case "IcePrison":    this._updateIcePrison(); break;
      case "Cracking":     this._updateCracking(); break;
      case "Explosion":    this._updateExplosion(); break;
      case "Mist":         this._updateMist(); break;
      case "BossEntrance": this._updateBossEntrance(); break;
      case "Roar":         this._updateRoar(); break;
      case "BattleStart":  this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "Pause") {
      if (this.iceCharacter) this.iceCharacter.walking = false;
    } else if (state === "IcePrison") {
      this.prison.visible = true;
      sfxIceCrystallize?.();
    } else if (state === "Explosion") {
      this._triggerExplosion();
    } else if (state === "Mist") {
      this._spawnBoss();
    } else if (state === "BossEntrance") {
      // boss already placed by mist, just start walking him in
      if (this.boss) this.boss.entranceStartX = this.boss.x;
    } else if (state === "Roar") {
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateWalking() {
    const ic = this.iceCharacter;
    if (!ic) return;
    if (ic.walking) {
      const dx = ic.targetX - ic.x;
      if (Math.abs(dx) > 2) ic.x += Math.sign(dx) * ic.walkSpeed;
      else { ic.x = ic.targetX; ic.walking = false; }
    }
    this.focusX = ic.x;
    if (this.internalFrame % 14 === 0 && this._audioThrottle === 0) {
      sfxStep?.(); this._audioThrottle = 8;
    }
  }

  _updatePause() {
    // Stage 3 — the character stops and looks slightly downward. Silence.
  }

  _updateFreezing() {
    const ic = this.iceCharacter;
    if (!ic) return;
    const p = this.stateTimer / this.FSM.Freezing.duration;
    ic.frozenProgress = Math.min(1, p);
    this.magicCircleAlpha = Math.min(1, this.stateTimer / 20);
    if (this.stateTimer === 1) sfxIceFreeze?.();
    if (this.internalFrame % 9 === 0) {
      this.pool.spawn({ type: "snow", x: ic.x + rndInt(-50, 50), y: ic.y - 160, vx: (rng() - 0.5) * 0.6, vy: rng() * 1 + 0.6, life: 90, size: rndInt(2, 4), color: "white" });
    }
    screenShake = Math.max(screenShake, 1.2);
  }

  _updateIcePrison() {
    const dur = this.FSM.IcePrison.duration;
    const p = this.stateTimer / dur;
    this.prison.formProgress = Math.min(1, p * 2.2); // fast formation, then holds
    this.prison.glow = 0.45 + Math.sin(this.internalFrame * 0.05) * 0.15;
    if (this.stateTimer > dur * 0.4) screenShake = Math.max(screenShake, 0.4); // Stage 6 tension
  }

  _updateCracking() {
    const dur = this.FSM.Cracking.duration;
    const progress = this.stateTimer / dur;
    this.prison.crackProgress = progress;
    this.prison.glow = 0.5 + progress * 0.5 + Math.sin(this.internalFrame * 0.2) * 0.1 * progress;
    if (this.stateTimer % 24 === 0) screenShake = Math.max(screenShake, 3 + progress * 5); // every 0.4s
    if (this.stateTimer % 12 === 0) { // every 0.2s — a new crack appears
      const targetCracks = Math.floor(progress * 16) + 2;
      while (this.prison.crackList.length < targetCracks) {
        this.prison.crackList.push({ angle: rng() * Math.PI * 2, len: 40 + rng() * 95, seed: rng() * 1.4 - 0.7 });
      }
      sfxIceCrack?.();
    }
    if (rng() < 0.3 + progress * 0.4) {
      this.pool.spawn({ type: "frag", x: this.spawnX + rndInt(-45, 45), y: this.spawnY - rndInt(60, 480), vx: (rng() - 0.5) * 0.5, vy: rng() * 1.2 + 0.4, life: 40, size: rndInt(2, 5), rot: rng() * Math.PI, rotSpeed: (rng() - 0.5) * 0.2, color: "#bfe9ff" });
    }
  }

  _triggerExplosion() {
    this.prison.visible = false;
    this.iceCharacter = null; // Stage 9 — completely destroyed, never becomes the boss
    screenShake = Math.max(screenShake, 26);
    this.flash = { alpha: 0.9, duration: 14 };
    sfxIceExplode?.();
    sfxIceShatter?.();
    for (let i = 0; i < 16; i++) { // large shards
      const ang = rng() * Math.PI * 2, spd = rng() * 7 + 4;
      this.pool.spawn({ type: "shard_big", x: this.spawnX, y: this.spawnY - 120, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3, grav: 0.25, life: 70, size: 18 + rng() * 20, rot: rng() * Math.PI * 2, rotSpeed: (rng() - 0.5) * 0.3, color: rndChoice(["#bfe9ff", "#eaffff", "#8fd3ff"]) });
    }
    for (let i = 0; i < 50; i++) { // small shards
      const ang = rng() * Math.PI * 2, spd = rng() * 10 + 3;
      this.pool.spawn({ type: "shard_small", x: this.spawnX, y: this.spawnY - 120, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2, grav: 0.2, life: 55, size: 4 + rng() * 6, rot: rng() * Math.PI * 2, rotSpeed: (rng() - 0.5) * 0.5, color: "white" });
    }
    for (let i = 0; i < 14; i++) { // cold fog
      this.pool.spawn({ type: "fog", x: this.spawnX + rndInt(-60, 60), y: this.spawnY - rndInt(20, 100), vx: (rng() - 0.5) * 1.2, vy: -rng() * 0.6, life: 110, size: 40 + rng() * 40, color: "#c8ebff" });
    }
    for (let i = 0; i < 30; i++) { // snow burst
      const ang = rng() * Math.PI * 2, spd = rng() * 3 + 1;
      this.pool.spawn({ type: "snow", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 80, size: rndInt(2, 4), color: "white" });
    }
    this.shockwave = { r: 10, alpha: 1 };
  }

  _updateExplosion() {
    if (this.shockwave) {
      this.shockwave.r += 15;
      this.shockwave.alpha -= 0.045;
      if (this.shockwave.alpha <= 0) this.shockwave = null;
    }
  }

  _spawnBoss() {
    // Stage 10 — the real Frost King boss, hidden inside the mist. The
    // player never sees this happen; he simply fades into visibility.
    this.boss = new Boss(1, this.spawnX + 130, this.spawnY);
    this.boss.direction = -1;
    this.mistAlpha = 1.0;
    this.bossRevealAlpha = 0;
  }

  _updateMist() {
    const p = this.stateTimer / this.FSM.Mist.duration;
    this.mistAlpha = Math.max(0, 1 - p * 1.15);
    this.bossRevealAlpha = Math.min(1, p * 1.3);
    if (this.boss) { this.boss.anim++; this.boss._updateFrostKingFX(this.spawnY, 999999); }
    if (rng() < 0.5) this.pool.spawn({ type: "fog", x: this.spawnX + rndInt(-70, 70), y: this.spawnY - rndInt(0, 130), vx: (rng() - 0.5) * 0.8, vy: -rng() * 0.4, life: 60, size: 50 + rng() * 30, color: "#d2ebff" });
  }

  _updateBossEntrance() {
    const dur = this.FSM.BossEntrance.duration, stepDur = dur / 3;
    if (this.boss) {
      const stepIdx = Math.min(2, Math.floor(this.stateTimer / stepDur));
      const stepLocalT = Math.min(1, (this.stateTimer % stepDur) / stepDur);
      const totalGap = 130;
      const walked = (stepIdx + stepLocalT) * (totalGap / 3);
      this.boss.x = (this.boss.entranceStartX ?? this.spawnX + totalGap) - walked;
      this.boss.anim++;
      this.boss._updateFrostKingFX(this.spawnY, 999999);
      if (this.stateTimer % Math.round(stepDur) === 1) { sfxIceCrack?.(); screenShake = Math.max(screenShake, 4); }
    }
    this.bossRevealAlpha = 1;
    this.mistAlpha = Math.max(0, this.mistAlpha - 0.012);
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 14);
    this.zoom = 1.18;
    sfxBossRoar?.();
    this.auraBurst = 1.0;
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 5 + 4;
      this.pool.spawn({ type: "aura", x: this.spawnX, y: this.spawnY - 110, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 40, size: 4 + rng() * 4, color: "#aeeaff" });
    }
    this.titleDelay = 15;
  }

  _updateRoar() {
    if (this.auraBurst > 0) this.auraBurst = Math.max(0, this.auraBurst - 0.02);
    if (this.boss) { this.boss.anim++; this.boss._updateFrostKingFX(this.spawnY, 999999); }
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 15;
    const showDur = this.FSM.Roar.duration - 15;
    if (t >= 0) {
      this.showTitle = true;
      if (t < 20) this.titleAlpha = t / 20;
      else if (t > showDur - 25) this.titleAlpha = Math.max(0, (showDur - t) / 25);
      else this.titleAlpha = 1;
      if (t > showDur - 25 && rng() < 0.6) { // title dissolves into snow
        this.pool.spawn({ type: "snow", x: this.spawnX + rndInt(-90, 90), y: this.spawnY - 260 + rndInt(-20, 20), vx: (rng() - 0.5) * 1.5, vy: rng() * 1 + 0.5, life: 60, size: rndInt(2, 4), color: "white" });
      }
    }
    if (this.stateTimer > showDur * 0.6) this.zoom += (1.0 - this.zoom) * 0.02;
  }

  _updateBattleStart() {
    this.zoom += (1.0 - this.zoom) * 0.15;
    screenShake *= 0.5;
  }

  // ---------------- drawing ----------------
  // World-space visuals (must be called INSIDE the camera translate/zoom).
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if ((this.state === "Pause" || this.state === "Freezing") && this.magicCircleAlpha > 0) {
      this._drawMagicCircle(ctx);
    }
    if (this.iceCharacter) {
      // EXACT same draw() call the playable Frost Fighter uses — no
      // separate/simplified drawing path exists for this character.
      this.iceCharacter.draw(0, 0);
      if (this.iceCharacter.frozenProgress > 0) this._drawFreezeOverlay(ctx, this.iceCharacter);
    }
    if (this.prison.visible) this._drawPrison(ctx);
    this._drawPool(ctx);
    if (this.shockwave) this._drawShockwave(ctx);
    if (this.boss && (this.state === "Mist" || this.state === "BossEntrance" || this.state === "Roar")) {
      this._drawBossReveal(ctx);
    }
  }

  // Screen-space overlays (must be called OUTSIDE the camera translate — a
  // fixed full-screen flash / title card should not drift with the camera).
  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.flash && this.flash.alpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,255,255,${this.flash.alpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.flash.alpha -= 1 / this.flash.duration;
    }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawMagicCircle(ctx) {
    const x = this.spawnX, y = this.spawnY;
    ctx.save();
    ctx.globalAlpha = this.magicCircleAlpha * 0.85;
    const R = 70;
    ctx.strokeStyle = "#8fe0ff"; ctx.lineWidth = 2; ctx.shadowColor = "#aeeaff"; ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.ellipse(x, y + 4, R, R * 0.32, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y + 4, R * 0.7, R * 0.22, 0, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + this.internalFrame * 0.01;
      const rx1 = Math.cos(a) * R, ry1 = Math.sin(a) * R * 0.32;
      ctx.beginPath(); ctx.moveTo(x, y + 4); ctx.lineTo(x + rx1, y + 4 + ry1); ctx.stroke();
    }
    ctx.restore();
  }

  // Renders the freeze visibly climbing the body feet→head. This is an
  // actual rendered overlay (clipped rect + gradient + crystal spikes at
  // the boundary), not a hidden variable — the player can watch it rise.
  _drawFreezeOverlay(ctx, ic) {
    const p = ic.frozenProgress || 0;
    if (p <= 0) return;
    const feetY = ic.y, topY = ic.y - 140;
    const freezeTop = feetY - (feetY - topY) * p;
    ctx.save();
    ctx.translate(ic.x, ic.y); ctx.scale(CHAR_VISUAL_SCALE, CHAR_VISUAL_SCALE); ctx.translate(-ic.x, -ic.y);
    ctx.save();
    ctx.beginPath(); ctx.rect(ic.x - 42, freezeTop, 84, feetY - freezeTop); ctx.clip();
    const grad = ctx.createLinearGradient(0, freezeTop, 0, feetY);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.18, "rgba(205,240,255,0.55)");
    grad.addColorStop(1, "rgba(140,205,255,0.32)");
    ctx.fillStyle = grad; ctx.fillRect(ic.x - 42, freezeTop, 84, feetY - freezeTop);
    ctx.restore();
    if (p < 1) {
      ctx.strokeStyle = "white"; ctx.lineWidth = 3; ctx.shadowColor = "#8fe0ff"; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(ic.x - 42, freezeTop); ctx.lineTo(ic.x + 42, freezeTop); ctx.stroke();
      for (let i = -3; i <= 3; i++) {
        const sx = ic.x + i * 12, spike = 9 + Math.abs(i) * 1.6;
        ctx.beginPath(); ctx.moveTo(sx - 4, freezeTop); ctx.lineTo(sx, freezeTop - spike); ctx.lineTo(sx + 4, freezeTop); ctx.closePath();
        ctx.fillStyle = "rgba(215,246,255,0.92)"; ctx.fill();
      }
    }
    ctx.restore();
  }

  // The enormous ice prison — roughly 4x the fighter's height, translucent
  // so the frozen character stays visible inside, with an internal glow,
  // growing cracks, and a stroked crystalline outline.
  _drawPrison(ctx) {
    const cx = this.spawnX, baseY = this.spawnY;
    const h = 560 * this.prison.formProgress;
    const w = 170;
    const topY = baseY - h;
    ctx.save();
    const grad = ctx.createLinearGradient(0, topY, 0, baseY);
    grad.addColorStop(0, `rgba(150,225,255,${0.25 + this.prison.glow * 0.25})`);
    grad.addColorStop(0.5, `rgba(120,205,255,${0.35 + this.prison.glow * 0.3})`);
    grad.addColorStop(1, `rgba(90,180,255,${0.45 + this.prison.glow * 0.25})`);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx, topY);
    ctx.lineTo(cx + w * 0.55, topY + h * 0.18);
    ctx.lineTo(cx + w * 0.5, baseY);
    ctx.lineTo(cx - w * 0.5, baseY);
    ctx.lineTo(cx - w * 0.55, topY + h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = `rgba(230,250,255,${0.7 + this.prison.crackProgress * 0.3})`;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.save();
    ctx.shadowColor = "#7eebff"; ctx.shadowBlur = 20 + this.prison.glow * 30;
    ctx.fillStyle = `rgba(140,230,255,${this.prison.glow * 0.45})`;
    ctx.beginPath(); ctx.ellipse(cx, baseY - h * 0.45, w * 0.28, h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = `rgba(255,255,255,${0.5 + this.prison.crackProgress * 0.5})`;
    ctx.lineWidth = 1.6;
    this.prison.crackList.forEach(c => {
      const ox = cx + Math.cos(c.angle) * 10, oy = baseY - h * 0.5 + Math.sin(c.angle) * 10;
      const ex = ox + Math.cos(c.angle + c.seed) * c.len * this.prison.crackProgress;
      const ey = oy + Math.sin(c.angle + c.seed) * c.len * 0.6 * this.prison.crackProgress;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    });
    ctx.restore();
  }

  _drawShockwave(ctx) {
    const sw = this.shockwave;
    ctx.save();
    ctx.globalAlpha = Math.max(0, sw.alpha);
    ctx.strokeStyle = "white"; ctx.lineWidth = 6; ctx.shadowColor = "#aeeaff"; ctx.shadowBlur = 20;
    ctx.beginPath(); ctx.ellipse(this.spawnX, this.spawnY - 40, sw.r, sw.r * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "snow" || it.type === "aura") {
        ctx.globalAlpha = Math.min(1, a + 0.15);
        ctx.fillStyle = it.color || "white";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === "frag") {
        ctx.globalAlpha = a;
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
        ctx.fillStyle = it.color; ctx.fillRect(-it.size / 2, -it.size / 2, it.size, it.size);
        ctx.restore();
      } else if (it.type === "shard_big" || it.type === "shard_small") {
        ctx.globalAlpha = a;
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
        ctx.fillStyle = it.color; ctx.strokeStyle = "white"; ctx.lineWidth = 1;
        const s = it.size;
        ctx.beginPath(); ctx.moveTo(0, -s); ctx.lineTo(s * 0.6, 0); ctx.lineTo(0, s); ctx.lineTo(-s * 0.6, 0); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.restore();
      } else if (it.type === "fog") {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = it.color || "#c8ebff";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  _drawBossReveal(ctx) {
    const b = this.boss;
    const revealAlpha = this.state === "Mist" ? (this.bossRevealAlpha ?? 0) : 1;
    ctx.save(); ctx.globalAlpha = revealAlpha;
    b._drawFrostKingFrostTrail();
    b._drawFrostKingAura(b.x, b.y);
    ctx.restore();
    b._drawFrostKingBody(b.x, b.y, 1, revealAlpha, b.anim); // real Frost King body — no HP bar drawn yet
    if (this.auraBurst > 0) {
      ctx.save();
      ctx.globalAlpha = this.auraBurst * 0.6;
      ctx.strokeStyle = "#aeeaff"; ctx.lineWidth = 4; ctx.shadowColor = "#eaffff"; ctx.shadowBlur = 25;
      ctx.beginPath(); ctx.arc(b.x, b.y - 110, 90 + (1 - this.auraBurst) * 90, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    if (this.state === "Mist" && this.mistAlpha > 0) {
      ctx.save();
      ctx.globalAlpha = this.mistAlpha * 0.6;
      ctx.fillStyle = "#c8ebff";
      ctx.beginPath(); ctx.ellipse(this.spawnX, this.spawnY - 90, 140, 170, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#00eaff";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(120,220,255,0.85)"; ctx.shadowBlur = 18;
    ctx.fillText("❄ FROST KING ❄", W / 2, H / 2 - 30);
    ctx.font = "bold 22px Arial";
    ctx.fillText("THE FROZEN EMPEROR", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

let bossIntroManager = null;

// ================================================================
//  EARTH BOSS INTRO MANAGER — EARTH TITAN CINEMATIC (Boss 2 only)
//  ----------------------------------------------------------------
//  Same pattern as BossIntroManager above (Frost King / Boss 1): a
//  small state machine that plays out entirely with real game
//  objects — a real Fighter("earth",...) stand-in that rises out of
//  the ground, then the real Boss(5,...) instance — never any
//  placeholder art.
//
//  Public interface intentionally MATCHES BossIntroManager exactly:
//  start(), update(), .boss, .focusX, .zoom, drawWorld(ctx,w,h),
//  drawScreen(ctx,w,h). The generic CHALLENGE loop code that drives
//  the cinematic (see the "Boss intro cinematic" block further
//  down) only ever talks to whichever manager is active through
//  this shared shape — it never needs to know which boss's intro is
//  playing. Any future boss cinematic (Boss 3, 4, 6, 7...) should
//  copy this same class shape so it plugs into that loop for free.
// ================================================================
class EarthBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.earthCharacter = null;   // the real playable Fighter("earth") stand-in, rising from the ground
    this.riseDepth = 190;         // how far underground it starts (px) — tall enough to stay fully hidden pre-rise
    this.crackAlpha = 0;
    this.crackList = [];          // ground-crack lines radiating from the spawn point
    this.rocks = [];              // erupted rock spikes that later launch inward and collide
    this.boss = null;             // the real Boss(5,...) — Earth Titan
    this.dustAlpha = 0;
    this.bossRevealAlpha = 0;
    this.flash = null;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(150); // generic particle pool (name is historical — it's not ice-specific, just reused here for dust/rock debris)
    this._audioThrottle = 0;

    // Finite State Machine — durations in frames (~60fps), same convention
    // as BossIntroManager. Total ≈ 455f ≈ 7.6s, inside the requested 6-8s.
    this.FSM = {
      Quake:       { duration: 60, next: "Rise" },        // ~1.0s — screen shakes, ground cracks, dust
      Rise:        { duration: 70, next: "RocksErupt" },  // ~1.2s — earth character rises, stands still
      RocksErupt:  { duration: 30, next: "RocksLaunch" }, // ~0.5s — rocks/spikes burst up around it
      RocksLaunch: { duration: 20, next: "Impact" },      // ~0.3s — all rocks fire inward at once
      Impact:      { duration: 25, next: "Smoke" },       // collision -> big explosion
      Smoke:       { duration: 70, next: "BossReveal" },  // ~1.2s — dust covers screen, then fades (opacity only)
      BossReveal:  { duration: 70, next: "Roar" },        // Earth Titan stands motionless ~1s
      Roar:        { duration: 90, next: "BattleStart" }, // title card, then HP bar
      BattleStart: { duration: 20, next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Quake";
    this.stateTimer = 0;
    this.focusX = this.spawnX;
  }

  update() {
    this.internalFrame++;
    this.stateTimer++;
    if (this.state !== "IDLE" && this.state !== "COMPLETE") {
      const cfg = this.FSM[this.state];
      if (cfg && this.stateTimer >= cfg.duration) {
        this.state = cfg.next;
        this.stateTimer = 0;
        this._onEnterState(this.state);
        if (this.state === "COMPLETE") return { finished: true };
      }
    }
    switch (this.state) {
      case "Quake":       this._updateQuake(); break;
      case "Rise":         this._updateRise(); break;
      case "RocksErupt":   this._updateRocksErupt(); break;
      case "RocksLaunch":  this._updateRocksLaunch(); break;
      case "Impact":       this._updateImpact(); break;
      case "Smoke":        this._updateSmoke(); break;
      case "BossReveal":   this._updateBossReveal(); break;
      case "Roar":         this._updateRoar(); break;
      case "BattleStart":  this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "Rise") {
      this.earthCharacter = new Fighter(this.spawnX, this.spawnY + this.riseDepth, "earth", 1);
      sfxEarthCrack?.();
    } else if (state === "RocksErupt") {
      this._spawnRocks();
    } else if (state === "RocksLaunch") {
      sfxRockImpact?.();
    } else if (state === "Impact") {
      this._triggerImpact();
    } else if (state === "Smoke") {
      this._spawnBoss();
    } else if (state === "Roar") {
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó thanh máu Boss hiện ra"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateQuake() {
    // "Màn hình rung nhẹ. Mặt đất bắt đầu nứt. Xuất hiện hiệu ứng bụi đất."
    const p = this.stateTimer / this.FSM.Quake.duration;
    this.crackAlpha = Math.min(1, p * 1.4);
    if (this.stateTimer % 10 === 0) {
      const targetCracks = Math.floor(p * 8) + 2;
      while (this.crackList.length < targetCracks) {
        this.crackList.push({ angle: rng() * Math.PI * 2, len: 30 + rng() * 70, seed: rng() * 1.2 - 0.6 });
      }
      sfxEarthCrack?.();
    }
    if (this.internalFrame % 6 === 0) {
      this.pool.spawn({ type: "fog", x: this.spawnX + rndInt(-60, 60), y: this.spawnY - rndInt(0, 20), vx: (rng() - 0.5) * 0.6, vy: -rng() * 0.3, life: 60, size: 14 + rng() * 18, color: "#c9a878" });
    }
    screenShake = Math.max(screenShake, 1.5 + p * 2); // light shake only
    if (this.stateTimer === 1) sfxEarthRumble?.();
  }

  _updateRise() {
    // "Một nhân vật hệ Đất từ từ bước lên khỏi mặt đất. Nhân vật đứng yên."
    const ec = this.earthCharacter;
    if (!ec) return;
    const dur = this.FSM.Rise.duration, riseDur = dur * 0.65;
    const p = Math.min(1, this.stateTimer / riseDur);
    const eased = 1 - Math.pow(1 - p, 3); // ease-out — fast rise, gentle settle
    ec.y = this.spawnY + this.riseDepth * (1 - eased);
    if (p < 1 && this.internalFrame % 5 === 0) {
      this.pool.spawn({ type: "frag", x: this.spawnX + rndInt(-38, 38), y: this.spawnY - rndInt(0, 10), vx: (rng() - 0.5) * 1.5, vy: -rng() * 1.5 - 0.5, grav: 0.15, life: 40, size: rndInt(3, 6), rot: rng() * Math.PI, rotSpeed: (rng() - 0.5) * 0.2, color: rndChoice(["#8a6a4a", "#6a4a2a", "#c68a4a"]) });
      screenShake = Math.max(screenShake, 2);
    }
    this.focusX = this.spawnX;
  }

  _spawnRocks() {
    // "Ngay sau đó rất nhiều tảng đá lớn và các mũi đá từ dưới đất trồi lên xung quanh."
    const count = 10;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * Math.PI * 2 + rng() * 0.3;
      const dist = 90 + rng() * 70;
      this.rocks.push({
        homeX: this.spawnX + Math.cos(ang) * dist,
        homeY: this.spawnY + Math.sin(ang) * dist * 0.35,
        x: 0, y: 0,
        size: 14 + rng() * 16,
        growT: rng() * 6, // stagger the eruption slightly, some already mid-rise
        rot: rng() * Math.PI * 2,
        launched: false,
        _sfxDone: false,
        color: rndChoice(["#8a6a4a", "#6a4a2a", "#a9835a", "#7a5a3a"])
      });
    }
  }

  _updateRocksErupt() {
    this.rocks.forEach(r => {
      r.growT = Math.min(1, r.growT + 1 / 16);
      if (r.growT >= 1 && !r._sfxDone) {
        r._sfxDone = true;
        if (rng() < 0.5) sfxRockErupt?.();
        screenShake = Math.max(screenShake, 5); // "Camera rung khi đá xuất hiện"
      }
      r.x = r.homeX;
      r.y = r.homeY - 30 * r.growT; // spikes push up out of the ground
    });
  }

  _updateRocksLaunch() {
    // "Sau khoảng 0.5 giây toàn bộ đá đồng loạt bắn thẳng về phía nhân vật."
    const p = this.stateTimer / this.FSM.RocksLaunch.duration;
    screenShake = Math.max(screenShake, 3 + p * 6);
    this.rocks.forEach(r => {
      r.launched = true;
      r.x = r.homeX + (this.spawnX - r.homeX) * p;
      r.y = (r.homeY - 30) + ((this.spawnY - 120) - (r.homeY - 30)) * p;
      r.rot += 0.35;
    });
  }

  _triggerImpact() {
    // "Va chạm tạo nên một vụ nổ lớn. Bụi và khói bao phủ toàn bộ màn hình."
    this.rocks = [];
    this.earthCharacter = null; // consumed into the eruption — never becomes the boss directly
    screenShake = Math.max(screenShake, 30); // "Camera rung mạnh khi đá va chạm"
    this.flash = { alpha: 0.75, duration: 16 };
    sfxEarthExplode?.();
    for (let i = 0; i < 20; i++) { // flying rock chunks
      const ang = rng() * Math.PI * 2, spd = rng() * 7 + 3;
      this.pool.spawn({ type: "shard_big", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 3, grav: 0.3, life: 65, size: 14 + rng() * 18, rot: rng() * Math.PI * 2, rotSpeed: (rng() - 0.5) * 0.3, color: rndChoice(["#8a6a4a", "#6a4a2a", "#a9835a"]) });
    }
    for (let i = 0; i < 40; i++) { // dust/smoke covering the whole screen
      this.pool.spawn({ type: "fog", x: this.spawnX + rndInt(-260, 260), y: this.spawnY - rndInt(0, 220), vx: (rng() - 0.5) * 1.5, vy: -rng() * 0.7, life: 130, size: 60 + rng() * 60, color: rndChoice(["#c9a878", "#a68b5f", "#8a7150"]) });
    }
  }

  _updateImpact() {
    // Hold on the explosion for a beat before the dust settles into the Smoke state.
  }

  _spawnBoss() {
    // The real Earth Titan boss, hidden inside the dust cloud — mirrors
    // _spawnBoss() in BossIntroManager. HP bar stays hidden until BattleStart.
    this.boss = new Boss(2, this.spawnX, this.spawnY);
    this.boss.direction = -1;
    this.boss._introHideHp = true;
    this.dustAlpha = 1.0;
    this.bossRevealAlpha = 0;
  }

  _updateSmoke() {
    // "Khoảng 1 giây sau, khói bắt đầu tan." — fade purely via opacity, no hard cut.
    const p = this.stateTimer / this.FSM.Smoke.duration;
    this.dustAlpha = Math.max(0, 1 - Math.max(0, p - 0.15) * 1.3);
    this.bossRevealAlpha = Math.min(1, Math.max(0, p - 0.1) * 1.4);
    if (this.boss) this.boss.anim++;
    if (rng() < 0.4) this.pool.spawn({ type: "fog", x: this.spawnX + rndInt(-90, 90), y: this.spawnY - rndInt(0, 150), vx: (rng() - 0.5) * 0.7, vy: -rng() * 0.35, life: 55, size: 45 + rng() * 35, color: "#b89a6f" });
  }

  _updateBossReveal() {
    // "Boss Earth Titan xuất hiện. Boss đứng bất động khoảng 1 giây."
    if (this.boss) this.boss.anim++;
    this.bossRevealAlpha = 1;
    this.dustAlpha = Math.max(0, this.dustAlpha - 0.015);
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 16);
    this.zoom = 1.16;
    sfxEarthRoar?.();
    for (let i = 0; i < 18; i++) {
      const ang = (i / 18) * Math.PI * 2, spd = rng() * 4 + 3;
      this.pool.spawn({ type: "aura", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 36, size: 4 + rng() * 4, color: "#e0a030" });
    }
    this.titleDelay = 12;
  }

  _updateRoar() {
    if (this.boss) this.boss.anim++;
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 12;
    const showDur = this.FSM.Roar.duration - 12;
    if (t >= 0) {
      this.showTitle = true;
      if (t < 18) this.titleAlpha = t / 18;
      else if (t > showDur - 22) this.titleAlpha = Math.max(0, (showDur - t) / 22);
      else this.titleAlpha = 1;
    }
    if (this.stateTimer > showDur * 0.6) this.zoom += (1.0 - this.zoom) * 0.02;
  }

  _updateBattleStart() {
    this.zoom += (1.0 - this.zoom) * 0.15;
    screenShake *= 0.5;
  }

  // ---------------- drawing ----------------
  // World-space visuals (must be called INSIDE the camera translate/zoom).
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.crackAlpha > 0 && (this.state === "Quake" || this.state === "Rise")) this._drawCracks(ctx);
    if (this.earthCharacter) {
      // Clip out anything below the floor line so the character visibly
      // emerges FROM the ground instead of just sliding up through open air.
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.spawnX - 200, 0, 400, this.spawnY);
      ctx.clip();
      this.earthCharacter.draw(0, 0);
      ctx.restore();
    }
    this.rocks.forEach(r => this._drawRock(ctx, r));
    this._drawPool(ctx);
    if (this.boss && (this.state === "Smoke" || this.state === "BossReveal" || this.state === "Roar" || this.state === "BattleStart")) {
      this._drawBossReveal(ctx);
    }
  }

  // Screen-space overlays (must be called OUTSIDE the camera transform — a
  // fixed full-screen flash / dust wash / title card should not drift with
  // the camera).
  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.flash && this.flash.alpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,220,180,${this.flash.alpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.flash.alpha -= 1 / this.flash.duration;
    }
    if (this.dustAlpha > 0 && (this.state === "Impact" || this.state === "Smoke")) {
      ctx.save();
      ctx.globalAlpha = this.dustAlpha * 0.55;
      ctx.fillStyle = "#a68b5f";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawCracks(ctx) {
    ctx.save();
    ctx.globalAlpha = this.crackAlpha;
    ctx.strokeStyle = "#3a2a18";
    ctx.lineWidth = 2.5;
    this.crackList.forEach(c => {
      const ox = this.spawnX, oy = this.spawnY;
      const ex = ox + Math.cos(c.angle) * c.len, ey = oy + Math.sin(c.angle) * c.len * 0.22 + 4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    });
    ctx.restore();
  }

  _drawRock(ctx, r) {
    if (r.growT <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(1, r.growT * 1.5);
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    ctx.fillStyle = r.color;
    ctx.strokeStyle = "#2c1f10";
    ctx.lineWidth = 1.5;
    const s = r.size * (r.launched ? 1 : Math.min(1, r.growT));
    ctx.beginPath();
    ctx.moveTo(0, -s); ctx.lineTo(s * 0.7, -s * 0.1); ctx.lineTo(s * 0.5, s * 0.8);
    ctx.lineTo(-s * 0.5, s * 0.8); ctx.lineTo(-s * 0.7, -s * 0.1);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "fog") {
        ctx.globalAlpha = a * 0.4;
        ctx.fillStyle = it.color || "#c9a878";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === "frag" || it.type === "shard_big") {
        ctx.globalAlpha = a;
        ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot || 0);
        ctx.fillStyle = it.color; ctx.strokeStyle = "#2c1f10"; ctx.lineWidth = 1;
        ctx.fillRect(-it.size / 2, -it.size / 2, it.size, it.size);
        ctx.strokeRect(-it.size / 2, -it.size / 2, it.size, it.size);
        ctx.restore();
      } else if (it.type === "aura") {
        ctx.globalAlpha = Math.min(1, a + 0.15);
        ctx.fillStyle = it.color || "#e0a030";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  _drawBossReveal(ctx) {
    const b = this.boss;
    const revealAlpha = (this.state === "Smoke") ? (this.bossRevealAlpha ?? 0) : 1;
    ctx.save(); ctx.globalAlpha = revealAlpha;
    b.draw(); // the real Earth Titan body — draw() itself skips the HP bar while _introHideHp is set
    ctx.restore();
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#e0a030";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(200,120,40,0.85)"; ctx.shadowBlur = 18;
    ctx.fillText("🪨 EARTH TITAN 🪨", W / 2, H / 2 - 30);
    ctx.font = "bold 22px Arial";
    ctx.fillText("BOSS HỆ ĐẤT", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

// ================================================================
//  FLAME BOSS INTRO MANAGER — FLAME LORD CINEMATIC (Boss 3 only)
//  ----------------------------------------------------------------
//  Same pattern as BossIntroManager / EarthBossIntroManager above:
//  a small state machine that plays out entirely with real game
//  objects — a real Fighter("fire",...) FIRE-ELEMENT character (drawn
//  in its own true fire colors, never a black silhouette), then the
//  real Boss(6,...) instance — never any placeholder art.
//
//  ~9 seconds total. Camera shake is deliberately sparse: short pulses
//  at a handful of key beats (sky darkening, ground splitting, lava
//  erupting, the staff-raise, the flame column, the detonation, the
//  roar) rather than a continuous rumble through the whole sequence.
//
//  Public interface intentionally MATCHES the other managers exactly:
//  start(), update(), .boss, .focusX, .zoom, drawWorld(ctx,w,h),
//  drawScreen(ctx,w,h). The generic CHALLENGE loop code only ever
//  talks to whichever manager is active through this shared shape —
//  it never needs to know which boss's intro is playing. Any future
//  boss cinematic should copy this same class shape to plug into
//  that loop for free.
// ================================================================
class FlameBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.darkAlpha = 0;
    this.skyAlpha = 0;            // sky turning red overlay — "Bầu trời chuyển đỏ"
    this.cloudList = [];          // dark clouds rolling in — "Mây đen kéo đến"
    this.crackAlpha = 0;
    this.crackList = [];          // ground-crack lines radiating from the spawn point, glowing red-orange
    this.lavaJets = [];           // lava spouts erupting at multiple positions
    this.fireCharacter = null;    // the real playable Fighter("fire") — a true fire-element character, drawn in its own colors
    this.charWalkStartX = spawnX - 260;
    this.staffGlowAlpha = 0;      // symbolic "raised arms" energy building above the character
    this.flameColumnAlpha = 0;    // the giant central flame the character disappears into
    this.boss = null;             // the real Boss(6,...) — Flame Lord
    this.hazeAlpha = 0;
    this.bossRevealAlpha = 0;
    this.flash = null;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(180); // generic particle pool (name is historical — reused here for flame/ember/ash/lava fx)

    // Finite State Machine — durations in frames (~60fps). Total ≈ 545f ≈ 9.1s,
    // inside the requested 8-10s window.
    this.FSM = {
      Darken:      { duration: 25, next: "SkyTurn" },     // Khôi phục về nguyên bản
      SkyTurn:     { duration: 60, next: "Cracks" },      
      Cracks:      { duration: 50, next: "LavaErupt" },   
      LavaErupt:   { duration: 45, next: "WalkOut" },     
      WalkOut:     { duration: 45, next: "StaffRaise" },  // Rút ngắn từ 70 xuống 45 để đi nhanh hơn
      StaffRaise:  { duration: 35, next: "FlameBurst" },  
      FlameBurst:  { duration: 45, next: "Swirl" },       
      Swirl:       { duration: 40, next: "Explode" },     
      Explode:     { duration: 16, next: "FlameFade" },   
      FlameFade:   { duration: 60, next: "Roar" },        
      Roar:        { duration: 80, next: "BattleStart" }, 
      BattleStart: { duration: 18, next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Darken";
    this.stateTimer = 0;
    this.focusX = this.spawnX;
    for (let i = 0; i < 5; i++) {
      this.cloudList.push({ x: this.spawnX + rndInt(-260, 260), y: this.spawnY - 260 - rndInt(0, 60), w: 90 + rng() * 70, drift: 0.15 + rng() * 0.2 });
    }
  }

  update() {
    this.internalFrame++;
    this.stateTimer++;
    if (this.state !== "IDLE" && this.state !== "COMPLETE") {
      const cfg = this.FSM[this.state];
      if (cfg && this.stateTimer >= cfg.duration) {
        this.state = cfg.next;
        this.stateTimer = 0;
        this._onEnterState(this.state);
        if (this.state === "COMPLETE") return { finished: true };
      }
    }
    switch (this.state) {
      case "Darken":      this._updateDarken(); break;
      case "SkyTurn":      this._updateSkyTurn(); break;
      case "Cracks":       this._updateCracks(); break;
      case "LavaErupt":    this._updateLavaErupt(); break;
      case "WalkOut":      this._updateWalkOut(); break;
      case "StaffRaise":   this._updateStaffRaise(); break;
      case "FlameBurst":   this._updateFlameBurst(); break;
      case "Swirl":        this._updateSwirl(); break;
      case "Explode":      this._updateExplode(); break;
      case "FlameFade":    this._updateFlameFade(); break;
      case "Roar":         this._updateRoar(); break;
      case "BattleStart":  this._updateBattleStart(); break;
    }
    this.pool.update();
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "SkyTurn") {
      screenShake = Math.max(screenShake, 2); // one soft thunder-like pulse, not sustained
    } else if (state === "Cracks") {
      sfxLavaRumble?.();
    } else if (state === "LavaErupt") {
      this._spawnLavaJets();
    } else if (state === "WalkOut") {
      // "Nhân vật hệ Lửa bước ra từ biển lửa." — a real fire-element character,
      // drawn in its own true colors. No footstep SOUND is ever played for this walk.
      this.fireCharacter = new Fighter(this.charWalkStartX, this.spawnY, "fire", 1);
      this.fireCharacter.targetX = this.spawnX;
      this.fireCharacter.walking = true;
    } else if (state === "StaffRaise") {
      if (this.fireCharacter) this.fireCharacter.walking = false;
      screenShake = Math.max(screenShake, 3);
    } else if (state === "FlameBurst") {
      sfxFireBurst?.();
      screenShake = Math.max(screenShake, 9);
    } else if (state === "Swirl") {
      sfxFireCrackle?.();
    } else if (state === "Explode") {
      this._triggerExplode();
    } else if (state === "FlameFade") {
      this._spawnBoss();
    } else if (state === "Roar") {
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó hiện thanh máu và bắt đầu trận đấu"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateDarken() {
    // "Màn hình tối dần."
    const p = this.stateTimer / this.FSM.Darken.duration;
    this.darkAlpha = Math.min(0.5, p * 0.55);
  }

  _updateSkyTurn() {
    // "Bầu trời chuyển đỏ. Mây đen kéo đến."
    const p = this.stateTimer / this.FSM.SkyTurn.duration;
    this.skyAlpha = Math.min(0.5, p * 0.55);
    this.darkAlpha = Math.max(0, 0.5 - p * 0.25);
    this.cloudList.forEach(c => { c.x += c.drift; });
  }

  _updateCracks() {
    // "Dung nham làm nứt mặt đất." — ground begins to split and glow.
    const p = this.stateTimer / this.FSM.Cracks.duration;
    this.crackAlpha = Math.min(1, p * 1.4);
    if (this.stateTimer % 7 === 0) {
      const targetCracks = Math.floor(p * 9) + 3;
      while (this.crackList.length < targetCracks) {
        this.crackList.push({ angle: rng() * Math.PI * 2, len: 35 + rng() * 80, seed: rng() * 1.2 - 0.6 });
      }
    }
    if (this.internalFrame % 6 === 0) {
      this.pool.spawn({ type: "ember", x: this.spawnX + rndInt(-70, 70), y: this.spawnY - rndInt(0, 15), vx: (rng() - 0.5) * 0.5, vy: -rng() * 1.2 - 0.3, life: 50, size: 2 + rng() * 3, color: rndChoice(["#ff8800", "#ffcc33", "#ff4400"]) });
    }
    // A couple of discrete tremor beats instead of a continuous rumble.
    if (this.stateTimer === 18 || this.stateTimer === 40) screenShake = Math.max(screenShake, 3);
  }

  _spawnLavaJets() {
    // "Lửa bùng lên nhiều nơi." — lava/fire erupting at several positions.
    const count = 6;
    for (let i = 0; i < count; i++) {
      const ox = this.spawnX + (i - (count - 1) / 2) * 55 + rndInt(-15, 15);
      this.lavaJets.push({ x: ox, growT: rng() * 4, height: 60 + rng() * 50, _sfxDone: false });
    }
  }

  _updateLavaErupt() {
    this.lavaJets.forEach(j => {
      j.growT = Math.min(1, j.growT + 1 / 12);
      if (j.growT >= 1 && !j._sfxDone) {
        j._sfxDone = true;
        if (rng() < 0.5) sfxLavaErupt?.();
      }
      if (j.growT > 0.3 && this.internalFrame % 4 === 0) {
        this.pool.spawn({ type: "spark", x: j.x + rndInt(-8, 8), y: this.spawnY - j.height * j.growT, vx: (rng() - 0.5) * 1.5, vy: -rng() * 2 - 0.5, grav: 0.08, life: 30, size: 2 + rng() * 2, color: rndChoice(["#ffaa00", "#ff5500", "#ffe066"]) });
      }
    });
    if (this.stateTimer === 20) screenShake = Math.max(screenShake, 3); // a single eruption beat
    // Khói và tro bay khắp màn hình — smoke and ash drifting across the whole screen.
    if (this.internalFrame % 6 === 0) {
      this.pool.spawn({ type: "ash", x: this.spawnX + rndInt(-320, 320), y: this.spawnY - rndInt(60, 260), vx: (rng() - 0.5) * 0.6, vy: -rng() * 0.4 - 0.1, life: 150, size: 30 + rng() * 40, color: "#4a3a30" });
    }
  }

  _updateWalkOut() {
    // "Nhân vật hệ Lửa bước ra từ biển lửa." — visual footfall dust only, never a footstep sound.
    const fc = this.fireCharacter;
    if (fc && fc.walking) {
      const dx = fc.targetX - fc.x;
      // Tăng tốc độ di chuyển từ 2.2 lên khoảng 3.5 để khớp với thời gian rút ngắn
      if (Math.abs(dx) > 2) fc.x += Math.sign(dx) * 3.5;
      else { fc.x = fc.targetX; fc.walking = false; }
      if (this.internalFrame % 10 === 0) {
        this.pool.spawn({ type: "ember", x: fc.x + rndInt(-8, 8), y: this.spawnY - 2, vx: (rng() - 0.5) * 0.8, vy: -rng() * 0.8 - 0.2, life: 30, size: 2 + rng() * 2, color: "#ff8800" });
      }
    }
    this.focusX = fc ? fc.x : this.spawnX;
    if (this.internalFrame % 6 === 0) {
      this.pool.spawn({ type: "ash", x: this.spawnX + rndInt(-320, 320), y: this.spawnY - rndInt(60, 260), vx: (rng() - 0.5) * 0.6, vy: -rng() * 0.4 - 0.1, life: 150, size: 30 + rng() * 40, color: "#4a3a30" });
    }
  }

  _updateStaffRaise() {
    // "Giơ quyền trượng lên trời." — symbolic upward energy gathering above the character.
    const p = this.stateTimer / this.FSM.StaffRaise.duration;
    this.staffGlowAlpha = Math.min(1, p * 1.3);
    const cx = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
    if (this.internalFrame % 3 === 0) {
      this.pool.spawn({ type: "spark", x: cx + rndInt(-6, 6), y: this.spawnY - 160 - p * 60, vx: (rng() - 0.5) * 1, vy: -rng() * 1.5 - 0.5, life: 26, size: 2 + rng() * 2, color: "#ffcc33" });
    }
    this.focusX = cx;
  }

  _updateFlameBurst() {
    // "Một cột lửa khổng lồ bao phủ nhân vật."
    const p = this.stateTimer / this.FSM.FlameBurst.duration;
    this.flameColumnAlpha = Math.min(1, p * 1.6);
    if (this.stateTimer === 6) screenShake = Math.max(screenShake, 5);
    if (this.internalFrame % 3 === 0) {
      const cx = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
      for (let i = 0; i < 3; i++) {
        this.pool.spawn({ type: "flame", x: cx + rndInt(-50, 50), y: this.spawnY - rndInt(0, 40), vx: (rng() - 0.5) * 1.2, vy: -rng() * 3 - 1.5, life: 44, size: 10 + rng() * 16, color: rndChoice(["#ff5500", "#ff8800", "#ffcc33"]) });
      }
    }
    this.focusX = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
  }

  _updateSwirl() {
    // "Ngọn lửa xoáy quanh nhân vật rồi bùng nổ."
    if (this.internalFrame % 2 === 0) {
      const ang = this.internalFrame * 0.35, cx = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
      for (let k = 0; k < 2; k++) {
        const a = ang + k * Math.PI;
        const rad = 55 + Math.sin(this.internalFrame * 0.08) * 12;
        this.pool.spawn({ type: "flame", x: cx + Math.cos(a) * rad, y: this.spawnY - 90 + Math.sin(a) * rad * 0.6, vx: -Math.sin(a) * 1.4, vy: Math.cos(a) * 0.6 - 0.6, life: 30, size: 9 + rng() * 8, color: rndChoice(["#ff5500", "#ff8800", "#ffdd55"]) });
      }
    }
  }

  _triggerExplode() {
    // "Ngọn lửa ... rồi bùng nổ." — big detonation, the character is consumed into it.
    const cx = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
    this.fireCharacter = null; // consumed into the eruption — never becomes the boss directly
    this.lavaJets = [];
    this.staffGlowAlpha = 0;
    screenShake = Math.max(screenShake, 11); // the single biggest beat of the whole cinematic, still ~65% below the old peak
    this.flash = { alpha: 0.85, duration: 16 };
    sfxInfernoBurst?.();
    for (let i = 0; i < 26; i++) {
      const ang = rng() * Math.PI * 2, spd = rng() * 7 + 3;
      this.pool.spawn({ type: "flame", x: cx, y: this.spawnY - 90, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 2, life: 55, size: 12 + rng() * 16, color: rndChoice(["#ff4400", "#ff8800", "#ffcc33", "#ffffff"]) });
    }
    for (let i = 0; i < 34; i++) { // haze covering the whole screen
      this.pool.spawn({ type: "haze", x: cx + rndInt(-260, 260), y: this.spawnY - rndInt(0, 220), vx: (rng() - 0.5) * 1.2, vy: -rng() * 0.6, life: 120, size: 55 + rng() * 55, color: rndChoice(["#7a2a10", "#a03a10", "#5a1c0a"]) });
    }
  }

  _updateExplode() {
    // Hold on the detonation for a beat before the flame settles into FlameFade.
  }

  _spawnBoss() {
    // The real Flame Lord boss, hidden inside the dying flame — mirrors
    // _spawnBoss() in the other intro managers. HP bar stays hidden until BattleStart.
    this.boss = new Boss(6, this.spawnX, this.spawnY);
    this.boss.direction = -1;
    this.boss._introHideHp = true;
    this.hazeAlpha = 1.0;
    this.bossRevealAlpha = 0;
  }

  _updateFlameFade() {
    // "Khi lửa tan, Flame Lord xuất hiện với hiệu ứng lửa cháy quanh người."
    const p = this.stateTimer / this.FSM.FlameFade.duration;
    this.hazeAlpha = Math.max(0, 1 - Math.max(0, p - 0.15) * 1.3);
    this.flameColumnAlpha = Math.max(0, 1 - p * 1.5);
    this.bossRevealAlpha = Math.min(1, Math.max(0, p - 0.1) * 1.4);
    if (this.boss) this.boss.anim++;
    if (rng() < 0.5) this.pool.spawn({ type: "flame", x: this.spawnX + rndInt(-90, 90), y: this.spawnY - rndInt(0, 150), vx: (rng() - 0.5) * 0.7, vy: -rng() * 0.6 - 0.2, life: 46, size: 14 + rng() * 14, color: rndChoice(["#ff5500", "#ff8800"]) });
  }

  _triggerRoarBurst() {
    // "Hiển thị tên Boss thật hoành tráng."
    screenShake = Math.max(screenShake, 5); // was 18 — a firm punctuation beat, not a shudder
    this.zoom = 1.16;
    sfxFlameRoar?.();
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 4 + 3;
      this.pool.spawn({ type: "flame", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 34, size: 5 + rng() * 5, color: rndChoice(["#ff8800", "#ffcc33"]) });
    }
    this.titleDelay = 10;
  }

  _updateRoar() {
    if (this.boss) this.boss.anim++;
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 10;
    const showDur = this.FSM.Roar.duration - 10;
    if (t >= 0) {
      this.showTitle = true;
      if (t < 16) this.titleAlpha = t / 16;
      else if (t > showDur - 18) this.titleAlpha = Math.max(0, (showDur - t) / 18);
      else this.titleAlpha = 1;
    }
    if (this.stateTimer > showDur * 0.6) this.zoom += (1.0 - this.zoom) * 0.02;
  }

  _updateBattleStart() {
    this.zoom += (1.0 - this.zoom) * 0.15;
    screenShake *= 0.5;
  }

  // ---------------- drawing ----------------
  // World-space visuals (must be called INSIDE the camera translate/zoom).
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    this._drawClouds(ctx);
    if (this.crackAlpha > 0 && (this.state === "Cracks" || this.state === "LavaErupt" || this.state === "WalkOut")) this._drawCracks(ctx);
    this.lavaJets.forEach(j => this._drawLavaJet(ctx, j));
    if (this.flameColumnAlpha > 0 && (this.state === "FlameBurst" || this.state === "Swirl" || this.state === "FlameFade")) this._drawFlameColumn(ctx);
    if (this.fireCharacter) {
      // A genuine fire-element character in its own true colors — NOT a black
      // silhouette — with a warm emissive glow so it visibly reads as fire.
      ctx.save();
      ctx.shadowColor = "#ff5500"; ctx.shadowBlur = 22;
      ctx.filter = "brightness(1.08) saturate(1.25)";
      this.fireCharacter.draw(0, 0);
      ctx.restore();
      if (this.staffGlowAlpha > 0) this._drawStaffGlow(ctx, this.fireCharacter.x);
    }
    this._drawPool(ctx);
    if (this.boss && (this.state === "FlameFade" || this.state === "Roar" || this.state === "BattleStart")) {
      this._drawBossReveal(ctx);
    }
  }

  // Screen-space overlays (must be called OUTSIDE the camera transform — a
  // fixed full-screen darken / flash / haze wash / title card should not
  // drift with the camera).
  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.darkAlpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(0,0,0,${this.darkAlpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.skyAlpha > 0) { // "Bầu trời chuyển đỏ"
      ctx.save();
      const grad = ctx.createLinearGradient(0, 0, 0, H * 0.6);
      grad.addColorStop(0, `rgba(120,10,0,${this.skyAlpha})`);
      grad.addColorStop(1, `rgba(120,10,0,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.flash && this.flash.alpha > 0) {
      ctx.save();
      ctx.fillStyle = `rgba(255,200,120,${this.flash.alpha})`;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this.flash.alpha -= 1 / this.flash.duration;
    }
    if (this.hazeAlpha > 0 && (this.state === "Explode" || this.state === "FlameFade")) {
      ctx.save();
      ctx.globalAlpha = this.hazeAlpha * 0.5;
      ctx.fillStyle = "#a03a10";
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawClouds(ctx) {
    if (this.skyAlpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = Math.min(0.65, this.skyAlpha * 1.2);
    ctx.fillStyle = "#1a0e0a";
    this.cloudList.forEach(c => {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.w * 0.4, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + c.w * 0.6, c.y + 8, c.w * 0.7, c.w * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  _drawCracks(ctx) {
    ctx.save();
    ctx.globalAlpha = this.crackAlpha;
    ctx.strokeStyle = "#ff5500";
    ctx.shadowColor = "#ff3300"; ctx.shadowBlur = 8;
    ctx.lineWidth = 2.5;
    this.crackList.forEach(c => {
      const ox = this.spawnX, oy = this.spawnY;
      const ex = ox + Math.cos(c.angle) * c.len, ey = oy + Math.sin(c.angle) * c.len * 0.22 + 4;
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ex, ey); ctx.stroke();
    });
    ctx.restore();
  }

  _drawLavaJet(ctx, j) {
    if (j.growT <= 0) return;
    const h = j.height * Math.min(1, j.growT);
    ctx.save();
    ctx.globalAlpha = Math.min(1, j.growT * 1.5);
    ctx.shadowColor = "#ff5500"; ctx.shadowBlur = 12;
    const grad = ctx.createLinearGradient(j.x, this.spawnY, j.x, this.spawnY - h);
    grad.addColorStop(0, "#ffcc33"); grad.addColorStop(1, "rgba(255,68,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(j.x - 9, this.spawnY); ctx.lineTo(j.x, this.spawnY - h); ctx.lineTo(j.x + 9, this.spawnY);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _drawStaffGlow(ctx, cx) {
    // Symbolic beam of gathering energy above the raised arms/staff.
    ctx.save();
    ctx.globalAlpha = this.staffGlowAlpha * 0.7;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createLinearGradient(cx, this.spawnY - 300, cx, this.spawnY - 150);
    grad.addColorStop(0, "rgba(255,220,140,0.9)");
    grad.addColorStop(1, "rgba(255,90,0,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - 6, this.spawnY - 300, 12, 150);
    ctx.restore();
  }

  _drawFlameColumn(ctx) {
    const cx = this.fireCharacter ? this.fireCharacter.x : this.spawnX;
    ctx.save();
    ctx.globalAlpha = this.flameColumnAlpha;
    ctx.globalCompositeOperation = "lighter";
    const grad = ctx.createRadialGradient(cx, this.spawnY - 90, 10, cx, this.spawnY - 90, 130);
    grad.addColorStop(0, "rgba(255,230,150,0.9)");
    grad.addColorStop(0.5, "rgba(255,110,20,0.55)");
    grad.addColorStop(1, "rgba(255,60,0,0)");
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, this.spawnY - 90, 130, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "haze") {
        ctx.globalAlpha = a * 0.35;
        ctx.fillStyle = it.color || "#a03a10";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === "ash") {
        ctx.globalAlpha = a * 0.3;
        ctx.fillStyle = it.color || "#4a3a30";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === "flame") {
        ctx.globalAlpha = a; ctx.shadowColor = "#ff5500"; ctx.shadowBlur = 10;
        ctx.fillStyle = it.color || "#ff5500";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      } else if (it.type === "ember" || it.type === "spark") {
        ctx.globalAlpha = Math.min(1, a + 0.15); ctx.shadowColor = "#ff8800"; ctx.shadowBlur = 6;
        ctx.fillStyle = it.color || "#ffaa00";
        ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  _drawBossReveal(ctx) {
    const b = this.boss;
    const revealAlpha = (this.state === "FlameFade") ? (this.bossRevealAlpha ?? 0) : 1;
    ctx.save(); ctx.globalAlpha = revealAlpha;
    b.draw(); // the real Flame Lord body — draw() itself skips the HP bar while _introHideHp is set
    ctx.restore();
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#ff6600";
    ctx.font = "bold 48px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(255,90,0,0.85)"; ctx.shadowBlur = 24;
    ctx.fillText("🔥 FLAME LORD 🔥", W / 2, H / 2 - 30);
    ctx.font = "bold 22px Arial";
    ctx.fillText("PHÁP SƯ LỬA — CHÚA TỂ HỎA DIỆM", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

// ================================================================
//  ABYSSAL BOSS INTRO MANAGER — THE ABYSSAL CINEMATIC (Boss 4 only)
//  ----------------------------------------------------------------
//  Same public interface as BossIntroManager / EarthBossIntroManager /
//  FlameBossIntroManager: start(), update(), .boss, .focusX, .zoom,
//  drawWorld(ctx,w,h), drawScreen(ctx,w,h). Deliberately built from
//  completely different beats than the other three (no rising
//  element-character, no impact/explosion) — a rift tears open in
//  the distance, a shadow arm reaches out then withdraws, the camera
//  swings behind the player where The Abyssal is already standing
//  motionless, then a quick flash-cut drops it into the arena.
//  Total runtime ≈ 9.5s, inside the requested 9-11s window.
// ================================================================
class AbyssalBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.riftX = spawnX + 260;
    this.riftY = spawnY - 90;
    this.riftWidth = 0;
    this.riftAlpha = 0;
    this.armReach = 0;

    this.boss = null;           // the real Boss(4,...) — The Abyssal
    this.eyeOpen = 0;
    this.ringExpand = 0;
    this.flash = null;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;
    this.darkness = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(140);
    this._audioThrottle = 0;

    this.FSM = {
      Darken:       { duration: 65,  next: "RiftOpen" },     // screen dims, sound fades
      RiftOpen:     { duration: 95,  next: "ArmReach" },      // a rift tears open far away
      ArmReach:     { duration: 75,  next: "BehindPlayer" },  // a shadow arm reaches out, then withdraws
      BehindPlayer: { duration: 130, next: "FlashCut" },      // camera swings behind the player — Abyssal is already there
      FlashCut:     { duration: 20,  next: "ArenaReveal" },   // quick flash, boss now in the arena
      ArenaReveal:  { duration: 50,  next: "Roar" },
      Roar:         { duration: 110, next: "BattleStart" },   // head rises, dark ring, title, HP bar
      BattleStart:  { duration: 20,  next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Darken";
    this.stateTimer = 0;
    this.focusX = this.spawnX;
  }

  update() {
    this.internalFrame++;
    this.stateTimer++;
    if (this.state !== "IDLE" && this.state !== "COMPLETE") {
      const cfg = this.FSM[this.state];
      if (cfg && this.stateTimer >= cfg.duration) {
        this.state = cfg.next;
        this.stateTimer = 0;
        this._onEnterState(this.state);
        if (this.state === "COMPLETE") return { finished: true };
      }
    }
    switch (this.state) {
      case "Darken":       this._updateDarken(); break;
      case "RiftOpen":     this._updateRiftOpen(); break;
      case "ArmReach":     this._updateArmReach(); break;
      case "BehindPlayer": this._updateBehindPlayer(); break;
      case "FlashCut":     break; // purely visual, handled in drawScreen via this.flash
      case "ArenaReveal":  this._updateArenaReveal(); break;
      case "Roar":         this._updateRoar(); break;
      case "BattleStart":  this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "RiftOpen") {
      sfxVoidCrack?.(); sfxShadowWhisper?.();
    } else if (state === "ArmReach") {
      sfxVoidPulse?.();
    } else if (state === "BehindPlayer") {
      this._spawnBoss();
      sfxShadowTeleport?.();
    } else if (state === "FlashCut") {
      this.flash = { alpha: 1, duration: 14 };
      sfxShadowTeleport?.();
    } else if (state === "ArenaReveal") {
      if (this.boss) { this.boss.x = this.spawnX; this.boss.y = this.spawnY; this.boss.direction = -1; }
      this.focusX = this.spawnX;
    } else if (state === "Roar") {
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó thanh máu xuất hiện"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateDarken() {
    // "Màn hình bắt đầu tối dần. Âm thanh và nhạc nền giảm xuống."
    const p = this.stateTimer / this.FSM.Darken.duration;
    this.darkness = Math.min(0.55, p * 0.6);
    if (this.internalFrame % 9 === 0) {
      this.pool.spawn({ type: "mist", x: this.riftX + rndInt(-40, 40), y: this.riftY + rndInt(-20, 20), vx: (rng() - 0.5) * 0.3, vy: -rng() * 0.2, life: 70, size: 16 + rng() * 14, color: "#180022" });
    }
  }

  _updateRiftOpen() {
    // "Một vùng bóng tối xuất hiện ở phía xa — vết nứt trong không gian, từ từ mở rộng."
    const p = this.stateTimer / this.FSM.RiftOpen.duration;
    this.riftAlpha = Math.min(1, p * 1.6);
    this.riftWidth = Math.min(120, p * 130);
    if (this.stateTimer % 10 === 0) { sfxVoidCrack?.(); screenShake = Math.max(screenShake, 2); }
    if (this.internalFrame % 3 === 0) {
      const ang = rng() * Math.PI * 2;
      this.pool.spawn({ type: "spark", x: this.riftX, y: this.riftY, vx: Math.cos(ang) * (1 + rng() * 2), vy: Math.sin(ang) * (1 + rng() * 2) * 0.6, life: 44, size: 2 + rng() * 3, color: rndChoice(["#7a1fb8", "#2a0a40", "#c060ff"]) });
    }
  }

  _updateArmReach() {
    // "Một cánh tay của sinh vật bóng tối từ từ xuất hiện từ bên trong vết nứt. Sau đó biến mất."
    const dur = this.FSM.ArmReach.duration, half = dur * 0.55;
    if (this.stateTimer < half) this.armReach = this.stateTimer / half;
    else this.armReach = Math.max(0, 1 - (this.stateTimer - half) / (dur - half));
    if (this.stateTimer === Math.floor(half)) { screenShake = Math.max(screenShake, 5); sfxVoidPulse?.(); }
  }

  _spawnBoss() {
    // The real Abyssal boss, standing motionless behind the player.
    this.boss = new Boss(4, this.spawnX, this.spawnY);
    this.boss._introHideHp = true;
    const behindX = clamp(p1.x + (p1.direction === 1 ? -90 : 90), 60, 99999);
    this.boss.x = behindX; this.boss.y = this.spawnY;
    this.boss.direction = p1.x >= this.boss.x ? 1 : -1;
    this.boss._introAlpha = 0;
  }

  _updateBehindPlayer() {
    // "Camera từ từ quay sang phía sau nhân vật. Boss chỉ đứng im. Một con mắt phát sáng từ từ mở ra."
    const p = this.stateTimer / this.FSM.BehindPlayer.duration;
    this.focusX += (p1.x - this.focusX) * 0.06;
    if (this.boss) {
      this.boss.anim++;
      this.boss._introAlpha = Math.min(1, p * 3);
      this.boss.direction = p1.x >= this.boss.x ? 1 : -1;
      this.eyeOpen = Math.min(1, Math.max(0, (p - 0.35) / 0.5));
    }
    if (p > 0.7 && this.internalFrame % 14 === 0) screenShake = Math.max(screenShake, 3);
  }

  _updateArenaReveal() {
    if (this.boss) { this.boss.anim++; this.boss._introAlpha = 1; }
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 18);
    this.zoom = 1.15;
    sfxAbyssRoar?.();
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 4 + 2;
      this.pool.spawn({ type: "ring", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, life: 40, size: 3 + rng() * 3, color: "#a020f0" });
    }
    this.titleDelay = 14;
  }

  _updateRoar() {
    if (this.boss) this.boss.anim++;
    this.ringExpand = Math.min(1, this.ringExpand + 0.02);
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 14, showDur = this.FSM.Roar.duration - 14;
    if (t >= 0) {
      this.showTitle = true;
      if (t < 18) this.titleAlpha = t / 18;
      else if (t > showDur - 22) this.titleAlpha = Math.max(0, (showDur - t) / 22);
      else this.titleAlpha = 1;
    }
    if (this.stateTimer > showDur * 0.6) this.zoom += (1.0 - this.zoom) * 0.02;
  }

  _updateBattleStart() {
    this.zoom += (1.0 - this.zoom) * 0.15;
    screenShake *= 0.5;
    this.darkness = Math.max(0, this.darkness - 0.03);
  }

  // ---------------- drawing ----------------
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.riftAlpha > 0 && (this.state === "RiftOpen" || this.state === "ArmReach")) this._drawRift(ctx);
    if (this.armReach > 0 && this.state === "ArmReach") this._drawArm(ctx);
    this._drawPool(ctx);
    if (this.boss && ["BehindPlayer", "ArenaReveal", "Roar", "BattleStart"].includes(this.state)) {
      ctx.save(); ctx.globalAlpha = this.boss._introAlpha ?? 1;
      this.boss.draw();
      ctx.restore();
      if (this.state === "Roar" || this.state === "BattleStart") {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.ringExpand) * 0.7;
        ctx.strokeStyle = "#a020f0"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(this.boss.x, this.boss.y, 40 + this.ringExpand * 220, 16 + this.ringExpand * 70, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.darkness > 0) { ctx.save(); ctx.globalAlpha = this.darkness; ctx.fillStyle = "#050008"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (this.flash && this.flash.alpha > 0) {
      ctx.save(); ctx.fillStyle = `rgba(10,0,20,${this.flash.alpha})`; ctx.fillRect(0, 0, W, H); ctx.restore();
      this.flash.alpha -= 1 / this.flash.duration;
    }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawRift(ctx) {
    ctx.save();
    ctx.globalAlpha = this.riftAlpha;
    const grad = ctx.createLinearGradient(this.riftX, this.riftY - this.riftWidth, this.riftX, this.riftY + this.riftWidth);
    grad.addColorStop(0, "#000000"); grad.addColorStop(0.5, "#3a0a55"); grad.addColorStop(1, "#000000");
    ctx.strokeStyle = grad; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(this.riftX + 4, this.riftY - this.riftWidth);
    ctx.lineTo(this.riftX - 8, this.riftY);
    ctx.lineTo(this.riftX + 4, this.riftY + this.riftWidth);
    ctx.moveTo(this.riftX - 4, this.riftY - this.riftWidth);
    ctx.lineTo(this.riftX + 8, this.riftY);
    ctx.lineTo(this.riftX - 4, this.riftY + this.riftWidth);
    ctx.stroke();
    ctx.fillStyle = "#000";
    ctx.beginPath(); ctx.ellipse(this.riftX, this.riftY, 10, this.riftWidth * 0.9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  _drawArm(ctx) {
    const a = this.armReach;
    ctx.save();
    ctx.globalAlpha = Math.min(1, a * 1.4);
    ctx.strokeStyle = "#150022"; ctx.fillStyle = "#20002e"; ctx.lineWidth = 10;
    const ex = this.riftX - 70 * a, ey = this.riftY + 30 * a;
    ctx.beginPath(); ctx.moveTo(this.riftX, this.riftY); ctx.quadraticCurveTo(this.riftX - 40 * a, this.riftY - 10, ex, ey); ctx.stroke();
    ctx.beginPath(); ctx.arc(ex, ey, 7, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 4; i++) {
      const fx = ex - Math.cos(i * 0.5) * 14 * a, fy = ey + Math.sin(i * 0.5) * 14 * a;
      ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(fx, fy); ctx.stroke();
    }
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "mist") { ctx.globalAlpha = a * 0.35; ctx.fillStyle = it.color || "#20002e"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      else if (it.type === "spark") { ctx.globalAlpha = a; ctx.fillStyle = it.color || "#a020f0"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      else if (it.type === "ring") { ctx.globalAlpha = a * 0.8; ctx.fillStyle = it.color || "#a020f0"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#c060ff";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(120,20,180,0.9)"; ctx.shadowBlur = 22;
    ctx.fillText("🌑 THE ABYSSAL 🌑", W / 2, H / 2 - 30);
    ctx.font = "bold 20px Arial";
    ctx.fillText("BOSS HỆ BÓNG TỐI", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

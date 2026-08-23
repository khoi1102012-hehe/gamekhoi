// ================================================================
//  TEMPEST BOSS INTRO CINEMATIC (Boss 5 — THE TEMPEST, wind/speed boss)
//  Same generic hookup as BossIntroManager/EarthBossIntroManager/
//  FlameBossIntroManager/AbyssalBossIntroManager above (bossIntroManager,
//  challengeBossIntroState, INTRO_RUNNING/INTRO_DONE) — only the manager
//  class + visuals differ. Follows the 6-phase spec exactly:
//  gentle breeze -> wind builds (player buffeted slightly) -> a small
//  tornado forms center-arena and grows -> a silhouette appears inside it
//  -> a powerful gust clears the dust and reveals the Tempest hovering
//  -> eyes open, a wind ring expands, title + HP bar.
// ================================================================
class TempestBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.boss = null; // the real Boss(5,...) — The Tempest

    this.tornadoR = 0;
    this.tornadoSpin = 0;
    this.gustFlash = 0;
    this.ringExpand = 0;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(160);
    this._audioThrottle = 0;

    this.FSM = {
      Breeze:      { duration: 70,  next: "Buildup" },      // gió nhẹ bắt đầu, bụi/lá bắt đầu bay
      Buildup:     { duration: 90,  next: "TornadoForm" },  // gió mạnh dần, nhân vật bị ảnh hưởng nhẹ
      TornadoForm: { duration: 110, next: "Silhouette" },   // lốc nhỏ giữa arena, lớn dần, cuốn đất/bụi
      Silhouette:  { duration: 90,  next: "GustClear" },    // bóng người trong lốc, lốc xoáy mạnh hơn
      GustClear:   { duration: 55,  next: "EyesOpen" },     // gió cực mạnh thổi bụi sang hai bên, Boss lộ ra, lơ lửng
      EyesOpen:    { duration: 110, next: "BattleStart" },  // mở mắt, vòng gió lan ra, hiện tên
      BattleStart: { duration: 20,  next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Breeze";
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
      case "Breeze":      this._updateBreeze(); break;
      case "Buildup":     this._updateBuildup(); break;
      case "TornadoForm": this._updateTornadoForm(); break;
      case "Silhouette":  this._updateSilhouette(); break;
      case "GustClear":   this._updateGustClear(); break;
      case "EyesOpen":    this._updateEyesOpen(); break;
      case "BattleStart": this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "Buildup") {
      sfxWindGust?.();
    } else if (state === "TornadoForm") {
      sfxTornadoSwirl?.();
    } else if (state === "Silhouette") {
      this._spawnBoss();
    } else if (state === "GustClear") {
      this.gustFlash = 1;
      sfxWindDash?.();
    } else if (state === "EyesOpen") {
      if (this.boss) { this.boss.x = this.spawnX; this.boss.y = this.spawnY; this.boss.direction = -1; }
      this.focusX = this.spawnX;
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó thanh máu xuất hiện"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateBreeze() {
    // "Mọi thứ trong arena bắt đầu có gió nhẹ. Các hạt bụi, lá bắt đầu bay."
    if (this.internalFrame % 6 === 0) {
      this.pool.spawn({ type: "leaf", x: this.spawnX + rndInt(-260, 260), y: this.spawnY - rndInt(0, 60), vx: 0.6 + rng() * 0.8, vy: -rng() * 0.3, life: 70, size: 2 + rng() * 3, color: rndChoice(["#bfe08a", "#e8e8e8", "#cfe8f5"]) });
    }
  }

  _updateBuildup() {
    // "Gió mạnh dần. Nhân vật người chơi bị ảnh hưởng nhẹ bởi gió."
    if (this.internalFrame % 4 === 0) {
      this.pool.spawn({ type: "leaf", x: this.spawnX + rndInt(-320, 320), y: this.spawnY - rndInt(0, 90), vx: 1.2 + rng() * 1.6, vy: -rng() * 0.4, life: 60, size: 2 + rng() * 3, color: rndChoice(["#bfe08a", "#e8e8e8", "#cfe8f5"]) });
    }
    // A small, capped cosmetic buffet — player input is already frozen during
    // the intro, so this just visually sways them without breaking anything.
    if (p1) p1.x = clamp(p1.x + Math.sin(this.internalFrame * 0.2) * 0.4, 40, 99999);
  }

  _updateTornadoForm() {
    // "Một cơn lốc nhỏ xuất hiện ở giữa arena. Cơn lốc lớn dần. Đất và bụi bị cuốn lên."
    const p = this.stateTimer / this.FSM.TornadoForm.duration;
    this.tornadoR = p * 70;
    if (this.stateTimer % 22 === 0) sfxTornadoSwirl?.();
    if (this.internalFrame % 3 === 0) {
      const ang = rng() * Math.PI * 2, r = this.tornadoR * 0.9;
      this.pool.spawn({ type: "dust", x: this.spawnX + Math.cos(ang) * r, y: this.spawnY - rng() * 40, vx: Math.cos(ang + 1.5) * 1.5, vy: -rng() * 1.2, life: 40, size: 2 + rng() * 4, color: "#cfe8f5" });
    }
  }

  _updateSilhouette() {
    // "Một bóng người xuất hiện bên trong cơn lốc. Cơn lốc xoáy mạnh hơn."
    if (this.boss) this.boss.anim++;
    const p = this.stateTimer / this.FSM.Silhouette.duration;
    this.tornadoR = 70 + p * 20;
    this.tornadoSpin += 0.12 + p * 0.1;
    if (this.boss) this.boss._introAlpha = Math.min(0.4, p * 0.5);
    if (this.stateTimer % 16 === 0) screenShake = Math.max(screenShake, 3);
  }

  _spawnBoss() {
    // The real Tempest boss, hidden inside the tornado — mirrors the
    // "hidden inside the mist/cloud" pattern used by the other bosses.
    this.boss = new Boss(5, this.spawnX, this.spawnY);
    this.boss._introHideHp = true;
    this.boss._introAlpha = 0;
    this.boss.direction = -1;
  }

  _updateGustClear() {
    // "Một luồng gió cực mạnh thổi toàn bộ bụi sang hai bên. The Tempest
    //  xuất hiện giữa arena, lơ lửng nhẹ trên mặt đất."
    if (this.boss) this.boss.anim++;
    const p = this.stateTimer / this.FSM.GustClear.duration;
    this.tornadoR = Math.max(0, 90 - p * 90);
    if (this.boss) this.boss._introAlpha = Math.min(1, 0.4 + p * 1.2);
    if (this.gustFlash > 0) this.gustFlash -= 1 / this.FSM.GustClear.duration;
    if (this.internalFrame % 2 === 0) {
      const dir = rndChoice([-1, 1]);
      this.pool.spawn({ type: "dust", x: this.spawnX, y: this.spawnY - rndInt(10, 80), vx: dir * (3 + rng() * 3), vy: -rng() * 0.5, life: 34, size: 2 + rng() * 4, color: "#e8f6ff" });
    }
    if (this.stateTimer === Math.floor(this.FSM.GustClear.duration * 0.4)) screenShake = Math.max(screenShake, 10);
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 16);
    this.zoom = 1.12;
    sfxStormRoar?.();
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 4 + 2;
      this.pool.spawn({ type: "ring", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.6, life: 40, size: 3 + rng() * 3, color: "#eaffff" });
    }
    this.titleDelay = 14;
  }

  _updateEyesOpen() {
    // "Boss mở mắt. Một vòng gió lan ra xung quanh. Hiển thị THE TEMPEST."
    if (this.boss) this.boss.anim++;
    this.ringExpand = Math.min(1, this.ringExpand + 0.02);
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 14, showDur = this.FSM.EyesOpen.duration - 14;
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
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    this._drawPool(ctx);
    if (this.tornadoR > 0 && ["TornadoForm", "Silhouette", "GustClear"].includes(this.state)) this._drawTornado(ctx);
    if (this.boss && ["Silhouette", "GustClear", "EyesOpen", "BattleStart"].includes(this.state)) {
      ctx.save(); ctx.globalAlpha = this.boss._introAlpha ?? 1;
      this.boss.draw();
      ctx.restore();
      if (this.state === "EyesOpen" || this.state === "BattleStart") {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.ringExpand) * 0.7;
        ctx.strokeStyle = "#eaffff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(this.boss.x, this.boss.y, 40 + this.ringExpand * 220, 16 + this.ringExpand * 70, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.gustFlash > 0) { ctx.save(); ctx.globalAlpha = this.gustFlash * 0.4; ctx.fillStyle = "#eaf6ff"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawTornado(ctx) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 4; i++) {
      const yy = this.spawnY - i * 30, rr = this.tornadoR * (1 - i * 0.18);
      ctx.strokeStyle = "#cfe8f5"; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(this.spawnX, yy, rr, rr * 0.4, 0, this.tornadoSpin + i, this.tornadoSpin + i + 4.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "leaf" || it.type === "dust") { ctx.globalAlpha = a * 0.6; ctx.fillStyle = it.color || "#cfe8f5"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      else if (it.type === "ring") { ctx.globalAlpha = a * 0.8; ctx.fillStyle = it.color || "#eaffff"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#eaffff";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(160,220,255,0.9)"; ctx.shadowBlur = 22;
    ctx.fillText("🌪️ THE TEMPEST 🌪️", W / 2, H / 2 - 30);
    ctx.font = "bold 20px Arial";
    ctx.fillText("BOSS HỆ GIÓ", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

// ================================================================
//  TIDAL BOSS INTRO CINEMATIC (Boss 6 — THE TIDAL, water/tide boss)
//  Same generic hookup as BossIntroManager/EarthBossIntroManager/
//  FlameBossIntroManager/AbyssalBossIntroManager/TempestBossIntroManager
//  above (bossIntroManager, challengeBossIntroState, INTRO_RUNNING/
//  INTRO_DONE) — only the manager class + visuals differ. Follows the
//  6-phase spec: an ancient geometric water-god statue stands ->
//  cracks appear -> cracks spread and water leaks out -> the statue
//  shatters -> a giant water column erupts and The Tidal emerges from
//  within -> Boss raises its trident, a water ring expands, title +
//  HP bar appear.
// ================================================================
class TidalBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.boss = null; // the real Boss(7,...) — The Tidal

    this.crackLevel = 0;
    this.columnH = 0;
    this.gustFlash = 0;
    this.ringExpand = 0;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(160);
    this._audioThrottle = 0;

    this.FSM = {
      StatueStand:  { duration: 65,  next: "CracksAppear" },  // tượng đứng yên, nước chảy nhẹ xung quanh
      CracksAppear: { duration: 85,  next: "CracksSpread" },  // đường nứt xanh xuất hiện, khối rung nhẹ
      CracksSpread: { duration: 95,  next: "StatueBreak" },   // vết nứt lan rộng, nước tràn ra, khối tách khỏi tượng
      StatueBreak:  { duration: 65,  next: "WaterErupt" },    // tượng vỡ, mảnh khối hình học bay ra
      WaterErupt:   { duration: 85,  next: "Reveal" },        // cột nước lớn phun lên, The Tidal xuất hiện bên trong
      Reveal:       { duration: 110, next: "BattleStart" },   // nâng đinh ba, vòng nước lan rộng, hiện tên
      BattleStart:  { duration: 20,  next: "COMPLETE" }
    };
  }

  start() {
    this.state = "StatueStand";
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
      case "StatueStand":  this._updateStatueStand(); break;
      case "CracksAppear": this._updateCracksAppear(); break;
      case "CracksSpread": this._updateCracksSpread(); break;
      case "StatueBreak":  this._updateStatueBreak(); break;
      case "WaterErupt":   this._updateWaterErupt(); break;
      case "Reveal":       this._updateReveal(); break;
      case "BattleStart":  this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "CracksAppear") {
      sfxEarthCrack?.();
    } else if (state === "CracksSpread") {
      sfxWaterSurge?.();
    } else if (state === "StatueBreak") {
      sfxRockImpact?.();
    } else if (state === "WaterErupt") {
      this._spawnBoss();
      sfxWaterSurge?.();
    } else if (state === "Reveal") {
      if (this.boss) { this.boss.x = this.spawnX; this.boss.y = this.spawnY; this.boss.direction = -1; }
      this.focusX = this.spawnX;
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó thanh máu xuất hiện"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateStatueStand() {
    // "Giữa arena xuất hiện một bức tượng Thủy Thần khổng lồ. Tượng đứng yên. Xung quanh có nước chảy nhẹ."
    if (this.internalFrame % 8 === 0) {
      this.pool.spawn({ type: "droplet", x: this.spawnX + rndInt(-50, 50), y: this.spawnY - rndInt(0, 130), vx: (rng() - 0.5) * 0.4, vy: 0.4 + rng() * 0.4, life: 55, size: 2 + rng() * 3, color: "#aef2ff" });
    }
  }

  _updateCracksAppear() {
    // "Các đường nứt màu xanh bắt đầu xuất hiện trên bức tượng. Các khối nhỏ rung nhẹ."
    const p = this.stateTimer / this.FSM.CracksAppear.duration;
    this.crackLevel = p * 0.5;
    if (this.stateTimer % 20 === 0) sfxEarthCrack?.();
    if (this.internalFrame % 10 === 0) screenShake = Math.max(screenShake, 2);
  }

  _updateCracksSpread() {
    // "Các vết nứt lan rộng. Nước bắt đầu tràn ra. Một vài khối hình học tách khỏi tượng và lơ lửng."
    const p = this.stateTimer / this.FSM.CracksSpread.duration;
    this.crackLevel = 0.5 + p * 0.5;
    if (this.internalFrame % 3 === 0) {
      this.pool.spawn({ type: "droplet", x: this.spawnX + rndInt(-70, 70), y: this.spawnY - rndInt(20, 160), vx: (rng() - 0.5) * 1.2, vy: -rng() * 0.6, life: 45, size: 2 + rng() * 4, color: "#5fd0f0" });
    }
    if (this.stateTimer % 18 === 0) screenShake = Math.max(screenShake, 4);
  }

  _updateStatueBreak() {
    // "Bức tượng bắt đầu vỡ. Các mảnh khối hình học bay ra xung quanh." (particle-capped to avoid lag)
    if (this.internalFrame % 3 === 0) {
      const ang = rng() * Math.PI * 2, r = 20 + rng() * 40;
      this.pool.spawn({ type: "cube", x: this.spawnX + Math.cos(ang) * r, y: this.spawnY - 80 + Math.sin(ang) * r, vx: Math.cos(ang) * 1.4, vy: -rng() * 1.6, life: 50, size: 3 + rng() * 4, color: rndChoice(["#1590bd", "#2ab8e8", "#aef2ff"]) });
    }
    if (this.stateTimer === Math.floor(this.FSM.StatueBreak.duration * 0.5)) screenShake = Math.max(screenShake, 12);
  }

  _spawnBoss() {
    // The real Tidal boss, hidden inside the erupting water column — mirrors
    // the "hidden inside the mist/tornado" pattern used by the other bosses.
    this.boss = new Boss(7, this.spawnX, this.spawnY);
    this.boss._introHideHp = true;
    this.boss._introAlpha = 0;
    this.boss.direction = -1;
  }

  _updateWaterErupt() {
    // "Một cột nước lớn phun lên từ bên trong bức tượng... Khi nước bắt đầu tan xuống: THE TIDAL xuất hiện bên trong."
    if (this.boss) this.boss.anim++;
    const p = this.stateTimer / this.FSM.WaterErupt.duration;
    this.columnH = p;
    if (this.boss) this.boss._introAlpha = Math.min(1, p * 1.3);
    if (this.internalFrame % 2 === 0) {
      const dir = rndChoice([-1, 1]);
      this.pool.spawn({ type: "droplet", x: this.spawnX + dir * rndInt(0, 20), y: this.spawnY - rndInt(20, 220), vx: dir * (1.5 + rng() * 2), vy: -1.5 - rng() * 1.5, life: 40, size: 2 + rng() * 4, color: rndChoice(["#aef2ff", "#5fd0f0", "#eafcff"]) });
    }
    if (this.stateTimer === Math.floor(this.FSM.WaterErupt.duration * 0.4)) screenShake = Math.max(screenShake, 14);
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 18);
    this.zoom = 1.12;
    sfxTidalRoar?.();
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 4 + 2;
      this.pool.spawn({ type: "ring", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.6, life: 40, size: 3 + rng() * 3, color: "#aef2ff" });
    }
    this.titleDelay = 14;
  }

  _updateReveal() {
    // "Boss từ từ nâng cây đinh ba lên. Một vòng nước lan rộng từ chân Boss... Hiển thị THE TIDAL."
    if (this.boss) this.boss.anim++;
    this.ringExpand = Math.min(1, this.ringExpand + 0.02);
    if (this.boss && this.boss.tridentRaiseTimer <= 0 && this.stateTimer < 30) this.boss.tridentRaiseTimer = 20;
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 14, showDur = this.FSM.Reveal.duration - 14;
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
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (["StatueStand", "CracksAppear", "CracksSpread"].includes(this.state)) this._drawStatue(ctx);
    this._drawPool(ctx);
    if (this.state === "WaterErupt") this._drawWaterColumn(ctx);
    if (this.boss && ["WaterErupt", "Reveal", "BattleStart"].includes(this.state)) {
      ctx.save(); ctx.globalAlpha = this.boss._introAlpha ?? 1;
      this.boss.draw();
      ctx.restore();
      if (this.state === "Reveal" || this.state === "BattleStart") {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.ringExpand) * 0.7;
        ctx.strokeStyle = "#aef2ff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(this.boss.x, this.boss.y, 40 + this.ringExpand * 220, 16 + this.ringExpand * 70, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.gustFlash > 0) { ctx.save(); ctx.globalAlpha = this.gustFlash * 0.4; ctx.fillStyle = "#dff6ff"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawStatue(ctx) {
    // ancient geometric water-god statue, cracking apart — built from flat polygon blocks, no realistic sculpting
    const sx = this.spawnX, sy = this.spawnY;
    ctx.save();
    ctx.fillStyle = "#4a6a78"; ctx.strokeStyle = "#2c4048"; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - 26, sy - 30); ctx.lineTo(sx - 32, sy - 160); ctx.lineTo(sx - 12, sy - 190);
    ctx.lineTo(sx + 12, sy - 190); ctx.lineTo(sx + 32, sy - 160); ctx.lineTo(sx + 26, sy - 30);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    _rect(sx - 16, sy - 215, 32, 28, "#4a6a78", "#2c4048", 3);
    // cracks — spreading blue crack-lines over the statue silhouette
    if (this.crackLevel > 0) {
      ctx.save(); ctx.strokeStyle = `rgba(95,208,240,${Math.min(1, this.crackLevel + 0.2)})`; ctx.lineWidth = 2; ctx.shadowColor = "#5fd0f0"; ctx.shadowBlur = 8;
      const segs = Math.floor(this.crackLevel * 5);
      const paths = [[[-10, -40], [6, -90], [-6, -140]], [[14, -35], [2, -100], [18, -150]], [[-2, -160], [10, -185]]];
      paths.slice(0, segs + 1).forEach(pts => {
        ctx.beginPath(); ctx.moveTo(sx + pts[0][0], sy + pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(sx + pts[i][0], sy + pts[i][1]);
        ctx.stroke();
      });
      ctx.restore();
    }
  }

  _drawWaterColumn(ctx) {
    const sx = this.spawnX, sy = this.spawnY, h = this.columnH * 260;
    ctx.save(); ctx.globalAlpha = 0.55; ctx.fillStyle = "#5fd0f0";
    ctx.fillRect(sx - 30, sy - h, 60, h);
    ctx.globalAlpha = 0.3; ctx.fillStyle = "#aef2ff";
    ctx.fillRect(sx - 16, sy - h, 32, h);
    ctx.restore();
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "droplet") { ctx.globalAlpha = a * 0.7; ctx.fillStyle = it.color || "#aef2ff"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      else if (it.type === "cube") { ctx.globalAlpha = a * 0.7; ctx.fillStyle = it.color || "#5fd0f0"; ctx.translate(it.x, it.y); ctx.rotate(a * 3); ctx.fillRect(-it.size, -it.size, it.size * 2, it.size * 2); }
      else if (it.type === "ring") { ctx.globalAlpha = a * 0.8; ctx.fillStyle = it.color || "#aef2ff"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#aef2ff";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(95,208,240,0.9)"; ctx.shadowBlur = 22;
    ctx.fillText("🌊 THE TIDAL 🌊", W / 2, H / 2 - 30);
    ctx.font = "bold 20px Arial";
    ctx.fillText("BOSS HỆ THỦY", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

// ================================================================
//  VOLTAGE BOSS INTRO CINEMATIC (Boss 7 — THE VOLTAGE, final Lightning
//  boss). Same generic hookup as BossIntroManager/EarthBossIntroManager/
//  FlameBossIntroManager/AbyssalBossIntroManager/TempestBossIntroManager/
//  TidalBossIntroManager above (bossIntroManager, challengeBossIntroState,
//  INTRO_RUNNING/INTRO_DONE) — only the manager class + visuals differ.
//  Follows the 6-phase spec: arena calm, ambient sound fades -> a single
//  lightning strike hits empty ground -> two more strikes, glowing blocks
//  appear each time -> strikes hit the same spot repeatedly, blocks float
//  between the bolts -> the body assembles part by part (legs, torso,
//  arms, head), pieces not fully joined, arcs linking them -> one giant
//  bolt slams down, brief flash + light camera shake -> light fades, THE
//  VOLTAGE stands complete, head slowly rises, a pulse of electricity
//  spreads across the arena, title + HP bar appear.
// ================================================================
class VoltageBossIntroManager {
  constructor(spawnX, spawnY) {
    this.spawnX = spawnX;
    this.spawnY = spawnY;
    this.state = "IDLE";
    this.stateTimer = 0;
    this.internalFrame = 0;

    this.boss = null; // the real Boss(8,...) — The Voltage

    this.flash = 0;
    this.ringExpand = 0;
    this.showTitle = false;
    this.titleAlpha = 0;
    this.titleDelay = 0;

    this.zoom = 1.0;
    this.focusX = spawnX;

    this.pool = new IceFxPool(140);
    this._audioThrottle = 0;

    this.FSM = {
      Calm:              { duration: 70,  next: "FirstStrikes" },       // arena bình thường, âm thanh giảm dần, một tia sét nhỏ đánh xuống
      FirstStrikes:      { duration: 90,  next: "ContinuousStrikes" },  // 2 tia sét nữa, mỗi lần vài khối hình học phát sáng xuất hiện
      ContinuousStrikes: { duration: 90,  next: "BodyForm" },           // sét đánh liên tục cùng vị trí, khối lơ lửng giữa các tia điện
      BodyForm:          { duration: 95,  next: "BigStrike" },          // cơ thể hình thành từng phần: chân, thân, tay, đầu
      BigStrike:         { duration: 40,  next: "Reveal" },             // một tia sét khổng lồ đánh thẳng xuống, màn hình lóe sáng, rung nhẹ
      Reveal:            { duration: 110, next: "BattleStart" },        // Boss ngẩng đầu, xung điện lan ra, hiện tên + thanh máu
      BattleStart:       { duration: 20,  next: "COMPLETE" }
    };
  }

  start() {
    this.state = "Calm";
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
      case "Calm":              this._updateCalm(); break;
      case "FirstStrikes":      this._updateFirstStrikes(); break;
      case "ContinuousStrikes": this._updateContinuousStrikes(); break;
      case "BodyForm":          this._updateBodyForm(); break;
      case "BigStrike":         this._updateBigStrike(); break;
      case "Reveal":            this._updateReveal(); break;
      case "BattleStart":       this._updateBattleStart(); break;
    }
    this.pool.update();
    if (this._audioThrottle > 0) this._audioThrottle--;
    return { finished: this.state === "COMPLETE" };
  }

  _onEnterState(state) {
    if (state === "FirstStrikes") {
      this._spawnBoss(); // the body starts assembling from the very first strikes
      sfxLightningZap?.();
    } else if (state === "ContinuousStrikes") {
      sfxThunderBoom?.();
    } else if (state === "BodyForm") {
      if (this.boss) this.boss._introAlpha = 0.5;
    } else if (state === "BigStrike") {
      screenShake = Math.max(screenShake, 10);
      sfxThunderBoom?.();
    } else if (state === "Reveal") {
      if (this.boss) { this.boss.x = this.spawnX; this.boss.y = this.spawnY; this.boss.direction = -1; this.boss._introAlpha = 1; }
      this.focusX = this.spawnX;
      this._triggerRoarBurst();
    } else if (state === "BattleStart") {
      sfxBossBattleStart?.();
      if (this.boss) this.boss._introHideHp = false; // "Sau đó thanh máu xuất hiện"
      this.zoom = 1.0;
      screenShake = 0;
    }
  }

  // ---------------- per-state update logic ----------------
  _updateCalm() {
    // "Arena đang hoàn toàn bình thường. Âm thanh môi trường giảm dần. Một tia sét nhỏ đánh xuống arena. Không có Boss."
    if (this.stateTimer === Math.floor(this.FSM.Calm.duration * 0.75)) {
      this.pool.spawn({ type: "bolt", x: this.spawnX + rndInt(-30, 30), y: this.spawnY, life: 14, size: 1, color: "#fff45c" });
      screenShake = Math.max(screenShake, 4);
      sfxLightningZap?.();
    }
  }

  _updateFirstStrikes() {
    // "Một tia sét thứ hai đánh xuống. Sau đó tia thứ ba. Mỗi lần sét đánh, một vài khối hình học phát sáng xuất hiện."
    if (this.boss) this.boss.anim++;
    const p = this.stateTimer / this.FSM.FirstStrikes.duration;
    if (this.stateTimer === 20 || this.stateTimer === 60) {
      this.pool.spawn({ type: "bolt", x: this.spawnX + rndInt(-24, 24), y: this.spawnY, life: 14, size: 1, color: "#fff45c" });
      screenShake = Math.max(screenShake, 6); sfxLightningZap?.();
    }
    if (this.internalFrame % 4 === 0) {
      this.pool.spawn({ type: "cube", x: this.spawnX + rndInt(-40, 40), y: this.spawnY - 70 - rndInt(0, 60), vx: (rng() - 0.5) * 0.6, vy: -rng() * 0.4, life: 45, size: 3 + rng() * 3, color: rndChoice(["#fff45c", "#66e0ff", "#ffffff"]) });
    }
    if (this.boss) this.boss._introAlpha = 0.2 + p * 0.15;
  }

  _updateContinuousStrikes() {
    // "Các tia sét bắt đầu đánh liên tục vào cùng một vị trí. Các khối hình học bắt đầu lơ lửng giữa những tia điện."
    if (this.boss) this.boss.anim++;
    if (this.stateTimer % 12 === 0) {
      this.pool.spawn({ type: "bolt", x: this.spawnX + rndInt(-16, 16), y: this.spawnY, life: 12, size: 1, color: rndChoice(["#fff45c", "#66e0ff"]) });
      screenShake = Math.max(screenShake, 3);
      if (this.stateTimer % 24 === 0) sfxLightningZap?.();
    }
    if (this.internalFrame % 3 === 0) {
      const ang = rng() * Math.PI * 2, r = 20 + rng() * 50;
      this.pool.spawn({ type: "cube", x: this.spawnX + Math.cos(ang) * r, y: this.spawnY - 90 + Math.sin(ang) * r, vx: Math.cos(ang) * 0.8, vy: -rng() * 0.6, life: 50, size: 3 + rng() * 4, color: rndChoice(["#fff45c", "#66e0ff", "#ffffff"]) });
    }
  }

  _spawnBoss() {
    // The real Voltage boss, assembled directly from the lightning strikes —
    // no statue/mist stage: it is a creature MADE of electricity, not one
    // that emerges from behind something.
    this.boss = new Boss(8, this.spawnX, this.spawnY);
    this.boss._introHideHp = true;
    this.boss._introAlpha = 0;
    this.boss.direction = -1;
  }

  _updateBodyForm() {
    // "Cơ thể Boss được hình thành từng phần: Chân. Thân. Hai tay. Đầu. Các khối không cần ghép hoàn toàn sát nhau. Tia điện nối chúng lại."
    if (this.boss) this.boss.anim++;
    const p = this.stateTimer / this.FSM.BodyForm.duration;
    if (this.boss) this.boss._introAlpha = Math.min(1, 0.35 + p * 0.5);
    if (this.internalFrame % 3 === 0) {
      this.pool.spawn({ type: "spark", x: this.spawnX + rndInt(-50, 50), y: this.spawnY - 40 - rndInt(0, 140), vx: (rng() - 0.5) * 1.2, vy: -rng() * 1.0, life: 30, size: 2 + rng() * 2, color: "#66e0ff" });
    }
    if (this.stateTimer % 26 === 0) screenShake = Math.max(screenShake, 4);
  }

  _updateBigStrike() {
    // "Một tia sét khổng lồ đánh thẳng xuống Boss. Màn hình lóe sáng trong thời gian rất ngắn. Camera rung nhẹ."
    if (this.boss) this.boss.anim++;
    if (this.stateTimer === 4) {
      this.flash = 1;
      this.pool.spawn({ type: "bolt", x: this.spawnX, y: this.spawnY - 260, life: 16, size: 2, color: "#ffffff" });
    }
    this.flash = Math.max(0, this.flash - 0.06);
  }

  _triggerRoarBurst() {
    screenShake = Math.max(screenShake, 20);
    this.zoom = 1.12;
    sfxVoltageRoar?.();
    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2, spd = rng() * 4 + 2;
      this.pool.spawn({ type: "ring", x: this.spawnX, y: this.spawnY - 100, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd * 0.6, life: 40, size: 3 + rng() * 3, color: "#fff45c" });
    }
    this.titleDelay = 14;
  }

  _updateReveal() {
    // "Boss từ từ ngẩng đầu. Một xung điện lan ra toàn arena. Hiển thị THE VOLTAGE / BOSS HỆ LÔI."
    if (this.boss) this.boss.anim++;
    this.ringExpand = Math.min(1, this.ringExpand + 0.022);
    if (this.titleDelay > 0) { this.titleDelay--; return; }
    const t = this.stateTimer - 14, showDur = this.FSM.Reveal.duration - 14;
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
  drawWorld(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    this._drawPool(ctx);
    if (this.boss && ["FirstStrikes", "ContinuousStrikes", "BodyForm", "BigStrike", "Reveal", "BattleStart"].includes(this.state)) {
      ctx.save(); ctx.globalAlpha = this.boss._introAlpha ?? 1;
      this.boss.draw();
      ctx.restore();
      if (this.state === "Reveal" || this.state === "BattleStart") {
        ctx.save();
        ctx.globalAlpha = Math.max(0, 1 - this.ringExpand) * 0.7;
        ctx.strokeStyle = "#66e0ff"; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(this.boss.x, this.boss.y, 40 + this.ringExpand * 220, 16 + this.ringExpand * 70, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawScreen(ctx, W, H) {
    if (this.state === "IDLE" || !ctx) return;
    if (this.flash > 0) { ctx.save(); ctx.globalAlpha = this.flash * 0.55; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (this.showTitle && this.titleAlpha > 0) this._drawTitle(ctx, W, H);
  }

  _drawPool(ctx) {
    this.pool.forEachActive(it => {
      const a = Math.max(0, it.life / (it.maxLife || it.life || 1));
      ctx.save();
      if (it.type === "bolt") {
        ctx.globalAlpha = a; ctx.strokeStyle = it.color || "#fff45c"; ctx.lineWidth = 3 + it.size;
        ctx.shadowColor = "#66e0ff"; ctx.shadowBlur = 12;
        let px = it.x, py = it.y - 260;
        ctx.beginPath(); ctx.moveTo(px, py);
        for (let i = 1; i <= 5; i++) { py = it.y - 260 + ((it.y - (it.y - 260)) * i / 5); px = it.x + rndInt(-14, 14); ctx.lineTo(px, py); }
        ctx.lineTo(it.x, it.y); ctx.stroke();
      } else if (it.type === "cube") {
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = it.color || "#fff45c"; ctx.translate(it.x, it.y); ctx.rotate(a * 3); ctx.fillRect(-it.size, -it.size, it.size * 2, it.size * 2);
      } else if (it.type === "spark") {
        ctx.globalAlpha = a * 0.85; ctx.strokeStyle = it.color || "#66e0ff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(it.x - it.size, it.y); ctx.lineTo(it.x + it.size, it.y); ctx.moveTo(it.x, it.y - it.size); ctx.lineTo(it.x, it.y + it.size); ctx.stroke();
      } else if (it.type === "ring") {
        ctx.globalAlpha = a * 0.8; ctx.fillStyle = it.color || "#fff45c"; ctx.beginPath(); ctx.arc(it.x, it.y, it.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
  }

  _drawTitle(ctx, W, H) {
    ctx.save();
    ctx.globalAlpha = this.titleAlpha;
    ctx.fillStyle = "#fff45c";
    ctx.font = "bold 46px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(102,224,255,0.9)"; ctx.shadowBlur = 22;
    ctx.fillText("⚡ THE VOLTAGE ⚡", W / 2, H / 2 - 30);
    ctx.font = "bold 20px Arial";
    ctx.fillText("BOSS HỆ LÔI - BOSS CUỐI", W / 2, H / 2 + 20);
    ctx.restore();
  }
}

// Trash-mob stats for every stage are kept equal to stage 1's — only the
// bosses get progressively tougher; the fodder mobs stay a light, uniform
// warm-up in every stage (keeps their existing skin/behavior, just weaker).
const CHALLENGE_ENEMY_CFG = {
  1:{hp:30, spd:2.5, dmg:0.75},
  2:{hp:30, spd:2.5, dmg:0.75},
  3:{hp:30, spd:2.5, dmg:0.75},
  4:{hp:30, spd:2.5, dmg:0.75},
  5:{hp:30, spd:2.5, dmg:0.75},
  6:{hp:30, spd:2.5, dmg:0.75},
  7:{hp:30, spd:2.5, dmg:0.75},
};

// ================================================================
//  ROAD MODE ("ĐƯỜNG ĐI") STATE
// ================================================================
const ROAD_METER_PX = 15; // pixels per in-game meter
let roadState        = "RUN"; // RUN | BOSS | WON | LOST
let roadDistanceM     = 0;
let roadCameraX       = 0;
let roadWalls         = [];
let roadTraps         = [];
let roadEnemies       = [];
let roadBoss          = null;
let roadBossZoneIndex = 0; // 0,1,2 -> which of the 3 main bosses is next
let roadBossTriggersPx = [];
let roadEnemySpawnTimer = 90;
let roadTerrain = null;       // { segLen, heights[] } elevation profile for the whole run
let roadEnemyPlan = [];       // pre-planned {x, caster, elite, spawned} — fixed total count, not endless spam
let roadWallPlan  = [];       // pre-planned {x, hp, spawned} gates
let roadTrapPlan  = [];       // pre-planned {x, type, spawned} hazards

// Physics
const GRAVITY    = 0.7;
const JUMP_POWER = -14;
const FLOOR_Y_RATIO = 0.67;

// ================================================================
//  CANVAS SIZING
// ================================================================
let W, H;
function resizeCanvas() {
  if (platformMode === "MOBILE") {
    // Fixed design resolution (same one the game/UI was built for), scaled
    // via CSS to fit the phone screen. This keeps character size, HUD, and
    // text proportions consistent on every device instead of shrinking the
    // whole game world down to the phone's tiny actual pixel dimensions.
    const DESIGN_W = 1200, DESIGN_H = 700;
    canvas.width  = DESIGN_W;
    canvas.height = DESIGN_H;
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw/DESIGN_W, vh/DESIGN_H);
    canvas.style.width  = Math.round(DESIGN_W*scale) + "px";
    canvas.style.height = Math.round(DESIGN_H*scale) + "px";
  } else {
    const vw = window.innerWidth, vh = window.innerHeight;
    canvas.width  = vw;
    canvas.height = vh;
    canvas.style.width  = vw + "px";
    canvas.style.height = vh + "px";
  }
  W = canvas.width;
  H = canvas.height;
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  if (p1) p1.y = H*FLOOR_Y_RATIO;
  if (p2) p2.y = H*FLOOR_Y_RATIO;
});

// ================================================================
//  TOUCH / VIRTUAL BUTTON STATE
// ================================================================
const touch1 = { left:false, right:false, up:false, down:false, s2:false, s3:false, s4:false, shield:false, v4:false, _joyActive:false };
const touch2 = { left:false, right:false, up:false, down:false, s2:false, s3:false, s4:false, shield:false, v4:false, _joyActive:false };

// ---------- PC key rebinding ----------
// NOTE: Skill 1 ("Chiêu 1") no longer has its own button/key — it fires
// automatically as the "basic attack" whenever the player clicks the mouse,
// presses SPACE, or (on mobile) taps the screen. See the mousedown listener,
// the " " case in onKeyPress(), and the free-tap branch in onMobileTap().
let keyBindings = {left:"a", right:"d", up:"w", down:"s", s2:"f", s3:"t", s4:"g", v4:"y", shield:"r"};
const KEY_ACTION_LABELS = {left:"◀ Trái", right:"▶ Phải", up:"▲ Nhảy", down:"▼ Né/Xuống", s2:"Chiêu 2", s3:"Chiêu 3", s4:"Chiêu 4", v4:"Biến Hình", shield:"Khiên"};
const KEY_ACTION_ORDER = ["left","right","up","down","s2","s3","s4","shield","v4"];
let rebindingAction = null; // when set, the next physical key press is captured into keyBindings[rebindingAction]

// ---------- Mobile virtual-button layout customization ----------
let mobileLayoutCfg = {
  joystick:{dx:0,dy:0,scale:1},
  s2:{dx:0,dy:0,scale:1}, s3:{dx:0,dy:0,scale:1}, s4:{dx:0,dy:0,scale:1},
  shield:{dx:0,dy:0,scale:1}, v4:{dx:0,dy:0,scale:1}
};
let touchMoveStyle = "dpad"; // "joystick" (drag circle) | "dpad" (Minecraft PE style directional buttons)
let mobileLayoutVersion = 0; // bump whenever mobileLayoutCfg changes to force buildVBtns() to recompute

let touchEditorSelKey = null; // which button is currently selected in the touch editor
let touchEditorDrag = null;   // {key, startX, startY, baseDx, baseDy} while dragging
let _editorMouseDown = false;

// Virtual button layout (recalculated each draw)
let vBtns1 = {}; // P1 controls (joystick + skills) — always bottom-left joystick
let vBtns2 = {}; // P2 controls (PVP only) — bottom-right joystick

// MOBA-style layout: circular drag joystick for movement + a fan of skill
// buttons with a distinct larger "BIẾN HÌNH" (ultimate/transform) button.
let _vBtnsLayoutKey = null;
function _applyMobileCfg(btn, key) {
  const c = mobileLayoutCfg[key];
  if (!btn || !c) return;
  btn.x += c.dx; btn.y += c.dy;
  if (btn.r !== undefined) btn.r *= c.scale;
}
function buildVBtns() {
  const layoutKey = W+"x"+H+"_"+gameMode+"_"+platformMode+"_"+mobileLayoutVersion;
  if (layoutKey === _vBtnsLayoutKey && vBtns1.joystick) return;
  _vBtnsLayoutKey = layoutKey;
  
  // Design constants for MOBA layout (normalized to 1200x700)
  const baseR = Math.floor(Math.min(W, H) * 0.05);
  
  // Left Side: Joystick & Shield
  const joyX = Math.floor(W * 0.15);
  const joyY = Math.floor(H * 0.75);
  const joyR = baseR * 1.8;
  
  if (!vBtns1.joystick) vBtns1.joystick = { knobX: joyX, knobY: joyY };
  vBtns1.joystick.x = joyX; vBtns1.joystick.y = joyY; vBtns1.joystick.r = joyR;
  
  vBtns1.shield = { x: joyX + joyR * 1.8, y: joyY + joyR * 0.3, r: baseR * 0.9, label: "KHIÊN" };
  
  // Right Side: Jump, Crouch, Skills
  const rightX = Math.floor(W * 0.88);
  const rightY = Math.floor(H * 0.78);
  
  vBtns1.up = { x: rightX, y: rightY, r: baseR * 1.4, label: "NHẢY" };
  vBtns1.down = { x: rightX - baseR * 2.8, y: rightY + baseR * 0.2, r: baseR * 0.9, label: "CÚI" };
  
  // Skills arc (s1-s4) around the right thumb
  const arcR = baseR * 3.2;
  const startAng = Math.PI * 1.05;
  const endAng = Math.PI * 1.45;
  
  vBtns1.s2 = { x: rightX + Math.cos(startAng) * arcR, y: rightY + Math.sin(startAng) * arcR, r: baseR * 1.0, label: "C1" };
  vBtns1.s3 = { x: rightX + Math.cos(startAng + (endAng-startAng)*0.5) * arcR, y: rightY + Math.sin(startAng + (endAng-startAng)*0.5) * arcR, r: baseR * 1.0, label: "C2" };
  vBtns1.s4 = { x: rightX + Math.cos(endAng) * arcR, y: rightY + Math.sin(endAng) * arcR, r: baseR * 1.0, label: "C3" };
  
  // Ultimate (v4) - Isolated
  vBtns1.v4 = { x: rightX - baseR * 5.5, y: rightY - baseR * 2.5, r: baseR * 1.2, label: "BIẾN\nHÌNH" };
  
  // Apply customizations if any
  ["joystick", "up", "down", "s2", "s3", "s4", "shield", "v4"].forEach(k => {
    if (vBtns1[k]) _applyMobileCfg(vBtns1[k], k);
  });
  vBtns2 = {}; // PVP layout not used for now
}

function drawJoystick(j, active) {
  ctx.save();
  ctx.beginPath(); ctx.arc(j.x, j.y, j.r, 0, Math.PI*2);
  ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fill();
  ctx.strokeStyle = active ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2.5; ctx.stroke();
  const kx = active ? j.knobX : j.x, ky = active ? j.knobY : j.y;
  ctx.beginPath(); ctx.arc(kx, ky, j.r*0.42, 0, Math.PI*2);
  ctx.fillStyle = active ? "rgba(255,255,255,0.60)" : "rgba(255,255,255,0.25)";
  ctx.fill();
  ctx.strokeStyle = "white"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
}

// Minecraft-PE-style 4-button directional pad, anchored on the same spot as
// the joystick (reuses vb.joystick.x/y/r so the touch editor's drag/scale
// controls work for either style without extra bookkeeping).
function _dpadButtons(vb) {
  const j = vb.joystick; if (!j) return null;
  const s = j.r * 0.78;
  const off = j.r * 1.08;
  return {
    up:    { x: j.x,       y: j.y - off, s },
    down:  { x: j.x,       y: j.y + off, s },
    left:  { x: j.x - off, y: j.y,       s },
    right: { x: j.x + off, y: j.y,       s },
  };
}
function _drawDpadBtn(b, active, arrow) {
  ctx.save();
  ctx.beginPath(); _roundRectPath(b.x-b.s/2, b.y-b.s/2, b.s, b.s, 6);
  ctx.fillStyle = active ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.15)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)"; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = "white";
  ctx.font = `bold ${Math.floor(b.s*0.5)}px Arial`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(arrow, b.x, b.y);
  ctx.restore();
}
function _roundRectPath(x,y,w,h,r){
  ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath();
}
function drawDpad(vb, tstate) {
  const d = _dpadButtons(vb); if (!d) return;
  _drawDpadBtn(d.up,    tstate.up,    "▲");
  _drawDpadBtn(d.down,  tstate.down,  "▼");
  _drawDpadBtn(d.left,  tstate.left,  "◀");
  _drawDpadBtn(d.right, tstate.right, "▶");
}
function _applyDpadTouch(pt, tstate, vb) {
  const d = _dpadButtons(vb); if (!d) return false;
  let hit = false;
  Object.keys(d).forEach(dir => {
    const b = d[dir];
    if (Math.abs(pt.x-b.x) <= b.s/2*1.15 && Math.abs(pt.y-b.y) <= b.s/2*1.15) { tstate[dir] = true; hit = true; }
  });
}

function drawSkillBtn(btn, state, skillKey, cd, maxCd) {
  const { x, y, r, label } = btn;
  const active = state && state[skillKey];
  const isReady = cd <= 0;
  
  ctx.save();
  // Outer glow if ready
  if (isReady) {
    ctx.shadowColor = "rgba(255,255,255,0.5)";
    ctx.shadowBlur = 10;
  }
  
  // Button background
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = active ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)";
  ctx.fill();
  
  // Border
  ctx.strokeStyle = isReady ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  
  // Cooldown overlay
  if (!isReady && maxCd > 0) {
    const startAngle = -Math.PI/2;
    const endAngle = startAngle + (cd / maxCd) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fill();
    
    // Countdown text
    ctx.fillStyle = "white";
    ctx.font = `bold ${Math.floor(r*0.7)}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil(cd/60), x, y);
  } else {
    // Label
    ctx.fillStyle = isReady ? "white" : "rgba(255,255,255,0.5)";
    ctx.font = `bold ${Math.floor(r*0.5)}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(label, x, y);
    
    // Ready flash
    if (isReady && frameCount % 60 < 30) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, r + 2 + Math.sin(frameCount*0.1)*2, 0, Math.PI*2);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawUltiBtn(btn, active, cd, maxCd, transforming) {
  const { x, y, r, label } = btn;
  const isReady = cd <= 0;
  
  ctx.save();
  if (isReady) {
    ctx.shadowColor = "gold";
    ctx.shadowBlur = 20;
  }
  
  // Button background
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
  ctx.fillStyle = transforming ? "rgba(255,70,0,0.8)"
                : active       ? "rgba(255,215,0,0.7)"
                : isReady      ? "rgba(255,215,0,0.3)"
                               : "rgba(50,40,0,0.4)";
  ctx.fill();
  
  // Border
  ctx.strokeStyle = isReady ? "gold" : "rgba(180,150,60,0.4)";
  ctx.lineWidth = 4;
  ctx.stroke();
  
  // Cooldown overlay
  if (!isReady && maxCd > 0) {
    const startAngle = -Math.PI/2;
    const endAngle = startAngle + (cd / maxCd) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, r, startAngle, endAngle, false);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fill();
    
    // Countdown text
    ctx.fillStyle = "gold";
    ctx.font = `bold ${Math.floor(r*0.7)}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(Math.ceil(cd/60), x, y);
  } else {
    // Label
    ctx.fillStyle = isReady ? "white" : "rgba(255,255,255,0.6)";
    const lines = label.split("\n");
    ctx.font = `bold ${Math.floor(r*0.28)}px Arial`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    lines.forEach((ln,i) => ctx.fillText(ln, x, y + (i - (lines.length-1)/2) * r*0.35));
  }
  ctx.restore();
}

function drawMobileControls() {
  if (platformMode !== "MOBILE") return;
  buildVBtns();
  ctx.save();
  
  // D-pad (Replaces Joystick)
  if (vBtns1.joystick) drawDpad(vBtns1, touch1);
  
  // Basic Movement
  if (vBtns1.up) drawSkillBtn(vBtns1.up, touch1, "up", 0, 0);
  if (vBtns1.down) drawSkillBtn(vBtns1.down, touch1, "down", 0, 0);
  
  // Skills with Cooldowns
  if (vBtns1.s2) drawSkillBtn(vBtns1.s2, touch1, "s2", p1.cds.s2, 120);
  if (vBtns1.s3) drawSkillBtn(vBtns1.s3, touch1, "s3", p1.cds.s3, 180);
  if (vBtns1.s4) drawSkillBtn(vBtns1.s4, touch1, "s4", p1.cds.s4, 240);
  if (vBtns1.shield) drawSkillBtn(vBtns1.shield, touch1, "shield", 0, 0);
  
  // Ultimate
  if (vBtns1.v4) drawUltiBtn(vBtns1.v4, touch1.v4, p1.cds.s5, 1200, p1.transformActive);
  
  ctx.restore();
}

// ================================================================
//  TOUCH INPUT HANDLING
// ================================================================
function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W/rect.width, scaleY = H/rect.height;
  if (e.touches) {
    return Array.from(e.touches).map(t => ({
      x: (t.clientX - rect.left)*scaleX,
      y: (t.clientY - rect.top)*scaleY
    }));
  }
  return [{ x:(e.clientX-rect.left)*scaleX, y:(e.clientY-rect.top)*scaleY }];
}

// Turns a touch point into joystick movement flags if it falls inside that
// joystick's (generous) drag zone. Returns true if the point was consumed.
function _applyJoystickTouch(pt, tstate, vb) {
  if (!vb.joystick) return false;
  const j = vb.joystick;
  const dxp = pt.x - j.x, dyp = pt.y - j.y;
  const distP = Math.hypot(dxp, dyp);
  const activeRadius = j.r * 2.4; // finger can drift outside the ring and still steer
  if (distP > activeRadius) return false;
  tstate._joyActive = true;
  const clamped = Math.min(distP, j.r);
  const ang = Math.atan2(dyp, dxp);
  j.knobX = j.x + Math.cos(ang) * clamped;
  j.knobY = j.y + Math.sin(ang) * clamped;
  const deadzone = j.r * 0.25;
  if (distP > deadzone) {
    const nx = Math.cos(ang), ny = Math.sin(ang);
    if (nx < -0.35) tstate.left  = true;
    if (nx >  0.35) tstate.right = true;
    if (ny < -0.5)  tstate.up    = true;
    if (ny >  0.5)  tstate.down  = true;
  }
  return true;
}

function updateTouchState(touches) {
  // Reset flags
  Object.keys(touch1).forEach(k => touch1[k] = false);
  Object.keys(touch2).forEach(k => touch2[k] = false);
  if (platformMode !== "MOBILE") return;
  buildVBtns();
  
  touches.forEach(pt => {
    const {x, y} = pt;
    
    // Left Side: D-pad movement
    if (x < W * 0.45) {
      if (_applyDpadTouch(pt, touch1, vBtns1)) return;
    }

    // Right Side: Skills & Movement buttons
    const btnKeys = ["up", "down", "s2", "s3", "s4", "shield", "v4"];
    for (const k of btnKeys) {
      const btn = vBtns1[k];
      if (btn && Math.hypot(x - btn.x, y - btn.y) <= btn.r * 1.4) {
        touch1[k] = true;
        return;
      }
    }
  });
}

canvas.addEventListener('touchstart',  e => {
  e.preventDefault();
  const pts = getCanvasPos(e);
  if (gameState === "TOUCH_EDITOR") { handleTouchEditorPointer(pts[0].x, pts[0].y, "down"); return; }
  updateTouchState(pts); onMobileTap(pts);
}, { passive:false });
canvas.addEventListener('touchmove',   e => {
  e.preventDefault();
  const pts = getCanvasPos(e);
  if (gameState === "TOUCH_EDITOR") { handleTouchEditorPointer(pts[0].x, pts[0].y, "move"); return; }
  updateTouchState(pts);
}, { passive:false });
canvas.addEventListener('touchend',    e => {
  e.preventDefault();
  if (gameState === "TOUCH_EDITOR") { handleTouchEditorPointer(0, 0, "up"); return; }
  updateTouchState(getCanvasPos(e));
}, { passive:false });
canvas.addEventListener('touchcancel', e => {
  e.preventDefault();
  if (gameState === "TOUCH_EDITOR") { handleTouchEditorPointer(0, 0, "up"); return; }
  updateTouchState([]);
}, { passive:false });

// For casting skills on touch (one-shot on press)
let prevTouch1 = {};
let prevTouch2 = {};
function processTouchSkills() {
  if (platformMode !== "MOBILE") return;
  if ((gameState==="GAMEPLAY"||gameState==="CHALLENGE"||gameState==="ROAD") && p1.hp>0) {
    if (touch1.s2 && !prevTouch1.s2) { if(gameState==="GAMEPLAY") castSkill(p1,p2,2); else castSkill(p1,null,2); }
    if (touch1.s3 && !prevTouch1.s3) { if(gameState==="GAMEPLAY") castSkill(p1,p2,3); else castSkill(p1,null,3); }
    if (touch1.s4 && !prevTouch1.s4) { if(gameState==="GAMEPLAY") castSkill(p1,p2,4); else castSkill(p1,null,4); }
    if (touch1.v4 && !prevTouch1.v4) { if(gameState==="GAMEPLAY") castSkill(p1,p2,5); else castSkill(p1,null,5); }
    p1.isShielding = !!touch1.shield;
    if (gameMode==="PVP" && p2.hp>0) {
      if (touch2.s2 && !prevTouch2.s2) castSkill(p2,p1,2);
      if (touch2.s3 && !prevTouch2.s3) castSkill(p2,p1,3);
      if (touch2.s4 && !prevTouch2.s4) castSkill(p2,p1,4);
      if (touch2.v4 && !prevTouch2.v4) castSkill(p2,p1,5);
      p2.isShielding = !!touch2.shield;
    }
  }
  Object.keys(touch1).forEach(k => prevTouch1[k] = touch1[k]);
  Object.keys(touch2).forEach(k => prevTouch2[k] = touch2[k]);
}

// Skill 1 ("Chiêu 1") has no dedicated button anymore. Any tap that lands
// on the right-hand control side but doesn't hit an actual button (up/down/
// s2/s3/s4/shield/v4) is treated as a free "attack tap" and casts skill 1 —
// mirroring the mouse-click behavior on PC.
function _mobileTapHitsButton(mx, my) {
  const btnKeys = ["up", "down", "s2", "s3", "s4", "shield", "v4"];
  for (const k of btnKeys) {
    const btn = vBtns1[k];
    if (btn && Math.hypot(mx - btn.x, my - btn.y) <= btn.r * 1.4) return true;
  }
  return false;
}

function onMobileTap(points) {
  if (platformMode !== "MOBILE") return;
  const {x:mx, y:my} = points[0];
  // Back Button (Top-Left)
  const escR = Math.floor(W*0.04);
  const escX = escR + 20;
  const escY = escR + 20;
  if (Math.hypot(mx-escX, my-escY) <= escR * 1.5) { gameState="MENU"; showSettings=false; return; }
  // Game-over / challenge-result screens have no virtual buttons of their own;
  // let a tap do what R/SPACE would do on keyboard so mobile players aren't stuck.
  if (gameState === "GAMEPLAY" && (p1.hp<=0 || p2.hp<=0)) { startMatch(); return; }
  if (gameState === "ROAD" && (roadState==="WON" || roadState==="LOST")) { startRoadMode(); return; }
  if (gameState === "CHALLENGE" && challengeState === "DONE") {
    if (challengeResult === "WIN") {
      if (challengeStage < 6) { challengeStage++; gameState = "CHALLENGE_CHAR_SELECT"; }
    } else {
      startChallengeMode(challengeStage);
    }
    return;
  }
  // Free tap on the right-hand (attack) side during an active match = Skill 1.
  if ((gameState==="GAMEPLAY"||gameState==="CHALLENGE"||gameState==="ROAD") && p1.hp>0) {
    if (mx >= W*0.45 && !_mobileTapHitsButton(mx, my)) {
      if (gameState==="GAMEPLAY") castSkill(p1,p2,1); else castSkill(p1,null,1);
    }
    return;
  }
  // Forward to menu click if in non-gameplay state
  if (!["GAMEPLAY","CHALLENGE","ROAD"].includes(gameState)) {
    handleMenuClick(mx, my);
  }
}

// ================================================================
//  KEYBOARD INPUT
// ================================================================
const keys = new Set();
document.addEventListener('keydown', e => {
  if (rebindingAction) {
    e.preventDefault();
    if (e.key.toLowerCase() !== "escape") keyBindings[rebindingAction] = e.key.toLowerCase();
    rebindingAction = null;
    return;
  }
  keys.add(e.key.toLowerCase()); onKeyPress(e);
});
document.addEventListener('keyup',   e => {
  keys.delete(e.key.toLowerCase());
  if (e.key.toLowerCase()===keyBindings.shield) p1.isShielding = false;
  if (e.key==="2") p2.isShielding = false;
  if (gameState==="MINIGAME_DINO" && e.key==="ArrowDown") dinoDuck(false);
});
canvas.addEventListener('mousedown', e => {
  const {x,y}=getCanvasPosM(e);
  // Mouse click during an active match = Skill 1 ("Chiêu 1" / basic attack).
  if (platformMode==="PC" && (gameState==="GAMEPLAY"||gameState==="CHALLENGE"||gameState==="ROAD") && p1.hp>0) {
    if (gameState==="GAMEPLAY") castSkill(p1,p2,1); else castSkill(p1,null,1);
    return;
  }
  handleMenuClick(x,y);
});

function getCanvasPosM(e) {
  const rect = canvas.getBoundingClientRect();
  return { x:(e.clientX-rect.left)*(W/rect.width), y:(e.clientY-rect.top)*(H/rect.height) };
}

// ================================================================
//  HELPERS
// ================================================================
function hsvToRgb(h,s,v){
  let r,g,b;
  const i=Math.floor(h*6),f=h*6-i,p=v*(1-s),q=v*(1-f*s),t=v*(1-(1-f)*s);
  switch(i%6){case 0:r=v;g=t;b=p;break;case 1:r=q;g=v;b=p;break;case 2:r=p;g=v;b=t;break;
    case 3:r=p;g=q;b=v;break;case 4:r=t;g=p;b=v;break;case 5:r=v;g=p;b=q;break;}
  return [Math.round(r*255),Math.round(g*255),Math.round(b*255)];
}
function hsvHex(h,s,v){const[r,g,b]=hsvToRgb(h,s,v);return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;}
function rng(){return Math.random();}
function rndInt(a,b){return Math.floor(rng()*(b-a+1))+a;}
function rndChoice(arr){return arr[Math.floor(rng()*arr.length)];}
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
// Skill/dash/teleport code (castSkill, aoePush) historically clamped the
// mover's x to the fixed screen-space range [40, W-40]. That's correct in
// GAMEPLAY/CHALLENGE, where the arena is a bounded worldW starting at 0.
// But in ROAD mode the player's x keeps growing with roadDistanceM and the
// camera (roadCameraX) scrolls forward indefinitely, so [40, W-40] is only
// valid near the very start of the road. Any teleport/dash/knockback that
// clamped to that fixed range in ROAD mode would silently snap the mover
// back toward x≈0..W — i.e. yank them 100-200m backward — the moment they
// were far enough down the road. These two helpers give the *current*
// valid on-screen x range for whichever mode is active, so movement clamps
// stay correct as the road camera scrolls.
function moveBoundLo(){return gameState==="ROAD"?roadCameraX+40:40;}
function moveBoundHi(){return gameState==="ROAD"?roadCameraX+W-40:W-40;}
function dist(ax,ay,bx,by){return Math.sqrt((ax-bx)**2+(ay-by)**2);}
function getHPDisplay(hp){const v=Math.floor(hp);return v>0||hp<=0?v:1;}

// ================================================================
//  VISUAL FX: elemental colors, hit effects, dash trails, bursts
// ================================================================
const ELEMENT_COLORS={red:"#ff5533",shadow:"#bb44ff",thunder:"#FFD700",frost:"#66ccff",earth:"#c68a4a",water:"#44bbff",wind:"#a6f0a6",fire:"#FF4500"};
// ================================================================
//  CHAR_PROFILE — per-element body size / move speed / max HP.
//  size  : multiplies CHAR_VISUAL_SCALE just for this character (anchored
//          at the feet, so bigger/smaller bodies never float or sink).
//  speed : multiplies the base 4.3125 move speed used by the player.
//  hp    : multiplies MAX_HP to get this character's own maxHp.
//  Net idea: small/light elements (wind, shadow, thunder, frost) trade HP
//  for extra speed so they can dodge; earth trades speed for a much
//  bigger, tankier body. Water/fire/red/thunder-base stay close to normal.
// ================================================================
const CHAR_PROFILE={
  red:     {size:1.00, speed:1.00, hp:1.00},
  fire:    {size:1.00, speed:1.00, hp:1.00},
  earth:   {size:1.25, speed:0.80, hp:1.35},
  thunder: {size:0.92, speed:1.15, hp:0.90},
  frost:   {size:0.95, speed:1.08, hp:0.95},
  water:   {size:1.02, speed:0.95, hp:1.10},
  wind:    {size:0.82, speed:1.32, hp:0.78},
  shadow:  {size:0.90, speed:1.15, hp:0.90},
};
function charProfile(charType){return CHAR_PROFILE[charType]||{size:1,speed:1,hp:1};}
// FIRE — a brand-new selectable character (separate from the unused "red" fighter
// above). Same Y-key Rage/Ultimate transform framework as every other character,
// but its own V1 (orange/red flame) -> "Flame V2" (blue flame, white core, cyan
// light) transformation, with its own 4 skills: Fire Bullet, Fire Pillar, Fire
// Dash, and the Flame Destroyer ultimate. All fire_* state is namespaced so it
// can never affect any other charType.
const FIRE_V1_COL="#FF4500", FIRE_V2_COL="#00E5FF";
// Thunder (Lôi) rework palette — pure white + electric gold only, no purple anywhere.
const THUNDER_WHITE="#FFFFFF",THUNDER_GOLD="#FFD700",THUNDER_YELLOW="#FFF176",THUNDER_ARC="#EAF6FF";
// The fire (red) fighter automatically switches every fire visual to a blue
// "hellfire" palette for the whole duration of its V4 transform, then reverts
// to normal red/orange the instant the transform ends. No toggle, no persistent
// mode — it's purely driven by `fighter.transformActive && fighter.charType==="red"`.

// ----- Lightweight procedural SFX (no audio files needed) -----
let _actx=null;
function _getActx(){ if(!_actx){try{_actx=new (window.AudioContext||window.webkitAudioContext)();}catch(e){_actx=null;}} return _actx; }
function _noiseBuffer(ac,dur){
  const buf=ac.createBuffer(1,Math.floor(ac.sampleRate*dur),ac.sampleRate);
  const d=buf.getChannelData(0);
  for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(1-i/d.length);
  return buf;
}
function sfxEnergyCharge(){ // rising whoosh while V4 windup charges up
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(140,ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(680,ac.currentTime+0.8);
  g.gain.setValueAtTime(0.0001,ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.18,ac.currentTime+0.5);
  g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.8);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.85);
}
function sfxExplosion(){ // the 20-spark hellfire explosion
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.5);
  const g=ac.createGain();g.gain.setValueAtTime(0.35,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(2200,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(200,ac.currentTime+0.5);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(90,ac.currentTime);o.frequency.exponentialRampToValueAtTime(30,ac.currentTime+0.4);
  og.gain.setValueAtTime(0.3,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.4);
}
function sfxFireCrackle(){ // ambient fire-catching sound as the flame ignites
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.35);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.value=1400;filt.Q.value=0.6;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+0.05);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.35);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxTransformEnd(){ // distinct sound when V4 wears off and fire returns to red
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="triangle";o.frequency.setValueAtTime(500,ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(120,ac.currentTime+0.45);
  g.gain.setValueAtTime(0.2,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.45);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.5);
}
function sfxHit(isCrit){ // short percussive "thwack" on every landed hit, sharper+higher on crits
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,isCrit?0.14:0.09);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.value=isCrit?2600:1500;filt.Q.value=1.1;
  const g=ac.createGain();g.gain.setValueAtTime(isCrit?0.3:0.16,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+(isCrit?0.16:0.1));
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  if(isCrit){
    const o=ac.createOscillator(),og=ac.createGain();o.type="square";o.frequency.setValueAtTime(900,ac.currentTime);o.frequency.exponentialRampToValueAtTime(1500,ac.currentTime+0.09);
    og.gain.setValueAtTime(0.12,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.12);
    o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.13);
  }
}
function sfxComboMilestone(n){ // rising ping every 5-hit combo milestone, pitch climbs with combo size
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  const base=520+Math.min(n,40)*8;
  o.type="sine";o.frequency.setValueAtTime(base,ac.currentTime);o.frequency.exponentialRampToValueAtTime(base*1.6,ac.currentTime+0.12);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+0.02);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.22);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.25);
}
function sfxVictory(){
  const ac=_getActx(); if(!ac)return;
  [0,0.12,0.24,0.4].forEach((t,i)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="triangle";o.frequency.setValueAtTime([523,659,784,1046][i],ac.currentTime+t);
    g.gain.setValueAtTime(0.001,ac.currentTime+t);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+t+0.03);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+t+0.35);
    o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+t);o.stop(ac.currentTime+t+0.4);
  });
}
function sfxDefeat(){
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(300,ac.currentTime);
  o.frequency.exponentialRampToValueAtTime(60,ac.currentTime+0.9);
  g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.9);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.95);
}
function sfxRecord(){ // little celebratory chime when a new personal-best distance is set
  const ac=_getActx(); if(!ac)return;
  [0,0.1,0.2].forEach((t,i)=>{
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";o.frequency.setValueAtTime([784,988,1318][i],ac.currentTime+t);
    g.gain.setValueAtTime(0.001,ac.currentTime+t);g.gain.linearRampToValueAtTime(0.2,ac.currentTime+t+0.02);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+t+0.3);
    o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+t);o.stop(ac.currentTime+t+0.32);
  });
}
// ----- NEW: standalone SFX for the Frost King (Boss 1) spawn cinematic only -----
function sfxIceCrack(){ // sharp icy crack — used for crack growth + heavy footsteps
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.12);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.value=1800;
  const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.12);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(2200,ac.currentTime);o.frequency.exponentialRampToValueAtTime(900,ac.currentTime+0.1);
  og.gain.setValueAtTime(0.12,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.1);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.12);
}
function sfxIceShatter(){ // the ice cocoon exploding to reveal the Frost King
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.6);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(2600,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(400,ac.currentTime+0.6);
  const g=ac.createGain();g.gain.setValueAtTime(0.32,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.6);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  [1800,2400,3100].forEach((f,i)=>{const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(f,ac.currentTime+i*0.02);
    og.gain.setValueAtTime(0.001,ac.currentTime+i*0.02);og.gain.linearRampToValueAtTime(0.15,ac.currentTime+i*0.02+0.02);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+i*0.02+0.4);
    o.connect(og);og.connect(ac.destination);o.start(ac.currentTime+i*0.02);o.stop(ac.currentTime+i*0.02+0.42);});
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(80,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(25,ac.currentTime+0.5);
  bg.gain.setValueAtTime(0.3,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.5);
}
function sfxBossRoar(){ // Frost King's deep roar once fully emerged
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(90,ac.currentTime);o.frequency.exponentialRampToValueAtTime(45,ac.currentTime+0.7);o.frequency.exponentialRampToValueAtTime(70,ac.currentTime+1.0);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.28,ac.currentTime+0.15);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=700;
  o.connect(filt);filt.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+1.0);
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.9);
  const filt2=ac.createBiquadFilter();filt2.type="bandpass";filt2.frequency.value=350;filt2.Q.value=0.7;
  const g2=ac.createGain();g2.gain.setValueAtTime(0.0001,ac.currentTime);g2.gain.linearRampToValueAtTime(0.18,ac.currentTime+0.2);g2.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.9);
  src.connect(filt2);filt2.connect(g2);g2.connect(ac.destination);src.start();
}
function sfxStep(){ // soft footstep
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.08);
  const g=ac.createGain();g.gain.setValueAtTime(0.15,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.1);
  src.connect(g);g.connect(ac.destination);src.start();
}
function sfxIceFreeze(){ // character begins to freeze
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sine";o.frequency.setValueAtTime(1200,ac.currentTime);o.frequency.exponentialRampToValueAtTime(800,ac.currentTime+0.3);
  g.gain.setValueAtTime(0.0001,ac.currentTime);g.gain.linearRampToValueAtTime(0.18,ac.currentTime+0.05);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.3);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.35);
}
function sfxIceCrystallize(){ // ice forming and crystallizing
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.15);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.value=2200;
  const g=ac.createGain();g.gain.setValueAtTime(0.12,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxIceExplode(){ // massive ice explosion
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.6);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(2600,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(400,ac.currentTime+0.6);
  const g=ac.createGain();g.gain.setValueAtTime(0.32,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.6);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  [1800,2400,3100].forEach((f,i)=>{const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(f,ac.currentTime+i*0.02);
    og.gain.setValueAtTime(0.001,ac.currentTime+i*0.02);og.gain.linearRampToValueAtTime(0.15,ac.currentTime+i*0.02+0.02);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+i*0.02+0.4);
    o.connect(og);og.connect(ac.destination);o.start(ac.currentTime+i*0.02);o.stop(ac.currentTime+i*0.02+0.42);});
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(80,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(25,ac.currentTime+0.5);
  bg.gain.setValueAtTime(0.3,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.5);
}
function sfxBossBattleStart(){ // dramatic start to boss battle
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sine";o.frequency.setValueAtTime(200,ac.currentTime);o.frequency.linearRampToValueAtTime(400,ac.currentTime+0.15);
  g.gain.setValueAtTime(0.25,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.3);
}

// ----- NEW: standalone SFX for the Earth Titan (Boss 2) spawn cinematic + skills -----
function sfxEarthRumble(){ // low rolling rumble — ground quake buildup
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.5);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(220,ac.currentTime);filt.frequency.linearRampToValueAtTime(140,ac.currentTime+0.5);
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+0.15);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(55,ac.currentTime);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.18,ac.currentTime+0.2);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.5);
}
function sfxEarthCrack(){ // ground splitting — sharp low crack, used for cracks + heavy footsteps
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.18);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=900;
  const g=ac.createGain();g.gain.setValueAtTime(0.26,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.18);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="triangle";o.frequency.setValueAtTime(160,ac.currentTime);o.frequency.exponentialRampToValueAtTime(60,ac.currentTime+0.16);
  og.gain.setValueAtTime(0.16,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.16);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.18);
}
function sfxRockErupt(){ // a rock spike bursting up out of the ground
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.2);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(500,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(1400,ac.currentTime+0.1);filt.Q.value=1.2;
  const g=ac.createGain();g.gain.setValueAtTime(0.2,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.2);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxRockImpact(){ // heavy rock-on-rock collision — used for boulder/rock convergence hits
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.3);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=650;
  const g=ac.createGain();g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.3);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="square";o.frequency.setValueAtTime(90,ac.currentTime);o.frequency.exponentialRampToValueAtTime(35,ac.currentTime+0.25);
  og.gain.setValueAtTime(0.18,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.28);
}
function sfxEarthExplode(){ // massive rock/dust explosion (mirrors sfxIceExplode's structure for an earthy/dusty timbre)
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.7);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1200,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(150,ac.currentTime+0.7);
  const g=ac.createGain();g.gain.setValueAtTime(0.36,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.7);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(70,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(20,ac.currentTime+0.6);
  bg.gain.setValueAtTime(0.32,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.6);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.6);
}
function sfxEarthRoar(){ // Earth Titan's deep grinding roar once fully emerged
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(70,ac.currentTime);o.frequency.exponentialRampToValueAtTime(35,ac.currentTime+0.8);o.frequency.exponentialRampToValueAtTime(55,ac.currentTime+1.1);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.3,ac.currentTime+0.15);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.1);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=500;
  o.connect(filt);filt.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+1.1);
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,1.0);
  const filt2=ac.createBiquadFilter();filt2.type="bandpass";filt2.frequency.value=220;filt2.Q.value=0.6;
  const g2=ac.createGain();g2.gain.setValueAtTime(0.0001,ac.currentTime);g2.gain.linearRampToValueAtTime(0.2,ac.currentTime+0.2);g2.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  src.connect(filt2);filt2.connect(g2);g2.connect(ac.destination);src.start();
}

// ----- NEW: standalone SFX for the Flame Lord (Boss 3) spawn cinematic + skills -----
function sfxLavaRumble(){ // low, hotter rumble than Earth's — ground beginning to crack and glow
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.45);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(280,ac.currentTime);filt.frequency.linearRampToValueAtTime(160,ac.currentTime+0.45);
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.2,ac.currentTime+0.12);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.45);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(48,ac.currentTime);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.16,ac.currentTime+0.18);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.45);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.45);
}
function sfxLavaErupt(){ // a jet of lava/fire spouting up out of the ground
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.22);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(600,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(1600,ac.currentTime+0.12);filt.Q.value=1.1;
  const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.22);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxFireBurst(){ // a sudden whoosh of flame igniting (used for the giant flame column bursting up)
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.32);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.setValueAtTime(300,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(900,ac.currentTime+0.15);
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.28,ac.currentTime+0.05);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.32);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxInfernoBurst(){ // massive fire explosion (mirrors sfxEarthExplode's structure for a searing/hot timbre)
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.65);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1500,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(180,ac.currentTime+0.65);
  const g=ac.createGain();g.gain.setValueAtTime(0.38,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.65);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sawtooth";bo.frequency.setValueAtTime(90,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(25,ac.currentTime+0.55);
  bg.gain.setValueAtTime(0.3,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.55);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.55);
}
function sfxFlameRoar(){ // Flame Lord's blazing roar once fully emerged
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();
  o.type="sawtooth";o.frequency.setValueAtTime(85,ac.currentTime);o.frequency.exponentialRampToValueAtTime(40,ac.currentTime+0.75);o.frequency.exponentialRampToValueAtTime(65,ac.currentTime+1.05);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.3,ac.currentTime+0.15);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.05);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=650;
  o.connect(filt);filt.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+1.05);
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.95);
  const filt2=ac.createBiquadFilter();filt2.type="bandpass";filt2.frequency.value=500;filt2.Q.value=0.7;
  const g2=ac.createGain();g2.gain.setValueAtTime(0.0001,ac.currentTime);g2.gain.linearRampToValueAtTime(0.2,ac.currentTime+0.2);g2.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.95);
  src.connect(filt2);filt2.connect(g2);g2.connect(ac.destination);src.start();
}
function sfxMeteorFall(){ // a burning meteor slamming into the ground
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.3);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=700;
  const g=ac.createGain();g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.3);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="square";o.frequency.setValueAtTime(100,ac.currentTime);o.frequency.exponentialRampToValueAtTime(38,ac.currentTime+0.25);
  og.gain.setValueAtTime(0.18,ac.currentTime);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.25);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.28);
}
function sfxFireTornado(){ // rising swirl-whoosh — used when the Fire Tornado skill is cast
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.6);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(300,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(2200,ac.currentTime+0.4);filt.frequency.exponentialRampToValueAtTime(700,ac.currentTime+0.6);filt.Q.value=1.4;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.24,ac.currentTime+0.15);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.6);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxSpiritSummon(){ // ghostly rising chime — used when Fire Spirits are summoned
  const ac=_getActx(); if(!ac)return;
  for(let i=0;i<3;i++){
    const o=ac.createOscillator(),g=ac.createGain();
    o.type="sine";const base=520+i*180;
    o.frequency.setValueAtTime(base*0.6,ac.currentTime+i*0.05);
    o.frequency.exponentialRampToValueAtTime(base,ac.currentTime+i*0.05+0.22);
    g.gain.setValueAtTime(0.0001,ac.currentTime+i*0.05);
    g.gain.linearRampToValueAtTime(0.12,ac.currentTime+i*0.05+0.08);
    g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+i*0.05+0.4);
    o.connect(g);g.connect(ac.destination);o.start(ac.currentTime+i*0.05);o.stop(ac.currentTime+i*0.05+0.42);
  }
}

// ----- NEW: standalone SFX for THE ABYSSAL (Boss 4 — Shadow) spawn cinematic + skills -----
function sfxVoidCrack(){ // a rift tearing open in space — low dissonant crack, not a rock crack
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.4);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(180,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(70,ac.currentTime+0.4);filt.Q.value=3.5;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.24,ac.currentTime+0.08);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sawtooth";o.frequency.setValueAtTime(90,ac.currentTime);o.frequency.exponentialRampToValueAtTime(38,ac.currentTime+0.4);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.14,ac.currentTime+0.1);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+0.4);
}
function sfxShadowWhisper(){ // eerie low hum/whisper — ambient dread, used while the rift widens
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.setValueAtTime(120,ac.currentTime);o.frequency.linearRampToValueAtTime(95,ac.currentTime+0.9);
  g.gain.setValueAtTime(0.0001,ac.currentTime);g.gain.linearRampToValueAtTime(0.1,ac.currentTime+0.25);g.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.9);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=340;
  o.connect(filt);filt.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.9);
  const o2=ac.createOscillator(),g2=ac.createGain();o2.type="sine";o2.frequency.setValueAtTime(121.5,ac.currentTime);o2.frequency.linearRampToValueAtTime(96.5,ac.currentTime+0.9);
  g2.gain.setValueAtTime(0.0001,ac.currentTime);g2.gain.linearRampToValueAtTime(0.07,ac.currentTime+0.25);g2.gain.exponentialRampToValueAtTime(0.0001,ac.currentTime+0.9);
  o2.connect(filt);g2.connect(ac.destination);o2.connect(g2);o2.start();o2.stop(ac.currentTime+0.9);
}
function sfxVoidPulse(){ // a telegraphed void-rift attack firing
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.22);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(200,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(900,ac.currentTime+0.15);filt.Q.value=2;
  const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.22);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxShadowTeleport(){ // quick whoosh — used for clone spawn, darkness vanish/reappear
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.setValueAtTime(700,ac.currentTime);o.frequency.exponentialRampToValueAtTime(90,ac.currentTime+0.22);
  g.gain.setValueAtTime(0.18,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.22);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.22);
}
function sfxAbyssRoar(){ // The Abyssal's reveal — deep, dissonant, not a beast roar
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();o.type="sawtooth";o.frequency.setValueAtTime(65,ac.currentTime);o.frequency.exponentialRampToValueAtTime(30,ac.currentTime+0.9);o.frequency.exponentialRampToValueAtTime(48,ac.currentTime+1.2);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.26,ac.currentTime+0.2);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.2);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.value=420;
  o.connect(filt);filt.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+1.2);
  const o2=ac.createOscillator(),g2=ac.createGain();o2.type="sawtooth";o2.frequency.setValueAtTime(65*1.06,ac.currentTime);o2.frequency.exponentialRampToValueAtTime(30*1.06,ac.currentTime+0.9);
  g2.gain.setValueAtTime(0.001,ac.currentTime);g2.gain.linearRampToValueAtTime(0.16,ac.currentTime+0.2);g2.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  o2.connect(filt);o2.connect(g2);g2.connect(ac.destination);o2.start();o2.stop(ac.currentTime+1.0);
}
function sfxVoidExplode(){ // Ultimate "Abyss" release — dark convergence detonation
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.75);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1000,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(120,ac.currentTime+0.75);
  const g=ac.createGain();g.gain.setValueAtTime(0.34,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.75);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(60,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(18,ac.currentTime+0.65);
  bg.gain.setValueAtTime(0.3,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.65);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.65);
}

// ----- NEW: standalone SFX for the Tempest (Boss 5) spawn cinematic + skills -----
function sfxWindGust(){ // rising gust of wind — used for Wind Blades cast + Air Prison
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.35);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(500,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(1400,ac.currentTime+0.3);filt.Q.value=1.2;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.2,ac.currentTime+0.08);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.35);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxTornadoSwirl(){ // rising swirl-whoosh — used when the Tornado skill forms
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.5);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(300,ac.currentTime);filt.frequency.linearRampToValueAtTime(900,ac.currentTime+0.25);filt.frequency.linearRampToValueAtTime(300,ac.currentTime+0.5);filt.Q.value=3;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+0.12);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxWindDash(){ // sharp rushing whoosh — used when Wind Dash fires
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.22);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.setValueAtTime(600,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(2200,ac.currentTime+0.2);
  const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.22);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxSkyFallImpact(){ // Sky Fall slamming into the ground
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.4);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1200,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(200,ac.currentTime+0.4);
  const g=ac.createGain();g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(90,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(30,ac.currentTime+0.3);
  bg.gain.setValueAtTime(0.24,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.3);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.3);
}
function sfxStormRoar(){ // The Tempest's reveal — deep windy howl, NOT a beast roar
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,1.0);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(220,ac.currentTime);filt.frequency.linearRampToValueAtTime(500,ac.currentTime+0.5);filt.frequency.linearRampToValueAtTime(180,ac.currentTime+1.0);filt.Q.value=1.5;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.26,ac.currentTime+0.25);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(70,ac.currentTime);o.frequency.exponentialRampToValueAtTime(45,ac.currentTime+1.0);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.16,ac.currentTime+0.2);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+1.0);
}
function sfxStormBurst(){ // Ultimate "Eye of the Storm" release — wide wind detonation
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.7);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(1200,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(150,ac.currentTime+0.7);filt.Q.value=1;
  const g=ac.createGain();g.gain.setValueAtTime(0.32,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.7);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}

// ----- NEW: standalone SFX for The Tidal (Boss 6) spawn cinematic + skills -----
function sfxWaterSurge(){ // rising water/bubbling surge — used for Water Prison cast + Rising Tide + the eruption column
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.4);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(350,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(1100,ac.currentTime+0.35);filt.Q.value=1.4;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.22,ac.currentTime+0.1);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxWaveCrash(){ // a wave/water burst crashing down — used for Tidal Wave + Water Prison burst
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.45);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1400,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(250,ac.currentTime+0.45);
  const g=ac.createGain();g.gain.setValueAtTime(0.3,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.45);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(80,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(28,ac.currentTime+0.35);
  bg.gain.setValueAtTime(0.2,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.35);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.35);
}
function sfxWhirlpoolSwirl(){ // swirling whirlpool — used for Water Whirl + Maelstrom forming
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.55);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(260,ac.currentTime);filt.frequency.linearRampToValueAtTime(700,ac.currentTime+0.28);filt.frequency.linearRampToValueAtTime(260,ac.currentTime+0.55);filt.Q.value=3.2;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.2,ac.currentTime+0.14);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.55);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxTridentThrust(){ // sharp watery thrust — used for Water Spear cast + Trident Rush
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.2);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.setValueAtTime(500,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(1800,ac.currentTime+0.18);
  const g=ac.createGain();g.gain.setValueAtTime(0.2,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.2);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxTidalRoar(){ // The Tidal's reveal — deep watery roar, NOT a beast roar
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,1.0);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(200,ac.currentTime);filt.frequency.linearRampToValueAtTime(460,ac.currentTime+0.5);filt.frequency.linearRampToValueAtTime(160,ac.currentTime+1.0);filt.Q.value=1.4;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.26,ac.currentTime+0.25);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="sine";o.frequency.setValueAtTime(64,ac.currentTime);o.frequency.exponentialRampToValueAtTime(40,ac.currentTime+1.0);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.17,ac.currentTime+0.2);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+1.0);
}
function sfxOceanBurst(){ // Ultimate "Ocean's Judgment" release — wide water detonation
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.7);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(1000,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(140,ac.currentTime+0.7);filt.Q.value=1;
  const g=ac.createGain();g.gain.setValueAtTime(0.32,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.7);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}

// ----- NEW: standalone SFX for The Voltage (Boss 7 — final boss) spawn cinematic + skills -----
function sfxLightningZap(){ // sharp electric zap — used for Chain Lightning cast + Lightning Dash + Voltage Orbs launch
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.18);
  const filt=ac.createBiquadFilter();filt.type="highpass";filt.frequency.setValueAtTime(800,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(3200,ac.currentTime+0.15);
  const g=ac.createGain();g.gain.setValueAtTime(0.22,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.18);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}
function sfxThunderBoom(){ // a deep thunderclap — used for Thunder Strike/Thunder Pillars impact + the giant intro bolt
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.5);
  const filt=ac.createBiquadFilter();filt.type="lowpass";filt.frequency.setValueAtTime(1600,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(150,ac.currentTime+0.5);
  const g=ac.createGain();g.gain.setValueAtTime(0.34,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.5);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const bo=ac.createOscillator(),bg=ac.createGain();bo.type="sine";bo.frequency.setValueAtTime(90,ac.currentTime);bo.frequency.exponentialRampToValueAtTime(30,ac.currentTime+0.4);
  bg.gain.setValueAtTime(0.24,ac.currentTime);bg.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.4);
  bo.connect(bg);bg.connect(ac.destination);bo.start();bo.stop(ac.currentTime+0.4);
}
function sfxElectricCharge(){ // rising charge-up hum — used for Overcharge + Thunderstorm channel
  const ac=_getActx(); if(!ac)return;
  const o=ac.createOscillator(),g=ac.createGain();o.type="sawtooth";o.frequency.setValueAtTime(90,ac.currentTime);o.frequency.linearRampToValueAtTime(520,ac.currentTime+0.9);
  g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.14,ac.currentTime+0.7);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.9);
  o.connect(g);g.connect(ac.destination);o.start();o.stop(ac.currentTime+0.9);
}
function sfxVoltageRoar(){ // The Voltage's reveal — a deep electric surge, NOT a beast roar
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,1.0);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(300,ac.currentTime);filt.frequency.linearRampToValueAtTime(900,ac.currentTime+0.4);filt.frequency.linearRampToValueAtTime(220,ac.currentTime+1.0);filt.Q.value=2.2;
  const g=ac.createGain();g.gain.setValueAtTime(0.001,ac.currentTime);g.gain.linearRampToValueAtTime(0.28,ac.currentTime+0.2);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
  const o=ac.createOscillator(),og=ac.createGain();o.type="square";o.frequency.setValueAtTime(60,ac.currentTime);o.frequency.exponentialRampToValueAtTime(36,ac.currentTime+1.0);
  og.gain.setValueAtTime(0.001,ac.currentTime);og.gain.linearRampToValueAtTime(0.1,ac.currentTime+0.2);og.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+1.0);
  o.connect(og);og.connect(ac.destination);o.start();o.stop(ac.currentTime+1.0);
}
function sfxThunderstormBurst(){ // Ultimate "Thunderstorm" release — massive electric detonation
  const ac=_getActx(); if(!ac)return;
  const src=ac.createBufferSource();src.buffer=_noiseBuffer(ac,0.8);
  const filt=ac.createBiquadFilter();filt.type="bandpass";filt.frequency.setValueAtTime(1500,ac.currentTime);filt.frequency.exponentialRampToValueAtTime(120,ac.currentTime+0.8);filt.Q.value=1;
  const g=ac.createGain();g.gain.setValueAtTime(0.36,ac.currentTime);g.gain.exponentialRampToValueAtTime(0.001,ac.currentTime+0.8);
  src.connect(filt);filt.connect(g);g.connect(ac.destination);src.start();
}

// ---------- Floating damage numbers ----------
function spawnDamageNumber(x,y,amount,isCrit){
  const v=Math.round(amount);
  if(v<=0)return;
  dmgNumbers.push({
    x:x+rndInt(-10,10), y, vy:-1.6, life:38, maxLife:38,
    text:(isCrit?"CHÍ MẠNG! ":"")+v,
    color:isCrit?"#ffcc00":"#ffffff",
    size:isCrit?15:11,
    crit:!!isCrit
  });
}
function updateAndDrawDmgNumbers(){
  _compact(dmgNumbers,d=>d.life>0);
  dmgNumbers.forEach(d=>{
    d.life--; d.y+=d.vy; d.vy+=0.045; d.x+=d.crit?Math.sin(d.life*0.5):0;
    const a=Math.max(0,d.life/d.maxLife);
    ctx.save();
    ctx.globalAlpha=a;
    ctx.font=`bold ${d.size+(d.crit?Math.sin(d.life*0.6)*1.5:0)}px Arial`;
    ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.lineWidth=3;ctx.strokeStyle="rgba(0,0,0,0.7)";
    ctx.strokeText(d.text,d.x,d.y);
    ctx.fillStyle=d.color;
    ctx.fillText(d.text,d.x,d.y);
    ctx.restore();
  });
}

// ---------- Combo counter HUD (screen-space; call outside the camera transform) ----------
function drawComboCounter(){
  if(comboCount<2)return;
  const tierColor = comboCount>=25?"#ff3355":comboCount>=15?"#ff9900":comboCount>=8?"#ffdd00":"#ffffff";
  const pulse = 1+Math.sin(frameCount*0.35)*0.06;
  const cx=W/2, cy=H*0.16;
  ctx.save();
  ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.translate(cx,cy);ctx.scale(pulse,pulse);
  ctx.font="bold 30px Arial";
  ctx.lineWidth=5;ctx.strokeStyle="rgba(0,0,0,0.75)";
  ctx.strokeText(`${comboCount} COMBO`,0,0);
  ctx.fillStyle=tierColor;
  ctx.fillText(`${comboCount} COMBO`,0,0);
  ctx.font="bold 11px Arial";
  ctx.strokeText("liên hoàn đòn đánh","0",16);
  ctx.strokeText("liên hoàn đòn đánh",0,16);
  ctx.fillStyle="white";
  ctx.fillText("liên hoàn đòn đánh",0,16);
  ctx.restore();
}

// ---------- Low-HP warning vignette (screen-space; call outside the camera transform) ----------
function drawLowHpVignette(){
  if(!p1||p1.hp<=0)return;
  const frac=p1.hp/(p1.maxHp||MAX_HP);
  if(frac>0.25)return;
  const pulse=0.25+0.20*Math.abs(Math.sin(frameCount*0.09));
  const grad=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.75);
  grad.addColorStop(0,"rgba(180,0,0,0)");
  grad.addColorStop(1,`rgba(180,0,0,${pulse})`);
  ctx.save();ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);ctx.restore();
}

let hitEffects=[];
function spawnHitEffect(x,y,color){
  color=color||"white";
  hitEffects.push({x,y,color,life:16,maxLife:16,ring:true});
  for(let i=0;i<7;i++){
    hitEffects.push({x:x+rndInt(-8,8),y:y+rndInt(-8,8),vx:(rng()-0.5)*6,vy:-rng()*4-1,life:20,maxLife:20,particle:true,color});
  }
}
function spawnBossDeathBurst(x,y){
  screenShake=Math.max(screenShake,40);
  for(let i=0;i<32;i++){
    const ang=rng()*Math.PI*2,spd=rng()*8+3;
    hitEffects.push({x,y:y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:52,maxLife:52,particle:true,color:rndChoice(["orange","red","yellow","white","#ffaa33"])});
  }
  hitEffects.push({x,y:y-60,life:42,maxLife:42,color:"gold",ring:true,big:true});
  hitEffects.push({x,y:y-60,life:60,maxLife:60,color:"white",ring:true,big:true,delay:6});
}
function spawnJumpSmoke(x,y){
  // Puff of dust bursting from the feet — makes double/triple jumps feel like a hard stomp-off.
  for(let i=0;i<10;i++){
    const ang=Math.PI+(rng()-0.5)*Math.PI*0.9,spd=rng()*2.2+0.6;
    hitEffects.push({x:x+rndInt(-6,6),y:y-4,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd*0.4-0.3,life:26,maxLife:26,smoke:true,r0:rndInt(5,9),color:rndChoice(["#e8e8e8","#d4d4d4","#ffffff","#bfbfbf"])});
  }
}
function updateAndDrawHitEffects(){
  _compact(hitEffects,fx=>fx.life>0);
  hitEffects.forEach(fx=>{
    fx.life--;
    if(fx.smoke){
      fx.x+=fx.vx;fx.y+=fx.vy;fx.vy+=0.02;
      const t=1-fx.life/fx.maxLife,r=fx.r0+t*14,a=Math.max(0,fx.life/fx.maxLife)*0.55;
      ctx.save();ctx.globalAlpha=a;ctx.fillStyle=fx.color;
      ctx.beginPath();ctx.arc(fx.x,fx.y,r,0,Math.PI*2);ctx.fill();
      ctx.restore();
    }else if(fx.particle){
      fx.x+=fx.vx;fx.y+=fx.vy;fx.vy+=fx.size?0.06:0.22; // big (smoke-like) particles drift instead of falling hard
      const a=Math.max(0,fx.life/fx.maxLife);
      const s=fx.size||6;
      ctx.save();ctx.globalAlpha=a;
      _oval(fx.x-s/2,fx.y-s/2,s,s,fx.color,null);
      ctx.restore();
    }else if(fx.ring){
      const a=Math.max(0,fx.life/fx.maxLife);
      const maxR=fx.big?80:40;
      const r=(1-a)*maxR+10;
      ctx.save();ctx.globalAlpha=a*0.8;ctx.strokeStyle=fx.color;ctx.lineWidth=fx.big?5:3;
      ctx.beginPath();ctx.arc(fx.x,fx.y,r,0,Math.PI*2);ctx.stroke();
      if(!fx.big){ctx.globalAlpha=a;ctx.fillStyle="white";ctx.beginPath();ctx.arc(fx.x,fx.y,4,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    }else if(fx.shockwave){
      // Vòng sóng nổ cỡ lớn, tự chỉnh bán kính/tốc độ/độ dày riêng (không dùng
      // chung kích cỡ cố định của "ring" thường) — dùng cho những vụ nổ cần
      // to rõ và chậm hơn để mắt kịp nhìn thấy.
      const a=Math.max(0,fx.life/fx.maxLife);
      const r=(1-a)*fx.maxR+15;
      ctx.save();ctx.globalAlpha=a*0.9;ctx.strokeStyle=fx.color;ctx.lineWidth=fx.lw||10;
      ctx.shadowColor=fx.color;ctx.shadowBlur=20;
      ctx.beginPath();ctx.arc(fx.x,fx.y,r,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  });
}
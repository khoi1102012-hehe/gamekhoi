// ================================================================
//  FIRE — generic burn (damage-over-time) queue. Works against any target
//  type (Fighter, ChallengeEnemy, Boss, RoadEnemy, RoadBoss...) because it
//  just calls the existing applyDamage() dispatcher on a tick, instead of
//  hooking into every game mode's own hit-detection code.
// ================================================================
let burnEffects=[];
function igniteBurn(target,attacker,dmgPerTick,ticks){
  if(!target||target.hp===undefined||target.hp<=0)return;
  burnEffects.push({target,attacker,dmg:dmgPerTick,ticksLeft:ticks,tick:0});
}
function updateBurnEffects(){
  if(!burnEffects.length)return;
  _compact(burnEffects,b=>b.target&&b.target.hp>0&&b.ticksLeft>0);
  burnEffects.forEach(b=>{
    b.tick++;
    if(b.tick>=18){ // ~0.3s per tick @60fps
      b.tick=0;b.ticksLeft--;
      applyDamage(b.target,b.dmg,b.attacker);
      if(b.target.hp>0)spawnHitEffect(b.target.x,(b.target.y||0)-50,"#FF6600");
    }
  });
}
function _dashCapture(f,oldX,oldY){
  if(!f.afterImages)f.afterImages=[];
  const col=(ELEMENT_COLORS[f.charType]||"white");
  const steps=5;
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    f.afterImages.push({x:oldX+(f.x-oldX)*t,y:oldY+(f.y-oldY)*t,dir:f.direction,life:18,maxLife:18,color:col});
  }
}

// ================================================================
//  FIGHTER CLASS
// ================================================================
class Fighter {
  constructor(x,y,charType,direction){
    this.charType=charType;
    this.reset(x,y,direction);
  }
  reset(x,y,direction){
    this.x=x;this.y=y;this.vy=0;this.onGround=false;
    this.jumpsUsed=0;this._upPrevInput=false;this._ambient=null;
    // Per-element size/speed/HP — see CHAR_PROFILE above.
    const _prof=charProfile(this.charType);
    this.sizeMult=_prof.size;this.speedMult=_prof.speed;
    this.maxHp=Math.round(MAX_HP*_prof.hp);
    this.hp=this.maxHp;this.direction=direction;
    this.isAttacking=false;this.attackCooldown=0;this.activeSkill=null;
    this.isShielding=false;
    this.cds={s1:0,s2:0,s3:0,s4:0,s5:0};
    this.animFrame=0;this.ultiTimer=0;this.ultiPulse=0;
    this.rainDrops=[];this.lightningBolts=[];
    this.slowTimer=0;this.earthPillars=[];
    this._meteorWindup=0;this._meteorExploded=false;this._meteorExplodeFrame=0;this._meteorTargetX=0;this._meteorTargetY=0;this._meteorCracks=null;
    this.targetSpikeX=0;this.thunderBoltX=0;this.thunderBoltXs=[];
    this.thunderFCount=0;this.thunderFTimer=0;
    this.waterShieldHp=0;this.tsunamiActive=false;
    this.tsunamiWaveXL=0;this.tsunamiWaveXR=0;
    this.windBoostTimer=0;this.windDashTrail=[];this.windDashTimer=0;
    this.windCycloneActive=false;this.windCycloneX=null;this.windCycloneY=null;this.windCycloneTimer=0;this.windCycloneTick=0;
    this.windSideCyclones=[];
    this.windStormTick=0;
    this.stunTimer=0;
    this.transformTimer=0;this.transformActive=false;
    this.transformInvisTimer=0;this.transformInvisActive=false;
    this.ghostHp=0;this.thunderAuraTick=0;this.shockStack=0;
    this.thunderDashTimer=0;this.thunderDashTrail=[];this.thunderPrisonTimer=0;this.thunderPrisonBreakCd=0;
    // M1 (Lôi Thương ném giáo), Chiêu 2 (Lôi Điện Giáng) & giáp ảo, Chiêu 3/Ulti (Lôi Cầu Phán Quyết)
    this.thunderM1WindupTimer=0;this.thunderM1Target=null;
    this.thunderShieldHp=0;this.thunderShieldTimer=0;
    this.thunderCallTimer=0;this.thunderCallStruck=false;this.thunderCallX=0;this.thunderCallY=0;
    this.thunderUltiOrbX=0;this.thunderUltiOrbY=0;this.thunderUltiHitSet=new Set();
    this.waterRegenTick=0;this.windMiniTornadoTick=0;
    this.crowAngle=0;this.isFlying=false;
    this.v4InvisScheduled=false;this.v4LifestealPct=0;
    this.waterSlowAuraTick=0;this._slowPct=0.5;
    this._dashSmoke=[];
    this.dmgReduceTimer=0;
    this.boulderY=-320;this.boulderLanded=false;
    this.waterCloudTimer=0;this.waterCloudTick=0;this.waterCloudDrops=[];
    this.auraParticles=[];this.afterImages=[];this.transformBurstTimer=0;
    this.transformWindupTimer=0;this.transformLandingTimer=0;this._ringAngle=0;
    this._transformWindupTotal=0; // total-frame length of the currently running windup (set at cast time; SHADOW uses 210 = 3.5s @60fps, other types default to 360 if ever used)
    this._shadowRiftCracked=false;this._shadowWhispered=false;this._shadowWindupBurstDone=false; // one-shot SFX/FX flags for the Shadow V4 wind-up sequence
    this._runTrailTick=0;this._lastX=x;
    // --- RED (Hỏa Ma Thần) V4-only state — namespaced, only ever touched when charType==="red" ---
    this.hoaChungStacks=0;this.hoaChungFlashTimer=0;
    this._fireCircleAngle=0;this._fireCircleAngle2=0;this._fireCircleEmbers=[];
    this._windupCrackled=false;
    this._fireFootprints=[];this._fireAsh=[];this._fireFlyTrail=[];
    this.fireFlyDamageTick=0;
    // --- Frost-only skill state (namespaced so other characters are unaffected) ---
    this.frostSlideTrail=[];this.frostSlideActive=0;
    this.frostDomainActive=false;this.frostDomainTimer=0;this.frostDomainTick=0;
    this._domainSnow=[];
    this.frostPillarTick=0;
    this.frostComboLog=[];this.frostComboFX=0;this.frostComboBonusPct=0;
    this._icePrisonedTargets=[];
    this._frostAbsZeroTimer=0;this._frostAbsZeroCrystals=[];
    this._icePrisoned=false;this._icePrisonTimer=0;
    // --- Earth-only skill state ---
    this.earthMudActive=false;this.earthMudTimer=0;this.earthMudSpeed=1;this.earthMudRegen=0;
    this.earthMinions=[];this.earthMinionLimit=18;this.earthMinionUpdateTick=0;
    // --- Thunder-only skill state ---
    this.thunderS3Targets=[];this.thunderS3DelayTick=0;this.thunderS3MaxTick=20;
    // --- FIRE-only skill state (namespaced so no other character is affected) ---
    this.fireDashTimer=0;this.fireDashTrail=[];
    this.firePillarTargets=[];this.firePillarDelayTick=0;this.firePillarMaxTick=22;
    this._fireUltiExploded=false;this._fireUltiTargetX=0;this._fireUltiTargetY=0;
    this._fireUltiWindup=100;this._fireUltiExplodeFrame=0;
    this._fireEmbers=[];this._fireV2Particles=[];this._fireHairFlicker=0;this._firePillarBursts=[];
    // --- SHADOW (Bóng Tối) skill state ---
    // s1 Đánh thường: fired as a projectile, no extra state needed beyond the projectile itself.
    // F (s2) Void Tentacle: portal opens above the target, a short delay later a tentacle stabs down.
    this.shadowTentacleTarget=null;this.shadowTentacleDelayTick=0;
    this.shadowTentaclePortalDur=20;this.shadowTentacleWaitDur=15;this.shadowTentacleGrowDur=15;
    this.shadowTentacleMaxTick=50;
    this._shadowTentacleDissolve=null;
    // T (s3) Thoát Xác: soul leaves the body — untargetable + faster, old body stays behind as a decoy.
    this._soulActive=false;this._soulTimer=0;this._soulMaxTimer=180;this._soulBody=null;
    // G (s4) Ultimate: giant portal + arm slam on the nearest enemy.
    this._shadowUltiExploded=false;this._shadowUltiTargetX=0;this._shadowUltiTargetY=0;
    this._shadowUltiTargetRef=null;this._shadowUltiWindup=60;
    this._shadowUltiPortalDur=30;this._shadowUltiSlamDur=30;this._shadowUltiDissolve=null;
    this._shadowFrozenTargets=[]; // { ref, timer } — draws an actual ice-block over stunned targets, like Frost's Ice Prison
    this._shadowGroundCracks=[]; // { x, y, timer, maxTimer, seed } — lingering ground crack decals from the ulti impact
  }
  applyGravity(floorY){
    if(this.stunTimer>0)this.stunTimer--;
    if(this.thunderDashTimer>0)this.thunderDashTimer--;
    if(this.fireDashTimer>0)this.fireDashTimer--;
    // Thunder Prison: while caged, periodically zap + snap the victim back
    // toward the cage center the instant they try to drift away.
    if(this.thunderPrisonTimer>0){
      this.thunderPrisonTimer--;
      const dxp=this.x-(this.thunderPrisonCenterX||this.x);
      if(Math.abs(dxp)>70*SR){
        this.x=(this.thunderPrisonCenterX||this.x)+Math.sign(dxp)*70*SR;
        spawnHitEffect(this.x,this.y-60,"#FFFFFF");
        screenShake=Math.max(screenShake,6);
      }
      if(this.thunderPrisonTimer%20===0)applyDamage(this,3,this._thunderPrisonCaster);
    }
    // TRANSFORM WIND-UP: freezes the fighter in place (no gravity drift) while
    // the charge-up sequence plays out in _drawTransformWindup(). When the
    // timer reaches 0 we hand off to _finalizeTransform() exactly once —
    // this is the single choke point every element's windup (currently only
    // SHADOW actually sets this timer > 0; see castSkill skillNum===5) funnels
    // through, so nothing else needs its own parallel completion check.
    if(this.transformWindupTimer>0){
      this.transformWindupTimer--;
      this.vy=0;
      if(this.transformWindupTimer===0){
        this._finalizeTransform(floorY);
      }
      return;
    }
    if(this.transformLandingTimer>0){
      this.transformLandingTimer--;
      this.vy=0; // Không dùng trọng lực bình thường
      this.y+=3.5; // Đáp xuống từ từ
      if(this.y>=floorY){this.y=floorY;this.transformLandingTimer=0;this.onGround=true;}
      return;
    }
    if(this.transformActive&&(this.charType==="frost"||this.charType==="red")&&this.isFlying){
      this.vy*=0.8;this.y+=this.vy;
      if(this.y<60)this.y=60;
      if(this.y>=floorY){this.y=floorY;this.vy=0;}
      this.onGround=false;return;
    }
    this.vy+=GRAVITY;this.y+=this.vy;
    if(this.y>=floorY){this.y=floorY;this.vy=0;this.onGround=true;this.jumpsUsed=0;}
    else this.onGround=false;
  }
  // Fires once the transform windup (stand-still + rise-up) finishes: this is
  // the moment the powerful 20-ray spark explosion happens and the V4 skin
  // actually switches on.
  _finalizeTransform(floorY){
    this.transformLandingTimer=30;
    // Transform duration: SHADOW gets 20s (1200f — pairs with its 30s cast
    // cooldown above in castSkill), every other element keeps the original
    // 10s (600f).
    this.transformActive=true;this.transformTimer=(this.charType==="shadow"?1200:600);this.attackCooldown=20;
    const buffs=this.getTransformBuffs();
    if(this.charType==="frost"||this.charType==="red")this.isFlying=buffs.can_fly||false;
    if(this.charType==="shadow")this.v4LifestealPct=buffs.lifesteal||0;
    // RED no longer gets a scripted "bất tử" invulnerability window — replaced by the
    // Hỏa Chủng (Fire Seed) stack mechanic below (see _afterHit / triggerHoaChungExplosion).
    if(this.charType==="red"){this.v4InvisScheduled=false;this.transformInvisActive=false;this.transformInvisTimer=0;this.hoaChungStacks=0;this.hoaChungFlashTimer=0;this._fireFlyTrail=[];this._fireFootprints=[];}
    if(this.charType==="earth"){this.ghostHp=130;this._earthRockArmor=true;this._earthRockTimer=0;this._earthRockAngle=0;}
    if(this.charType==="fire"){this.fireDashTimer=0;this.fireDashTrail=[];this.firePillarTargets=[];this._fireEmbers=[];this._fireV2Particles=[];sfxFireCrackle();}
    this.transformBurstTimer=25;
    screenShake=Math.max(screenShake,12);
    const _tCol=this.charType==="red"?"#00AEFF":(this.charType==="fire"?FIRE_V2_COL:(ELEMENT_COLORS[this.charType]||"white"));
    sfxExplosion();
    // 12 spark rays bursting outward (reduced from 30)
    for(let i=0;i<12;i++){
      const ang=(i/12)*Math.PI*2,spd=rng()*6+8;
      hitEffects.push({x:this.x,y:this.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-5,life:35,maxLife:35,particle:true,color:_tCol});
    }
    // Ground shockwave ring (reduced size)
    hitEffects.push({x:this.x,y:this.y,life:25,maxLife:25,color:_tCol,ring:true,big:true});
    hitEffects.push({x:this.x,y:this.y,life:35,maxLife:35,color:"white",ring:true,big:true,delay:5});
    // Element-specific landing burst (reduced counts)
    if(this.charType==="red"){
      for(let i=0;i<10;i++){const fx=this.x+rndInt(-60,60),fy=this.y+rndInt(-10,20);hitEffects.push({x:fx,y:fy,vx:(rng()-0.5)*2,vy:-rng()*4-2,life:30,maxLife:30,particle:true,color:rndChoice(["#FF6600","#FF4400","orange","yellow"])});}
    }else if(this.charType==="fire"){
      for(let i=0;i<14;i++){const ang=rng()*Math.PI*2,spd=rng()*6+3;hitEffects.push({x:this.x,y:this.y-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:32,maxLife:32,particle:true,color:rndChoice(["#00AEFF","#00E5FF","white","#66F0FF"])});}
      hitEffects.push({x:this.x,y:this.y-20,life:28,maxLife:28,color:"#00CFFF",ring:true,big:true});
    }else if(this.charType==="earth"){
      for(let i=0;i<12;i++){const ang=Math.PI+(rng()-0.5)*Math.PI,spd=rng()*6+3;hitEffects.push({x:this.x+rndInt(-40,40),y:this.y,vx:Math.cos(ang)*spd,vy:-Math.abs(Math.sin(ang))*spd-1,life:35,maxLife:35,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#4a3524","#c68a4a"])});}
      for(let i=0;i<5;i++){const cx=this.x+(i-2)*25;hitEffects.push({x:cx,y:this.y,life:35,maxLife:35,particle:true,color:"#4a3524",vx:(rng()-0.5)*0.8,vy:-0.2});}
    }else if(this.charType==="thunder"){
      for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,spd=rng()*5+3;hitEffects.push({x:this.x,y:this.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:25,maxLife:25,particle:true,color:rndChoice(["#FFD700","white","#FFF176"])});}
      for(let i=0;i<3;i++){spawnLightningArc(this.x+rndInt(-80,80),this.y-150,this.x+rndInt(-30,30),this.y-40);}
    }else if(this.charType==="frost"){
      for(let i=0;i<10;i++){const ang=rng()*Math.PI*2,spd=rng()*4+2;hitEffects.push({x:this.x,y:this.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-1,life:30,maxLife:30,particle:true,color:rndChoice(["white","#AEEBFF","cyan"])});}
    }else if(this.charType==="water"){
      for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,spd=rng()*5+3;hitEffects.push({x:this.x,y:this.y-40,vx:Math.cos(ang)*spd,vy:-Math.abs(Math.sin(ang))*spd-1,life:30,maxLife:30,particle:true,color:rndChoice(["aqua","dodgerblue","white"])});}
    }else if(this.charType==="wind"){
      for(let i=0;i<8;i++){const ang=(i/8)*Math.PI*2,spd=rng()*7+4;hitEffects.push({x:this.x,y:this.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3,life:30,maxLife:30,particle:true,color:rndChoice(["#90EE90","white","#CCFFCC"])});}
    }else if(this.charType==="shadow"){
      // THẦN CHẾT — a billowing cloud of black smoke erupts outward instead of the
      // old demon burst. Anything caught in the cloud (all nearby "quái") gets
      // slowed 30% for 5s and its skin is swapped to a Grim Reaper permanently.
      for(let i=0;i<20;i++){const ang=rng()*Math.PI*2,spd=rng()*5+2;hitEffects.push({x:this.x,y:this.y-55,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd*0.6-1,life:50,maxLife:50,particle:true,size:rndInt(10,20),color:rndChoice(["#0a0a10","#15151f","#22222e","#302f3d"])});}
      hitEffects.push({x:this.x,y:this.y-40,life:45,maxLife:45,color:"#0e0e16",ring:true,big:true});
      hitEffects.push({x:this.x,y:this.y-40,life:60,maxLife:60,color:"#6654ff",ring:true,big:true,delay:8});
      const _reaperRadius=280;
      [...roadEnemies,...challengeEnemies].forEach(mob=>{
        if(mob.hp>0&&Math.abs(mob.x-this.x)<_reaperRadius){
          mob.slowTimer=Math.max(mob.slowTimer||0,300); // 5s @60fps
          mob._slowPct=0.3;
          mob.reaperForm=true;
        }
      });
    }
    // Secondary particles (reduced)
    for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,spd=rng()*3+1;hitEffects.push({x:this.x,y:this.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-1,life:20,maxLife:20,particle:true,color:_tCol});}
  }
  jump(){
    if(this.stunTimer>0||this.transformWindupTimer>0)return;
    if(this.transformActive&&(this.charType==="frost"||this.charType==="red")&&this.isFlying){this.vy=-10;return;}
    if(this.onGround){this.vy=JUMP_POWER;this.onGround=false;this.jumpsUsed=1;}
    else if(this.jumpsUsed<3){
      this.jumpsUsed++;
      this.vy=JUMP_POWER*(this.jumpsUsed===2?0.92:0.85);
      spawnJumpSmoke(this.x,this.y);
    }
  }
  getTransformBuffs(){
    if(!this.transformActive)return{};
    switch(this.charType){
      case"red":    return{dmg_mult:1.15,speed:1.2,can_fly:true};
      case"fire":   return{dmg_mult:1.25,speed:1.2,dash_mult:1.2,proj_speed_mult:1.25,burn_mult:1.6,knockback_mult:1.3};
      case"shadow": return{dmg_mult:1.2,lifesteal:0.75,speed:1.3};
      case"thunder":return{dmg_mult:1.1,speed:1.5};
      case"frost":  return{dmg_mult:1.1,can_fly:true};
      case"water":  return{dmg_mult:1.1,shield_regen:1.5};
      case"earth":  return{dmg_mult:1.25,speed:0.9,slow_aura:true};
      case"wind":   return{dmg_mult:1.05,speed:2.0};
    }
    return{};
  }
  draw(ox=0,oy=0){
    // Anchor the shrink at the character's feet (ground contact point) so it
    // scales down in place instead of floating up/sinking into the floor.
    const _gx=this.x+ox, _gy=this.y+oy;
    ctx.save();
    ctx.translate(_gx,_gy);
    const _cvs=CHAR_VISUAL_SCALE*(this.sizeMult||1);
    ctx.scale(_cvs,_cvs);
    ctx.translate(-_gx,-_gy);
    // SHADOW — Thoát Xác: while the soul is out of the body it renders as a
    // lighter, translucent, smoke-wreathed ghost (real body colors dimmed).
    if(this._soulActive){
      ctx.save();
      ctx.globalAlpha=0.55;
      ctx.shadowColor="#b866ff";ctx.shadowBlur=16;
      this._drawInner(ox,oy);
      ctx.restore();
    }else{
      this._drawInner(ox,oy);
    }
    ctx.restore();
  }
  _drawInner(ox=0,oy=0){
    this.animFrame++;
    // SHADOW V4 — THẦN CHẾT: while transformed, the entire body is replaced
    // by the Grim Reaper (hood, cape, scythe) — no generic block body at all.
    if(this.charType==="shadow"&&this.transformActive){this._drawReaperFighter(ox,oy);return;}
    // EARTH S2 — MUD FORM: while transformed into mud, the character is fully
    // replaced by a dedicated sink/submerge/emerge visual (no normal body,
    // no rock-orbit ambient FX). Self-contained and driven purely by the
    // earthMudTimer countdown so it can never desync or get stuck.
    if(this.charType==="earth"&&this.earthMudActive){this._drawMudForm(ox,oy);return;}
    const COLOR_MAP={red:"red",shadow:"#551a8b",thunder:"gold",frost:"deepskyblue",earth:"sienna",water:"dodgerblue",wind:"#90EE90",fire:FIRE_V1_COL};
    const isRedV4=this.charType==="red"&&this.transformActive;
    const isThunderV4=this.charType==="thunder"&&this.transformActive;
    const isFireV2=this.charType==="fire"&&this.transformActive;
    let cFill=isRedV4?"#FF6644":(isThunderV4?THUNDER_WHITE:(isFireV2?"white":(COLOR_MAP[this.charType]||"white"))); // body glows brighter/hotter while transformed
    const rx=this.x+ox,ry=this.y+oy-52;
    let cOut;
    if(this.stunTimer>0)cOut="orange";
    else if(this.slowTimer>0)cOut="deepskyblue";
    else if(isRedV4)cOut="#00CFFF"; // glowing blue outline while transformed
    else if(isThunderV4)cOut=THUNDER_GOLD; // glowing gold outline while transformed
    else if(isFireV2)cOut=FIRE_V2_COL; // Flame V2 — glowing cyan outline
    else cOut=this.isAttacking?"cyan":"white";
    // Leave a blue/gold afterimage behind on every running step while transformed
    if((isRedV4||isThunderV4||isFireV2)&&this.onGround){
      if(this._lastX===undefined)this._lastX=this.x;
      const moved=this.x-this._lastX;
      this._runTrailTick=(this._runTrailTick||0)+1;
      if(Math.abs(moved)>1.2&&this._runTrailTick%5===0){
        this.afterImages.push({x:this.x,y:this.y,dir:this.direction,life:14,maxLife:14,color:isThunderV4?THUNDER_GOLD:(isFireV2?FIRE_V2_COL:"#00AEFF")});
      }
    }
    this._lastX=this.x;
    this._drawAfterImages(ox,oy);
    this._drawLivingAura(rx,ry);
    this._drawAmbientFX(rx,ry);
    if(isRedV4){ctx.save();ctx.shadowColor="#00AEFF";ctx.shadowBlur=16;}
    else if(isThunderV4){ctx.save();ctx.shadowColor=THUNDER_GOLD;ctx.shadowBlur=18;}
    else if(isFireV2){ctx.save();ctx.shadowColor=FIRE_V2_COL;ctx.shadowBlur=18;}
    this._drawElementalBody(rx,ry,cFill,cOut);
    if(isRedV4||isThunderV4||isFireV2)ctx.restore();
    if(this.transformWindupTimer>0){
      const _windupTotal=this._transformWindupTotal||360;
      // SHADOW reserves its first 45 frames (0.75s) for the camera
      // delay+punch-in (see shadowCamZoomState() in 07) with NOTHING drawn —
      // including this label — so it doesn't hang in front of the zoom.
      const _preroll=(this.charType==="shadow")?45:0;
      const _age=_windupTotal-this.transformWindupTimer;
      if(_age>=_preroll){
        const _windupProg=(_age-_preroll)/Math.max(1,_windupTotal-_preroll);
        const _windupText=this.charType==="red"?"🔥 TRIỆU HỒI HỎA NGỤC 🔥":this.charType==="fire"?"🔥 CHUYỂN HÓA FLAME V2 🔥":this.charType==="earth"?"🗿 LUYỆN THẠCH GIÁP 🗿":this.charType==="thunder"?"⚡ GỌI THẦN SẤM ⚡":this.charType==="frost"?"❄️ HÓA RỒNG BĂNG ❄️":this.charType==="water"?"🌊 THIÊN THẦN GIÁNG THẾ 🌊":this.charType==="shadow"?"😈 MỞ CỬA ĐỊA NGỤC 😈":"🌪️ THỎ BỒNG BỘT 🌪️";
        _text(rx,ry-105,_windupText,"white","9px Arial bold");
        // Show phase indicator. SHADOW stands its ground the whole time (no
        // rise/descend flight), so it gets its own awaken -> drain -> burst
        // labels instead of the generic fly-up-and-land phrasing.
        const _phase=(this.charType==="shadow")
          ? (_windupProg<0.4?"Thức tỉnh bóng tối":_windupProg<0.86?"Hút năng lượng":"Bùng nổ")
          : (_windupProg<1/3?"Bay lên":_windupProg<3/4?"Bùng phát":"Đáp xuống");
        _text(rx,ry-115,`[${_phase}]`,"#aaa","7px Arial");
      }
    }
    else if(this.stunTimer>0) _text(rx,ry-105,"⛓ STUNNED ⛓","orange","9px Arial bold");
    else if(this.slowTimer>0) _text(rx,ry-105,"❄️ SLOWED ❄️","deepskyblue","9px Arial bold");
    if(this.charType==="wind"&&this.windBoostTimer>0){
      for(let i=0;i<4;i++){
        const ang=(this.animFrame*8+i*90)%360*(Math.PI/180);
        const wx=rx+40*Math.cos(ang),wy=ry+20+30*Math.sin(ang);
        _oval(wx-5,wy-5,10,10,"#90EE90",null);
      }
    }
    if(this.isShielding){
      const SC={red:"gold",shadow:"magenta",thunder:"yellow",frost:"cyan",earth:"burlywood",water:"aqua",wind:"lightgreen",fire:"orangered"};
      const sc=SC[this.charType]||"white";
      ctx.strokeStyle=sc;ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(rx,ry-20,58,Math.PI,0);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx-55,ry-20);ctx.lineTo(rx-55,ry+55);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx+55,ry-20);ctx.lineTo(rx+55,ry+55);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx-55,ry+55);ctx.lineTo(rx+55,ry+55);ctx.stroke();
    }
    if(this.charType==="water"&&this.waterShieldHp>0){
      const pulse=Math.sin(this.animFrame*0.15)*5;
      ctx.strokeStyle="aqua";ctx.lineWidth=3;ctx.setLineDash([6,3]);
      ctx.beginPath();ctx.ellipse(rx,ry-18,50+pulse,78+pulse,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);
    }
    if(this.charType==="thunder"&&this.thunderShieldHp>0){
      // GIÁP ẢO (Chiêu 2 payoff): vòng tím-xanh lung linh quanh người, hiện
      // độc lập với activeSkill để còn thấy trong suốt 3 giây hiệu lực.
      const pulse=Math.sin(this.animFrame*0.2)*4;
      ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=10;
      ctx.strokeStyle="#c77dff";ctx.lineWidth=3;ctx.setLineDash([5,4]);
      ctx.beginPath();ctx.ellipse(rx,ry-18,46+pulse,74+pulse,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    }
    if(this._dashSmoke&&this._dashSmoke.length){
      _compact(this._dashSmoke,s=>s.life>0);
      this._dashSmoke.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--;const a=Math.max(0,s.life/30*0.55);ctx.beginPath();ctx.fillStyle=`rgba(50,15,70,${a})`;ctx.arc(s.x+ox,s.y+oy,s.r,0,Math.PI*2);ctx.fill();});
    }
    if(this.transformWindupTimer>0)this._drawTransformWindup(rx,ry);
    if(this.transformActive)this._drawTransform(rx,ry);
    if(this.attackCooldown>0&&this.activeSkill)this._drawSkillFX(rx,ry);
    if(this.dmgReduceTimer>0)this._drawEarthBuff(rx,ry);
    if(this.waterCloudTimer>0)this._drawWaterCloud(rx,ry);
    if(this.ultiTimer>0)this._drawUlti(rx,ry);
    if(this.transformBurstTimer>0)this._drawTransformBurst(rx,ry);
  }
  // Minimal muddy-brown silhouette used only during the sink-in / rise-out
  // transition edges of Mud Form, so the character reads as "turning into
  // mud" / "climbing back out" rather than popping in and out of existence.
  // ================================================================
  //  ELEMENTAL BODY DISPATCH — replaces the old shared 3-rect body.
  //  Each charType gets its own silhouette + head + eyes + signature
  //  prop, drawn with plain path calls (lineTo/quadraticCurveTo) so
  //  every character reads as a distinct shape even at small size,
  //  not just a different fill color on the same three boxes.
  // ================================================================
  _drawElementalBody(rx,ry,cFill,cOut){
    const dir=this.direction, af=this.animFrame;
    switch(this.charType){
      case"thunder": this._bodyThunder(rx,ry,cFill,cOut,dir,af); return;
      case"frost":   this._bodyFrost(rx,ry,cFill,cOut,dir,af); return;
      case"earth":   this._bodyEarth(rx,ry,cFill,cOut,dir,af); return;
      case"water":   this._bodyWater(rx,ry,cFill,cOut,dir,af); return;
      case"wind":    this._bodyWind(rx,ry,cFill,cOut,dir,af); return;
      case"fire":    this._bodyFire(rx,ry,cFill,cOut,dir,af); return;
      case"shadow":  this._bodyShadowIdle(rx,ry,cFill,cOut,dir,af); return;
      default:
        // Safety net for any legacy/unused charType (e.g. "red") — keep
        // the old generic silhouette so nothing ever fails to render.
        _rect(rx-28,ry,56,52,cFill,cOut,2);
        _rect(rx-12,ry-20,24,20,cFill,cOut,1);
        _rect(rx-20,ry-60,40,40,cFill,cOut,2);
        _oval(rx+(10*dir)-3,ry-44,6,6,"white",null);
        _rect(rx-36,ry-64,72,4,"black",cOut,1);
        _rect(rx-24,ry-74,48,10,"black",cOut,1);
        _rect(rx-16,ry-82,32,8,"black",cOut,1);
        _rect(rx-8,ry-88,16,6,"black",cOut,1);
    }
  }
  // ----------------------------------------------------------------
  //  THUNDER — inverted-triangle torso with a jagged lightning-bolt
  //  edge (instead of straight rect sides), pentagon head with a
  //  swept-back spike, flashing shoulder spikes, and a hand-held
  //  charge rod that occasionally arcs a spark off its tip.
  // ----------------------------------------------------------------
  _bodyThunder(rx,ry,cFill,cOut,dir,af){
    // jittery idle offset — Thunder never sits perfectly still
    const jx=(af%7<2)?rndInt(-1,1):0, jy=(af%11<2)?rndInt(-1,0):0;
    const x=rx+jx, y=ry+jy;
    // TORSO — wide shoulders tapering to narrow hips, zigzag side edges
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x-32,y-6);
    ctx.lineTo(x+32,y-6);
    ctx.lineTo(x+14,y+18);
    ctx.lineTo(x+23,y+32);
    ctx.lineTo(x+9,y+50);
    ctx.lineTo(x-9,y+50);
    ctx.lineTo(x-23,y+32);
    ctx.lineTo(x-14,y+18);
    ctx.closePath();ctx.fill();ctx.stroke();
    // SHOULDER SPIKES — 3 small triangles, flash alternately
    for(let i=0;i<3;i++){
      const sx=x-24+i*24;
      const lit=(Math.floor(af/6)+i)%3===0;
      ctx.fillStyle=lit?"white":cFill;
      ctx.beginPath();ctx.moveTo(sx-6,y-6);ctx.lineTo(sx+6,y-6);ctx.lineTo(sx,y-16);ctx.closePath();ctx.fill();
      ctx.strokeStyle=cOut;ctx.lineWidth=1;ctx.stroke();
    }
    // HEAD — pentagon with a back-swept spike
    const hx=x, hy=y-72;
    const backX=x-16*dir;
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(hx-11,hy+14);
    ctx.lineTo(hx-16,hy);
    ctx.lineTo(backX,hy-14);
    ctx.lineTo(hx+16,hy);
    ctx.lineTo(hx+11,hy+14);
    ctx.closePath();ctx.fill();ctx.stroke();
    // EYES — 2 tiny lightning-bolt triangles on the facing side
    const eyeX=hx+7*dir;
    ctx.fillStyle="white";ctx.shadowColor="#FFF9C4";ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(eyeX-4,hy-2);ctx.lineTo(eyeX+3,hy-1);ctx.lineTo(eyeX-2,hy+3);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    // CHARGE ROD — held at the hip on the facing side, tip glows
    const rodX=x+22*dir, rodTopY=y-14, rodBotY=y+30;
    ctx.strokeStyle="#3a2f00";ctx.lineWidth=5;
    ctx.beginPath();ctx.moveTo(rodX,rodBotY);ctx.lineTo(rodX,rodTopY);ctx.stroke();
    ctx.fillStyle="white";ctx.shadowColor="gold";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(rodX,rodTopY,4,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    if(this.onGround && rng()<0.012){
      spawnLightningArc(rodX+rndInt(-15,15),rodTopY-40,rodX,rodTopY);
    }
  }
  // ----------------------------------------------------------------
  //  FROST — a proper ice-armored warrior, not a plain hexagon block.
  //  Crystal-plate torso with a glowing frozen core, a jagged spiked
  //  crown/head, swept-back crystalline "cape wings" behind the
  //  shoulders, a trailing mist-frost aura, TWO ice shards orbiting
  //  (instead of one), and drifting snow motes. Near-motionless idle
  //  otherwise — Frost is still the "stillness" character.
  // ----------------------------------------------------------------
  _bodyFrost(rx,ry,cFill,cOut,dir,af){
    const x=rx,y=ry; // Frost holds almost perfectly still — no jitter
    // GROUND FROST MIST — faint pale cloud pooled at the feet
    ctx.save();ctx.globalAlpha=0.3;
    const mist=ctx.createRadialGradient(x,y+52,4,x,y+52,46);
    mist.addColorStop(0,"rgba(200,240,255,0.5)");mist.addColorStop(1,"rgba(200,240,255,0)");
    ctx.fillStyle=mist;ctx.beginPath();ctx.ellipse(x,y+52,46,16,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // CRYSTAL CAPE-WINGS — swept-back angular ice plates behind the shoulders,
    // giving Frost real silhouette instead of reading as a flat hexagon.
    ctx.fillStyle="rgba(150,220,255,0.55)";ctx.strokeStyle="#bff2ff";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x-22,y-10);ctx.lineTo(x-52,y-2);ctx.lineTo(x-46,y+18);ctx.lineTo(x-24,y+14);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+22,y-10);ctx.lineTo(x+52,y-2);ctx.lineTo(x+46,y+18);ctx.lineTo(x+24,y+14);ctx.closePath();ctx.fill();ctx.stroke();
    // TORSO — crystal-plate armor, bulges at the shoulders/waist, tapers to one sharp foot point
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x-26,y-12);
    ctx.lineTo(x+26,y-12);
    ctx.lineTo(x+32,y+16);
    ctx.lineTo(x+9,y+50);
    ctx.lineTo(x,y+58);
    ctx.lineTo(x-9,y+50);
    ctx.lineTo(x-32,y+16);
    ctx.closePath();ctx.fill();ctx.stroke();
    // ARMOR SEAMS — a couple of sharp facet lines so the torso reads as cut ice, not a flat shape
    ctx.strokeStyle="rgba(230,250,255,0.6)";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x-14,y-10);ctx.lineTo(x-6,y+30);ctx.moveTo(x+14,y-10);ctx.lineTo(x+6,y+30);ctx.stroke();
    // FROZEN CORE — glowing crystal set in the chest
    ctx.save();
    const coreP=0.6+Math.sin(af*0.06)*0.4;
    ctx.fillStyle="#eafcff";ctx.shadowColor="cyan";ctx.shadowBlur=10+coreP*8;
    ctx.beginPath();ctx.moveTo(x,y+2-7);ctx.lineTo(x+5,y+2);ctx.lineTo(x,y+2+7);ctx.lineTo(x-5,y+2);ctx.closePath();ctx.fill();
    ctx.restore();
    // HEAD — hexagon crystal with a taller jagged spiked crown on top
    const hx=x,hy=y-70;
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(hx-14,hy+12);
    ctx.lineTo(hx-16,hy-4);
    ctx.lineTo(hx-6,hy-16);
    ctx.lineTo(hx,hy-27);
    ctx.lineTo(hx+6,hy-16);
    ctx.lineTo(hx+16,hy-4);
    ctx.lineTo(hx+14,hy+12);
    ctx.closePath();ctx.fill();ctx.stroke();
    // SPIKED ICE CROWN — 3 jagged shards fanning up off the head
    ctx.fillStyle="#d8f6ff";ctx.strokeStyle="white";ctx.lineWidth=1.2;
    for(let i=-1;i<=1;i++){
      const sx=hx+i*10,sh=16-Math.abs(i)*5;
      ctx.beginPath();ctx.moveTo(sx-4,hy-16);ctx.lineTo(sx,hy-16-sh);ctx.lineTo(sx+4,hy-16);ctx.closePath();ctx.fill();ctx.stroke();
    }
    // EYES — cold cyan glow dots
    const eyeX=hx+6*dir;
    ctx.fillStyle="cyan";ctx.shadowColor="cyan";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(eyeX,hy-2,3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    // ORBITING ICE SHARDS — two diamonds circling (was one), always present
    // (not just during a skill), so Frost reads as "wielding controlled
    // ice" even at rest.
    for(let k=0;k<2;k++){
      const orbAngle=af*0.035+k*Math.PI;
      const ox2=x+18*dir+Math.cos(orbAngle)*22, oy2=y+18+Math.sin(orbAngle)*10;
      ctx.save();ctx.translate(ox2,oy2);ctx.rotate(orbAngle*1.4);
      ctx.fillStyle="#d8f6ff";ctx.strokeStyle="white";ctx.lineWidth=1.5;
      ctx.shadowColor="cyan";ctx.shadowBlur=8;
      ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6,0);ctx.lineTo(0,9);ctx.lineTo(-6,0);ctx.closePath();
      ctx.fill();ctx.stroke();
      ctx.restore();
    }
    // DRIFTING SNOW MOTES — a few slow sparkles around the body
    for(let s=0;s<4;s++){
      const sAng=(af*0.6+s*90)%360*(Math.PI/180);
      const sxp=x+Math.cos(sAng)*(30+s*4),syp=y-10+Math.sin(sAng*1.3)*30;
      ctx.globalAlpha=0.5+0.5*Math.sin(af*0.05+s);
      ctx.fillStyle="white";ctx.beginPath();ctx.arc(sxp,syp,1.6,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=1;
    }
  }
  // ----------------------------------------------------------------
  //  TERRA — wide-based trapezoid torso (heavier at the hips than the
  //  shoulders, the opposite taper of Thunder) for a low, planted
  //  stance, asymmetric rock-chunk shoulders, a blocky head with
  //  glowing lava-slit eyes, and one oversized stone fist instead of
  //  a held weapon.
  // ----------------------------------------------------------------
  _bodyEarth(rx,ry,cFill,cOut,dir,af){
    const x=rx,y=ry; // Terra barely nudges — heavy, grounded, no idle bounce
    // TORSO — trapezoid, narrow shoulders / wide hips (planted, heavy stance)
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x-19,y-10);
    ctx.lineTo(x+19,y-10);
    ctx.lineTo(x+30,y+50);
    ctx.lineTo(x-30,y+50);
    ctx.closePath();ctx.fill();ctx.stroke();
    // ASYMMETRIC SHOULDER ROCKS — one bigger than the other, natural not machined
    ctx.fillStyle="#8a6a4a";ctx.strokeStyle=cOut;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(x-19,y-10);ctx.lineTo(x-35,y-26);ctx.lineTo(x-11,y-18);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(x+19,y-10);ctx.lineTo(x+29,y-20);ctx.lineTo(x+13,y-16);ctx.closePath();ctx.fill();ctx.stroke();
    // HEAD — blocky square
    const hx=x,hy=y-62;
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    _rect(hx-14,hy-14,28,28,cFill,cOut,2);
    // EYES — glowing lava-slit
    const eyeX=hx+4*dir;
    ctx.fillStyle="#ff8800";ctx.shadowColor="#ff8800";ctx.shadowBlur=8;
    ctx.fillRect(eyeX-4,hy-2,8,3);
    ctx.shadowBlur=0;
    // OVERSIZED STONE FIST — one hand is a jagged rock chunk, not a held prop
    const fx=x+30*dir,fy=y+18;
    ctx.fillStyle="#7a5a3a";ctx.strokeStyle="#3a2818";ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(fx-13,fy-6);ctx.lineTo(fx+2,fy-13);ctx.lineTo(fx+14,fy-4);
    ctx.lineTo(fx+11,fy+11);ctx.lineTo(fx-4,fy+15);ctx.lineTo(fx-14,fy+5);
    ctx.closePath();ctx.fill();ctx.stroke();
  }
  // ----------------------------------------------------------------
  //  WATER — a curved water-elemental silhouette with actual presence:
  //  teardrop torso (fat at the shoulders, pointed at the feet), a soft
  //  oval head crowned with flowing liquid "hair" ribbons, a flowing eye,
  //  a hovering water-orb held near one hand, a bigger dashed vortex ring
  //  studded with orbiting droplets, and a rippling puddle-glow at the
  //  feet. Soft wide idle bob throughout.
  // ----------------------------------------------------------------
  _bodyWater(rx,ry,cFill,cOut,dir,af){
    const bob=Math.sin(af*0.09)*4;
    const x=rx,y=ry+bob;
    // PUDDLE GLOW — soft reflective pool under the feet
    ctx.save();ctx.globalAlpha=0.25;
    const pg=ctx.createRadialGradient(x,y+55,4,x,y+55,40);
    pg.addColorStop(0,"rgba(100,220,255,0.6)");pg.addColorStop(1,"rgba(100,220,255,0)");
    ctx.fillStyle=pg;ctx.beginPath();ctx.ellipse(x,y+55,40,13,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // TORSO — teardrop, all curves, no straight edges
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x,y-14);
    ctx.quadraticCurveTo(x-34,y-14,x-30,y+15);
    ctx.quadraticCurveTo(x-24,y+45,x,y+55);
    ctx.quadraticCurveTo(x+24,y+45,x+30,y+15);
    ctx.quadraticCurveTo(x+34,y-14,x,y-14);
    ctx.closePath();ctx.fill();ctx.stroke();
    // LIQUID SHEEN — a soft curved highlight down one side of the torso
    ctx.strokeStyle="rgba(255,255,255,0.45)";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(x-14,y-6);ctx.quadraticCurveTo(x-20,y+18,x-10,y+40);ctx.stroke();
    // HEAD — soft oval
    const hx=x,hy=y-72;
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(hx,hy,14,16,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    // FLOWING LIQUID CROWN — 3 droplet-tipped ribbons streaming back off the head
    ctx.strokeStyle="rgba(120,220,255,0.85)";ctx.lineWidth=2.5;ctx.lineCap="round";
    for(let i=0;i<3;i++){
      const wob=Math.sin(af*0.07+i)*4;
      const sx=hx-6+i*6;
      ctx.beginPath();
      ctx.moveTo(sx,hy-15);
      ctx.quadraticCurveTo(sx-6*dir+wob,hy-26,sx-2*dir+wob,hy-34-i*2);
      ctx.stroke();
    }
    // EYE — a single flowing curved line instead of a dot
    const eyeX=hx+5*dir;
    ctx.strokeStyle="white";ctx.lineWidth=2;ctx.shadowColor="aqua";ctx.shadowBlur=8;
    ctx.beginPath();ctx.moveTo(eyeX-4,hy-2);ctx.quadraticCurveTo(eyeX,hy+2,eyeX+4,hy-2);ctx.stroke();
    ctx.shadowBlur=0;
    // HOVERING WATER ORB — a small sphere of swirling liquid held near one hand
    const orbAngle=af*0.04;
    const wox=x+26*dir+Math.sin(orbAngle)*4, woy=y+10+Math.cos(orbAngle*1.2)*6;
    ctx.save();
    const og=ctx.createRadialGradient(wox-3,woy-3,1,wox,woy,9);
    og.addColorStop(0,"rgba(255,255,255,0.9)");og.addColorStop(0.5,"rgba(100,210,255,0.85)");og.addColorStop(1,"rgba(30,140,220,0.6)");
    ctx.fillStyle=og;ctx.shadowColor="aqua";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(wox,woy,9,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // VORTEX RING — bigger dashed circle hovering at the chest, studded with
    // small orbiting droplets, always spinning
    ctx.save();
    ctx.strokeStyle="aqua";ctx.lineWidth=2;ctx.setLineDash([5,4]);
    ctx.lineDashOffset=-af*0.6;
    ctx.beginPath();ctx.arc(x,y+14,19,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    for(let d=0;d<3;d++){
      const dAng=af*0.05+d*(Math.PI*2/3);
      const dx=x+Math.cos(dAng)*19,dy=y+14+Math.sin(dAng)*19;
      ctx.fillStyle="#bff2ff";ctx.beginPath();ctx.arc(dx,dy,2.3,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }
  // ----------------------------------------------------------------
  //  WIND — a sleek aerodynamic sprinter: the whole body still leans
  //  into a fixed tilt, but now with a sharp angular torso (not a
  //  plain trapezoid), a trailing scarf/ribbon instead of just hair
  //  streaks, small swept "fin" pauldrons, glowing speed-lines that
  //  peel off the limbs, and 3 wind-swirls (was 2) circling faster and
  //  wider so it visibly reads as the fastest character on the roster.
  // ----------------------------------------------------------------
  _bodyWind(rx,ry,cFill,cOut,dir,af){
    // SPEED LINES — short glowing streaks trailing behind, always present
    ctx.save();ctx.globalAlpha=0.5;ctx.strokeStyle="#CCFFCC";ctx.lineWidth=2;ctx.lineCap="round";
    for(let i=0;i<3;i++){
      const ly=rx?0:0; // no-op guard, kept simple
      const yy=ry-30+i*20;
      ctx.beginPath();ctx.moveTo(rx-14*dir,yy);ctx.lineTo(rx-30*dir-Math.sin(af*0.2+i)*4,yy+2);ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(rx,ry);
    ctx.rotate(0.11*dir); // permanent lean — Wind never stands straight
    // TRAILING SCARF — a long wind-whipped ribbon streaming off the back,
    // reads as motion even while idle
    ctx.strokeStyle="rgba(180,255,190,0.8)";ctx.lineWidth=5;ctx.lineCap="round";
    for(let i=0;i<2;i++){
      const wob=Math.sin(af*0.1+i*1.5)*8;
      ctx.beginPath();
      ctx.moveTo(0,-6+i*4);
      ctx.quadraticCurveTo(-20*dir,-2+i*4+wob,-34*dir,10+i*8+wob*1.4);
      ctx.stroke();
    }
    // TORSO — sharp angular silhouette (was a plain trapezoid)
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(-13,-8);ctx.lineTo(13,-8);ctx.lineTo(9,50);ctx.lineTo(0,44);ctx.lineTo(-9,50);
    ctx.closePath();ctx.fill();ctx.stroke();
    // SWEPT FIN PAULDRONS — small angular fins on the shoulders
    ctx.fillStyle="#CCFFCC";ctx.strokeStyle=cOut;ctx.lineWidth=1.2;
    ctx.beginPath();ctx.moveTo(-13,-8);ctx.lineTo(-24,-14*dir<0?-14:-2);ctx.lineTo(-9,-2);ctx.closePath();ctx.fill();ctx.stroke();
    // HAIR STREAKS — thin curved lines trailing backward
    ctx.strokeStyle="white";ctx.lineWidth=1.5;ctx.globalAlpha=0.7;
    for(let i=0;i<3;i++){
      const sy=-66+i*5;
      ctx.beginPath();ctx.moveTo(0,sy);
      ctx.quadraticCurveTo(-14*dir,sy-4,-24*dir,sy-2+i*2);
      ctx.stroke();
    }
    ctx.globalAlpha=1;
    // HEAD — small circle
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(0,-68,10,0,Math.PI*2);ctx.fill();ctx.stroke();
    // EYE — thin diagonal slash
    const eyeX=5*dir;
    ctx.strokeStyle="white";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(eyeX-3,-70);ctx.lineTo(eyeX+3,-66);ctx.stroke();
    ctx.restore();
    // WIND SWIRLS — 3 always-on orbits (was 2), wider and faster so Wind
    // visibly reads as the fastest, most evasive character on the roster
    // (independent of the tilt, circles the actual anchor)
    for(let i=0;i<3;i++){
      const ang=(af*9+i*120)%360*(Math.PI/180);
      const wx=rx+34*Math.cos(ang),wy=ry+16+19*Math.sin(ang);
      ctx.globalAlpha=0.6;
      _oval(wx-4,wy-4,8,8,"#CCFFCC",null);
      ctx.globalAlpha=1;
    }
  }
  // ----------------------------------------------------------------
  //  FIRE — torso silhouette is an actual flame shape (wide base,
  //  single wavering peak) whose outline edge points shift with a
  //  sine offset every frame, so the "burning" reads in the base
  //  silhouette itself rather than only in particle FX. Small flame-
  //  tipped head, single glowing eye, and a fast little flame ring
  //  orbiting one hand (mirrors Frost's orbiting shard, opposite
  //  element, same cheap rig).
  // ----------------------------------------------------------------
  _bodyFire(rx,ry,cFill,cOut,dir,af){
    const x=rx,y=ry;
    const peakOff=Math.sin(af*0.15)*6;
    const flick=Math.sin(af*0.22)*3;
    // TORSO — flame silhouette, wide base tapering to one wavering peak
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(x-24,y+50);
    ctx.lineTo(x-18+flick,y+8);
    ctx.lineTo(x-22,y-14);
    ctx.lineTo(x+peakOff,y-42);
    ctx.lineTo(x+20,y-12);
    ctx.lineTo(x+16-flick,y+8);
    ctx.lineTo(x+24,y+50);
    ctx.closePath();ctx.fill();ctx.stroke();
    // HEAD — small circle with flickering flame-tip spikes
    const hx=x,hy=y-58;
    ctx.fillStyle=cFill;ctx.strokeStyle=cOut;ctx.lineWidth=2;
    ctx.beginPath();ctx.arc(hx,hy,11,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle=cFill;
    for(let i=0;i<3;i++){
      const sx=hx-8+i*8, h2=10+Math.sin(af*0.2+i)*4;
      ctx.beginPath();ctx.moveTo(sx-4,hy-9);ctx.lineTo(sx+4,hy-9);ctx.lineTo(sx,hy-9-h2);ctx.closePath();ctx.fill();
    }
    // EYE — single glowing ember dot
    const eyeX=hx+5*dir;
    ctx.fillStyle="yellow";ctx.shadowColor="orange";ctx.shadowBlur=10;
    ctx.beginPath();ctx.arc(eyeX,hy-1,3,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
    // ORBITING FLAME RING — fast small flame circling the hand
    const orbAngle=af*0.09;
    const fx=x+20*dir+Math.cos(orbAngle)*16, fy=y+16+Math.sin(orbAngle)*10;
    ctx.fillStyle="#FFCC66";ctx.shadowColor="orange";ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(fx,fy,5,0,Math.PI*2);ctx.fill();
    ctx.shadowBlur=0;
  }
  // ----------------------------------------------------------------
  //  SHADOW (base form) — a humanoid mass built entirely from dark,
  //  hard-edged blocks. No robe, no cloak silhouette, no visible
  //  weapon: at rest this must read as a still shape made of shadow,
  //  not a person holding something. Rules baked into this shape:
  //   - head: small, nested inside a much larger dark mass (shoulders/
  //     collar), no face — just two glowing eye slits
  //   - shoulders wider than the head; big upper body tapering to a
  //     narrow lower body
  //   - every edge is straight/angular (lineTo only — no curves, no
  //     rounded cloak hem)
  //   - one side only carries extra jagged trailing shard-fragments,
  //     so the silhouette is asymmetric, not mirrored
  //   - arms stay tight against the torso, never spread outward
  //   - the whole thing must still read correctly as flat black + 2
  //     eye dots, with no color/glow required to identify it
  // ----------------------------------------------------------------
  _bodyShadowIdle(rx,ry,cFill,cOut,dir,af){
    const bob=Math.sin(af*0.05)*2; // slow, minimal — a still mass, not a person shifting weight
    ctx.save();
    ctx.translate(rx,ry+bob);
    ctx.scale(dir,1);
    const BLACK="#0a0812", LINE="#211a34";
    // MAIN MASS — torso+shoulders+hips as one continuous hard-edged
    // polygon. Wide jagged shoulder points (well past the head), big
    // upper-body bulge, all straight edges, tapering to a narrow hip
    // line. The gap at the top (-7,-46)..(7,-46) is where the small
    // head sits, nested inside — the collar peaks flank it on both
    // sides and reach nearly as high as the head itself.
    ctx.fillStyle=BLACK;ctx.strokeStyle=LINE;ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(-7,-46);
    ctx.lineTo(-16,-40);
    ctx.lineTo(-30,-34);   // left shoulder spike — wider than the head
    ctx.lineTo(-22,-20);
    ctx.lineTo(-32,-2);    // upper-body bulge, sharp point
    ctx.lineTo(-20,16);
    ctx.lineTo(-24,34);
    ctx.lineTo(-10,44);
    ctx.lineTo(0,40);      // small inward hip notch, keeps the hem angular
    ctx.lineTo(10,44);
    ctx.lineTo(24,34);
    ctx.lineTo(20,16);
    ctx.lineTo(32,-2);     // right upper-body bulge — mirrors the left, no extra shards
    ctx.lineTo(22,-20);
    ctx.lineTo(30,-34);    // right shoulder spike
    ctx.lineTo(16,-40);
    ctx.lineTo(7,-46);
    ctx.closePath();ctx.fill();ctx.stroke();
    // ASYMMETRIC TRAILING SHARDS — one side only (left), jagged
    // fragments of the same dark mass peeling off at different
    // heights. This is what breaks the mirror symmetry; the right
    // side stays clean.
    ctx.fillStyle=BLACK;ctx.strokeStyle=LINE;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-30,-34);ctx.lineTo(-47,-37);ctx.lineTo(-40,-24);ctx.lineTo(-27,-27);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-32,-2);ctx.lineTo(-51,3);ctx.lineTo(-43,18);ctx.lineTo(-28,10);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(-24,34);ctx.lineTo(-39,43);ctx.lineTo(-31,55);ctx.lineTo(-18,46);ctx.closePath();ctx.fill();ctx.stroke();
    // ARMS — kept tight against the torso, never sticking outward.
    // Drawn as a slightly indented seam within the mass rather than a
    // separate limb silhouette, so the outer shape never widens.
    ctx.strokeStyle=LINE;ctx.lineWidth=1.5;ctx.globalAlpha=0.8;
    ctx.beginPath();ctx.moveTo(-17,-36);ctx.lineTo(-19,-6);ctx.lineTo(-13,26);ctx.stroke();
    ctx.beginPath();ctx.moveTo(17,-36);ctx.lineTo(19,-6);ctx.lineTo(13,26);ctx.stroke();
    ctx.globalAlpha=1;
    // LEGS — narrow, straight-edged, tapering to a point at the feet
    ctx.fillStyle=BLACK;ctx.strokeStyle=LINE;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(-10,44);ctx.lineTo(-13,64);ctx.lineTo(-6,68);ctx.lineTo(-3,46);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(10,44);ctx.lineTo(13,64);ctx.lineTo(6,68);ctx.lineTo(3,46);ctx.closePath();ctx.fill();ctx.stroke();
    // HEAD — small, sharp-edged, sitting deep in the notch of the
    // collar above. No face geometry at all beyond the two eye slits.
    const hx=0,hy=-52;
    ctx.fillStyle=BLACK;ctx.strokeStyle=LINE;ctx.lineWidth=1.5;
    ctx.beginPath();
    ctx.moveTo(hx-6,hy-6);ctx.lineTo(hx+6,hy-6);ctx.lineTo(hx+8,hy+2);ctx.lineTo(hx,hy+10);ctx.lineTo(hx-8,hy+2);
    ctx.closePath();ctx.fill();ctx.stroke();
    // EYES — the only bright thing on the whole silhouette: two thin
    // glowing slits, nothing resembling a normal face around them.
    const eyeOff=3*dir;
    ctx.fillStyle="#8f7bff";ctx.shadowColor="#8f7bff";ctx.shadowBlur=9;
    ctx.beginPath();ctx.moveTo(hx-6+eyeOff,hy-1);ctx.lineTo(hx-2+eyeOff,hy);ctx.lineTo(hx-6+eyeOff,hy+1.5);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(hx+2+eyeOff,hy);ctx.lineTo(hx+6+eyeOff,hy-1);ctx.lineTo(hx+6+eyeOff,hy+1.5);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    ctx.restore();
  }
  _drawBodyOnly(rx,ry){
    const cFill="#7a5a3a",cOut="#3a2a18";
    _rect(rx-28,ry,56,52,cFill,cOut,2);
    _rect(rx-12,ry-20,24,20,cFill,cOut,1);
    _rect(rx-20,ry-60,40,40,cFill,cOut,2);
    const eyeX=rx+(10*this.direction);
    _oval(eyeX-3,ry-44,6,6,"#ffe9c2",null);
  }
  // ================================================================
  //  EARTH S2 — MUD FORM VISUAL (hóa bùn / lặn xuống đất / trồi lên)
  //  Fully driven by earthMudTimer (300 -> 0, 5s @60fps):
  //    [300..280]  SINK    — body melts down into a puddle, mud splashes out
  //    [280..30]   UNDER   — fully submerged, only a rippling mud pool + bubbles
  //    [30..0]     RISE    — climbs back up out of the ground
  //  Because every phase is derived from the single countdown timer (never a
  //  separate flag), the animation can't desync or leave the character stuck
  //  mid-transition even if the skill ends early or is interrupted.
  // ================================================================
  _drawMudForm(ox=0,oy=0){
    const rx=this.x+ox,ry=this.y+oy-52,groundY=this.y+oy;
    const af=this.animFrame;
    const TOTAL=300,SINK=20,RISE=30;
    const elapsed=TOTAL-Math.max(0,this.earthMudTimer);
    let phase,prog;
    if(elapsed<SINK){phase="sink";prog=elapsed/SINK;}
    else if(this.earthMudTimer<RISE){phase="rise";prog=1-(this.earthMudTimer/RISE);}
    else{phase="under";prog=1;}
    // Ever-present rippling mud pool on the ground beneath the character
    ctx.save();ctx.globalAlpha=0.55;
    const rippleR=16+Math.sin(af*0.12)*3;
    ctx.strokeStyle="#5a4020";ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(rx,groundY,rippleR+14,rippleR*0.35,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    if(phase==="sink"){
      const sinkDepth=60*prog;
      ctx.save();ctx.globalAlpha=Math.max(0,1-prog);
      this._drawBodyOnly(rx,ry+sinkDepth);
      ctx.restore();
      for(let i=0;i<8;i++){
        const ang=(i/8)*Math.PI*2,d2=32*prog;
        const mx=rx+Math.cos(ang)*d2,my=groundY+Math.sin(ang)*d2*0.3;
        _oval(mx-6,my-6,12,12,"#6a4a2a",null);
      }
      _text(rx,ry-115,"🟤 HÓA THÂN THÀNH BÙN 🟤","#a67c52","10px Arial bold");
    }else if(phase==="under"){
      _oval(rx-46,groundY-11,92,22,"#4a3524","#241608",2);
      _oval(rx-38,groundY-8,76,15,"#6a4a2a",null);
      _oval(rx-22,groundY-6,44,9,"#8a6a4a",null);
      if(!this._mudBubbles)this._mudBubbles=[];
      if(af%10===0&&this._mudBubbles.length<6)this._mudBubbles.push({x:rx+rndInt(-32,32),y:groundY-6,life:24,maxLife:24});
      _compact(this._mudBubbles,b=>b.life>0);
      this._mudBubbles.forEach(b=>{
        b.life--;
        const bp=1-b.life/b.maxLife;
        ctx.save();ctx.globalAlpha=Math.max(0,b.life/b.maxLife);
        _oval(b.x-3,b.y-bp*9-3,6,6,"#8a6a4a",null);
        ctx.restore();
      });
      // Faint underground streak trailing behind the direction of travel
      ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle="#5a4020";
      ctx.beginPath();ctx.ellipse(rx-26*this.direction,groundY-6,20,7,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      _text(rx,groundY-38,"🫧 LẶN DƯỚI BÙN 🫧","#c68a4a","9px Arial bold");
    }else if(phase==="rise"){
      const sinkDepth=60*(1-prog);
      ctx.save();ctx.globalAlpha=Math.min(1,prog+0.15);
      this._drawBodyOnly(rx,ry+sinkDepth);
      ctx.restore();
      for(let i=0;i<6;i++){
        const dx=rndInt(-26,26);
        _oval(rx+dx-4,groundY-6-prog*12+rndInt(-4,4),8,8,"#6a4a2a",null);
      }
      if(prog>0.55&&!this._mudRiseShook){this._mudRiseShook=true;screenShake=Math.max(screenShake,6);}
      _text(rx,ry-115,"⬆️ TRỒI LÊN MẶT ĐẤT ⬆️","#c68a4a","10px Arial bold");
    }
  }
  // ================================================================
  //  SHADOW V4 — THẦN CHẾT (Grim Reaper), full appearance replacement.
  //  Ported from the reference character: hood, cape, robe, skull face,
  //  and a scythe that idles tucked in and chops down on the normal attack
  //  (shadow_s1 while transformed). Origin (0,0) sits at shoulder height,
  //  matching rx/ry used by the rest of the class — head is negative-y,
  //  feet positive-y, exactly like the reference file.
  // ================================================================
  _drawReaperFighter(ox=0,oy=0){
    const af=this.animFrame;
    const rx=this.x+ox, ry=this.y+oy-52;
    const dir=this.direction;
    const attacking=this.activeSkill==="shadow_s1"&&this.attackCooldown>0;
    const bob=attacking?0:Math.sin(af*0.07)*3;
    ctx.save();
    ctx.translate(rx,ry+bob);
    ctx.scale(dir,1);
    // Stretch taller (anchored at the feet line, y=52) so the Grim Reaper
    // stands as tall as the other V4 forms instead of reading short/squat.
    ctx.translate(0,52);ctx.scale(1,1.28);ctx.translate(0,-52);

    // AURA
    const aura=ctx.createRadialGradient(0,0,10,0,0,90);
    aura.addColorStop(0,"rgba(100,75,255,0.22)");
    aura.addColorStop(0.5,"rgba(50,35,150,0.08)");
    aura.addColorStop(1,"rgba(0,0,0,0)");
    ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,0,90,0,Math.PI*2);ctx.fill();

    // ULTI-ONLY BLUE GLOW + RISING SMOKE — active exactly while the
    // Ulti (shadow_s4) is in progress (windup -> portal -> slam), not
    // during the rest of the V4 form. Turns off the instant ultiTimer
    // hits 0 / activeSkill changes, so it reads as tied to the move
    // itself rather than a permanent transform effect.
    const _ultiBusy=this.activeSkill==="shadow_s4"&&this.ultiTimer>0;
    if(_ultiBusy){
      const bluePulse=0.5+0.5*Math.sin(af*0.18);
      const blueAura=ctx.createRadialGradient(0,0,10,0,0,100);
      blueAura.addColorStop(0,`rgba(60,160,255,${0.30+0.16*bluePulse})`);
      blueAura.addColorStop(0.55,`rgba(30,110,220,${0.14+0.08*bluePulse})`);
      blueAura.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=blueAura;ctx.beginPath();ctx.arc(0,0,100,0,Math.PI*2);ctx.fill();
      // gentle smoke — a handful of soft puffs drifting straight up off
      // the shoulders/back and fading out, purely procedural (no extra
      // state array to manage/clean up)
      for(let i=0;i<5;i++){
        const seed=i*13.7;
        const life=(af*0.6+seed*17)%90; // 0..90 loop per puff
        const t=life/90;
        const sx=(-14+i*7)+Math.sin(af*0.03+seed)*5;
        const sy=10-t*70;
        const r=5+t*10;
        ctx.save();
        ctx.globalAlpha=(1-t)*0.35;
        ctx.fillStyle="rgba(150,210,255,0.7)";
        ctx.beginPath();ctx.arc(sx,sy,r,0,Math.PI*2);ctx.fill();
        ctx.restore();
      }
    }

    // HÀO QUANG ĐỎ — bật sau khi dùng Ulti nổ (shadow_s4 lúc biến hình),
    // kéo dài liên tục cho tới khi hết biến hình (tắt trong tickV4).
    if(this._shadowRedGlow){
      const pulse=0.5+0.5*Math.sin(af*0.15);
      const redAura=ctx.createRadialGradient(0,0,10,0,0,115);
      redAura.addColorStop(0,`rgba(255,30,30,${0.32+0.16*pulse})`);
      redAura.addColorStop(0.55,`rgba(180,0,0,${0.16+0.1*pulse})`);
      redAura.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=redAura;ctx.beginPath();ctx.arc(0,0,115,0,Math.PI*2);ctx.fill();
    }

    // CAPE
    ctx.fillStyle="#10111b";
    ctx.beginPath();
    ctx.moveTo(-28,-5);ctx.lineTo(-50,56);ctx.lineTo(-27,48);ctx.lineTo(-14,62);ctx.lineTo(0,49);
    ctx.lineTo(15,62);ctx.lineTo(29,48);ctx.lineTo(50,56);ctx.lineTo(28,-5);
    ctx.closePath();ctx.fill();
    ctx.strokeStyle="#29283e";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(-27,2);ctx.lineTo(-36,46);ctx.moveTo(27,2);ctx.lineTo(36,46);ctx.stroke();

    // BODY
    ctx.fillStyle="#1b1c29";
    ctx.beginPath();ctx.moveTo(-18,-8);ctx.lineTo(18,-8);ctx.lineTo(25,35);ctx.lineTo(0,49);ctx.lineTo(-25,35);ctx.closePath();ctx.fill();
    ctx.fillStyle="#080910";
    ctx.beginPath();ctx.moveTo(-11,0);ctx.lineTo(11,0);ctx.lineTo(15,31);ctx.lineTo(0,40);ctx.lineTo(-15,31);ctx.closePath();ctx.fill();

    // HEAD
    ctx.fillStyle="#d5d1c8";
    ctx.beginPath();ctx.arc(0,-27,20,0,Math.PI*2);ctx.fill();
    // jaw
    ctx.fillStyle="#b8b4ad";
    ctx.beginPath();ctx.moveTo(-13,-18);ctx.lineTo(13,-18);ctx.lineTo(8,-3);ctx.lineTo(0,2);ctx.lineTo(-8,-3);ctx.closePath();ctx.fill();
    // eyes (purple glow, matches the reaper reference)
    ctx.fillStyle="#6654ff";ctx.shadowColor="#7565ff";ctx.shadowBlur=14;
    ctx.beginPath();ctx.moveTo(-12,-31);ctx.lineTo(-3,-29);ctx.lineTo(-11,-25);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(12,-31);ctx.lineTo(3,-29);ctx.lineTo(11,-25);ctx.closePath();ctx.fill();
    ctx.shadowBlur=0;
    // nose
    ctx.fillStyle="#77736d";
    ctx.beginPath();ctx.moveTo(0,-27);ctx.lineTo(-3,-19);ctx.lineTo(3,-19);ctx.closePath();ctx.fill();
    // mouth + teeth
    ctx.strokeStyle="#514d49";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-8,-12);ctx.lineTo(8,-12);ctx.stroke();
    ctx.strokeStyle="#85817b";ctx.lineWidth=1;
    for(let i=-6;i<=6;i+=4){ctx.beginPath();ctx.moveTo(i,-12);ctx.lineTo(i,-8);ctx.stroke();}

    // HOOD
    ctx.fillStyle="#080910";
    ctx.beginPath();ctx.moveTo(-29,-26);ctx.quadraticCurveTo(0,-63,29,-26);ctx.lineTo(20,-12);ctx.lineTo(-20,-12);ctx.closePath();ctx.fill();
    ctx.strokeStyle="#29293d";ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(0,-27,25,Math.PI,Math.PI*2);ctx.stroke();

    // ARMS + SCYTHE
    this._drawReaperWeaponPose(attacking);

    // FEET
    ctx.fillStyle="#090a10";
    ctx.beginPath();ctx.ellipse(-12,48,13,6,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(12,48,13,6,0,0,Math.PI*2);ctx.fill();

    ctx.restore();

    // status overlays (kept so gameplay state stays readable)
    if(this.stunTimer>0)_text(rx,ry-108,"⛓ STUNNED ⛓","orange","9px Arial bold");
    else if(this.slowTimer>0)_text(rx,ry-108,"❄️ SLOWED ❄️","deepskyblue","9px Arial bold");
    else _text(rx,ry-108,"💀 THẦN CHẾT V4 💀","#8b7bff","9px Arial bold");
    if(this.isShielding){
      ctx.strokeStyle="magenta";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(rx,ry-20,58,Math.PI,0);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx-55,ry-20);ctx.lineTo(rx-55,ry+55);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx+55,ry-20);ctx.lineTo(rx+55,ry+55);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx-55,ry+55);ctx.lineTo(rx+55,ry+55);ctx.stroke();
    }
    if(this._dashSmoke&&this._dashSmoke.length){
      _compact(this._dashSmoke,s=>s.life>0);
      this._dashSmoke.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--;const a=Math.max(0,s.life/30*0.55);ctx.beginPath();ctx.fillStyle=`rgba(50,15,70,${a})`;ctx.arc(s.x+ox,s.y+oy,s.r,0,Math.PI*2);ctx.fill();});
    }
    if(this.attackCooldown>0&&this.activeSkill&&this.activeSkill!=="shadow_s1")this._drawSkillFX(rx,ry);
    if(this.transformBurstTimer>0)this._drawTransformBurst(rx,ry);
  }
  // Idle: arms tucked in, scythe resting behind the back.
  // Attack (shadow_s1 while transformed): the scythe chops down in an arc —
  // driven by attackCooldown counting 15 -> 0 (set in castSkill).
  _drawReaperWeaponPose(attacking){
    const SCYTHE_SCALE=1.4; // phóng to cây liềm (cán + lưỡi) so với bản gốc
    if(!attacking){
      ctx.fillStyle="#171824";
      ctx.save();ctx.translate(-14,1);ctx.rotate(0.35);ctx.fillRect(-2,0,25,10);ctx.restore();
      ctx.save();ctx.translate(14,1);ctx.rotate(-0.35);ctx.fillRect(-23,0,25,10);ctx.restore();
      ctx.save();ctx.globalAlpha=0.75;
      ctx.translate(18,25);ctx.scale(SCYTHE_SCALE,SCYTHE_SCALE);ctx.translate(-18,-25);
      ctx.strokeStyle="#77736d";ctx.lineWidth=4;
      ctx.beginPath();ctx.moveTo(18,25);ctx.lineTo(48,-55);ctx.stroke();
      ctx.strokeStyle="#aaa8a4";ctx.lineWidth=5;
      ctx.beginPath();ctx.moveTo(48,-54);ctx.quadraticCurveTo(72,-69,83,-48);ctx.quadraticCurveTo(64,-58,48,-43);ctx.stroke();
      ctx.restore();
      return;
    }
    // BỔ LIỀM XUỐNG — the scythe chops down over the ~15-frame attack window
    let p=1-Math.max(0,this.attackCooldown)/15;
    p=Math.min(1,Math.max(0,p));
    const ease=p<0.5?2*p*p:1-Math.pow(-2*p+2,2)/2;
    const angle=-1.5+ease*2.6;
    const armLength=55*SCYTHE_SCALE;
    ctx.save();ctx.translate(13,0);ctx.rotate(angle);ctx.fillStyle="#171824";ctx.fillRect(0,-6,armLength,12);ctx.restore();
    const handX=13+Math.cos(angle)*armLength, handY=Math.sin(angle)*armLength;
    ctx.fillStyle="#c1bdb5";ctx.beginPath();ctx.arc(handX,handY,7,0,Math.PI*2);ctx.fill();
    ctx.save();ctx.translate(handX,handY);ctx.rotate(angle);ctx.scale(SCYTHE_SCALE,SCYTHE_SCALE);
    ctx.strokeStyle="#85817a";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(8,-70);ctx.stroke();
    ctx.strokeStyle="#d1cfca";ctx.lineWidth=6;
    ctx.beginPath();ctx.moveTo(8,-70);ctx.quadraticCurveTo(34,-85,46,-61);ctx.quadraticCurveTo(26,-72,8,-55);ctx.stroke();
    ctx.restore();
    if(p>0.45){
      ctx.globalAlpha=Math.sin(((p-0.45)/0.55)*Math.PI)*0.8;
      ctx.strokeStyle="#8175ff";ctx.lineWidth=5;
      ctx.shadowColor="#6758ff";ctx.shadowBlur=18;
      ctx.beginPath();ctx.arc(20,5,67*SCYTHE_SCALE,-1.0,0.35);ctx.stroke();
      ctx.shadowBlur=0;ctx.globalAlpha=1;
    }
  }
  // Charge-up visual while the V4 transform winds up: energy spirals inward
  // and upward around the still-frozen, rising fighter, building in intensity
  // until the moment it detonates into the finishing spark explosion.
  _drawTransformWindup(rx,ry){
    const af=this.animFrame,total=this._transformWindupTotal||360,t=Math.max(0,this.transformWindupTimer),age=total-t,prog=age/total;
    if(t===0){this._windupCrackled=false;this._fireFlipDone=false;}
    if(this.charType==="red"){
      // Hỏa Ma Thần awakening — fully custom 3-stage sequence (magic circle ->
      // fire pillar -> demon form emerging), kept entirely separate from the
      // shared generic swirl below so other elements are untouched.
      this._drawFireTransformWindup(rx,ry,af,age,total);
      return;
    }
    if(this.charType==="fire"){
      this._drawFireV2TransformWindup(rx,ry,af,age,total);
      return;
    }
    if(this.charType==="shadow"){
      // SHADOW — "Bóng Tối Thức Tỉnh": fully custom 3.5s (210-frame) sequence,
      // kept entirely separate from the shared generic swirl below so other
      // elements are untouched. See _drawShadowTransformWindup() for the
      // phase-by-phase breakdown.
      this._drawShadowTransformWindup(rx,ry,af,age,total);
      return;
    }
    const col=ELEMENT_COLORS[this.charType]||"#FFAA33";
    const glow="#FFEE99";
    if(this.charType==="thunder"){
      // THUNDER V4 WINDUP: screen dims, sky-bolts crash down around the
      // fighter as they rise, then one huge column of lightning strikes them.
      // Bolt top-Y is solved analytically (same fix as Water's light beam)
      // so it always originates just above the real top of the canvas
      // (screen_y ≈ -60) instead of a fixed "ry-N" offset that — after the
      // per-pivot CHAR_VISUAL_SCALE body shrink — could fall short of the
      // top of the screen on tall viewports.
      const _fy=ry+52, _skyY=_fy+(-60-_fy)/CHAR_VISUAL_SCALE;
      ctx.save();
      // Draw outside camera context for full screen coverage
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=Math.min(0.5,prog*0.6);ctx.fillStyle="#000010";ctx.fillRect(0,0,W,H);
      ctx.restore();
      if(!this._windupBolts||af%6===0){
        this._windupBolts=[];
        for(let b=0;b<4;b++){const sx=rx+rndInt(-220,220);this._windupBolts.push({x:sx,y0:_skyY,y1:ry-30});}
      }
      this._windupBolts.forEach(b=>{
        ctx.save();ctx.globalAlpha=0.8;ctx.strokeStyle="white";ctx.shadowColor="#FFD700";ctx.shadowBlur=16;ctx.lineWidth=3;
        ctx.beginPath();let cy3=b.y0,cx3=b.x;ctx.moveTo(cx3,cy3);
        while(cy3<b.y1){cx3+=rndInt(-16,16);cy3+=rndInt(20,40);ctx.lineTo(cx3,cy3);}
        ctx.stroke();ctx.restore();
      });
      if(prog>0.5){
        // giant strike column right on top of the fighter as the windup finishes
        // Cải tiến: tia sét tụ lại rồi phình to gấp 3 (từ prog 0.5 đến 1.0)
        const boltProg = (prog - 0.5) / 0.5; // 0.0 -> 1.0
        const baseWidth = 4;
        const targetWidth = 30; // To gấp 3 lần bình thường (10 * 3)
        const currentWidth = baseWidth + (targetWidth - baseWidth) * boltProg;
        
        ctx.save();
        ctx.globalAlpha=Math.min(1, boltProg * 1.5);
        ctx.strokeStyle="white";ctx.shadowColor="white";ctx.shadowBlur=30 + boltProg * 20;
        ctx.lineWidth=currentWidth;
        ctx.beginPath();ctx.moveTo(rx+rndInt(-4,4),_skyY);ctx.lineTo(rx,ry-30);ctx.stroke();
        
        ctx.strokeStyle="#FFD700";
        ctx.lineWidth=currentWidth * 0.4;
        ctx.stroke();
        ctx.restore();
      }
    }
    // Earth-specific windup: ground cracks and rocks fly toward the character
    if(this.charType==="earth"){
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      // Screen shake intensifies during earth windup
      if(prog>0.3)screenShake=Math.max(screenShake,15);
      // Ground cracking effect
      if(prog>0.2&&af%8===0){
        for(let c=0;c<3;c++){
          const cx=rx+rndInt(-200,200),cy=ry+52+rndInt(-5,5);
          hitEffects.push({x:cx,y:cy,life:30,maxLife:30,particle:true,color:"#4a3524",vx:(rng()-0.5)*0.5,vy:-rng()*0.3});
        }
      }
      // Rocks being sucked toward the character
      const rockCount=Math.floor(prog*15)+3;
      for(let i=0;i<rockCount;i++){
        const ang=(af*3+i*24)*Math.PI/180;
        const dist2=180-(prog*160)+Math.sin(af*0.1+i)*20;
        const rsx=rx+Math.cos(ang)*dist2,rsy=ry-20+Math.sin(ang)*dist2*0.4;
        const rs=rndInt(4,12);
        ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=6;
        ctx.fillStyle=rndChoice(["#8a6a4a","#6a4a2a","#7a5a3a"]);ctx.strokeStyle="#3a2518";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(rsx-rs,rsy+rs*0.5);ctx.lineTo(rsx-rs*0.3,rsy-rs*0.7);ctx.lineTo(rsx+rs*0.5,rsy-rs*0.8);ctx.lineTo(rsx+rs,rsy);ctx.lineTo(rsx+rs*0.4,rsy+rs*0.6);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
      }
      // As prog increases, rocks merge into armor
      if(prog>0.7){
        const mergeAlpha=(prog-0.7)/0.3;
        for(let i=0;i<8;i++){
          const ang=(af*5+i*45)*Math.PI/180;
          const mdist=60*(1-prog)+20;
          const mx=rx+Math.cos(ang)*mdist,my=ry-20+Math.sin(ang)*mdist*0.5;
          ctx.save();ctx.globalAlpha=mergeAlpha*0.8;
          _oval(mx-6,my-6,12,12,"#8a6a4a","#4a3524",1);
          ctx.restore();
        }
      }
      ctx.restore();
    }
    ctx.save();
    ctx.globalAlpha=0.55+prog*0.4;
    ctx.shadowColor=glow;ctx.shadowBlur=14+prog*20;
    for(let i=0;i<12;i++){
      const spinSpeed=4+prog*6;
      const ang=(af*spinSpeed+i*30)*Math.PI/180;
      const rad=(1-prog)*100+12;
      const px=rx+rad*Math.cos(ang);
      const py=ry-15+rad*Math.sin(ang)*0.6-prog*40;
      const s=3+prog*4;
      _oval(px-s,py-s,s*2,s*2,i%2===0?col:glow,null);
    }
    ctx.strokeStyle=col;ctx.lineWidth=2+prog*2;
    ctx.beginPath();ctx.ellipse(rx,ry-15,40+prog*15,60+prog*20,0,0,Math.PI*2*prog+0.2);ctx.stroke();
    ctx.restore();
  }
  // ================================================================
  //  RED — HỎA MA THẦN (Fire Demon God) V4 rework-only helpers
  // ================================================================
  // Fire-themed magic circle, hand-rolled on <canvas> (no images): three
  // concentric rings rotating in alternating directions, ancient-rune tick
  // marks, a six-point star, flame glyphs, radiating energy lines, a
  // flowing "lava" dashed stroke, and rising embers. Red/orange/gold only.
  _drawFireMagicCircle(cx,cy,alpha,intensity){
    if(alpha<=0)return;
    const af=this.animFrame;
    this._fireCircleAngle=((this._fireCircleAngle||0)+0.25)%360;   // outer ring: slow
    this._fireCircleAngle2=((this._fireCircleAngle2||0)-0.55)%360; // inner ring: faster, opposite
    const baseY=cy+56, flat=0.34;
    const R1=150,R2=112,R3=78;
    ctx.save();
    ctx.globalAlpha=alpha;
    ctx.translate(cx,baseY);
    // glow field
    const grad=ctx.createRadialGradient(0,0,10,0,0,R1);
    grad.addColorStop(0,`rgba(255,140,0,${0.35*intensity})`);
    grad.addColorStop(0.6,`rgba(255,60,0,${0.18*intensity})`);
    grad.addColorStop(1,"rgba(255,0,0,0)");
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.ellipse(0,0,R1,R1*flat,0,0,Math.PI*2);ctx.fill();
    // outer ring: rune ticks + flowing lava dash
    ctx.save();ctx.rotate(this._fireCircleAngle*Math.PI/180);
    ctx.strokeStyle="#FF6A00";ctx.lineWidth=3;ctx.shadowColor="#FF8800";ctx.shadowBlur=18;
    ctx.beginPath();ctx.ellipse(0,0,R1,R1*flat,0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([16,10]);ctx.lineDashOffset=-af*1.4;ctx.strokeStyle="#FFCC33";ctx.lineWidth=2;ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(0,0,R1,R1*flat,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
    for(let i=0;i<24;i++){
      const a=(i/24)*Math.PI*2;
      const x1=Math.cos(a)*R1,y1=Math.sin(a)*R1*flat;
      const ext=i%3===0?16:9;
      const x2=Math.cos(a)*(R1+ext),y2=Math.sin(a)*(R1+ext)*flat;
      ctx.strokeStyle=i%3===0?"#FFDD55":"#FF5500";ctx.lineWidth=i%3===0?2.6:1.4;ctx.shadowBlur=i%3===0?12:4;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
      if(i%3===0){ctx.beginPath();ctx.moveTo(x2,y2);ctx.lineTo(x2+Math.cos(a+0.5)*7,y2+Math.sin(a+0.5)*7*flat);ctx.stroke();}
    }
    ctx.restore();
    // middle ring: six-point magic star, counter-rotating
    ctx.save();ctx.rotate(this._fireCircleAngle2*Math.PI/180);
    ctx.strokeStyle="#FF9900";ctx.lineWidth=2;ctx.shadowColor="#FFB020";ctx.shadowBlur=14;
    ctx.beginPath();ctx.ellipse(0,0,R2,R2*flat,0,0,Math.PI*2);ctx.stroke();
    for(let pass=0;pass<2;pass++){
      ctx.beginPath();
      for(let i=0;i<=6;i++){const a=(i/6)*Math.PI*2+(pass?Math.PI/6:0);const x=Math.cos(a)*R2,y=Math.sin(a)*R2*flat;if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
      ctx.closePath();ctx.strokeStyle="#FF4400";ctx.lineWidth=1.6;ctx.stroke();
    }
    ctx.restore();
    // inner ring: fast spin, radiating energy lines
    ctx.save();ctx.rotate(this._fireCircleAngle*-1.6*Math.PI/180);
    ctx.strokeStyle="#FFEE88";ctx.lineWidth=2;ctx.shadowColor="#FFF3C0";ctx.shadowBlur=10;
    ctx.beginPath();ctx.ellipse(0,0,R3,R3*flat,0,0,Math.PI*2);ctx.stroke();
    for(let i=0;i<8;i++){
      const a=(i/8)*Math.PI*2;
      ctx.globalAlpha=alpha*(0.4+0.3*Math.sin(af*0.15+i));
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*R3,Math.sin(a)*R3*flat);ctx.stroke();
    }
    ctx.globalAlpha=alpha;
    ctx.restore();
    // fire glyphs at 4 points, pulsing
    for(let i=0;i<4;i++){
      const a=(i/4)*Math.PI*2+this._fireCircleAngle*Math.PI/180*0.3;
      const gx=Math.cos(a)*R2,gy=Math.sin(a)*R2*flat;
      const pulse=0.7+0.3*Math.sin(af*0.2+i);
      ctx.save();ctx.globalAlpha=alpha*pulse;ctx.translate(gx,gy);
      ctx.fillStyle="#FF6600";ctx.shadowColor="#FFAA00";ctx.shadowBlur=10;
      ctx.beginPath();
      ctx.moveTo(0,-9);ctx.quadraticCurveTo(6,-2,3,5);ctx.quadraticCurveTo(6,3,0,9);
      ctx.quadraticCurveTo(-6,3,-3,-1);ctx.quadraticCurveTo(-2,-6,0,-9);
      ctx.closePath();ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // rising embers off the ring
    if(!this._fireCircleEmbers)this._fireCircleEmbers=[];
    if(rng()<0.55*intensity&&this._fireCircleEmbers.length<40){
      const a=rng()*Math.PI*2;
      this._fireCircleEmbers.push({x:cx+Math.cos(a)*R1*rng(),y:baseY+Math.sin(a)*R1*flat*rng(),vy:-(rng()*1.3+0.6),vx:(rng()-0.5)*0.4,life:50,maxLife:50,size:rndInt(2,4)});
    }
    _compact(this._fireCircleEmbers,e=>e.life>0);
    this._fireCircleEmbers.forEach(e=>{
      e.x+=e.vx;e.y+=e.vy;e.life--;
      ctx.save();ctx.globalAlpha=Math.max(0,e.life/e.maxLife)*alpha*0.9;
      _oval(e.x-e.size,e.y-e.size,e.size*2,e.size*2,rndChoice(["#FF8800","#FFCC33","#FF4400"]),null);
      ctx.restore();
    });
  }
  // The 3-stage RED windup sequence described by design:
  //  Stage 1 (0 -> 0.8s): magic circle fades in under the character's feet.
  //  Stage 2 (0.8s -> ~3.2s): a towering pillar of fire erupts — camera
  //    shake, a screen flash, a heat-wave overlay, and the circle brightens.
  //  Stage 3 (~4.5s -> end): the pillar dissolves into drifting embers as
  //    the new Hỏa Ma Thần form is revealed (finalized when landing completes).
  _drawFireTransformWindup(rx,ry,af,age,total){
    const t1=48, t3=270; // 0.8s ignite, matches the physical "begin descend" phase
    if(!this._windupCrackled&&age>=t1){this._windupCrackled=true;sfxFireCrackle();screenShake=Math.max(screenShake,10);}
    const circleAlpha=Math.min(1,age/20);
    const circleIntensity=age<t1?0.5+0.5*(age/t1):1;
    this._drawFireMagicCircle(rx,ry,circleAlpha,circleIntensity);
    if(age>=t1&&age<t3){
      const pillarAge=age-t1;
      const pillarProg=Math.min(1,pillarAge/24);
      screenShake=Math.max(screenShake,pillarAge<10?16:4);
      ctx.save();
      const ph=260*pillarProg;
      const pw=70+Math.sin(af*0.3)*8;
      const grad=ctx.createLinearGradient(0,ry-ph,0,ry+30);
      grad.addColorStop(0,"rgba(255,240,180,0.05)");
      grad.addColorStop(0.35,"rgba(255,150,30,0.55)");
      grad.addColorStop(0.75,"rgba(255,60,0,0.8)");
      grad.addColorStop(1,"rgba(180,20,0,0.9)");
      ctx.fillStyle=grad;ctx.shadowColor="#FF6600";ctx.shadowBlur=30;
      ctx.beginPath();
      ctx.moveTo(rx-pw*0.5,ry+30);
      ctx.quadraticCurveTo(rx-pw*0.8,ry-ph*0.5,rx-pw*0.25,ry-ph);
      ctx.quadraticCurveTo(rx,ry-ph-16,rx+pw*0.25,ry-ph);
      ctx.quadraticCurveTo(rx+pw*0.8,ry-ph*0.5,rx+pw*0.5,ry+30);
      ctx.closePath();ctx.fill();
      ctx.globalAlpha=0.85;ctx.fillStyle="rgba(255,255,220,0.5)";
      ctx.beginPath();ctx.ellipse(rx,ry-ph*0.4,pw*0.22,ph*0.42,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      if(af%2===0)for(let i=0;i<3;i++){const ex=rx+rndInt(-pw*0.5,pw*0.5),ey=ry-rng()*ph;hitEffects.push({x:ex,y:ey,vx:(rng()-0.5)*2,vy:-rng()*2-1,life:26,maxLife:26,particle:true,color:rndChoice(["#FF8800","#FFCC33","#FFEE88"])});}
      ctx.save();ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=0.05+0.05*Math.sin(af*0.4);
      ctx.fillStyle="#FF3300";ctx.fillRect(0,0,W,H);
      ctx.restore();
      if(pillarAge<10){
        ctx.save();ctx.setTransform(1,0,0,1,0,0);
        ctx.globalAlpha=Math.max(0,(10-pillarAge)/10)*0.5;
        ctx.fillStyle="white";ctx.fillRect(0,0,W,H);
        ctx.restore();
      }
    }else if(age>=t3){
      const dProg=Math.min(1,(age-t3)/Math.max(1,total-t3));
      const emberCount=Math.floor(6*(1-dProg))+2;
      for(let i=0;i<emberCount;i++){
        const ang=rng()*Math.PI*2,r=rng()*50;
        hitEffects.push({x:rx+Math.cos(ang)*r,y:ry-20+Math.sin(ang)*r*0.5,vx:(rng()-0.5)*1.2,vy:-rng()*1.6-0.4,life:30,maxLife:30,particle:true,color:rndChoice(["#FF8800","#FFCC33","#FF4400"])});
      }
      ctx.save();ctx.globalAlpha=dProg*0.9;ctx.shadowColor="#FF6600";ctx.shadowBlur=20;
      _oval(rx-30,ry-70,60,90,`rgba(255,120,0,${0.4*dProg})`,null);
      ctx.restore();
    }
  }
  // ================================================================
  //  FIRE — "Flame V2" transformation windup.
  //  The character stands completely still while:
  //   0.0s-0.3s : body starts glowing red/orange, faint shake begins
  //   0.3s-0.9s : a column of RED fire erupts straight up around them
  //   0.9s-1.5s : the pillar FLIPS to blue mid-air with a burst of energy,
  //               a shockwave ring races outward, and blue embers scatter
  //   1.5s+     : holds in a settled blue-glow standby until the shared
  //               6s windup finishes and _finalizeTransform() switches the
  //               fighter into Flame V2 proper.
  //  (The overall stand-still windup duration is the same 360-frame timer
  //  shared by every character's transform, so other characters are 100%
  //  unaffected — only the visuals inside these ~90 frames matter here.)
  // ================================================================
  _drawFireV2TransformWindup(rx,ry,af,age,total){
    const t1=18,t2=54,t3=90; // frame marks: glow start, red pillar peak, blue flip complete (~0.3/0.9/1.5s)
    if(age<t1){
      const glowA=age/t1;
      ctx.save();ctx.globalAlpha=glowA*0.6;ctx.shadowColor=FIRE_V1_COL;ctx.shadowBlur=26*glowA;
      _oval(rx-34,ry-70,68,110,`rgba(255,69,0,${0.35*glowA})`,null);
      ctx.restore();
      if(age>t1*0.5)screenShake=Math.max(screenShake,3);
      return;
    }
    if(!this._windupCrackled&&age>=t1){this._windupCrackled=true;sfxFireCrackle();}
    if(age<t2){
      // Rising red/orange fire column
      const prog=Math.min(1,(age-t1)/(t2-t1));
      screenShake=Math.max(screenShake,prog<0.3?12:5);
      const ph=230*prog,pw=56+Math.sin(af*0.3)*6;
      ctx.save();
      const grad=ctx.createLinearGradient(0,ry-ph,0,ry+30);
      grad.addColorStop(0,"rgba(255,220,150,0.05)");
      grad.addColorStop(0.4,"rgba(255,120,20,0.55)");
      grad.addColorStop(0.8,"rgba(255,40,0,0.85)");
      grad.addColorStop(1,"rgba(160,10,0,0.9)");
      ctx.fillStyle=grad;ctx.shadowColor=FIRE_V1_COL;ctx.shadowBlur=26;
      ctx.beginPath();
      ctx.moveTo(rx-pw*0.5,ry+30);
      ctx.quadraticCurveTo(rx-pw*0.8,ry-ph*0.5,rx-pw*0.25,ry-ph);
      ctx.quadraticCurveTo(rx,ry-ph-14,rx+pw*0.25,ry-ph);
      ctx.quadraticCurveTo(rx+pw*0.8,ry-ph*0.5,rx+pw*0.5,ry+30);
      ctx.closePath();ctx.fill();
      ctx.restore();
      if(af%2===0)for(let i=0;i<3;i++){const ex=rx+rndInt(-pw*0.5,pw*0.5),ey=ry-rng()*ph;hitEffects.push({x:ex,y:ey,vx:(rng()-0.5)*2,vy:-rng()*2-1,life:24,maxLife:24,particle:true,color:rndChoice(["#FF6600","#FF4400","#FFAA33"])});}
      return;
    }
    if(age<t3){
      // Blue flip: burst + shockwave
      if(!this._fireFlipDone){
        this._fireFlipDone=true;
        screenShake=Math.max(screenShake,20);
        sfxExplosion();
        for(let i=0;i<26;i++){const ang=rng()*Math.PI*2,spd=rng()*7+3;hitEffects.push({x:rx,y:ry-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3,life:34,maxLife:34,particle:true,color:rndChoice(["#00AEFF","#00E5FF","white","#66F0FF"])});}
        hitEffects.push({x:rx,y:ry-20,life:30,maxLife:30,color:"#00CFFF",ring:true,big:true});
        hitEffects.push({x:rx,y:ry-20,life:40,maxLife:40,color:"white",ring:true,big:true,delay:5});
      }
      const prog=(age-t2)/(t3-t2);
      ctx.save();ctx.globalAlpha=Math.max(0,1-prog)*0.9;ctx.shadowColor=FIRE_V2_COL;ctx.shadowBlur=24;
      _oval(rx-32,ry-90,64,110,`rgba(0,180,255,${0.4*(1-prog)})`,null);
      ctx.restore();
      return;
    }
    // Settled Flame V2 standby glow for the remainder of the windup
    ctx.save();ctx.globalAlpha=0.35+0.15*Math.sin(af*0.15);ctx.shadowColor=FIRE_V2_COL;ctx.shadowBlur=18;
    _oval(rx-28,ry-80,56,100,"rgba(0,180,255,0.3)",null);
    ctx.restore();
    if(rng()<0.4)hitEffects.push({x:rx+rndInt(-24,24),y:ry-30,vx:(rng()-0.5)*0.6,vy:-rng()*1.4-0.4,life:26,maxLife:26,particle:true,color:rndChoice(["#00AEFF","#00E5FF","white"])});
  }
  // ================================================================
  //  SHADOW — "Bóng Tối Thức Tỉnh" (Darkness Awakening) V4 wind-up.
  //  Total length: 210 frames = 3.5s @60fps (set by castSkill / read via
  //  this._transformWindupTotal so the shared timer stays generic).
  //   0.0s-0.5s (age   0- 30): Kích hoạt — aura bóng tối nhẹ bắt đầu hiện ra.
  //   0.5s-1.4s (age  30- 84): Mở năng lượng — bóng dưới chân lan rộng,
  //                            portal/hố đen hé mở, hạt năng lượng bay vào.
  //   1.4s-2.4s (age  84-144): Tụ lực mạnh — aura + particle tăng tốc, rung
  //                            màn hình rất nhẹ tăng dần.
  //   2.4s-3.0s (age 144-180): Cao trào — portal đạt max, silhouette Reaper
  //                            hiện mờ phía sau lưng Shadow.
  //   3.0s-3.2s (age 180-192): "Nín thở" — mọi hiệu ứng dịu lại cực ngắn,
  //                            silhouette nhập vào Shadow.
  //   3.2s-3.5s (age 192-210): BÙNG NỔ — vòng xung kích + particle bắn ra +
  //                            flash ngắn. _finalizeTransform() được
  //                            applyGravity() gọi đúng 1 lần khi age=210.
  // ================================================================
  _drawShadowTransformWindup(rx,ry,af,age,total){
    // First 45 frames (0.75s = 0.25s nothing + 0.5s camera punch-in, handled
    // entirely by shadowCamZoomState()/the camera code in
    // 07-fx-ticks-ui-and-main-menu.js) are deliberately blank here — no aura,
    // no portal, nothing. The moment the camera finishes zooming in on the
    // caster, vAge crosses 0 and the original 3.5s (210f) VFX sequence below
    // plays out exactly as before, just now offset by the punch-in.
    const PREROLL=45;
    const vAge=age-PREROLL, vTotal=total-PREROLL;
    if(vAge<0)return;
    const T1=30,T2=84,T3=144,T4=180,BURST=192; // frame marks relative to vAge (vTotal=210)
    age=vAge; total=vTotal;
    // footY lowered a bit (was ry+52) so the ground portal actually hugs
    // Shadow's feet at the character's real height instead of reading as
    // slightly "floating".
    const footY=ry+64;
    // ---- one-shot ambient SFX as each phase begins (sfxEnergyCharge already
    // fired once at the moment the skill was cast, in castSkill) ----
    if(!this._shadowRiftCracked&&age>=T1){this._shadowRiftCracked=true;sfxVoidCrack?.();}
    if(!this._shadowWhispered&&age>=T2){this._shadowWhispered=true;sfxShadowWhisper?.();}

    // The portal (pool + ring + tentacles) doesn't just cut off — it
    // dissolves away in a rising-smoke sweep the instant BÙNG NỔ fires,
    // matching the same dissolve language as Void Tentacle/Ultimate
    // (_shadowTentacleDissolve / _shadowUltiDissolve in 06).
    const dissolveT=age>=BURST?Math.min(1,(age-BURST)/Math.max(1,total-BURST)):0;
    const portalAlphaMult=1-dissolveT;

    // ---- growing shadow pool + black-hole/portal ring under the feet ----
    const poolProg=Math.min(1,age/T4);
    const poolR=16+poolProg*95;
    ctx.save();
    ctx.globalAlpha=(0.3+0.45*poolProg)*portalAlphaMult;
    const poolGrad=ctx.createRadialGradient(rx,footY,4,rx,footY,poolR);
    poolGrad.addColorStop(0,"rgba(8,4,16,0.95)");
    poolGrad.addColorStop(0.55,"rgba(90,40,180,0.35)");
    poolGrad.addColorStop(1,"rgba(90,40,180,0)");
    ctx.fillStyle=poolGrad;
    ctx.beginPath();ctx.ellipse(rx,footY,poolR,poolR*0.32,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    if(age>=T1){
      const ringProg=Math.min(1,(age-T1)/(T4-T1));
      const ringR=12+ringProg*(poolR-4);
      ctx.save();
      ctx.globalAlpha=(0.5+0.4*ringProg)*portalAlphaMult;
      ctx.strokeStyle="#bb44ff";ctx.shadowColor="#6654ff";ctx.shadowBlur=14;ctx.lineWidth=2.5;
      ctx.beginPath();ctx.ellipse(rx,footY,ringR,ringR*0.32,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      // ---- tentacles reaching up out of the portal rim (same visual
      // language as the Void Tentacle skill / the Nộ bar's tendrils) ----
      const tentCount=5;
      for(let i=0;i<tentCount;i++){
        const baseAng=(i/tentCount)*Math.PI*2+af*0.01;
        const bx=rx+Math.cos(baseAng)*ringR*0.85,by=footY+Math.sin(baseAng)*ringR*0.85*0.32;
        const h=(14+ringProg*44)*(1-dissolveT*0.6);
        const sway=Math.sin(af*0.13+i*1.7)*9;
        ctx.save();
        ctx.globalAlpha=(0.45+0.35*ringProg)*portalAlphaMult;
        ctx.strokeStyle="#6654ff";ctx.shadowColor="#bb44ff";ctx.shadowBlur=7;ctx.lineWidth=3;ctx.lineCap="round";
        ctx.beginPath();
        ctx.moveTo(bx,by);
        ctx.quadraticCurveTo(bx+sway*0.6,by-h*0.55,bx+sway,by-h);
        ctx.stroke();
        ctx.restore();
      }
    }
    // ---- dissolve: portal + tentacles sweep upward into rising smoke as
    // they fade, instead of just vanishing the moment the burst fires ----
    if(dissolveT>0&&rng()<0.55){
      hitEffects.push({x:rx+rndInt(-poolR*0.6,poolR*0.6),y:footY,vx:(rng()-0.5)*0.6,vy:-rng()*1.6-0.6,life:34,maxLife:34,particle:true,size:rndInt(6,12),color:rndChoice(["#1a0a24","#3a0a55","#6654ff"])});
    }

    // ---- inbound dark/purple energy particles converging on the caster ----
    if(age>=T1){
      const inProg=Math.min(1,(age-T1)/(T4-T1));
      const count=Math.floor(6+inProg*18); // 6 -> 24 particles as it intensifies
      const spinSpeed=3+inProg*9+(age>=T2?5:0);
      for(let i=0;i<count;i++){
        const ang=(af*spinSpeed+i*(360/count))*Math.PI/180;
        const pullT=((af*2+i*11)%90)/90; // each particle loops its own pull-in cycle
        const rad=190-(190-10)*pullT;
        const px=rx+rad*Math.cos(ang);
        const py=ry-15+rad*Math.sin(ang)*0.55-inProg*10;
        const s=2+(1-pullT)*3;
        ctx.save();ctx.globalAlpha=(0.45+0.4*inProg)*(age>=T4&&age<BURST?0.5:1);ctx.shadowColor="#bb44ff";ctx.shadowBlur=8;
        _oval(px-s,py-s,s*2,s*2,i%2===0?"#6654ff":"#bb44ff",null);
        ctx.restore();
      }
    }

    // ---- rising dark aura wrapping the body ----
    const auraProg=Math.min(1,age/T4);
    const holdBreath=age>=T4&&age<BURST; // brief lull right before the burst
    const pulse=0.5+0.5*Math.sin(af*(0.08+auraProg*0.15));
    ctx.save();
    ctx.globalAlpha=(holdBreath?0.4:1)*(0.14+0.5*auraProg*pulse);
    ctx.shadowColor="#6654ff";ctx.shadowBlur=(holdBreath?8:14)+auraProg*22;
    _oval(rx-36-auraProg*10,ry-95-auraProg*10,72+auraProg*20,130+auraProg*20,`rgba(80,40,170,${holdBreath?0.1:0.22})`,null);
    ctx.restore();

    // ---- very light, gradually-increasing screen shake (capped low) ----
    if(age>=T2&&!holdBreath){
      const shakeProg=Math.min(1,(age-T2)/(T4-T2));
      screenShake=Math.max(screenShake,1+shakeProg*3);
    }

    // ---- climax silhouette: cái bóng ngả thành silhouette Reaper phía sau
    // lưng Shadow, hiện rõ dần rồi nhập vào nhân vật ngay trước khi nín thở ----
    if(age>=T3&&age<T4){
      const silProg=(age-T3)/(T4-T3);
      ctx.save();
      ctx.globalAlpha=silProg*0.75;
      ctx.fillStyle="#0a0812";
      ctx.shadowColor="#6654ff";ctx.shadowBlur=18;
      const sx=rx,sy=ry-10-silProg*6;
      ctx.beginPath();
      ctx.moveTo(sx-30,sy+60);
      ctx.quadraticCurveTo(sx-40,sy-10,sx-24,sy-55);
      ctx.quadraticCurveTo(sx,sy-85,sx+24,sy-55);
      ctx.quadraticCurveTo(sx+40,sy-10,sx+30,sy+60);
      ctx.closePath();ctx.fill();
      ctx.restore();
    }

    // ---- BÙNG NỔ: fires once at age===BURST (3.2s), then the shockwave
    // ring/particles play out through the remaining ~0.3s before
    // applyGravity() hits age=total and calls _finalizeTransform() ----
    if(age>=BURST){
      if(!this._shadowWindupBurstDone){
        this._shadowWindupBurstDone=true;
        screenShake=Math.max(screenShake,14);
        sfxVoidExplode?.();
        for(let i=0;i<22;i++){
          const ang=rng()*Math.PI*2,spd=rng()*6+3;
          hitEffects.push({x:rx,y:ry-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd*0.6-2,life:36,maxLife:36,particle:true,size:rndInt(6,14),color:rndChoice(["#0a0a10","#6654ff","#bb44ff","white"])});
        }
        hitEffects.push({x:rx,y:footY,life:30,maxLife:30,color:"#6654ff",ring:true,big:true});
        hitEffects.push({x:rx,y:footY,life:40,maxLife:40,color:"white",ring:true,big:true,delay:4});
      }
      const burstProg=(age-BURST)/Math.max(1,total-BURST);
      if(burstProg<0.3){
        ctx.save();ctx.setTransform(1,0,0,1,0,0);
        ctx.globalAlpha=Math.max(0,(0.3-burstProg)/0.3)*0.5;
        ctx.fillStyle="white";ctx.fillRect(0,0,W,H);
        ctx.restore();
      }
    }
  }
  // Stack indicator for the Hỏa Chủng innate: 10 small flame pips + counter,
  // floating above the fighter's head while V4 is active.
  _drawHoaChungStacks(rx,ry){
    const n=this.hoaChungStacks||0;
    if(this.hoaChungFlashTimer>0)this.hoaChungFlashTimer--;
    const flashBoost=this.hoaChungFlashTimer>0?(this.hoaChungFlashTimer/12)*6:0;
    const y0=ry-205;
    ctx.save();
    ctx.font="10px Arial bold";ctx.textAlign="center";ctx.textBaseline="middle";
    ctx.fillStyle=n>=10?"#FFEE88":"#FFAA33";
    ctx.shadowColor="#FF6600";ctx.shadowBlur=8+flashBoost;
    ctx.fillText(`🔥 HỎA CHỦNG ${n}/10`,rx,y0);
    ctx.restore();
    const spacing=13,startX=rx-(10*spacing)/2+spacing/2;
    for(let i=0;i<10;i++){
      const filled=i<n,px=startX+i*spacing,py=y0+13;
      ctx.save();
      ctx.globalAlpha=filled?1:0.25;
      ctx.fillStyle=filled?(i===9?"#FFEE88":"#FF7700"):"#552200";
      ctx.shadowColor=filled?"#FFAA00":"transparent";ctx.shadowBlur=filled?8:0;
      ctx.beginPath();
      ctx.moveTo(px,py-5);ctx.quadraticCurveTo(px+3.5,py-1,px+2,py+3);
      ctx.quadraticCurveTo(px+3.5,py+1.5,px,py+5);
      ctx.quadraticCurveTo(px-3.5,py+1.5,px-2,py+3);
      ctx.quadraticCurveTo(px-3.5,py-1,px,py-5);
      ctx.closePath();ctx.fill();
      ctx.restore();
    }
  }
  // Small scorch decals left behind on every V4 running step ("để lại dấu
  // cháy khi di chuyển"). Fixed-length array, always trimmed — no leak.
  _drawFireFootprints(ox,oy){
    if(!this._fireFootprints)this._fireFootprints=[];
    _compact(this._fireFootprints,f=>f.life>0);
    this._fireFootprints.forEach(f=>{
      f.life--;
      const a=Math.max(0,f.life/f.maxLife)*0.5;
      ctx.save();ctx.globalAlpha=a;ctx.fillStyle="#3a1000";
      ctx.beginPath();ctx.ellipse(f.x+ox,f.y+oy+2,14,5,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=a*0.8;ctx.fillStyle="#FF6600";
      ctx.beginPath();ctx.ellipse(f.x+ox,f.y+oy+1,7,2.4,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
  }
  // Long fire-comet tail drawn behind the fighter while airborne in "Hỏa
  // Phi" — a distinct flight identity from any other character's aerial FX.
  _drawFireFlyTrail(rx,ry){
    if(!this._fireFlyTrail)this._fireFlyTrail=[];
    this._fireFlyTrail.push({x:rx,y:ry-20});
    if(this._fireFlyTrail.length>16)this._fireFlyTrail.shift();
    ctx.save();
    const n=this._fireFlyTrail.length;
    this._fireFlyTrail.forEach((p,i)=>{
      const frac=i/n;
      const s=28*frac+6;
      ctx.globalAlpha=frac*0.55;
      ctx.shadowColor="#FF5500";ctx.shadowBlur=14;
      _oval(p.x-s/2,p.y-s/2,s,s,rndChoice(["#FF6600","#FF9900","#FFCC33"]),null);
    });
    ctx.restore();
  }
  _drawAfterImages(ox,oy){
    if(!this.afterImages||!this.afterImages.length)return;
    _compact(this.afterImages,a=>a.life>0);
    this.afterImages.forEach(a=>{
      a.life--;
      const ax=a.x+ox,ay=a.y+oy-52;
      const alpha=Math.max(0,a.life/a.maxLife)*0.32;
      ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=a.color||(ELEMENT_COLORS[this.charType]||"white");
      ctx.fillRect(ax-28,ay,56,52);
      ctx.fillRect(ax-20,ay-60,40,40);
      ctx.restore();
    });
  }
  // Detailed rotating aura ring for the fire fighter's V4 transform. The
  // fighter stays fixed at the exact center of the ring while it continuously
  // and slowly spins, with an inner counter-rotating ring and 16 tick/rune
  // marks for a layered, "ngầu" magic-circle look.
  _drawHellRing(cx,cy,hell){
    const outerCol=hell?"#00AEFF":"#FF5500";
    const glowCol =hell?"#66E0FF":"#FFCC33";
    this._drawEnergyRing(cx,cy,outerCol,glowCol);
  }
  _drawEnergyRing(cx,cy,outerCol,glowCol){
    const af=this.animFrame;
    if(this._ringAngle===undefined)this._ringAngle=0;
    this._ringAngle=(this._ringAngle+0.45)%360; // slow continuous rotation
    const rot1=this._ringAngle*Math.PI/180;
    const rot2=-this._ringAngle*1.7*Math.PI/180;
    ctx.save();
    ctx.translate(cx,cy);
    // outer solid ring
    ctx.rotate(rot1);
    ctx.strokeStyle=outerCol;ctx.lineWidth=3;
    ctx.shadowColor=glowCol;ctx.shadowBlur=18;
    ctx.beginPath();ctx.ellipse(0,0,98,68,0,0,Math.PI*2);ctx.stroke();
    // 16 rotating tick/rune marks around the outer ring
    for(let i=0;i<16;i++){
      const a=(i/16)*Math.PI*2;
      const rxo=98,ryo=68;
      const x1=Math.cos(a)*rxo,y1=Math.sin(a)*ryo;
      const x2=Math.cos(a)*(rxo+ (i%4===0?14:8)),y2=Math.sin(a)*(ryo+(i%4===0?10:6));
      ctx.strokeStyle=i%4===0?glowCol:outerCol;
      ctx.lineWidth=i%4===0?3:1.5;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.rotate(-rot1);
    // inner dashed ring, counter-rotating for a layered "double ring" effect
    ctx.rotate(rot2);
    ctx.strokeStyle=glowCol;ctx.lineWidth=2;ctx.setLineDash([9,7]);
    ctx.beginPath();ctx.ellipse(0,0,78,54,0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-rot2);
    ctx.restore();
    // faint pulsing energy particles orbiting along the ring
    for(let i=0;i<6;i++){
      const a=((af*3+i*60)%360)*Math.PI/180;
      const px=cx+Math.cos(a)*98,py=cy+Math.sin(a)*68;
      ctx.save();ctx.globalAlpha=0.8;
      _oval(px-3,py-3,6,6,glowCol,null);
      ctx.restore();
    }
  }
  _drawLivingAura(rx,ry){
    const col=(this.charType==="red"&&this.transformActive)?"#00AEFF":((this.charType==="fire"&&this.transformActive)?FIRE_V2_COL:(ELEMENT_COLORS[this.charType]||"white"));
    const af=this.animFrame;
    ctx.save();
    for(let l=0;l<4;l++){
      const wobble=Math.sin(af*0.08+l*1.3)*6;
      const rBase=32+l*11+wobble;
      const rot=((af*0.7+l*35)%360)*Math.PI/180;
      ctx.globalAlpha=0.18-l*0.035;
      ctx.strokeStyle=col;ctx.lineWidth=2;
      ctx.beginPath();
      ctx.ellipse(rx,ry-15,rBase,rBase*0.55,rot,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();
    if(!this.auraParticles)this.auraParticles=[];
    if(this.hp>0&&rng()<0.32&&this.auraParticles.length<14){
      this.auraParticles.push({x:rx+rndInt(-24,24),y:ry+22,vy:-(rng()*1.1+0.6),life:38,maxLife:38,r:rndInt(2,4)});
    }
    _compact(this.auraParticles,p=>p.life>0);
    this.auraParticles.forEach(p=>{
      p.y+=p.vy;p.life--;
      ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.65;
      _oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,col,null);
      ctx.restore();
    });
  }
  // Per-character ambient idle FX so silhouettes read differently at a glance
  // even without new sprites: fire licks the fists, shadow trails dark wisps
  // and hovers, thunder crackles with tiny arcs, frost has snow drifting down,
  // earth has small rocks orbiting, water drips gentle droplets, wind trails
  // a flowing ribbon/scarf. Skipped while V4-transformed (that has its own FX).
  _drawAmbientFX(rx,ry){
    if(this.transformActive||this.transformWindupTimer>0)return;
    const af=this.animFrame;
    if(!this._ambient)this._ambient={parts:[]};
    const amb=this._ambient;
    if(this.charType==="red"){
      if(rng()<0.5&&amb.parts.length<10){
        const side=rng()<0.5?-1:1;
        amb.parts.push({x:rx+side*28,y:ry-4,vy:-rng()*1.1-0.35,vx:(rng()-0.5)*0.5,life:22,maxLife:22,r:rndInt(3,6)});
      }
      _compact(amb.parts,p=>p.life>0);
      amb.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.85;ctx.shadowColor="orange";ctx.shadowBlur=6;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,rndChoice(["#FF6600","orange","yellow"]),null);ctx.restore();});
    }
    else if(this.charType==="fire"){
      // Small licks of orange flame constantly curling off the fists/shoulders.
      if(rng()<0.55&&amb.parts.length<12){
        const side=rng()<0.5?-1:1;
        amb.parts.push({x:rx+side*26,y:ry-8,vy:-rng()*1.3-0.4,vx:(rng()-0.5)*0.6,life:24,maxLife:24,r:rndInt(2,5)});
      }
      _compact(amb.parts,p=>p.life>0);
      amb.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.8;ctx.shadowColor=FIRE_V1_COL;ctx.shadowBlur=7;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,rndChoice([FIRE_V1_COL,"#FF6600","#FFAA33"]),null);ctx.restore();});
    }
    else if(this.charType==="shadow"){
      ctx.save();ctx.globalAlpha=0.5;ctx.strokeStyle="#551a8b";ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        const wob=Math.sin(af*0.1+i*2)*10;
        ctx.beginPath();ctx.moveTo(rx-18+i*18,ry+50);ctx.quadraticCurveTo(rx-18+i*18+wob,ry+70,rx-18+i*18,ry+90);ctx.stroke();
      }
      ctx.restore();
      if(rng()<0.3&&amb.parts.length<8)amb.parts.push({x:rx+rndInt(-20,20),y:ry+40,vy:-rng()*0.5-0.2,life:30,maxLife:30,r:rndInt(2,4)});
      _compact(amb.parts,p=>p.life>0);
      amb.parts.forEach(p=>{p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.5;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,"#8844aa",null);ctx.restore();});
    }
    else if(this.charType==="thunder"){
      if(rng()<0.35){
        const a1=rng()*Math.PI*2,r1=rndInt(20,36);
        const sx=rx+Math.cos(a1)*r1,sy=ry-20+Math.sin(a1)*r1*0.6;
        ctx.save();ctx.strokeStyle="yellow";ctx.lineWidth=1.5;ctx.shadowColor="yellow";ctx.shadowBlur=6;
        ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(sx+rndInt(-8,8),sy+rndInt(-8,8));ctx.stroke();
        ctx.restore();
      }
    }
    else if(this.charType==="frost"){
      if(rng()<0.4&&amb.parts.length<14)amb.parts.push({x:rx+rndInt(-40,40),y:ry-90,vy:rng()*0.8+0.4,vx:(rng()-0.5)*0.4,life:70,maxLife:70,r:rndInt(2,4)});
      _compact(amb.parts,p=>p.life>0&&p.y<ry+30);
      amb.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.8;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,"white",null);ctx.restore();});
    }
    else if(this.charType==="earth"){
      // Rocks orbiting faster and more dynamically
      if(!amb.rocks)amb.rocks=[0,1,2,3].map(i=>({ang:i*90,r:rndInt(34,46),s:rndInt(4,8)}));
      amb.rocks.forEach(rk=>{
        rk.ang+=1.2;
        const rrx=rx+Math.cos(rk.ang*Math.PI/180)*rk.r,rry=ry-20+Math.sin(rk.ang*Math.PI/180)*rk.r*0.5;
        ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=4;
        ctx.fillStyle="#8a6a4a";ctx.strokeStyle="#4a3524";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(rrx-rk.s,rry+rk.s*0.5);ctx.lineTo(rrx-rk.s*0.4,rry-rk.s*0.6);ctx.lineTo(rrx+rk.s*0.3,rry-rk.s*0.7);ctx.lineTo(rrx+rk.s,rry);ctx.lineTo(rrx+rk.s*0.5,rry+rk.s*0.6);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
      });
      // Extra dust particles floating around
      if(rng()<0.4&&amb.parts.length<12)amb.parts.push({x:rx+rndInt(-30,30),y:ry+rndInt(-10,20),vy:-rng()*0.3-0.1,vx:(rng()-0.5)*0.4,life:25,maxLife:25,r:rndInt(2,4)});
      _compact(amb.parts,p=>p.life>0);
      amb.parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.6;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,rndChoice(["#c68a4a","#a67c52","#8a6a4a","#6a4a2a"]),null);ctx.restore();});
    }
    else if(this.charType==="water"){
      if(rng()<0.3&&amb.parts.length<8)amb.parts.push({x:rx+rndInt(-24,24),y:ry-10,vy:-rng()*0.5-0.2,life:26,maxLife:26,r:rndInt(2,4)});
      _compact(amb.parts,p=>p.life>0);
      amb.parts.forEach(p=>{p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.7;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,"aqua",null);ctx.restore();});
    }
    else if(this.charType==="wind"){
      const wob=Math.sin(af*0.12)*14;
      ctx.save();ctx.strokeStyle="#90EE90";ctx.lineWidth=3;ctx.globalAlpha=0.6;
      ctx.beginPath();ctx.moveTo(rx-14*this.direction,ry-10);
      ctx.quadraticCurveTo(rx-40*this.direction+wob,ry+5,rx-70*this.direction+wob*1.4,ry-4);
      ctx.stroke();
      ctx.restore();
    }
  }
  _drawTransformBurst(rx,ry){
    this.transformBurstTimer--;
    const t=this.transformBurstTimer,total=30,age=total-t;
    const rad=age*9;
    ctx.save();
    ctx.globalAlpha=Math.max(0,t/total)*0.9;
    ctx.strokeStyle="white";ctx.lineWidth=5;
    ctx.beginPath();ctx.arc(rx,ry-20,rad,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle=(this.charType==="red"&&this.transformActive)?"#00AEFF":((this.charType==="fire"&&this.transformActive)?FIRE_V2_COL:(ELEMENT_COLORS[this.charType]||"gold"));ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(rx,ry-20,rad*0.7,0,Math.PI*2);ctx.stroke();
    ctx.restore();
  }
  _drawSkillFX(rx,ry){
    const sk=this.activeSkill,af=this.animFrame;
    if(sk==="shadow_s1"){
      const dir=this.direction;
      const cx=rx+26*dir, cy=ry-70;
      const ang=dir>0?55:125; // three near-parallel claw slashes sweeping from upper-back down to lower-forward
      _text(rx,ry-118,"🐾 BÓNG VUỐT 🐾","#cc66ff","10px Arial bold");
      ctx.save();ctx.shadowColor="#aa00ff";ctx.shadowBlur=16;
      const perpX=-Math.sin(ang*Math.PI/180), perpY=Math.cos(ang*Math.PI/180);
      const claws=[{off:-18,len:96,w:10,bow:9,col:"#e6ccff"},{off:0,len:112,w:12,bow:11,col:"#cc66ff"},{off:18,len:94,w:10,bow:9,col:"#9933ff"}];
      claws.forEach(c=>{
        const sx=cx+perpX*c.off, sy=cy+perpY*c.off;
        _clawMark(sx,sy,ang,c.len,c.w,c.bow,c.col,"#1a0030");
      });
      ctx.restore();
      for(let i=0;i<6;i++){const a2=(af*9+i*60)*Math.PI/180,fr=26+Math.sin(af*0.2+i)*5,fx=cx+fr*Math.cos(a2),fy=cy+fr*Math.sin(a2),s=rndInt(3,6);_oval(fx-s,fy-s,s*2,s*2,rndChoice(["purple","magenta","#330055"]),null);}
    }
    else if(sk==="shadow_s2"){
      // F — VOID TENTACLE: the real portal + tentacle strike is drawn by
      // drawShadow() over the target; here we just show the casting flourish
      // on the caster's hands as the portal is summoned.
      _text(rx,ry-110,"🕳️ HỐ ĐEN 🕳️","#cc66ff","10px Arial bold");
      ctx.save();ctx.shadowColor="#9933ff";ctx.shadowBlur=14;ctx.strokeStyle="#cc66ff";ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(rx+22*this.direction,ry-70,14+Math.sin(af*0.3)*3,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
    else if(sk==="shadow_s3"){
      // T — THOÁT XÁC: a brief burst of dark motes as the soul tears free
      // of the body (the lingering ghost/decoy visuals are drawn elsewhere).
      _text(rx,ry-120,"😈 THOÁT XÁC 😈","#cc66ff","11px Arial bold");
      ctx.save();ctx.globalAlpha=0.8;
      for(let i=0;i<10;i++){
        const ang=(af*10+i*36)*Math.PI/180,r2=20+Math.sin(af*0.2+i)*10;
        const sx=rx+r2*Math.cos(ang),sy=ry-55+r2*Math.sin(ang)*0.8,s=rndInt(2,5);
        _oval(sx-s,sy-s,s*2,s*2,rndChoice(["#5a1a8a","#2a0a3d","#9933ff","white"]),null);
      }
      ctx.restore();
    }
    else if(sk==="thunder_s1"){
      // M1 — LÔI THƯƠNG: không quay người, chỉ lùi tay lấy đà 0.5s rồi ném
      // giáo sét tia chớp xanh tím (giáo bay thật do updateProjectiles vẽ,
      // ở đây chỉ vẽ cây giáo đang lăm lăm trong tay lúc lùi tay lấy đà).
      const windingUp=this.thunderM1WindupTimer>0;
      if(windingUp){
        _text(rx,ry-110,"⚡ LÔI THƯƠNG ⚡","#c77dff","10px Arial bold");
        const pullBack=(30-this.thunderM1WindupTimer)/30; // 0 -> 1 trong lúc lùi tay
        const hx=rx-(10+pullBack*18)*this.direction,hy=ry-46;
        ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=12;
        ctx.strokeStyle="#c77dff";ctx.lineWidth=3;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(hx-14*this.direction,hy+4);ctx.lineTo(hx+14*this.direction,hy-4);ctx.stroke();
        ctx.restore();
        for(let i=0;i<2;i++){const fx=hx+rndInt(-6,6),fy=hy+rndInt(-6,6),s2=rndInt(2,4);_oval(fx-s2,fy-s2,s2*2,s2*2,rndChoice(["#9d4edd","#4cc9f0","white"]),null);}
      }
    }
    else if(sk==="thunder_s2"){
      _text(rx,ry-110,"⚡ LÔI TỐC ⚡","#c77dff","11px Arial bold");
      ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=12;
      for(let i=0;i<10;i++){const tx3=rx-(i+1)*12*this.direction,ty3=ry+rndInt(-20,20),s3=rndInt(4,10);_oval(tx3-s3,ty3-s3,s3*2,s3*2,rndChoice(["#9d4edd","#c77dff","white","#4cc9f0"]),null);}
      for(let i=0;i<5;i++){const bx2=rx-(i+1)*20*this.direction,by2=ry+rndInt(-25,25);_line(bx2,by2,bx2+rndInt(-14,14)*this.direction,by2+rndInt(-14,14),"#c77dff",2);}
      ctx.restore();
    }
    else if(sk==="thunder_s3"){
      // CHIÊU 2 — LÔI ĐIỆN GIÁNG: sét đánh thẳng xuống vị trí của chính
      // nhân vật (0.5s rơi + 0.5s chờ trước khi nổ ra hiệu ứng điện giật +
      // giáp ảo — phần tick/damage nằm ở tickThunderDash trong 07).
      const t=this.thunderCallTimer;
      if(t>0){
        _text(rx,ry-125,"⚡ LÔI ĐIỆN GIÁNG ⚡","#c77dff","11px Arial bold");
        if(t>30){
          // 0.5s đầu: tia sét đang rơi từ trời xuống đúng vị trí đứng
          const prog=1-((t-30)/30);
          const skyStart=-260;
          ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=20;
          ctx.strokeStyle="#e0aaff";ctx.lineWidth=5;ctx.lineCap="round";
          ctx.beginPath();let cy2=skyStart,cx2=rx+rndInt(-10,10);ctx.moveTo(cx2,cy2);
          const targetY=skyStart+(ry-skyStart)*prog;
          while(cy2<targetY){const nx=rx+rndInt(-14,14),ny=cy2+rndInt(30,60);ctx.lineTo(nx,ny);cy2=ny;}
          ctx.stroke();
          ctx.strokeStyle="#c77dff";ctx.lineWidth=2;ctx.stroke();
          ctx.restore();
        }else{
          // 0.5s sau: sét đã chạm đất, đang tích tụ chờ nổ
          const pulse=Math.sin(this.animFrame*0.4)*4;
          ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=18;ctx.strokeStyle="#e0aaff";ctx.lineWidth=3;
          ctx.beginPath();ctx.arc(rx,ry,20+pulse,0,Math.PI*2);ctx.stroke();
          ctx.restore();
          for(let i=0;i<2;i++){const fx=rx+rndInt(-22,22),fy=ry-30+rndInt(-20,20),s2=rndInt(2,5);_oval(fx-s2,fy-s2,s2*2,s2*2,rndChoice(["#9d4edd","#c77dff","white"]),null);}
        }
      }
    }
    else if(sk==="frost_s1"){
      _text(rx,ry-110,"❄️ ICE SPEARS ❄️","deepskyblue","10px Arial bold");
      ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=14;
      for(let i=0;i<4;i++){
        const bx=rx-(20*this.direction)-(i*14*this.direction),by=ry-18+(i*8);
        ctx.fillStyle="#AEEBFF";ctx.strokeStyle="white";ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(bx,by-10);ctx.lineTo(bx+(38*this.direction),by);ctx.lineTo(bx+(20*this.direction),by+10);ctx.lineTo(bx-(6*this.direction),by+2);
        ctx.closePath();ctx.fill();ctx.stroke();
      }
      ctx.restore();
      for(let i=0;i<6;i++){const sx=rx-rndInt(10,60)*this.direction,sy=ry+rndInt(-25,15),ss=rndInt(2,5);_oval(sx-ss,sy-ss,ss*2,ss*2,"white",null);}
    }
    else if(sk==="frost_s2"){
      _text(rx,ry-110,"🧊 ICE SLIDE 🧊","cyan","10px Arial bold");
      ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=12;
      for(let i=0;i<10;i++){const tx=rx-(i+1)*14*this.direction,ty=ry+rndInt(-6,20),s=rndInt(5,12);_oval(tx-s,ty-s,s*2,s*2,rndChoice(["#AEEBFF","white","#66CFFF"]),null);}
      ctx.restore();
      _oval(rx-30*this.direction-30,ry+18,60,10,"rgba(180,230,255,0.55)",null);
    }
    else if(sk==="frost_s3"){_text(rx,ry-110,"❄️ FROZEN DOMAIN ❄️","deepskyblue","10px Arial bold");}
    else if(sk==="frost_s4"){_text(rx,ry-110,"🧊 ICE PRISON 🧊","deepskyblue","10px Arial bold");}
    else if(sk==="fire_s1"){
      const v2=this.transformActive;
      _text(rx,ry-110,v2?"🔵 BLUE FIRE BULLET 🔵":"🔥 FIRE BULLET 🔥",v2?"#00E5FF":"orangered","10px Arial bold");
      ctx.save();ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=14;
      const mx=rx+30*this.direction;
      for(let i=0;i<6;i++){const a2=(af*10+i*60)*Math.PI/180,fr=14+Math.sin(af*0.2+i)*4,fx=mx+fr*Math.cos(a2),fy=ry-45+fr*Math.sin(a2),s=rndInt(3,6);_oval(fx-s,fy-s,s*2,s*2,rndChoice(v2?["#00AEFF","#00E5FF","white"]:["#FF6600","orange","yellow"]),null);}
      ctx.restore();
    }
    else if(sk==="fire_s2"){
      const v2=this.transformActive;
      _text(rx,ry-110,v2?"🔵 BLUE FLAME PILLAR 🔵":"🔥 FIRE PILLAR 🔥",v2?"#00E5FF":"orangered","10px Arial bold");
      (this.firePillarTargets||[]).forEach(t=>{
        ctx.save();ctx.globalAlpha=0.7;ctx.strokeStyle=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.lineWidth=3;ctx.setLineDash([6,4]);
        ctx.beginPath();ctx.ellipse(t.x,t.y+6,40*SR,14*SR,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        ctx.restore();
      });
    }
    else if(sk==="fire_s3"){
      const v2=this.transformActive;
      _text(rx,ry-110,v2?"🔵 BLUE FIRE DASH 🔵":"🔥 FIRE DASH 🔥",v2?"#00E5FF":"orangered","10px Arial bold");
      ctx.save();ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=12;
      for(let i=0;i<10;i++){const tx=rx-(i+1)*14*this.direction,ty=ry+rndInt(-20,20),s=rndInt(5,11);_oval(tx-s,ty-s,s*2,s*2,rndChoice(v2?["#00AEFF","#00E5FF","white"]:["#FF6600","#FF4400","yellow"]),null);}
      ctx.restore();
    }
    else if(sk==="fire_s4"){
      const v2=this.transformActive;
      _text(rx,ry-130,v2?"🔵 BLUE INFERNO DESTROYER 🔵":"🔥 FLAME DESTROYER 🔥",v2?"#00E5FF":"orangered","12px Arial bold");
    }
    else if(sk==="earth_s1"){
      _text(rx,ry-115,"🗿 EARTH BOULDER 🗿","burlywood","10px Arial bold");
      // Show the boulder being thrown from the character
      const throwX=rx+60*this.direction,throwY=ry-55;
      ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=12;
      // Boulder
      _oval(throwX-22,throwY-22,44,44,"#6a4a2a","#4a3524",2);
      _oval(throwX-16,throwY-16,32,32,"#8a6a4a",null);
      _oval(throwX-10,throwY-10,20,20,"#a67c52",null);
      // Cracks
      ctx.strokeStyle="#3a2518";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(throwX-10,throwY-12);ctx.lineTo(throwX+8,throwY-5);ctx.lineTo(throwX+3,throwY+8);ctx.stroke();
      ctx.restore();
      // Debris particles
      for(let i=0;i<6;i++){const dx=rndInt(-30,30),dy=rndInt(-30,10),s=rndInt(3,7);_oval(throwX+dx-s,throwY+dy-s,s*2,s*2,rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"]),null);}
      // Motion lines showing throw direction
      ctx.strokeStyle="rgba(198,138,74,0.5)";ctx.lineWidth=3;
      for(let i=0;i<4;i++){const lx=rx+(30+i*12)*this.direction,ly=ry-50+rndInt(-8,8);ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(lx+15*this.direction,ly);ctx.stroke();}
    }
    else if(sk==="earth_s2"){
      // Safety-net only: _drawInner intercepts earthMudActive before this
      // point every frame, so this branch normally never renders.
      _text(rx,ry-115,"🟤 HÓA BÙN 🟤","#a67c52","10px Arial bold");
    }
    else if(sk==="earth_s3"){
      _text(rx,ry-115,"🌵 CỘT ĐÁ PHẢN ĐÒN 🌵","gold","10px Arial bold");
      // Spikes around the character
      for(let i=0;i<10;i++){
        const ang=(i/10)*Math.PI*2,sr=50+Math.sin(af*0.1+i)*10;
        const sx=rx+Math.cos(ang)*sr,sy=ry-10+Math.sin(ang)*sr*0.4;
        ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=6;
        ctx.fillStyle="#8a6a4a";ctx.strokeStyle="#4a3524";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(sx-5,sy+15);ctx.lineTo(sx,sy-15);ctx.lineTo(sx+5,sy+15);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
      }
    }
    else if(sk==="water_s1"){_text(rx,ry-110,"💧 WATER BULLET 💧","aqua","11px Arial bold");}
    else if(sk==="water_s2"){_text(rx,ry-110,"🛡️ AQUA SHIELD 🛡️","cyan","11px Arial bold");}
    else if(sk==="water_s3"){
      _text(rx,ry-115,"🌊 THỦY PHÁO CUỒNG NỘ 🌊","aqua","11px Arial bold");
      const wEnd=rx+(520*this.direction),x1=Math.min(rx,wEnd),ww=Math.abs(520);
      ctx.save();ctx.shadowColor="aqua";ctx.shadowBlur=14;
      _rect(x1,ry-22,ww,64,"#1560c4","aqua",3);
      _rect(x1,ry-10,ww,10,"#3fa9ff",null,0);
      _rect(x1,ry+18,ww,10,"#0a3d91",null,0);
      ctx.restore();
      for(let w2=0;w2<3;w2++){
        const wy=ry-16+w2*20;
        ctx.strokeStyle="rgba(255,255,255,0.55)";ctx.lineWidth=2;
        ctx.beginPath();
        for(let a=0;a<=ww;a+=14){
          const yy=wy+Math.sin((a+this.animFrame*6+w2*30)*0.15)*5;
          const xx=x1+a;
          if(a===0)ctx.moveTo(xx,yy);else ctx.lineTo(xx,yy);
        }
        ctx.stroke();
      }
      for(let i=0;i<10;i++){const fx2=x1+rng()*ww,fy2=ry-22+rng()*64,fs=rndInt(4,9);_oval(fx2-fs,fy2-fs,fs*2,fs*2,"white",null);}
      for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,rr=rndInt(10,30),sx=wEnd+Math.cos(ang)*rr,sy=ry+Math.sin(ang)*rr*0.5,ss=rndInt(3,7);_oval(sx-ss,sy-ss,ss*2,ss*2,rndChoice(["white","aqua","#D6F3FF"]),null);}
    }
    else if(sk==="wind_s1"){
      _text(rx,ry-110,"🍃 PHONG TRẢM 🍃","lightgreen","10px Arial bold");
      ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=10;ctx.strokeStyle="#CCFFCC";ctx.lineWidth=3;
      for(let i=0;i<3;i++){const lx=rx+(20+i*16)*this.direction;ctx.beginPath();ctx.moveTo(lx,ry-52-i*4);ctx.quadraticCurveTo(lx+10*this.direction,ry-46-i*4,lx,ry-40-i*4);ctx.stroke();}
      ctx.restore();
    }
    else if(sk==="wind_s2"){
      _text(rx,ry-110,"💨 CUỒNG PHONG BỘ 💨","lightgreen","10px Arial bold");
      ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=10;
      for(let i=0;i<6;i++){const tx2=rx-(i+1)*16*this.direction,ty2=ry+rndInt(-24,10),s=rndInt(4,9);_oval(tx2-s,ty2-s,s*2,s*2,rndChoice(["#90EE90","white","#CCFFCC"]),null);}
      ctx.restore();
    }
    else if(sk==="wind_s3"){_text(rx,ry-115,"🌀 LỐC GIAM CẦM 🌀","lightgreen","11px Arial bold");}
    else if(sk==="wind_s4"){_text(rx,ry-110,"🌪️ ĐẠI PHONG BẠO 🌪️","lightgreen","12px Arial bold");}
  }
  _drawEarthBuff(rx,ry){
    const af=this.animFrame,pulse=Math.sin(af*0.15)*6;
    ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=14;
    // Outer rock shell
    ctx.strokeStyle="#8a6a4a";ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(rx,ry-20,62+pulse,86+pulse,0,0,Math.PI*2);ctx.stroke();
    // Inner glow
    ctx.strokeStyle="#c68a4a";ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(rx,ry-20,55+pulse,78+pulse,0,0,Math.PI*2);ctx.stroke();
    // Rock fragments orbiting
    for(let i=0;i<8;i++){const ang=(af*4+i*45)*Math.PI/180,rr=65+pulse,px2=rx+Math.cos(ang)*rr,py2=ry-20+Math.sin(ang)*rr*0.9;
      const rs=rndInt(4,8);ctx.fillStyle="#a97a45";ctx.strokeStyle="#4a3524";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(px2,py2-rs);ctx.lineTo(px2+rs,py2+rs*0.5);ctx.lineTo(px2-rs,py2+rs*0.5);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.restore();
    _text(rx,ry-108,`🛡️ GIÁP ĐÁ -70% (${Math.ceil(this.dmgReduceTimer/60)}s)`,"#e0b070","8px Arial bold");
  }
  _drawWaterCloud(rx,ry){
    const cloudY=ry-138;
    ctx.save();ctx.globalAlpha=0.92;
    [-32,-10,14,36].forEach(off=>{_oval(rx+off-22,cloudY-14,44,28,"#5a6a7a","#8fa0b0",1);});
    _oval(rx-46,cloudY-6,26,20,"#5a6a7a","#8fa0b0",1);
    ctx.restore();
    (this.waterCloudDrops||[]).forEach(d=>{ctx.strokeStyle="rgba(150,220,255,0.85)";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(d.x,d.y);ctx.lineTo(d.x,d.y+10);ctx.stroke();});
    _text(rx,cloudY-24,"🌧️ MƯA HỒI PHỤC 🌧️","lightblue","9px Arial bold");
  }
  _drawUlti(rx,ry){
    const af=this.animFrame;
    if(this.activeSkill==="thunder_s4"){
      // CHIÊU 3 / CHIÊU CUỐI — LÔI CẦU PHÁN QUYẾT: tụ lực (0.75s) -> bắn
      // năng lượng lên trời (0.25s) -> quả cầu sét hình thành & chờ (0.25s)
      // -> quả cầu liên tục phóng tia sét xuống mục tiêu quanh nó (phần gây
      // damage/DOT nằm ở thunderJudgmentTick trong 06). rx,ry là toạ độ màn
      // hình của nhân vật; quả cầu neo tại thunderUltiOrbX/Y (toạ độ thế
      // giới, khoá lúc tạo) — quy đổi sang màn hình theo lệch rx-this.x.
      const CHARGE=45,BEAM=15,WAIT=15;
      const elapsed=195-this.ultiTimer;
      const orbSx=rx+(this.thunderUltiOrbX-this.x),orbSy=ry+(this.thunderUltiOrbY-this.y);
      if(elapsed<CHARGE){
        _text(rx,ry-150,"⚡ TỤ LỰC SẤM SÉT ⚡","#c77dff","12px Arial bold");
        for(let i=0;i<3;i++){
          const ang=(af*6+i*120)*Math.PI/180,r2=34+Math.sin(af*0.25+i)*8;
          const sx=rx+r2*Math.cos(ang),sy=ry-40+r2*Math.sin(ang)*0.7;
          _oval(sx-4,sy-4,8,8,rndChoice(["#9d4edd","#4cc9f0","white"]),null);
        }
      }else if(elapsed<CHARGE+BEAM){
        _text(rx,ry-150,"⚡ LÔI CẦU PHÁN QUYẾT ⚡","#c77dff","12px Arial bold");
        ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=22;
        ctx.strokeStyle="#e0aaff";ctx.lineWidth=7;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(rx,ry-40);ctx.lineTo(orbSx,orbSy);ctx.stroke();
        ctx.strokeStyle="#c77dff";ctx.lineWidth=3;ctx.stroke();
        ctx.restore();
      }else{
        // Quả cầu đã (hoặc đang) hình thành: vòng xoáy độc đáo lơ lửng trên trời
        _text(rx,ry-150,"⚡ LÔI CẦU PHÁN QUYẾT ⚡","#c77dff","12px Arial bold");
        ctx.save();ctx.shadowColor="#9d4edd";ctx.shadowBlur=24;
        for(let i=0;i<3;i++){
          const rr=22+i*9+Math.sin(af*0.15+i)*3;
          ctx.strokeStyle=["#9d4edd","#4cc9f0","#c77dff"][i];ctx.lineWidth=2;
          ctx.beginPath();ctx.ellipse(orbSx,orbSy,rr,rr*0.75,af*0.05+i,0,Math.PI*2);ctx.stroke();
        }
        ctx.fillStyle="#e0aaff";ctx.beginPath();ctx.arc(orbSx,orbSy,11,0,Math.PI*2);ctx.fill();
        ctx.restore();
        for(let i=0;i<2;i++){const fx=orbSx+rndInt(-16,16),fy=orbSy+rndInt(-16,16),s2=rndInt(2,4);_oval(fx-s2,fy-s2,s2*2,s2*2,rndChoice(["#9d4edd","white"]),null);}
      }
    }
    else if(this.activeSkill==="frost_s4"){
      ctx.strokeStyle="deepskyblue";ctx.lineWidth=1;ctx.setLineDash([4,4]);ctx.beginPath();ctx.arc(rx,ry,450,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      if(this.rainDrops.length<80)this.rainDrops.push({x:this.x+rndInt(-440,440),y:this.y-rndInt(100,400),r:rndInt(2,6)});
      this.rainDrops.forEach(sf=>{_oval(sf.x-sf.r,sf.y-sf.r,sf.r*2,sf.r*2,"white",null);sf.y+=rndInt(3,7);if(sf.y>this.y+80)sf.y=this.y-rndInt(100,400);});
    }
    else if(this.activeSkill==="earth_s4"){
      const tx=this._meteorTargetX||rx,ty=this._meteorTargetY||ry;
      const total=this._meteorWindup||150,elapsed=total-this.ultiTimer;
      const exploded=this._meteorExploded;
      _text(rx,ry-170,"☄️ THIÊN THẠCH GIÁNG THẾ ☄️","#c9a06a","14px Arial bold");
      if(!exploded){
        // Ground warning shadow grows first, then the meteor screams down —
        // slow at first, accelerating hard right before it hits (gravity feel)
        const preTotal=Math.max(1,total-24);
        const prog=Math.min(1,elapsed/preTotal);
        const shadowR=40+prog*95;
        ctx.save();ctx.globalAlpha=0.3+0.3*prog;ctx.fillStyle="rgba(15,8,0,0.6)";
        ctx.beginPath();ctx.ellipse(tx,ty+8,shadowR,shadowR*0.32,0,0,Math.PI*2);ctx.fill();
        ctx.restore();
        const metY=(ty-640)+640*Math.pow(prog,1.8);
        const metR=32+prog*32;
        ctx.save();ctx.shadowColor="#ff8a3d";ctx.shadowBlur=42;
        const grad=ctx.createRadialGradient(tx,metY,4,tx,metY,metR);
        grad.addColorStop(0,"#fff6dc");grad.addColorStop(0.35,"#ffcf7a");grad.addColorStop(0.65,"#d9691f");grad.addColorStop(0.85,"#7a3a12");grad.addColorStop(1,"rgba(60,20,5,0.15)");
        ctx.fillStyle=grad;
        ctx.beginPath();ctx.arc(tx,metY,metR,0,Math.PI*2);ctx.fill();
        for(let i=0;i<6;i++){const a2=(af*4+i*60)*Math.PI/180,fr=metR*0.8,fx2=tx+fr*Math.cos(a2),fy2=metY+fr*Math.sin(a2)*0.9,s=metR*0.2;_oval(fx2-s,fy2-s,s*2,s*2,"#ffb35c",null);}
        ctx.restore();
        // Fiery trail streaking up behind it
        ctx.save();ctx.globalAlpha=0.7;
        const trail=ctx.createLinearGradient(tx,metY-metR,tx,metY-metR-130);
        trail.addColorStop(0,"rgba(255,180,80,0.55)");trail.addColorStop(1,"rgba(255,80,20,0)");
        ctx.fillStyle=trail;
        ctx.beginPath();ctx.moveTo(tx-metR*0.55,metY-metR*0.3);ctx.lineTo(tx+metR*0.55,metY-metR*0.3);ctx.lineTo(tx+metR*0.22,metY-metR-150);ctx.lineTo(tx-metR*0.22,metY-metR-150);ctx.closePath();ctx.fill();
        ctx.restore();
        if(af%2===0)hitEffects.push({x:tx+rndInt(-8,8),y:metY+metR*0.5,vx:(rng()-0.5)*1.5,vy:rng()*1+0.5,life:20,maxLife:20,particle:true,color:rndChoice(["#ffb35c","#ff8a3d","#ffdca0"])});
        // World starts trembling harder as it closes in
        screenShake=Math.max(screenShake,prog*prog*10);
      }else{
        const since=elapsed-(this._meteorExplodeFrame||elapsed);
        const flashA=Math.max(0,1-since*0.15);
        if(flashA>0){
          ctx.save();ctx.globalAlpha=flashA*0.6;
          const fl=ctx.createRadialGradient(tx,ty-10,0,tx,ty-10,380);
          fl.addColorStop(0,"white");fl.addColorStop(0.4,"#ffcf7a");fl.addColorStop(1,"rgba(255,255,255,0)");
          ctx.fillStyle=fl;ctx.beginPath();ctx.arc(tx,ty-10,380,0,Math.PI*2);ctx.fill();
          ctx.restore();
        }
        for(let ring=0;ring<3;ring++){
          const rSince=Math.max(0,since-ring*5);
          if(rSince<=0)continue;
          const maxR=520-ring*100;
          const rr=Math.min(maxR,rSince*22);
          const a=Math.max(0,1-rSince/30);
          if(a<=0)continue;
          ctx.save();ctx.globalAlpha=a*0.7;
          ctx.strokeStyle=["#5a4030","#c9a06a","#8a6a4a"][ring];
          ctx.lineWidth=[8,4,6][ring];
          ctx.beginPath();ctx.ellipse(tx,ty+8,rr,rr*0.3,0,0,Math.PI*2);ctx.stroke();
          ctx.restore();
        }
        // Jagged ground cracks radiating from the impact, generated once and
        // held steady on `this` so they don't jitter/re-randomize every frame
        if(!this._meteorCracks){
          this._meteorCracks=[];
          const crackCount=10;
          for(let i=0;i<crackCount;i++){
            const ang=(i/crackCount)*Math.PI*2+rng()*0.3;
            const len=60+rng()*90,segs=4+rndInt(0,2);
            const pts=[tx,ty+8];let cx=tx,cy=ty+8;
            for(let s=0;s<segs;s++){cx+=Math.cos(ang)*(len/segs)+(rng()-0.5)*10;cy+=Math.sin(ang)*0.25*(len/segs)+(rng()-0.5)*6;pts.push(cx,cy);}
            this._meteorCracks.push(pts);
          }
        }
        const crackA=Math.max(0,1-since*0.02);
        ctx.save();ctx.globalAlpha=crackA;ctx.strokeStyle="#2a1a0e";ctx.lineWidth=3;
        this._meteorCracks.forEach(pts=>{ctx.beginPath();for(let i=0;i<pts.length;i+=2)i===0?ctx.moveTo(pts[i],pts[i+1]):ctx.lineTo(pts[i],pts[i+1]);ctx.stroke();});
        ctx.strokeStyle="#ff8a3d";ctx.lineWidth=1;ctx.globalAlpha=crackA*0.8;
        this._meteorCracks.forEach(pts=>{ctx.beginPath();for(let i=0;i<pts.length;i+=2)i===0?ctx.moveTo(pts[i],pts[i+1]):ctx.lineTo(pts[i],pts[i+1]);ctx.stroke();});
        ctx.restore();
        // Smoldering crater
        ctx.save();ctx.globalAlpha=Math.max(0,0.55-since*0.01);
        _oval(tx-90,ty-20,180,55,"rgba(30,18,10,0.6)",null);
        ctx.restore();
      }
    }
    else if(this.activeSkill==="fire_s4"){
      const v2=this.transformActive;
      const tx=this._fireUltiTargetX||rx,ty=this._fireUltiTargetY||ry;
      const total=this._fireUltiWindup||100, elapsed=total-this.ultiTimer;
      const exploded=this._fireUltiExploded;
      _text(rx,ry-170,v2?"🔵 BLUE INFERNO DESTROYER 🔵":"🔥 FLAME DESTROYER 🔥",v2?"#00E5FF":"orange","14px Arial bold");
      if(!exploded){
        // A truly GIANT fireball forms high above the target and descends
        const preTotal=total-45;
        const prog=Math.min(1,elapsed/Math.max(1,preTotal));
        const fbY=(ty-420)+420*prog;
        const fbR=(v2?170:130)*(0.5+0.5*prog); // 4-5x bigger than the original version
        ctx.save();ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=50;
        const grad=ctx.createRadialGradient(tx,fbY,4,tx,fbY,fbR);
        if(v2){grad.addColorStop(0,"white");grad.addColorStop(0.3,"#AEEFFF");grad.addColorStop(0.55,"#33CCFF");grad.addColorStop(0.82,"#0066FF");grad.addColorStop(1,"rgba(0,40,180,0.15)");}
        else{grad.addColorStop(0,"#FFFDE0");grad.addColorStop(0.3,"#FFEE99");grad.addColorStop(0.55,"#FF9900");grad.addColorStop(0.82,"#FF3300");grad.addColorStop(1,"rgba(140,10,0,0.15)");}
        ctx.fillStyle=grad;
        ctx.beginPath();ctx.arc(tx,fbY,fbR,0,Math.PI*2);ctx.fill();
        // Roiling surface flares around the rim for a less-perfect-sphere, more "alive" look
        for(let i=0;i<8;i++){const a2=(af*6+i*45)*Math.PI/180,fr=fbR*0.85,fx2=tx+fr*Math.cos(a2),fy2=fbY+fr*Math.sin(a2)*0.6,s=fbR*0.22;_oval(fx2-s,fy2-s,s*2,s*2,v2?"#66DDFF":"#FFCC55",null);}
        ctx.restore();
        if(af%2===0)for(let i=0;i<5;i++){const ang=rng()*Math.PI*2;hitEffects.push({x:tx+Math.cos(ang)*fbR,y:fbY+Math.sin(ang)*fbR,vx:(rng()-0.5)*3,vy:(rng()-0.5)*3,life:24,maxLife:24,particle:true,color:v2?rndChoice(["#00AEFF","#00E5FF","white"]):rndChoice(["#FF8800","#FFCC33","#FF4400"])});}
      }else{
        // MASSIVE multi-ring shockwave + ground scorch, custom-drawn (not
        // limited by the generic hitEffects ring's 80px cap) so it can
        // actually read as 5-10x bigger than a normal skill's impact.
        const since=elapsed-(this._fireUltiExplodeFrame||elapsed);
        const flashA=Math.max(0,1-since*0.18);
        if(flashA>0){
          ctx.save();ctx.globalAlpha=flashA*0.55;
          const fl=ctx.createRadialGradient(tx,ty-20,0,tx,ty-20,420);
          fl.addColorStop(0,"white");fl.addColorStop(0.4,v2?"#66DDFF":"#FFCC66");fl.addColorStop(1,"rgba(255,255,255,0)");
          ctx.fillStyle=fl;ctx.beginPath();ctx.arc(tx,ty-20,420,0,Math.PI*2);ctx.fill();
          ctx.restore();
        }
        for(let ring=0;ring<3;ring++){
          const ringDelay=ring*6;
          const rSince=Math.max(0,since-ringDelay);
          if(rSince<=0)continue;
          const maxR=900-ring*120; // huge — several times the character's own size
          const rr=Math.min(maxR,rSince*26);
          const a=Math.max(0,1-rSince/38);
          if(a<=0)continue;
          ctx.save();ctx.globalAlpha=a*0.75;
          ctx.strokeStyle=[v2?"#00CFFF":"#FF6600","white",v2?"#66F0FF":"#FFDD55"][ring];
          ctx.lineWidth=[9,5,7][ring];
          ctx.beginPath();ctx.ellipse(tx,ty+10,rr,rr*0.32,0,0,Math.PI*2);ctx.stroke();
          ctx.restore();
        }
        // Lingering ground fire glow
        ctx.save();ctx.globalAlpha=Math.max(0,0.5-since*0.012);ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=40;
        _oval(tx-140,ty-40,280,90,v2?"rgba(0,150,255,0.4)":"rgba(255,80,0,0.4)",null);
        ctx.restore();
      }
    }
    else if(this.activeSkill==="water_s4"){
      _text(rx,ry-155,"🌊 ĐẠI HỒNG THỦY - TSUNAMI 🌊","aqua","13px Arial bold");
      const floorYY=H-230,waveH=Math.floor(H*0.28),wxL=this.tsunamiWaveXL,wxR=this.tsunamiWaveXR;
      [wxL,wxR].forEach((wx,idx)=>{
        const dir=idx===0?-1:1;
        ctx.save();ctx.shadowColor="aqua";ctx.shadowBlur=18;
        for(let layer=0;layer<3;layer++){
          const lh=waveH*(1-layer*0.22),lo=layer*14;
          ctx.fillStyle=["#0a3d91","#1560c4","#3fa9ff"][layer];
          ctx.strokeStyle="aqua";ctx.lineWidth=2;
          ctx.beginPath();
          ctx.moveTo(wx+lo*dir,floorYY);
          ctx.lineTo(wx+(lo-30)*dir,floorYY-lh);
          ctx.lineTo(wx+(lo+30)*dir,floorYY-lh);
          ctx.lineTo(wx+(lo+40)*dir,floorYY);
          ctx.closePath();ctx.fill();ctx.stroke();
        }
        ctx.restore();
        for(let i=0;i<14;i++){const fx3=wx+rndInt(-40,40),fy3=floorYY-waveH+rndInt(-10,20),fs=rndInt(3,8);_oval(fx3-fs,fy3-fs,fs*2,fs*2,"white",null);}
        for(let i=0;i<6;i++){const mx2=wx+rndInt(-60,60),my2=floorYY-waveH-rndInt(0,30);_oval(mx2-10,my2-6,20,12,"rgba(255,255,255,0.35)",null);}
      });
    }
    else if(this.activeSkill==="wind_s4"){
      // ĐẠI PHONG BẠO — a massive tempest engulfs the whole area around the
      // caster: dimmed sky, a tall thick funnel, a pulsing shockwave ring at
      // the true damage boundary, streaking wind-blades, and orbiting debris.
      ctx.save();
      ctx.setTransform(1,0,0,1,0,0);
      ctx.globalAlpha=0.22;ctx.fillStyle="#081208";ctx.fillRect(0,0,W,H);
      ctx.restore();
      _text(rx,ry-190,"🌪️ ĐẠI PHONG BẠO 🌪️","#AAFFAA","16px Arial bold");
      const range=600*SR;
      // soft ground-hugging haze across the whole ability range
      ctx.save();ctx.globalAlpha=0.16;ctx.fillStyle="#90EE90";
      ctx.beginPath();ctx.ellipse(rx,ry,range,range*0.42,0,0,Math.PI*2);ctx.fill();ctx.restore();
      // pulsing shockwave ring marking the true damage boundary
      const pulse=(af*5)%range;
      ctx.save();ctx.globalAlpha=Math.max(0,1-pulse/range)*0.6;ctx.strokeStyle="#CCFFCC";ctx.lineWidth=4;ctx.shadowColor="#90EE90";ctx.shadowBlur=14;
      ctx.beginPath();ctx.ellipse(rx,ry,pulse,pulse*0.42,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      // tall, thick central funnel — 14 layers reaching well above the character
      for(let layer=0;layer<14;layer++){
        const frac=layer/14,layerY=ry+55-frac*460,baseR=(range*0.34)*(1-frac*0.5)+22,spin=Math.sin(af*0.2+frac*Math.PI*3.2)*(32-frac*14);
        const cols=["#061a06","#0a330a","#0f4d0f","#166416","#1c7d1c","#228B22","#2fa82f","#32CD32","#4fd94f","#7CFC00","#9dff5c","#ADFF2F","#E0FF80","#F5FFF0"];
        ctx.strokeStyle=cols[layer];ctx.lineWidth=4;
        ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=10;
        ctx.beginPath();ctx.ellipse(rx+spin,layerY,baseR,24,0,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }
      // bright glowing core column
      ctx.save();ctx.globalAlpha=0.5;ctx.shadowColor="white";ctx.shadowBlur=20;ctx.fillStyle="rgba(240,255,230,0.5)";
      ctx.beginPath();ctx.ellipse(rx,ry-160,28,190,0,0,Math.PI*2);ctx.fill();ctx.restore();
      // orbiting chunks of debris flung out at the full ability radius
      if(!this._windStormDebris)this._windStormDebris=[0,1,2,3,4,5,6,7].map(i=>({ang:i*45,r:rndInt(90,range*0.95),s:rndInt(5,11)}));
      this._windStormDebris.forEach(d=>{
        d.ang+=7;
        const dx=rx+Math.cos(d.ang*Math.PI/180)*d.r,dy=ry-20+Math.sin(d.ang*Math.PI/180)*d.r*0.4;
        ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=10;ctx.fillStyle="#E0FFE0";
        ctx.beginPath();ctx.ellipse(dx,dy,d.s,d.s*0.5,d.ang*Math.PI/180,0,Math.PI*2);ctx.fill();
        ctx.restore();
      });
      // slashing wind-blade streaks radiating outward
      if(af%6===0){
        for(let i=0;i<4;i++){
          const ang=rng()*Math.PI*2,len=range*(0.5+rng()*0.5);
          const sx=rx+Math.cos(ang)*40,sy=ry-30+Math.sin(ang)*20;
          const ex=rx+Math.cos(ang)*len,ey=ry-20+Math.sin(ang)*len*0.4;
          ctx.save();ctx.globalAlpha=0.7;ctx.strokeStyle="#CCFFCC";ctx.lineWidth=3;ctx.shadowColor="#90EE90";ctx.shadowBlur=10;
          ctx.beginPath();ctx.moveTo(sx,sy);ctx.lineTo(ex,ey);ctx.stroke();
          ctx.restore();
        }
      }
      if(af%2===0)for(let i=0;i<5;i++){const ang=rng()*Math.PI*2,rr=rng()*range;hitEffects.push({x:rx+Math.cos(ang)*rr,y:ry-20+Math.sin(ang)*rr*0.4,vx:(rng()-0.5)*2.5,vy:-rng()*2.5-1,life:24,maxLife:24,particle:true,color:rndChoice(["#90EE90","white","#CCFFCC"])});}
    }
  }
  // Detailed rotating aura ring for the fire fighter's V4 transform. The
  // fighter stays fixed at the exact center of the ring while it continuously
  // and slowly spins, with an inner counter-rotating ring and 16 tick/rune
  // marks for a layered, "ngầu" magic-circle look.
  _drawHellRing(cx,cy,hell){
    const af=this.animFrame;
    if(this._ringAngle===undefined)this._ringAngle=0;
    this._ringAngle=(this._ringAngle+0.45)%360; // slow continuous rotation
    const outerCol=hell?"#00AEFF":"#FF5500";
    const glowCol =hell?"#66E0FF":"#FFCC33";
    const rot1=this._ringAngle*Math.PI/180;
    const rot2=-this._ringAngle*1.7*Math.PI/180;
    ctx.save();
    ctx.translate(cx,cy);
    // outer solid ring
    ctx.rotate(rot1);
    ctx.strokeStyle=outerCol;ctx.lineWidth=3;
    ctx.shadowColor=glowCol;ctx.shadowBlur=18;
    ctx.beginPath();ctx.ellipse(0,0,98,68,0,0,Math.PI*2);ctx.stroke();
    // 16 rotating tick/rune marks around the outer ring
    for(let i=0;i<16;i++){
      const a=(i/16)*Math.PI*2;
      const rxo=98,ryo=68;
      const x1=Math.cos(a)*rxo,y1=Math.sin(a)*ryo;
      const x2=Math.cos(a)*(rxo+ (i%4===0?14:8)),y2=Math.sin(a)*(ryo+(i%4===0?10:6));
      ctx.strokeStyle=i%4===0?glowCol:outerCol;
      ctx.lineWidth=i%4===0?3:1.5;
      ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
    }
    ctx.rotate(-rot1);
    // inner dashed ring, counter-rotating for a layered "double ring" effect
    ctx.rotate(rot2);
    ctx.strokeStyle=glowCol;ctx.lineWidth=2;ctx.setLineDash([9,7]);
    ctx.beginPath();ctx.ellipse(0,0,78,54,0,0,Math.PI*2);ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-rot2);
    ctx.restore();
    // faint pulsing energy particles orbiting along the ring
    for(let i=0;i<6;i++){
      const a=((af*3+i*60)%360)*Math.PI/180;
      const px=cx+Math.cos(a)*98,py=cy+Math.sin(a)*68;
      ctx.save();ctx.globalAlpha=0.8;
      _oval(px-3,py-3,6,6,glowCol,null);
      ctx.restore();
    }
  }
  _drawTransform(rx,ry){
    const af=this.animFrame,t=this.charType;
    const secsLeft=(this.transformTimer/60).toFixed(1);
    if(t==="red"){
      if(this.transformInvisActive){const pulse=Math.abs(Math.sin(af*0.25))*3;ctx.strokeStyle="white";ctx.lineWidth=3;ctx.setLineDash([4,4]);ctx.beginPath();ctx.ellipse(rx,ry-23,60+pulse,83+pulse,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);_text(rx,ry-125,"👻 BẤT TỬ 👻","white","9px Arial bold");}
      else{
        const _h=true; // V4 transform always switches to hellfire blue — no toggle needed
        this._drawHellRing(rx,ry-15,_h);
        // Bigger, more intense flame surging up around the fighter (replaces the old tiny flame column)
        const normalCols=["#FF6600","#FF4400","orange","yellow","white","#FFEE88","red"];
        const hellCols=["#0033CC","#0066FF","#0099FF","#33CCFF","#99EEFF","white","#00AEFF"];
        const palette=_h?hellCols:normalCols;
        ctx.save();ctx.shadowColor=_h?"#00AEFF":"orange";ctx.shadowBlur=20;
        for(let i=0;i<22;i++){
          const fx=rx+rndInt(-42,42);
          const fy=ry+58-i*13-rndInt(0,12);
          const sz=Math.max(9,34-i*1.1);
          const intens=i/22;
          const col=intens<0.3?rndChoice(palette.slice(0,3)):intens<0.65?rndChoice(palette.slice(2,5)):rndChoice(palette.slice(4));
          _oval(fx-sz,fy-sz,sz*2,sz*2,col,null);
        }
        // large glowing core at the base — this is the "địa ngục" (hellfire) heart of the flame
        const corePulse=Math.abs(Math.sin(af*0.2))*6;
        _oval(rx-26-corePulse,ry+40,52+corePulse*2,34+corePulse,_h?"#00CFFF":"#FFCC33",null);
        _oval(rx-14,ry+44,28,20,"white",null);
        ctx.restore();
        _text(rx,ry-192,_h?"🔥 LỬA ĐỊA NGỤC V4 🔥":"🔥 BỐC LỬA V4 🔥","white","9px Arial bold");
      }
    }
    else if(t==="thunder"){
      // ⚡ THUNDER GOD V4 — pure white + electric gold, no purple anywhere.
      this._drawEnergyRing(rx,ry-15,THUNDER_WHITE,THUNDER_GOLD);
      // Lightning-bolt wings made of jagged white/gold shards on the back
      for(const side of[-1,1]){
        ctx.save();ctx.shadowColor=THUNDER_GOLD;ctx.shadowBlur=14;
        ctx.fillStyle="rgba(255,215,0,0.28)";ctx.strokeStyle=THUNDER_WHITE;ctx.lineWidth=2;
        ctx.beginPath();
        ctx.moveTo(rx+side*6,ry-40);
        ctx.lineTo(rx+side*46,ry-88);ctx.lineTo(rx+side*30,ry-80);
        ctx.lineTo(rx+side*70,ry-118);ctx.lineTo(rx+side*50,ry-108);
        ctx.lineTo(rx+side*88,ry-70);ctx.lineTo(rx+side*58,ry-58);
        ctx.lineTo(rx+side*72,ry-10);ctx.lineTo(rx+side*30,ry+10);
        ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
      }
      // A crackling halo behind the head + glowing white eyes
      ctx.save();ctx.shadowColor=THUNDER_WHITE;ctx.shadowBlur=14;
      ctx.strokeStyle=THUNDER_GOLD;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(rx,ry-68,20,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      _oval(rx-9,ry-46,7,7,THUNDER_WHITE,null);_oval(rx+2,ry-46,7,7,THUNDER_WHITE,null);
      // Continuous electric arcs running off the whole body — never purple
      for(let i=0;i<6;i++){
        const ang=(af*15+i*60)*Math.PI/180,db=100+rndInt(20,170),ex=rx+db*Math.cos(ang),ey=ry-10+(db*0.55)*Math.sin(ang),mx=(rx+ex)/2+rndInt(-28,28),my=(ry-10+ey)/2+rndInt(-20,20);
        ctx.strokeStyle=rndChoice([THUNDER_GOLD,THUNDER_YELLOW,THUNDER_WHITE,THUNDER_ARC]);ctx.lineWidth=rndChoice([1,1,2,2,3]);
        ctx.beginPath();ctx.moveTo(rx,ry-10);ctx.lineTo(mx,my);ctx.stroke();
        ctx.beginPath();ctx.moveTo(mx,my);ctx.lineTo(ex,ey);ctx.stroke();
        _oval(ex-5,ey-5,10,10,THUNDER_GOLD,null);
      }
      // Ground-hugging static field rings
      for(let i=0;i<4;i++){const r2=90+i*55+Math.sin(af*0.1+i)*12;ctx.strokeStyle=[THUNDER_WHITE,THUNDER_GOLD,THUNDER_YELLOW,THUNDER_ARC][i];ctx.lineWidth=2;ctx.setLineDash([5,3]);ctx.beginPath();ctx.ellipse(rx,ry+5,r2,r2*0.5+10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
      _text(rx,ry-118,"⚡ THẦN SẤM V4 ⚡","white","9px Arial bold");
    }
    else if(t==="frost"){
      const flapAngle=Math.sin(af*0.18)*28;
      for(const side of[-1,1]){
        const fyo=Math.floor(flapAngle*side*-0.6);
        ctx.save();ctx.shadowColor="deepskyblue";ctx.shadowBlur=10;
        ctx.fillStyle="#001a4d";ctx.strokeStyle="deepskyblue";ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(rx+side*8,ry-38);
        ctx.lineTo(rx+side*55,ry-130+fyo);
        ctx.lineTo(rx+side*75,ry-145+fyo);
        ctx.lineTo(rx+side*95,ry-128+fyo);
        ctx.lineTo(rx+side*110,ry-150+fyo);
        ctx.lineTo(rx+side*128,ry-118+fyo);
        ctx.lineTo(rx+side*145,ry-90+fyo);
        ctx.lineTo(rx+side*130,ry-20+fyo/2);
        ctx.lineTo(rx+side*90,ry+30);
        ctx.lineTo(rx+side*30,ry+15);
        ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
        ctx.strokeStyle="#66CFFF";ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(rx+side*8,ry-38);ctx.lineTo(rx+side*95,ry-110+fyo);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx+side*8,ry-38);ctx.lineTo(rx+side*120,ry-60+fyo/2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx+side*8,ry-38);ctx.lineTo(rx+side*90,ry+10);ctx.stroke();
        [[55,-130],[110,-150],[145,-90]].forEach(tip=>{const tx5=rx+side*tip[0],ty5=ry+tip[1]+fyo;_oval(tx5-4,ty5-4,8,8,"white",null);});
      }
      ctx.fillStyle="#DFF7FF";ctx.strokeStyle="white";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(rx-14,ry-82);ctx.lineTo(rx-26,ry-118);ctx.lineTo(rx-10,ry-84);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx+14,ry-82);ctx.lineTo(rx+26,ry-118);ctx.lineTo(rx+10,ry-84);ctx.closePath();ctx.fill();ctx.stroke();
      _text(rx,ry-160,"🐉 RỒNG V4 🐉","deepskyblue","9px Arial bold");
    }
    else if(t==="earth"){
      // === EARTH V4: ROCK ARMOR Golem with floating rocks ===
      // Initialize floating rock system if not exists
      if(!this._earthRocks)this._earthRocks=[0,1,2,3,4,5,6,7].map(i=>({ang:i*45+af*0.3,r:60+rng()*30,offY:(rng()-0.5)*40,s:rndInt(8,16),speed:0.6+rng()*0.4}));
      
      // Main body: armored rock core
      const armorPulse=Math.sin(af*0.08)*3;
      // Back armor plates
      ctx.save();ctx.shadowColor="#8a6a4a";ctx.shadowBlur=12;
      _rect(rx-32,ry-68,64+armorPulse,58+armorPulse,"#6a4a2a","#4a3524",2);
      _rect(rx-28,ry-52,56+armorPulse,42+armorPulse,"#7a5a3a","#4a3524",2);
      // Left shoulder rock
      ctx.fillStyle="#5a4030";ctx.strokeStyle="#3a2518";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(rx-28,ry-55);ctx.lineTo(rx-52,ry-68);ctx.lineTo(rx-48,ry-40);ctx.lineTo(rx-30,ry-38);ctx.closePath();ctx.fill();ctx.stroke();
      // Right shoulder rock
      ctx.beginPath();ctx.moveTo(rx+28,ry-55);ctx.lineTo(rx+52,ry-68);ctx.lineTo(rx+48,ry-40);ctx.lineTo(rx+30,ry-38);ctx.closePath();ctx.fill();ctx.stroke();
      // Arm armor
      _rect(rx-42,ry-38,16,30,"#5a4030","#3a2518",1);
      _rect(rx+26,ry-38,16,30,"#5a4030","#3a2518",1);
      // Leg armor
      _rect(rx-24,ry-18,18,22,"#5a4030","#3a2518",1);
      _rect(rx+6,ry-18,18,22,"#5a4030","#3a2518",1);
      // Face rock plate
      _rect(rx-14,ry-62,28,22,"#7a5a3a","#4a3524",2);
      ctx.restore();
      
      // Eyes glowing through the rock mask
      _oval(rx-9,ry-56,6,5,"#FFAA33",null);
      _oval(rx+3,ry-56,6,5,"#FFAA33",null);
      
      // Floating rocks orbiting around (must continuously move!)
      this._earthRocks.forEach((rk,i)=>{
        rk.ang+=rk.speed;
        const rAngle=rk.ang*Math.PI/180;
        const rBob=Math.sin(af*0.06+i*0.8)*8;
        const sx=rx+Math.cos(rAngle)*rk.r;
        const sy=ry-30+Math.sin(rAngle)*rk.r*0.45+rk.offY+rBob;
        ctx.save();
        ctx.shadowColor="#c68a4a";ctx.shadowBlur=8;
        // Draw jagged rock shape
        ctx.fillStyle=rndChoice(["#8a6a4a","#6a4a2a","#7a5a3a"]);
        ctx.strokeStyle="#4a3524";ctx.lineWidth=1.5;
        ctx.beginPath();
        ctx.moveTo(sx-rk.s*0.8,sy+rk.s*0.5);
        ctx.lineTo(sx-rk.s*0.4,sy-rk.s*0.7);
        ctx.lineTo(sx+rk.s*0.3,sy-rk.s*0.9);
        ctx.lineTo(sx+rk.s*0.9,sy-rk.s*0.1);
        ctx.lineTo(sx+rk.s*0.5,sy+rk.s*0.7);
        ctx.lineTo(sx-rk.s*0.2,sy+rk.s*0.6);
        ctx.closePath();ctx.fill();ctx.stroke();
        ctx.restore();
      });
      
      // Rock fragments trailing behind back (like Susanoo ribs)
      ctx.save();ctx.shadowColor="#a67c52";ctx.shadowBlur=6;
      for(let i=0;i<5;i++){
        const backX=rx+i*6;
        const backY=ry-70-i*14+Math.sin(af*0.07+i*1.2)*4;
        const bw=14-i*2;
        ctx.fillStyle="#5a4030";ctx.strokeStyle="#3a2518";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(backX-bw/2,backY);ctx.lineTo(backX,backY-10);ctx.lineTo(backX+bw/2,backY);ctx.closePath();ctx.fill();ctx.stroke();
      }
      ctx.restore();
      
      // Dust particles around armor
      if(af%4===0){
        const dx=rndInt(-50,50),dy=rndInt(-70,20);
        hitEffects.push({x:rx+dx,y:ry+dy,vx:(rng()-0.5)*0.6,vy:-rng()*0.4-0.1,life:20,maxLife:20,smoke:true,r0:rndInt(3,6),color:rndChoice(["#c68a4a","#a67c52","#8a6a4a"])});
      }
      
      // Ground dust when walking
      if(this.onGround&&Math.abs(this.x-this._lastX)>0.5){
        if(af%6===0){
          for(let i=0;i<3;i++){hitEffects.push({x:rx+rndInt(-20,20),y:ry+4,vy:-rng()*0.5-0.2,vx:(rng()-0.5)*0.8,life:18,maxLife:18,smoke:true,r0:rndInt(4,8),color:rndChoice(["#a67c52","#8a6a4a","#6a4a2a"])});}
        }
      }
      
      // Ghost HP bar
      if(this.ghostHp>0){const gbarW=Math.min(this.ghostHp/140,1)*80;_rect(rx-40,ry-145,80,10,"#333",null,0);_rect(rx-40,ry-145,gbarW,10,"#c68a4a",null,0);_text(rx,ry-155,`🪨 ${Math.floor(this.ghostHp)}`,"#c68a4a","8px Arial bold");}
      
      _text(rx,ry-170,"🗿 THẦN THỔ V4 🗿","#c68a4a","10px Arial bold");
    }
    else if(t==="water"){
      // ================================================================
      //  WATER V4 — "THIÊN THẦN GIÁNG THẾ" (Ocean Angel) rework v3.
      //  Wings reverted back to the original gold angel-feather shape per
      //  request. The divine light beam is kept, but its top Y is now solved
      //  analytically so it always lands just above the actual top of the
      //  canvas (screen_y ≈ -60) regardless of the fighter's on-screen height
      //  or the window/canvas size — v2 used a fixed "ry-420" offset which,
      //  after the body's per-pivot CHAR_VISUAL_SCALE shrink, could stop well
      //  short of the top of the screen on tall viewports. The same fix is
      //  applied to Thunder's V4 windup strike-column below.
      // ================================================================
      if(!this._waterHaloDrops)this._waterHaloDrops=[0,1,2,3,4,5].map(i=>({ang:i*60}));
      if(!this._waterLightMotes)this._waterLightMotes=[];
      const wDeep="#083a63",wMid="#1f8fd0",wLight="#8de8ff",wWhite="#f2fdff";

      // --- divine light beam pouring down from the sky ---
      // fy = the fighter's feet in the same (unscaled) coordinate space rx/ry
      // live in; solving screen_y = fy + SCALE*(topY-fy) = -60 for topY:
      const fy=ry+52;
      const beamTopY=fy+(-60-fy)/CHAR_VISUAL_SCALE, beamBotY=fy+2; // fy = feet, so the beam now actually reaches the ground
      ctx.save();
      ctx.globalCompositeOperation="lighter";
      const beamGrad=ctx.createLinearGradient(rx,beamTopY,rx,beamBotY);
      beamGrad.addColorStop(0,"rgba(255,255,255,0)");
      beamGrad.addColorStop(0.2,"rgba(240,253,255,0.5)");
      beamGrad.addColorStop(1,"rgba(180,230,255,0.08)");
      ctx.fillStyle=beamGrad;
      ctx.beginPath();
      ctx.moveTo(rx-16,beamTopY);ctx.lineTo(rx+16,beamTopY);
      ctx.lineTo(rx+64,beamBotY);ctx.lineTo(rx-64,beamBotY);
      ctx.closePath();ctx.fill();
      for(let i=0;i<4;i++){
        const sway=Math.sin(af*0.03+i*1.7)*14;
        ctx.globalAlpha=0.22;ctx.fillStyle="#ffffff";
        ctx.beginPath();
        ctx.moveTo(rx-3+sway*0.2,beamTopY);ctx.lineTo(rx+3+sway*0.2,beamTopY);
        ctx.lineTo(rx+10+sway,beamBotY);ctx.lineTo(rx-10+sway,beamBotY);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
      if(rng()<0.5&&this._waterLightMotes.length<22){
        this._waterLightMotes.push({x:rx+rndInt(-45,45),y:beamTopY,vy:rng()*1.4+0.9,life:80,maxLife:80,r:rndInt(1,3)});
      }
      _compact(this._waterLightMotes,p=>p.life>0&&p.y<beamBotY+10);
      this._waterLightMotes.forEach(p=>{
        p.y+=p.vy;p.life--;
        ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.9;
        _oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,"#ffffff",null);
        ctx.restore();
      });

      // --- original gold angel-feather wings (reverted, unchanged) ---
      for(const side of[-1,1]){ctx.fillStyle="#FFFFF0";ctx.strokeStyle="#FFD700";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rx+side*5,ry-35);ctx.lineTo(rx+side*30,ry-48);ctx.lineTo(rx+side*43,ry-35);ctx.lineTo(rx+side*38,ry-10);ctx.lineTo(rx+side*20,ry+8);ctx.lineTo(rx+side*10,ry+5);ctx.closePath();ctx.fill();ctx.stroke();}

      // halo — a ring of orbiting droplets instead of a static gold ellipse
      ctx.save();
      ctx.shadowColor=wWhite;ctx.shadowBlur=10;
      this._waterHaloDrops.forEach(d=>{
        d.ang=(d.ang+2.2)%360;
        const a=d.ang*Math.PI/180;
        const hx=rx+Math.cos(a)*15,hy=ry-49+Math.sin(a)*5;
        _oval(hx-3,hy-3,6,6,wWhite,wLight,1);
      });
      ctx.globalAlpha=0.7;ctx.strokeStyle=wLight;ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(rx,ry-47,15,5,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();

      // layered tidal rings pulsing outward around the body
      for(let i=0;i<3;i++){const r2=28+i*9+Math.sin(af*0.08+i)*3;ctx.strokeStyle=[wDeep,wMid,wLight][i];ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(rx,ry-10,r2,r2,0,0,Math.PI*2);ctx.stroke();}

      // outer swirling wave ring beneath the fighter (kept, glow added)
      ctx.save();ctx.shadowColor=wMid;ctx.shadowBlur=8;
      ctx.strokeStyle=wLight;ctx.lineWidth=2.5;
      ctx.beginPath();for(let a=0;a<=48;a++){const ar=a*(Math.PI*2/48),w2=Math.sin(ar*5+af*0.18)*11+Math.cos(ar*3-af*0.12)*6,rw=160+w2,rh=50+w2*0.3,wx=rx+rw*Math.cos(ar),wy2=ry+20+rh*0.32*Math.sin(ar);a===0?ctx.moveTo(wx,wy2):ctx.lineTo(wx,wy2);}ctx.stroke();
      ctx.restore();

      // trailing tidal comet-tail flowing down from the feet
      ctx.save();ctx.globalAlpha=0.4;ctx.fillStyle=wMid;
      ctx.beginPath();
      ctx.moveTo(rx-14,ry+40);
      ctx.quadraticCurveTo(rx,ry+70+Math.sin(af*0.15)*6,rx+14,ry+40);
      ctx.quadraticCurveTo(rx,ry+50,rx-14,ry+40);
      ctx.closePath();ctx.fill();
      ctx.restore();

      _text(rx,ry-122,"👼 THIÊN THẦN V4 👼","#eafcff","9px Arial bold");
    }
    else if(t==="fire"){
      // FLAME V2 — blue fire body, white-hot core, cyan light, blue "hair"
      // flame, glowing cyan eyes, and a steady stream of blue embers.
      this._drawHellRing(rx,ry-15,true);
      const cols=["#0033CC","#0066FF","#0099FF","#33CCFF","#99EEFF","white","#00E5FF"];
      ctx.save();ctx.shadowColor=FIRE_V2_COL;ctx.shadowBlur=22;
      for(let i=0;i<20;i++){
        const fx=rx+rndInt(-40,40);
        const fy=ry+56-i*13-rndInt(0,12);
        const sz=Math.max(8,32-i*1.1);
        const intens=i/20;
        const col=intens<0.3?rndChoice(cols.slice(0,3)):intens<0.65?rndChoice(cols.slice(2,5)):rndChoice(cols.slice(4));
        _oval(fx-sz,fy-sz,sz*2,sz*2,col,null);
      }
      // White-hot core at the base
      const corePulse=Math.abs(Math.sin(af*0.2))*6;
      _oval(rx-24-corePulse,ry+40,48+corePulse*2,32+corePulse,"#DFFCFF",null);
      _oval(rx-12,ry+44,24,18,"white",null);
      ctx.restore();
      // Blue flame "hair" jutting up from the head (replaces the plain black hat while V2)
      ctx.save();ctx.shadowColor=FIRE_V2_COL;ctx.shadowBlur=14;
      this._fireHairFlicker=(this._fireHairFlicker||0)+1;
      for(let i=0;i<3;i++){
        const flick=Math.sin(af*0.3+i*1.4)*6;
        const hx=rx-16+i*16,hLen=30+i%2*10+flick;
        ctx.fillStyle=i%2===0?"#00AEFF":"white";
        ctx.beginPath();
        ctx.moveTo(hx-7,ry-88);ctx.quadraticCurveTo(hx+flick,ry-88-hLen,hx+7,ry-88);
        ctx.closePath();ctx.fill();
      }
      ctx.restore();
      // Glowing cyan eyes
      _oval(rx-9,ry-46,7,7,"#AEEFFF",null);_oval(rx+2,ry-46,7,7,"#AEEFFF",null);
      // Floating blue embers drifting up around the body
      if(!this._fireV2Particles)this._fireV2Particles=[];
      if(rng()<0.5&&this._fireV2Particles.length<16)this._fireV2Particles.push({x:rx+rndInt(-38,38),y:ry+30,vy:-(rng()*1.2+0.5),vx:(rng()-0.5)*0.5,life:40,maxLife:40,r:rndInt(2,4)});
      _compact(this._fireV2Particles,p=>p.life>0);
      this._fireV2Particles.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.life--;ctx.save();ctx.globalAlpha=Math.max(0,p.life/p.maxLife)*0.85;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,rndChoice(["#00AEFF","#00E5FF","white"]),null);ctx.restore();});
      _text(rx,ry-192,"🔥 FLAME V2 🔥","#00E5FF","9px Arial bold");
    }
    else if(t==="wind"){
      for(const[side,off]of[[-1,-14],[1,14]]){_oval(rx+off-5,ry-82,10,34,"#FFB6C1","white");_oval(rx+off-3,ry-84,6,28,"#FF69B4",null);}
      _oval(rx-19,ry+40,10,10,"white","lightgray");
      for(let i=0;i<4;i++){const tr=rx-(i+1)*12*this.direction;ctx.strokeStyle="#90EE90";ctx.lineWidth=Math.max(1,4-Math.floor(i/2));ctx.setLineDash([3,2]);ctx.beginPath();ctx.moveTo(tr,ry-25);ctx.lineTo(tr+14*this.direction,ry+18);ctx.stroke();ctx.setLineDash([]);}
      for(let i=0;i<4;i++){const r2=24+i*10+Math.sin(af*0.15+i)*4;ctx.strokeStyle="#90EE90";ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(rx,ry+3,r2,r2/2+6,0,0,Math.PI*2);ctx.stroke();}
      const tick=this.windMiniTornadoTick;
      if(this.transformActive&&tick<=40){for(let layer=0;layer<8;layer++){const frac=layer/8,spin=Math.sin(af*0.4+frac*Math.PI*2)*(30-layer*3),botR=Math.max(5,Math.floor(38*(1-frac*0.6))),cyT=ry+58-Math.floor(frac*70);ctx.strokeStyle=["#FFFFFF","#EEFFEE","#CCFFCC","#AAFFAA","#88EE88","#66DD66","#44BB44","#229922"][layer];ctx.lineWidth=Math.max(1,3-Math.floor(layer/3));ctx.beginPath();ctx.ellipse(rx+spin,cyT,botR,5,0,0,Math.PI*2);ctx.stroke();}}
      _text(rx,ry-162,"🐰 THỎ V4 🐰","#90EE90","9px Arial bold");
    }
    _text(rx,ry+68,`⏱ ${secsLeft}s`,"white","8px Arial bold");
  }
}

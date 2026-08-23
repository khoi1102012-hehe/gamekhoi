// ================================================================
//  CHALLENGE ENEMY
// ================================================================
class ChallengeEnemy {
  constructor(x,y,stage){
    const cfg=CHALLENGE_ENEMY_CFG[stage];
    this.x=x;this.y=y;this.vy=0;this.onGround=false;
    this.hp=cfg.hp;this.maxHp=cfg.hp;this.spd=cfg.spd;this.dmg=cfg.dmg;
    this.stage=stage;this.direction=1;this.attackTimer=0;this.anim=0;
    this.slowTimer=0;this._slowPct=0.5;this.stunTimer=0;
  }
  applyGravity(floorY){this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;this.onGround=true;}else this.onGround=false;}
  update(player,floorY,w){
    this.anim++;this.applyGravity(floorY);
    // FIX: slowTimer/_slowPct were tracked but never applied — mobs ignored
    // every slow effect in the game (frost trail, water aura, ice spear...).
    // Now ticks down and reduces movement speed, same as RoadEnemy already does.
    if(this.slowTimer>0)this.slowTimer--;
    if(this.stunTimer>0){this.stunTimer--;return;}
    const dx=player.x-this.x;this.direction=dx>0?1:-1;
    const spd=this.spd*(this.slowTimer>0?(1-this._slowPct):1);
    if(Math.abs(dx)>60)this.x+=spd*this.direction;
    this.x=clamp(this.x,40,w-40);
    this.attackTimer--;
    if(this.attackTimer<=0&&Math.abs(dx)<80*(player.sizeMult||1)){applyDamage(player,player.isShielding?this.dmg*0.2:this.dmg,null);this.attackTimer=70;}
  }
  draw(){
    if(this.reaperForm){this._drawReaperForm();return;}
    const COLS={1:"#884400",2:"#aa2200",3:"#cc0055",4:"#2a0a40",5:"#5a8fae"},col=COLS[this.stage]||"gray";
    if(this.stage===4){ctx.save();ctx.shadowColor="#a020f0";ctx.shadowBlur=8;}
    _rect(this.x-20,this.y-40,40,40,col,this.stage===4?"#c060ff":"white",2);_rect(this.x-15,this.y-65,30,30,col,this.stage===4?"#c060ff":"white",2);
    if(this.stage===4)ctx.restore();
    _oval(this.x+8*this.direction-4,this.y-57,8,8,this.stage===4?"#c060ff":"red",null);
    const bw=60*(this.hp/this.maxHp);
    _rect(this.x-30,this.y-80,60,7,"#333",null,0);_rect(this.x-30,this.y-80,bw,7,"#ff4444",null,0);
    _text(this.x,this.y-90,`S${this.stage} ${this.direction>0?">":"<"}`,"yellow","8px Arial bold");
    if(this.slowTimer>0)_text(this.x,this.y-100,"❄️","deepskyblue","10px Arial");
  }
  _drawReaperForm(){
    const rx=this.x,ry=this.y;
    _drawReaperMonster(rx,ry,this.direction);
    if(this.slowTimer>0)_text(rx,ry-98,"💨","#bda8ff","10px Arial");
    const bw=60*(this.hp/this.maxHp);
    _rect(rx-30,ry-80,60,7,"#333",null,0);_rect(rx-30,ry-80,Math.max(0,bw),7,"#8866ff",null,0);
  }
}

// ================================================================
//  BOSS CLASS
// ================================================================
// ================================================================
//  ICE PUPPET (Frost skill 2 summon)
// ================================================================
// ================================================================
//  EARTH SOLDIERS — Melee Minions
// ================================================================
class EarthSoldier {
  constructor(owner,x,y,direction){
    this.owner=owner;this.x=x;this.y=y;this.vy=0;this.direction=direction;
    this.hp=35;this.maxHp=35;this.atkTimer=0;this.anim=0;
    this.spd=4.3125*1.2;this.dmg=8;this.type="soldier";this.enemyList=[];
  }
  update(floorY,w){
    this.anim++;
    this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;}
    const targets=getAllEnemies(this.owner);
    if(targets.length){
      const tgt=targets.reduce((best,c)=>dist(c.x,c.y,this.x,this.y)<dist(best.x,best.y,this.x,this.y)?c:best);
      const dx=tgt.x-this.x;this.direction=dx>0?1:-1;
      if(Math.abs(dx)>40)this.x+=this.spd*this.direction;
      this.x=clamp(this.x,40,w-40);
      this.atkTimer--;
      if(this.atkTimer<=0&&Math.abs(dx)<70*(tgt.sizeMult||1)){applyDamage(tgt,this.dmg,this.owner);this.atkTimer=60;}
    }else{
      // Follow owner when no enemies
      const ownerDx=this.owner.x-this.x;
      if(Math.abs(ownerDx)>100)this.x+=this.spd*Math.sign(ownerDx);
      else this.x+=Math.sign(ownerDx)*0.5;
      this.x=clamp(this.x,40,w-40);
    }
  }
  draw(){
    const rx=this.x,ry=this.y,bob=Math.sin(this.anim*0.12)*1.5;
    ctx.save();ctx.shadowColor="#c68a4a";ctx.shadowBlur=8;
    // Body
    _rect(rx-12,ry-35+bob,24,35,"#8a6a4a","#4a3524",2);
    // Head
    _oval(rx-10,ry-48+bob,20,16,"#a67c52","#6a4a2a",1.5);
    // Eyes
    _oval(rx-6+2*this.direction,ry-44+bob,3,3,"#000",null);
    ctx.restore();
    const bw=24*(this.hp/this.maxHp);
    _rect(rx-12,ry-55+bob,24,3,"#333",null,0);_rect(rx-12,ry-55+bob,Math.max(0,bw),3,"#c68a4a",null,0);
  }
}

// ================================================================
//  EARTH ARCHERS — Ranged Minions
// ================================================================
class EarthArcher {
  constructor(owner,x,y,direction){
    this.owner=owner;this.x=x;this.y=y;this.vy=0;this.direction=direction;
    this.hp=35;this.maxHp=35;this.atkTimer=0;this.anim=0;
    this.spd=4.3125*1.2*0.857;this.dmg=6;this.type="archer";
  }
  update(floorY,w){
    this.anim++;
    this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;}
    const targets=getAllEnemies(this.owner);
    if(targets.length){
      const tgt=targets.reduce((best,c)=>dist(c.x,c.y,this.x,this.y)<dist(best.x,best.y,this.x,this.y)?c:best);
      const dx=tgt.x-this.x;const dy=tgt.y-this.y;
      const dist_to_tgt=Math.hypot(dx,dy);
      this.direction=dx>0?1:-1;
      // Keep distance between 80-200px
      if(dist_to_tgt<100)this.x-=this.spd*this.direction;
      else if(dist_to_tgt>200)this.x+=this.spd*this.direction;
      this.x=clamp(this.x,40,w-40);
      this.atkTimer--;
      if(this.atkTimer<=0&&dist_to_tgt<220){
        // Fire homing arrow
        projectiles.push({x:this.x+20*this.direction,y:this.y-30,vx:8*this.direction,vy:-2,owner:this.owner,
          damage:this.dmg,slow:30,slow_pct:0.3,color:"#8a6a4a",type:"earth_arrow",dir:this.direction,target:tgt,homing:true});
        this.atkTimer=70;
      }
    }else{
      // Follow owner when no enemies
      const ownerDx=this.owner.x-this.x;
      if(Math.abs(ownerDx)>120)this.x+=this.spd*Math.sign(ownerDx);
      else this.x+=Math.sign(ownerDx)*0.3;
      this.x=clamp(this.x,40,w-40);
    }
  }
  draw(){
    const rx=this.x,ry=this.y,bob=Math.sin(this.anim*0.1)*1;
    ctx.save();ctx.shadowColor="#a67c52";ctx.shadowBlur=6;
    // Body
    _rect(rx-10,ry-32+bob,20,32,"#a67c52","#6a4a2a",1.5);
    // Head
    _oval(rx-9,ry-45+bob,18,15,"#c68a4a","#8a6a4a",1);
    // Bow (simplified)
    ctx.strokeStyle="#6a4a2a";ctx.lineWidth=2;ctx.beginPath();ctx.arc(rx+8*this.direction,ry-20+bob,6,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    const bw=20*(this.hp/this.maxHp);
    _rect(rx-10,ry-50+bob,20,2.5,"#333",null,0);_rect(rx-10,ry-50+bob,Math.max(0,bw),2.5,"#a67c52",null,0);
  }
}

class IcePuppet {
  constructor(owner,x,y,direction){
    this.owner=owner;this.x=x;this.y=y;this.vy=0;this.direction=direction;
    this.hp=40;this.maxHp=40;this.life=600;this.atkTimer=0;this.anim=0;
    this.spd=3.2;this.dmg=6;
  }
  update(floorY,w){
    this.anim++;this.life--;
    this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;}
    const targets=getAllEnemies(this.owner);
    if(targets.length){
      const tgt=targets.reduce((best,c)=>dist(c.x,c.y,this.x,this.y)<dist(best.x,best.y,this.x,this.y)?c:best);
      const dx=tgt.x-this.x;this.direction=dx>0?1:-1;
      if(Math.abs(dx)>50)this.x+=this.spd*this.direction;
      this.x=clamp(this.x,40,w-40);
      this.atkTimer--;
      if(this.atkTimer<=0&&Math.abs(dx)<60*(tgt.sizeMult||1)){applyDamage(tgt,this.dmg,this.owner);this.atkTimer=50;}
    }
  }
  draw(){
    const rx=this.x,ry=this.y,bob=Math.sin(this.anim*0.15)*2;
    ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=8;
    _rect(rx-14,ry-40+bob,28,40,"#BEEBFF","white",2);
    _oval(rx-11,ry-58+bob,22,20,"#DFF7FF","deepskyblue",2);
    _oval(rx-6+3*this.direction,ry-51+bob,5,5,"#003366",null);
    ctx.restore();
    const bw=28*(this.hp/this.maxHp);
    _rect(rx-14,ry-66+bob,28,4,"#333",null,0);_rect(rx-14,ry-66+bob,Math.max(0,bw),4,"cyan",null,0);
  }
}


class Boss {
  constructor(bossId,x,y){
    this.bossId=bossId;this.x=x;this.y=y;this.vy=0;
    this.onGround=false;this.direction=-1;this.anim=0;
    this.skillTimer={};this.phase=1;this.dead=false;
    this.summonEnemies=[];this.stunTimer=0;
    this._init();
  }
  _init(){
    if(this.bossId===1){this.hp=this.maxHp=320;this.phase=1;this.phase2Entered=false;this.targetX=this.x;this.targetY=this.y;this.hoverTimer=0;
      // ========== FROST KING v2 SKILL STATES ==========
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0,s6:0};this.skillCd={s1:420,s2:720,s3:1080,s4:600,s5:2100,s6:0};
      this.lastSkillUsed="";this.breatheTimer=0;this.actionState="idle"; // idle, breathing, preparing
      
      // === Skill 1: Frozen Spears ===
      this.frozenSpears=[];this.spearChargeTimer=0;this.spearChargePhase=0;
      
      // === Skill 2: Ice Prison ===
      this.icePrisonTarget=null;this.icePrisonWarningTimer=0;this.icePrisonWarningX=0;this.icePrisonWarningY=0;
      
      // === Skill 3: Blizzard ===
      this.blizzardActive=false;this.blizzardTimer=0;this.meteorSpawns=[];this.meteorWarnings=[];
      
      // === Skill 4: Frost Dash ===
      this.dashActive=false;this.dashPhase=0;this.dashTargetX=0;this.dashCount=0;this.dashIceTrails=[];
      
      // === Skill 5: Absolute Zero ===
      this.absoluteZeroCharging=false;this.absoluteZeroTimer=0;this.heatCrystals=[];this.battlefieldFrozen=false;
      
      // === Phase 2: Frost King's Wrath ===
      this.phase2SpeedMult=1.0;this.phase2AttackMult=1.0;
      
      // --- Visuals (additive-only, never affects logic) ---
      this.auraParticles=[];this._floorY=this.y;this.lastFootX=this.x;this.frostTrail=[];
      this.wingFlap=0;this.iceshardFX=[];this.breathingEffect=0;
      for(let i=0;i<32;i++)this.auraParticles.push({ang:rng()*Math.PI*2,rad:60+rng()*95,spd:0.008+rng()*0.02,size:2+rng()*4,type:rndChoice(["snow","crystal","mist"]),bob:rng()*Math.PI*2});
    }
    else if(this.bossId===3){this.hp=this.maxHp=200;this.phase=1;this.phase2Hp=100;this.skillTimer={s1:0,s2:0,s3:0};this.rainbowHue=0;this.currentElement="fire";this.elementTimer=180;this.chainActive=false;this.chainX=this.x;this.chainY=this.y;this.chainDir=1;this.chainVx=0;this.clones=[];this.cloneSpawnDone=false;this.screenTint=null;}
    else if(this.bossId===4){
      // ========== THE ABYSSAL (Boss 4) — a tall, gaunt shadow entity from the
      // Vực Thẳm (Abyss). NOT a warrior: no sword, no staff, no armor. A single
      // glowing eye, a torn dark cloak, limbs longer than a normal fighter, and
      // loose shadow fragments drifting around a body partly made of darkness.
      // Fights entirely through misdirection — rifts, clones, chains, gravity —
      // never a brawler stance. ==========
      this.hp=this.maxHp=590;this.phase=1;this.phase2Entered=false;this._introHideHp=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0};
      this.skillCd={s1:260,s2:420,s3:340,s4:520,s5:2200};
      this.lastSkillUsed="";
      // === Skill 1: Void Rift — a rift crawls toward the player, then erupts ===
      this.voidRifts=[];
      // === Skill 2: Shadow Clone — 2-3 decoys, only one is real ===
      this.shadowClones=[];this.cloneActive=false;this.cloneTimer=0;
      // === Skill 3: Darkness Chains — chains erupt from the ground and slow ===
      this.chainWarnings=[];this.chains=[];
      // === Skill 4: Black Hole — a gravity well slowly pulls the player in ===
      this.blackHole=null;
      // === Special: Darkness Vanish — Boss disappears, reappears elsewhere ===
      this.vanishActive=false;this.vanishTimer=0;this.vanishCd=520;this.vanishGhostX=0;
      // === Ultimate: Abyss — arena darkens, boss flickers between shadow zones, then a wide dark blast ===
      this.abyssCharging=false;this.abyssTimer=0;this.abyssShadowSpots=[];this.abyssFlickerT=0;
      // === Phase 2: enraged (from 35% HP) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Visuals (additive-only, never affects logic) ---
      this._floorY=this.y;this.shadowWisps=[];this.cloakSway=0;this.bodyDistort=0;this.eyeGlow=1;this.hoverYOffset=0;
      for(let i=0;i<20;i++)this.shadowWisps.push({ang:rng()*Math.PI*2,rad:55+rng()*80,spd:0.006+rng()*0.014,size:2+rng()*4,bob:rng()*Math.PI*2});
    }
    else if(this.bossId===2){
      // ========== EARTH TITAN (Boss 2) — thay thế Smoke Boss cũ, có cinematic riêng ==========
      this.hp=this.maxHp=520;this.phase=1;this.phase2Entered=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0};
      this.skillCd={s1:260,s2:420,s3:640,s4:560,s5:2000};
      this.lastSkillUsed="";this._introHideHp=false;
      // === Skill 1: Stone Spear — spikes erupt under/around the target ===
      this.stoneSpearWarnings=[];this.stoneSpears=[];
      // === Skill 2: Earth Smash — ground-pound shockwave ===
      this.smashActive=false;this.smashTimer=0;this.smashShockwaves=[];
      // === Skill 3: Rock Wall — temporary damage-reduction shell ===
      this.rockWallActive=false;this.rockWallTimer=0;this.dmgReducePct=0;
      // === Skill 4: Boulder Rain — falling boulders across the arena ===
      this.boulderWarnings=[];this.boulders=[];
      // === Ultimate: Earth Core — channel ~2s then a huge AOE explosion ===
      this.earthCoreCharging=false;this.earthCoreTimer=0;
      // === Phase 2: enraged (from 35% HP) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Visuals (additive-only, never affects logic) ---
      this.crackGlow=0;this._floorY=this.y;this.rockOrbits=[];
      for(let i=0;i<8;i++)this.rockOrbits.push({ang:i*45*Math.PI/180,rad:70+rng()*25,spd:0.01+rng()*0.01,size:8+rng()*8});
    }
    else if(this.bossId===6){
      // ========== FLAME LORD (Boss 3) — a tall Fire Sorcerer/"Chúa Tể Hỏa Diệm": flowing
      // flame-cloak, a magic staff topped with a burning crystal, embers and ash drifting
      // off the whole body. Fights entirely like a spellcaster — never a brawler. ==========
      this.hp=this.maxHp=560;this.phase=1;this.phase2Entered=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0};
      this.skillCd={s1:340,s2:460,s3:380,s4:620,s5:2100};
      this.lastSkillUsed="";this._introHideHp=false;
      // === Skill 1: Fire Tornado — giơ quyền trượng, triệu hồi lốc lửa truy đuổi người chơi ===
      this.fireTornadoes=[];
      // === Skill 2: Summon Fire Spirits — triệu hồi 3-5 linh hồn lửa tự động tấn công ===
      this.fireSpirits=[];
      // === Skill 3: Inferno Pillars — giơ quyền trượng, nhiều cột lửa phun liên tiếp dưới chân người chơi ===
      this.infernoPillarWarnings=[];this.infernoPillars=[];this.infernoPillarWaves=0;
      // === Skill 4: Meteor Storm — triệu hồi hàng chục thiên thạch rơi ngẫu nhiên ===
      this.meteorWarnings=[];this.meteorRocks=[];
      // === Ultimate: World of Flames — Boss bay lên, toàn bản đồ hóa biển lửa (dung nham + lốc lửa + thiên thạch + cột lửa) ===
      this.worldFlameCharging=false;this.worldFlameTimer=0;this.worldFlameActive=false;this.worldFlameTimer2=0;
      this.worldFlameLavaZones=[];this.hoverOffset=0;
      // === Phase 2: enraged (from 35% HP) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Casting pose: staff raised briefly whenever a skill fires ---
      this.staffRaiseTimer=0;
      // --- Visuals (additive-only, never affects logic) ---
      this._floorY=this.y;this.flameAura=[];this.robeSway=0;this.emberTrail=[];
      for(let i=0;i<24;i++)this.flameAura.push({ang:rng()*Math.PI*2,rad:60+rng()*90,spd:0.008+rng()*0.016,size:2+rng()*4,bob:rng()*Math.PI*2,type:rndChoice(["ember","ash"])});
    }
    else if(this.bossId===5){
      // ========== THE TEMPEST (Boss 5) — a slender wind entity: no armor,
      // no weapon, always airborne and shifting position. Cloth/hair
      // permanently wind-blown, small currents swirling around the body.
      // Fights entirely through speed and air control — wind blades,
      // a chasing tornado, a cross-arena wind dash, a brief air-prison
      // cage, a telegraphed sky-slam, and an arena-wide storm ultimate —
      // never a grounded brawler. ==========
      this.hp=this.maxHp=540;this.phase=1;this.phase2Entered=false;this._introHideHp=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0};
      this.skillCd={s1:280,s2:460,s3:380,s4:560,s5:2200};
      this.lastSkillUsed="";
      // === Skill 1: Wind Blades — several wind-slash projectiles at different speeds/lanes ===
      this.windBlades=[];
      // === Skill 2: Tornado — telegraphed, drifts toward the player, pushes + ticks damage up close ===
      this.tornadoWarnings=[];this.tornadoes=[];
      // === Skill 3: Wind Dash — boss becomes a streak of wind, crosses the arena, can turn once, leaves a damaging trail ===
      this.windDashActive=false;this.windDashTimer=0;this.windDashDir=1;this.windDashChanged=false;this.windDashSpd=7;this.windDashTrail=[];
      // === Skill 4: Air Prison — wind cage heavily slows the player briefly, then bursts outward ===
      this.airPrisonActive=false;this.airPrisonTimer=0;this.airPrisonX=this.x;this.airPrisonY=this.y;
      // === Special: Sky Fall — boss climbs, telegraphs a landing zone, then slams down (own cooldown, outside the weighted skill pool) ===
      this.skyFallActive=false;this.skyFallPhase="";this.skyFallTimer=0;this.skyFallCd=420;this.skyFallWarnings=[];
      // === Ultimate: Eye of the Storm — arena-wide storm: boss flickers between spots while mini-tornadoes + wind blades sweep the arena ===
      this.eyeStormCharging=false;this.eyeStormTimer=0;this.eyeStormTick=0;
      // === Phase 2: enraged (from 35% HP) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Visuals (additive-only, never affects logic) ---
      this._floorY=this.y;this.windSway=0;this.robeFlap=0;this.hoverYOffset=0;this.windWisps=[];this.leafParticles=[];
      for(let i=0;i<18;i++)this.windWisps.push({ang:rng()*Math.PI*2,rad:50+rng()*75,spd:0.014+rng()*0.024,size:2+rng()*3,bob:rng()*Math.PI*2});
      for(let i=0;i<14;i++)this.leafParticles.push({ang:rng()*Math.PI*2,rad:70+rng()*110,spd:0.01+rng()*0.02,size:2+rng()*3,type:rndChoice(["leaf","dust"])});
    }
    else if(this.bossId===7){
      // ========== THE TIDAL (Boss 6) — an ancient Water God built entirely
      // from cyan/blue geometric blocks, polygons and floating water-cube
      // particles — never a realistic human/mermaid shape. Carries a
      // geometric TRIDENT (three glowing water-crystal prongs) as its
      // single defining prop — no sword, no heavy metal armor. Fights
      // through area control: waves, whirlpools, tides and the trident,
      // never a straightforward brawler. ==========
      this.hp=this.maxHp=580;this.phase=1;this.phase2Entered=false;this._introHideHp=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0,s8:0};
      this.skillCd={s1:260,s2:420,s3:480,s4:560,s5:620,s6:380,s7:900,s8:2300};
      this.lastSkillUsed="";
      // === Skill 1: Water Spear — several water-spear projectiles fired in a telegraphed volley ===
      this.waterSpears=[];
      // === Skill 2: Tidal Wave — boss slams the trident down, a geometric wave rolls toward the player ===
      this.tidalWaves=[];
      // === Skill 3: Water Whirl — a whirlpool drifts on the arena, pulls + ticks damage up close ===
      this.waterWhirls=[];
      // === Skill 4: Water Prison — geometric water pillars cage the player briefly, then burst ===
      this.waterPrisonActive=false;this.waterPrisonTimer=0;this.waterPrisonX=this.x;this.waterPrisonY=this.y;
      // === Skill 5: Rising Tide — telegraphed columns of water erupt from the ground at random spots ===
      this.risingTideWarnings=[];this.risingTideColumns=[];
      // === Skill 6: Trident Rush — boss dashes 1-2x leaving a water trail, ends with a small spin-ring ===
      this.tridentRushActive=false;this.tridentRushTimer=0;this.tridentRushDir=1;this.tridentRushCount=0;this.tridentRushMax=1;this.tridentRushTrail=[];
      // === Skill 7: Maelstrom — a large whirlpool anchors on the arena and pressures the player over time ===
      this.maelstromActive=false;this.maelstromTimer=0;this.maelstromX=this.x;
      // === Ultimate: Ocean's Judgment — boss channels center-arena, waves + rising columns sweep the arena, ends in a huge central water column ===
      this.oceanJudgmentCharging=false;this.oceanJudgmentTimer=0;this.oceanJudgmentTick=0;
      // === Phase 2: enraged (from 50% HP, per spec) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Trident raised briefly whenever a skill fires (cosmetic pose, mirrors Flame Lord's staff-raise) ---
      this.tridentRaiseTimer=0;
      // --- Visuals (additive-only, never affects logic) ---
      this._floorY=this.y;this.waterAura=[];this.bodySway=0;this.hoverBob=0;
      for(let i=0;i<20;i++)this.waterAura.push({ang:rng()*Math.PI*2,rad:55+rng()*85,spd:0.009+rng()*0.018,size:2+rng()*4,bob:rng()*Math.PI*2,type:rndChoice(["cube","droplet"])});
    }
    else if(this.bossId===8){
      // ========== THE VOLTAGE (Boss 7 — FINAL BOSS) — a Lightning entity
      // built entirely from yellow/white/electric-blue geometric cubes and
      // polygons. Several blocks float apart from the main body and are
      // linked back to it only by arcing bolts of electricity — no sword,
      // no staff, no hammer. "Not a creature that holds electricity — a
      // creature made of electricity." The fastest and most mobile of the
      // 7 elemental bosses: constant repositioning, short teleports/dashes,
      // chains, and arena-wide lightning. Never a straightforward brawler. ==========
      this.hp=this.maxHp=620;this.phase=1;this.phase2Entered=false;this._introHideHp=false;
      this.skillTimer={s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0,s8:0};
      this.skillCd={s1:260,s2:420,s3:340,s4:520,s5:380,s6:640,s7:820,s8:2400};
      this.lastSkillUsed="";
      // === Skill 1: Chain Lightning — a bolt hits the player, then arcs onward once (bounded, no infinite spawn) ===
      this.chainBolts=[];
      // === Skill 2: Thunder Strike — telegraphed strike zone(s), then lightning slams down ===
      this.thunderWarnings=[];this.thunderStrikes=[];
      // === Skill 3: Lightning Dash — boss becomes a bolt and streaks across the arena, then reappears at the far side ===
      this.lightningDashActive=false;this.lightningDashTimer=0;this.lightningDashDir=1;this.lightningDashTrail=[];
      // === Skill 4: Electric Field — a drifting electrified ground zone, ticks damage the longer the player lingers ===
      this.electricFields=[];
      // === Skill 5: Voltage Orbs — geometric energy orbs orbit the boss, then lock on and launch ===
      this.voltageOrbs=[];
      // === Skill 6: Thunder Pillars — a telegraphed sequence of lightning columns, 1->2->3->4, forcing constant movement ===
      this.thunderPillarWarnings=[];this.thunderPillars=[];
      // === Special: Overcharge — own cooldown, outside the weighted skill pool (mirrors The Tempest's Sky Fall). Boss channels briefly, then a wide electric pulse ===
      this.overchargeActive=false;this.overchargePhase="";this.overchargeTimer=0;this.overchargeCd=560;
      // === Ultimate: Thunderstorm — arena darkens, storm strikes sweep the ground, then converge on the boss for one huge shockwave ===
      this.thunderstormCharging=false;this.thunderstormTimer=0;this.thunderstormTick=0;this.thunderstormPhase="";
      // === Phase 2: enraged (from 50% HP, per spec — matches The Tidal) ===
      this.phase2SpeedMult=1.0;this.phase2DmgMult=1.0;
      // --- Visuals (additive-only, never affects logic) ---
      this._floorY=this.y;this.voltAura=[];this.bodyJitter=0;this.arcPulse=0;
      this.bodyBlocks=[]; // floating detached geometric blocks, linked to the body by electric arcs
      for(let i=0;i<22;i++)this.voltAura.push({ang:rng()*Math.PI*2,rad:55+rng()*90,spd:0.02+rng()*0.03,size:2+rng()*4,bob:rng()*Math.PI*2,type:rndChoice(["cube","spark"])});
      for(let i=0;i<5;i++)this.bodyBlocks.push({ox:rndInt(-46,46),oy:-70-rndInt(0,70),drift:rng()*Math.PI*2,size:6+rng()*5});
    }
  }
  applyGravity(floorY){if(this.bossId===1||this.bossId===5)return;this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;this.onGround=true;}else this.onGround=false;}
  update(player,floorY,w){
    this.anim++;this.applyGravity(floorY);
    if(this.stunTimer>0){this.stunTimer--;return;}
    for(const k in this.skillTimer)if(this.skillTimer[k]>0)this.skillTimer[k]--;
    if(this.bossId===1)this._updateBoss1(player,floorY,w);
    else if(this.bossId===3)this._updateBoss3(player,floorY,w);
    else if(this.bossId===4)this._updateBoss4(player,floorY,w);
    else if(this.bossId===2)this._updateBossEarth(player,floorY,w);
    else if(this.bossId===6)this._updateBossFlame(player,floorY,w);
    else if(this.bossId===5)this._updateBoss5(player,floorY,w);
    else if(this.bossId===7)this._updateBossTidal(player,floorY,w);
    else if(this.bossId===8)this._updateBossVoltage(player,floorY,w);
  }
  _updateBoss1(player,floorY,w){
    // ======= PHASE 2 CHECK =======
    if(this.phase===1 && this.hp<=this.maxHp*0.3 && !this.phase2Entered){
      this.phase=2;
      this.phase2Entered=true;
      this.phase2SpeedMult=1.15;
      this.phase2AttackMult=1.15;
      screenShake=Math.max(screenShake,35);
      // Reset some cooldowns to prepare phase 2
      this.skillTimer.s1=Math.min(this.skillTimer.s1,200);
    }

    // ======= COOLDOWN MANAGEMENT =======
    for(const k in this.skillTimer) if(this.skillTimer[k]>0) this.skillTimer[k]--;

    // ======= BREATHING / IDLE BEHAVIOR =======
    this.breatheTimer--;
    if(this.breatheTimer<=0){
      if(this.actionState==="idle" && rng()<0.35){
        this.actionState="breathing";
        this.breatheTimer=rndInt(120,200);
      }else{
        this.actionState="idle";
        this.breatheTimer=rndInt(60,140);
      }
    }
    this.breathingEffect+=0.03;

    // ======= HOVERING & POSITIONING =======
    this.hoverTimer++;
    this.wingFlap=(this.wingFlap+2+this.phase2SpeedMult*0.5)%360;
    if(this.hoverTimer>=150){
      this.hoverTimer=0;
      this.targetX=clamp(player.x+rndInt(-180,180),80,w-80);
      this.targetY=clamp(player.y-rndInt(120,200),100,floorY-150);
    }
    const moveSpeed=(this.actionState!=="preparing")?0.035:0.02;
    this.x+=(this.targetX-this.x)*moveSpeed;
    this.y+=(this.targetY-this.y)*moveSpeed;
    this.direction=this.x>player.x?-1:1;

    // ======= INTELLIGENT AI SKILL DECISION SYSTEM =======
    const dx=player.x-this.x, dy=player.y-this.y, dist=Math.sqrt(dx*dx+dy*dy);
    const playerMoving=Math.abs(player.vx)>1;
    
    // Skill availability check
    const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
    const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
    const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
    const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
    const canUseS5=this.skillTimer.s5<=0 && this.lastSkillUsed!=="s5" && this.phase===2;
    const canUseS6=this.skillTimer.s6<=0 && this.phase===2 && this.lastSkillUsed!=="s6";

    // Weighted AI decision
    let decision=rng()*100;
    let selectedSkill=null;

    // Skill weights based on distance & situation
    let weights={s1:35,s2:20,s3:15,s4:15,s5:10,s6:5};
    
    // Adjust weights based on context
    if(dist<150) weights.s4=30; // Frost Dash more likely when close
    if(Math.abs(dx)<50) weights.s2=30; // Ice Prison when directly above/below
    if(playerMoving) weights.s3=25; // Blizzard when player is mobile
    if(this.phase===2) weights.s5=15; // More likely to use ultimate in phase 2

    // Normalize weights
    let totalWeight=0;
    if(canUseS1) totalWeight+=weights.s1;
    if(canUseS2) totalWeight+=weights.s2;
    if(canUseS3) totalWeight+=weights.s3;
    if(canUseS4) totalWeight+=weights.s4;
    if(canUseS5) totalWeight+=weights.s5;
    if(canUseS6) totalWeight+=weights.s6;

    if(totalWeight>0){
      decision=rng()*totalWeight;
      let acc=0;
      if(canUseS1){acc+=weights.s1;if(decision<acc){selectedSkill="s1";}}
      else if(canUseS2){acc+=weights.s2;if(decision<acc){selectedSkill="s2";}}
      else if(canUseS3){acc+=weights.s3;if(decision<acc){selectedSkill="s3";}}
      else if(canUseS4){acc+=weights.s4;if(decision<acc){selectedSkill="s4";}}
      else if(canUseS5){acc+=weights.s5;if(decision<acc){selectedSkill="s5";}}
      else if(canUseS6){acc+=weights.s6;if(decision<acc){selectedSkill="s6";}}
    }

    // ======= SKILL EXECUTION =======
    if(selectedSkill==="s1" && canUseS1) this._boss1SkillFrozenSpears(player,w);
    else if(selectedSkill==="s2" && canUseS2) this._boss1SkillIcePrison(player);
    else if(selectedSkill==="s3" && canUseS3) this._boss1SkillBlizzard(player,w,floorY);
    else if(selectedSkill==="s4" && canUseS4) this._boss1SkillFrostDash(player,w);
    else if(selectedSkill==="s5" && canUseS5) this._boss1SkillAbsoluteZero(player,w,floorY);
    else if(selectedSkill==="s6" && canUseS6) this._boss1SkillWrathPhase2();

    // ======= ACTIVE SKILL UPDATES =======
    this._updateBoss1FrozenSpears(player,w);
    this._updateBoss1IcePrison();
    this._updateBoss1Blizzard(player,w,floorY);
    this._updateBoss1FrostDash(player,w);
    this._updateBoss1AbsoluteZero(player,w);

    this._floorY=floorY;
    this._updateFrostKingFX(floorY,w);
  }

  // ===== SKILL 1: FROZEN SPEARS =====
  _boss1SkillFrozenSpears(player,w){
    this.skillTimer.s1=this.skillCd.s1;
    this.lastSkillUsed="s1";
    this.actionState="preparing";
    this.spearChargeTimer=72; // 1.2 seconds at 60fps
    this.spearChargePhase=0;
  }

  _updateBoss1FrozenSpears(player,w){
    if(this.spearChargeTimer>0){
      this.spearChargeTimer--;
      this.spearChargePhase=1-(this.spearChargeTimer/72); // 0 to 1
      
      if(this.spearChargeTimer===0){
        // Launch spears in a fan
        const spearCount=Math.floor(6+rng()*5); // 6-10 spears
        const spreadAngle=Math.PI*0.8; // 144 degrees wide
        const baseAngle=-spreadAngle/2;
        
        for(let i=0;i<spearCount;i++){
          const angle=baseAngle+(spreadAngle/(spearCount-1))*i + rndInt(-15,15)*Math.PI/180;
          const spd=9+rng()*2;
          projectiles.push({
            x:this.x,y:this.y,
            vx:Math.cos(angle)*spd,vy:Math.sin(angle)*spd,
            owner:this,target:player,damage:12,
            color:"cyan",type:"ice_spear",size:2,
            lifetime:180,life:180
          });
        }
        screenShake=Math.max(screenShake,8);
        this.actionState="idle";
      }
    }
  }

  // ===== SKILL 2: ICE PRISON =====
  _boss1SkillIcePrison(player){
    this.skillTimer.s2=this.skillCd.s2;
    this.lastSkillUsed="s2";
    this.icePrisonTarget=player;
    this.icePrisonWarningTimer=90; // 1.5 seconds warning
    this.icePrisonWarningX=player.x;
    this.icePrisonWarningY=player.y;
    this.actionState="preparing";
  }

  _updateBoss1IcePrison(){
    if(this.icePrisonWarningTimer>0){
      this.icePrisonWarningTimer--;
      
      if(this.icePrisonWarningTimer===0 && this.icePrisonTarget){
        // Check if player is still in zone (update to current position)
        if(!this.icePrisonTarget._icePrisoned){
          const dist=Math.sqrt(Math.pow(this.icePrisonTarget.x-this.icePrisonWarningX,2)+Math.pow(this.icePrisonTarget.y-this.icePrisonWarningY,2));
          if(dist<60){ // Hit radius
            this.icePrisonTarget._icePrisoned=true;
            this.icePrisonTarget._icePrisonTimer=120; // 2 seconds frozen
            screenShake=Math.max(screenShake,10);
          }
        }
        this.actionState="idle";
      }
    }

    // Update ice prison effect on player
    if(this.icePrisonTarget && this.icePrisonTarget._icePrisoned){
      this.icePrisonTarget._icePrisonTimer--;
      if(this.icePrisonTarget._icePrisonTimer<=0){
        this.icePrisonTarget._icePrisoned=false;
      }
    }
  }

  // ===== SKILL 3: BLIZZARD =====
  _boss1SkillBlizzard(player,w,floorY){
    this.skillTimer.s3=this.skillCd.s3;
    this.lastSkillUsed="s3";
    this.blizzardActive=true;
    this.blizzardTimer=480; // 8 seconds
    this.meteorSpawns=[];
    this.meteorWarnings=[];
    screenShake=Math.max(screenShake,12);
    this.actionState="idle";
  }

  _updateBoss1Blizzard(player,w,floorY){
    if(this.blizzardActive && this.blizzardTimer>0){
      this.blizzardTimer--;
      
      // Spawn meteors every 30 frames (0.5 seconds)
      if(this.blizzardTimer%30===0){
        const meteorX=50+rng()*(w-100);
        const fallY=floorY-300;
        // First warn, then spawn
        this.meteorWarnings.push({x:meteorX,y:fallY,warningTimer:45,life:45});
      }

      // Update warnings and convert to actual meteors
      for(let i=this.meteorWarnings.length-1;i>=0;i--){
        this.meteorWarnings[i].warningTimer--;
        if(this.meteorWarnings[i].warningTimer<=0){
          const mw=this.meteorWarnings[i];
          this.meteorSpawns.push({x:mw.x,y:mw.y-100,vy:0,radius:35,damage:18,life:180});
          this.meteorWarnings.splice(i,1);
        }
      }

      // Update falling meteors & check collisions
      for(let i=this.meteorSpawns.length-1;i>=0;i--){
        const meteor=this.meteorSpawns[i];
        meteor.vy+=0.4; // gravity
        meteor.y+=meteor.vy;
        meteor.life--;
        
        if(meteor.y>=floorY-20){
          this.meteorSpawns.splice(i,1);
        }else if(player.hp>0){
          const d=Math.sqrt(Math.pow(meteor.x-player.x,2)+Math.pow(meteor.y-player.y,2));
          if(d<meteor.radius+20){
            applyDamage(player,meteor.damage*0.4,this);
            this.meteorSpawns.splice(i,1);
          }
        }
      }
    }else if(this.blizzardTimer<=0 && this.blizzardActive){
      this.blizzardActive=false;
      this.meteorSpawns=[];
      this.meteorWarnings=[];
    }
  }

  // ===== SKILL 4: FROST DASH =====
  _boss1SkillFrostDash(player,w){
    this.skillTimer.s4=this.skillCd.s4;
    this.lastSkillUsed="s4";
    this.dashActive=true;
    this.dashPhase=0;
    this.dashCount=0;
    this.dashTargetX=player.x;
    this.dashIceTrails=[];
    this.actionState="preparing";
  }

  _updateBoss1FrostDash(player,w){
    if(this.dashActive){
      if(this.dashPhase===0){ // Phase 0: Charge up
        if(this.dashCount<2){
          this.dashPhase=1; // Start dash
          this.dashCount++;
        }else{
          this.dashActive=false; // Done with dashes
          this.actionState="idle";
        }
      }else if(this.dashPhase===1){ // Phase 1: Dashing
        const dashSpd=(20+this.phase2SpeedMult*2)*this.phase2SpeedMult;
        const dirToDash=this.dashTargetX>this.x?1:-1;
        this.x+=dashSpd*dirToDash;
        this.x=clamp(this.x,60,w-60);
        
        // Leave ice trail
        this.dashIceTrails.push({x:this.x,y:this.y,life:90});
        
        // Check hit on player
        if(Math.abs(this.x-player.x)<70 && Math.abs(this.y-player.y)<80 && player.hp>0){
          applyDamage(player,14,this);
          screenShake=Math.max(screenShake,8);
          player.slowTimer=Math.max(player.slowTimer||0,30);
          player._slowPct=0.4;
        }

        // Dash complete
        if(Math.abs(this.x-this.dashTargetX)<50 || this.x<=60 || this.x>=w-60){
          this.dashPhase=0; // Return to charge phase
          this.dashTargetX=player.x; // Re-target
        }
      }
    }

    // Update ice trails
    _compact(this.dashIceTrails,t=>{t.life--;return t.life>0;});
  }

  // ===== SKILL 5: ABSOLUTE ZERO (ULTIMATE) =====
  _boss1SkillAbsoluteZero(player,w,floorY){
    this.skillTimer.s5=this.skillCd.s5;
    this.lastSkillUsed="s5";
    this.absoluteZeroCharging=true;
    this.absoluteZeroTimer=150; // 2.5 seconds charge
    this.heatCrystals=[];
    this.battlefieldFrozen=false;
    screenShake=Math.max(screenShake,15);
    this.actionState="preparing";
  }

  _updateBoss1AbsoluteZero(player,w){
    if(this.absoluteZeroCharging && this.absoluteZeroTimer>0){
      this.absoluteZeroTimer--;
      
      // Spawn heat crystals at 2 second mark (before release)
      if(this.absoluteZeroTimer===60){
        // Create 3 safe zones
        const safeZones=[w*0.25, w*0.5, w*0.75];
        this.heatCrystals=safeZones.map(zx=>({
          x:zx, y:this.y+150, life:300, maxLife:300, radius:50
        }));
        screenShake=Math.max(screenShake,20);
      }

      if(this.absoluteZeroTimer===0){
        // Release freeze wave
        this.battlefieldFrozen=true;
        const freezeLifetime=180;
        
        // Damage player based on distance to nearest crystal
        if(player.hp>0){
          let minDistToCrystal=999;
          for(const crystal of this.heatCrystals){
            const d=Math.sqrt(Math.pow(player.x-crystal.x,2)+Math.pow(player.y-crystal.y,2));
            minDistToCrystal=Math.min(minDistToCrystal,d);
          }

          if(minDistToCrystal<50){
            // In safe zone
            applyDamage(player,25,this); // Reduced damage
            // No freeze
          }else{
            // Outside safe zone
            applyDamage(player,60,this); // Heavy damage
            player._icePrisoned=true;
            player._icePrisonTimer=120; // Freeze status
          }
        }

        screenShake=Math.max(screenShake,25);
        this.absoluteZeroCharging=false;

        // Clear after effect
        setTimeout(()=>{this.battlefieldFrozen=false;},freezeLifetime);
      }
    }

    // Update heat crystals
    _compact(this.heatCrystals,c=>{c.life--;return c.life>0;});
  }

  // ===== SKILL 6: WRATH PHASE 2 =====
  _boss1SkillWrathPhase2(){
    if(this.phase===2){
      // Already in phase 2, boost for this frame
      this.phase2SpeedMult=Math.min(1.35,this.phase2SpeedMult+0.05);
      screenShake=Math.max(screenShake,5);
    }
  }
  _updateBoss3(player,floorY,w){
    this.rainbowHue=(this.rainbowHue+(this.phase===2?3:2))%360;
    const ELEMENTS=["fire","shadow","ice","thunder","earth","water","wind"],ELEM_HUES=[0,270,210,60,30,200,120];
    this.elementTimer--;if(this.elementTimer<=0){this.elementTimer=this.phase===2?120:180;let closest=0,minD=999;ELEM_HUES.forEach((h,i)=>{const d=Math.min(Math.abs(this.rainbowHue-h),360-Math.abs(this.rainbowHue-h));if(d<minD){minD=d;closest=i;}});this.currentElement=ELEMENTS[closest];}
    if(this.hp<=this.phase2Hp&&this.phase===1){this.phase=2;screenShake=Math.max(screenShake,25);}
    if(this.phase===2&&!this.cloneSpawnDone){this.cloneSpawnDone=true;for(const cx of[w*0.2,w*0.8])this.clones.push({x:cx,y:this.y,hp:40,hue:(this.rainbowHue+120)%360});}
    _compact(this.clones,c=>c.hp>0);this.clones.forEach(c=>{const dx=player.x-c.x;c.x+=2.5*(dx>0?1:-1);if(Math.abs(c.x-player.x)<50)applyDamage(player,2,this);});
    const isP2=this.phase===2,spdBase=isP2?4.2:3.3,s1cd=isP2?180:300;
    const approaching=this.skillTimer.s1>s1cd*0.3;
    const dx=player.x-this.x;
    if(approaching)this.x+=spdBase*(dx>0?1:-1);else this.x+=3.5*(dx>0?-1:1);
    this.x=clamp(this.x,60,w-60);this.direction=player.x>this.x?1:-1;
    if(this.skillTimer.s1<=0){this.skillTimer.s1=s1cd;boss3CastSkill(this,player,this.currentElement);if(isP2){const other=rndChoice(ELEMENTS.filter(e=>e!==this.currentElement));boss3CastSkill(this,player,other);}}
    const chainCd=isP2?150:210;
    if(this.skillTimer.s2<=0){this.skillTimer.s2=chainCd;this.chainActive=true;this.chainX=this.x;this.chainY=this.y-20;this.chainDir=player.x>this.x?1:-1;this.chainVx=14*this.chainDir;}
    if(this.chainActive){this.chainX+=this.chainVx;if(Math.abs(this.chainX-player.x)<50&&Math.abs(this.chainY-player.y)<70){if(player.stunTimer<=0)player.stunTimer=90;this.chainActive=false;}else if(this.chainX<0||this.chainX>w)this.chainActive=false;}
    if(isP2&&(this.skillTimer.s3||0)<=0){this.skillTimer.s3=480;applyDamage(player,12,this);screenShake=Math.max(screenShake,20);}
  }
  // ================================================================
  //  THE ABYSSAL (Boss 4) — a gaunt, distorted shadow entity. Never a
  //  brawler: fights entirely through misdirection, rifts, decoys,
  //  restraints and gravity. Same weighted-AI pattern as Earth Titan
  //  / Flame Lord, plus an independent "Darkness Vanish" timer that
  //  fires outside the weighted pool (it isn't really an attack).
  // ================================================================
  _updateBoss4(player,floorY,w){
    this._floorY=floorY;
    this.cloakSway=Math.sin(this.anim*0.04)*6;
    this.bodyDistort=Math.sin(this.anim*0.07)*0.5+Math.sin(this.anim*0.13)*0.3;
    this.hoverYOffset=Math.sin(this.anim*0.03)*8;
    this.shadowWisps.forEach(sw=>sw.ang+=sw.spd);

    // ======= PHASE 2 CHECK =======
    if(this.phase===1 && this.hp<=this.maxHp*0.5 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.25;this.phase2DmgMult=1.2;
      screenShake=Math.max(screenShake,25);
      this.skillTimer.s5=Math.min(this.skillTimer.s5,180);
    }
    const isP2=this.phase===2;

    // ======= DARKNESS VANISH — while vanished the boss doesn't act normally =======
    if(this.vanishActive){
      this._updateVanish(player,w);
      this._updateVoidRift(player,w);this._updateShadowClones(player,floorY,w);this._updateChains(player,w);this._updateBlackHole(player,w);
      return;
    }

    // ======= DRIFTING MOVEMENT — never a straight chase =======
    if(!this.abyssCharging){
      const dx=player.x-this.x,distP=Math.abs(dx),spd=(isP2?3.4:2.6)*this.phase2SpeedMult,idealDist=260;
      if(distP>idealDist+90)this.x+=spd*(dx>0?1:-1);
      else if(distP<idealDist-100)this.x-=spd*0.6*(dx>0?1:-1);
      this.x=clamp(this.x,80,w-80);
    }
    this.direction=player.x>this.x?1:-1;

    // ======= PERIODIC DARKNESS VANISH (outside the weighted skill pool) =======
    if(this.vanishCd>0)this.vanishCd--;
    if(this.vanishCd<=0 && !this.abyssCharging && !this.cloneActive){
      this.vanishCd=isP2?420:560;this.vanishActive=true;this.vanishTimer=70;
      sfxShadowTeleport?.();
      for(let i=0;i<12;i++)dmgNumbers.push({x:this.x+rndInt(-40,40),y:this.y-rndInt(20,120),text:"",type:"smoke",life:40,vx:rndInt(-2,2),vy:rndInt(-2,1),color:"#2a0a44"});
    }

    // ======= WEIGHTED AI SKILL DECISION (same pattern as Earth Titan / Flame Lord) =======
    const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
    const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2" && !this.cloneActive;
    const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
    const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4" && !this.blackHole;
    const canUseS5=this.skillTimer.s5<=0 && isP2 && this.lastSkillUsed!=="s5" && !this.abyssCharging;

    let weights={s1:30,s2:22,s3:22,s4:18,s5:14};
    if(Math.abs(player.x-this.x)>320)weights.s1=38;
    if(this.hp<this.maxHp*0.6)weights.s2=30;
    if(isP2)weights.s5=24;

    let totalWeight=0;
    if(canUseS1)totalWeight+=weights.s1;
    if(canUseS2)totalWeight+=weights.s2;
    if(canUseS3)totalWeight+=weights.s3;
    if(canUseS4)totalWeight+=weights.s4;
    if(canUseS5)totalWeight+=weights.s5;

    let selectedSkill=null;
    if(totalWeight>0 && !this.abyssCharging){
      let decision=rng()*totalWeight,acc=0;
      if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
      if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
      if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
      if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
      if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
    }

    if(selectedSkill==="s1")this._bossAbyssalSkillVoidRift(player,w);
    else if(selectedSkill==="s2")this._bossAbyssalSkillShadowClone(player,w);
    else if(selectedSkill==="s3")this._bossAbyssalSkillDarknessChains(player,w);
    else if(selectedSkill==="s4")this._bossAbyssalSkillBlackHole(player,w);
    else if(selectedSkill==="s5")this._bossAbyssalSkillAbyssUltimate();

    // ======= ACTIVE SKILL UPDATES =======
    this._updateVoidRift(player,w);
    this._updateShadowClones(player,floorY,w);
    this._updateChains(player,w);
    this._updateBlackHole(player,w);
    this._updateAbyssUltimate(player,w);
  }

  // ===== SKILL 1: VOID RIFT — a rift crawls toward the player, then erupts (telegraphed) =====
  _bossAbyssalSkillVoidRift(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";
    const isP2=this.phase===2,count=isP2?2:1;
    for(let i=0;i<count;i++){
      this.voidRifts.push({x:this.x+(i===0?0:130*(i%2===0?1:-1)),targetX:clamp(player.x,60,w-60),life:130,eruptTimer:70,erupted:false,dmg:(isP2?18:14)*this.phase2DmgMult});
    }
    sfxVoidCrack?.();
  }
  _updateVoidRift(player,w){
    _compact(this.voidRifts,r=>{
      r.life--;
      if(!r.erupted){
        const dx=r.targetX-r.x;
        if(Math.abs(dx)>4)r.x+=Math.sign(dx)*Math.min(3.2,Math.abs(dx));
        r.eruptTimer--;
        if(r.eruptTimer<=0){
          r.erupted=true;sfxVoidPulse?.();screenShake=Math.max(screenShake,8);
          if(Math.abs(player.x-r.x)<50&&player.hp>0)applyDamage(player,r.dmg,this);
        }
      }
      return r.life>0;
    });
  }

  // ===== SKILL 2: SHADOW CLONE — 2-3 decoys mirror the boss; only one is real =====
  _bossAbyssalSkillShadowClone(player,w){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";
    const isP2=this.phase===2,cnt=isP2?3:2;
    this.shadowClones=[];
    for(let i=0;i<cnt;i++){
      const side=(i%2===0)?1:-1;
      this.shadowClones.push({x:clamp(this.x+side*(80+i*40),80,w-80),atkTimer:rndInt(40,80)});
    }
    this.cloneActive=true;this.cloneTimer=isP2?230:190;
    sfxShadowTeleport?.();
  }
  _updateShadowClones(player,floorY,w){
    if(!this.cloneActive)return;
    const isP2=this.phase===2;
    this.cloneTimer--;
    this.shadowClones.forEach(c=>{
      const dx=player.x-c.x;
      c.x+=Math.sign(dx)*2.2;c.x=clamp(c.x,80,w-80);
      c.atkTimer--;
      if(c.atkTimer<=0&&Math.abs(dx)<70*(player.sizeMult||1)&&player.hp>0){
        c.atkTimer=70;applyDamage(player,isP2?10:7,this);
      }
    });
    if(this.cloneTimer<=0){this.cloneActive=false;this.shadowClones=[];}
  }

  // ===== SKILL 3: DARKNESS CHAINS — chains erupt from the ground and briefly slow =====
  _bossAbyssalSkillDarknessChains(player,w){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";
    this.chainWarnings.push({x:clamp(player.x,60,w-60),timer:40});
    sfxVoidPulse?.();
  }
  _updateChains(player,w){
    _compact(this.chainWarnings,cw=>{
      cw.timer--;
      if(cw.timer<=0){this.chains.push({x:cw.x,life:70,caught:false});screenShake=Math.max(screenShake,6);return false;}
      return true;
    });
    _compact(this.chains,c=>{
      c.life--;
      if(!c.caught&&Math.abs(player.x-c.x)<55&&player.hp>0){
        c.caught=true;
        player.slowTimer=Math.max(player.slowTimer||0,60);
        player._slowPct=Math.max(player._slowPct||0,0.45);
      }
      return c.life>0;
    });
  }

  // ===== SKILL 4: BLACK HOLE — a gravity well slowly pulls the player toward the center =====
  _bossAbyssalSkillBlackHole(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";
    const isP2=this.phase===2;
    this.blackHole={x:clamp(player.x+rndInt(-40,40),120,w-120),life:150,r:26,dmg:(isP2?3:2)*this.phase2DmgMult};
    sfxVoidPulse?.();
  }
  _updateBlackHole(player,w){
    if(!this.blackHole)return;
    const bh=this.blackHole;
    bh.life--;bh.r=Math.min(90,bh.r+0.6);
    const dx=bh.x-player.x,d=Math.abs(dx);
    if(d<340&&d>4&&player.hp>0){const pull=(1-d/340)*3.2;player.x=clamp(player.x+Math.sign(dx)*pull,60,w-60);}
    if(d<bh.r&&player.hp>0&&this.anim%20===0)applyDamage(player,bh.dmg,this);
    if(bh.life<=0){screenShake=Math.max(screenShake,6);this.blackHole=null;}
  }

  // ===== SPECIAL: DARKNESS VANISH — boss disappears from the arena, then reappears elsewhere =====
  _updateVanish(player,w){
    this.vanishTimer--;
    if(this.vanishTimer===35){
      this.x=clamp(player.x+rndChoice([-1,1])*rndInt(220,340),100,w-100);
      for(let i=0;i<12;i++)dmgNumbers.push({x:this.x+rndInt(-40,40),y:this.y-rndInt(20,120),text:"",type:"smoke",life:40,vx:rndInt(-2,2),vy:rndInt(-2,1),color:"#3a0a55"});
    }
    if(this.vanishTimer<=0){this.vanishActive=false;sfxShadowTeleport?.();screenShake=Math.max(screenShake,8);}
  }

  // ===== ULTIMATE: ABYSS — arena darkens, boss flickers between shadow zones, then a wide dark blast =====
  _bossAbyssalSkillAbyssUltimate(){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";
    this.abyssCharging=true;this.abyssTimer=220;this.abyssFlickerT=0;
    this.abyssShadowSpots=[];
    for(let i=0;i<5;i++)this.abyssShadowSpots.push({x:this.x+rndInt(-260,260)});
    sfxShadowWhisper?.();
  }
  _updateAbyssUltimate(player,w){
    if(!this.abyssCharging)return;
    this.abyssTimer--;this.abyssFlickerT++;
    if(this.abyssFlickerT%26===0){
      for(let i=0;i<8;i++)dmgNumbers.push({x:this.x+rndInt(-30,30),y:this.y-rndInt(20,100),text:"",type:"smoke",life:30,vx:rndInt(-1,1),vy:rndInt(-1,1),color:"#150022"});
      this.x=clamp(rndChoice(this.abyssShadowSpots).x,100,w-100);
      for(let i=0;i<8;i++)dmgNumbers.push({x:this.x+rndInt(-30,30),y:this.y-rndInt(20,100),text:"",type:"smoke",life:30,vx:rndInt(-1,1),vy:rndInt(-1,1),color:"#3a0a55"});
      sfxShadowTeleport?.();
    }
    if(this.abyssTimer<=0){
      this.abyssCharging=false;
      screenShake=Math.max(screenShake,38);
      sfxVoidExplode?.();
      const isP2=this.phase===2,radius=isP2?460:380,dmg=(isP2?38:28)*this.phase2DmgMult;
      if(Math.abs(player.x-this.x)<radius&&player.hp>0){
        applyDamage(player,dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*200,40,w-40);
      }
    }
  }

  // ================================================================
  //  EARTH TITAN (Boss 2) — heavy, slow, rock-armored brawler.
  //  5 skills: Stone Spear / Earth Smash / Rock Wall / Boulder Rain /
  //  Ultimate "Earth Core". Same weighted-AI pattern as Boss 1 (Frost King).
  // ================================================================
  _updateBossEarth(player,floorY,w){
    this._floorY=floorY;
    // ======= PHASE 2 CHECK =======
    if(this.phase===1 && this.hp<=this.maxHp*0.35 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.3;this.phase2DmgMult=1.25;
      screenShake=Math.max(screenShake,30);
      this.skillTimer.s1=Math.min(this.skillTimer.s1,120);
    }
    const isP2=this.phase===2;
    this.crackGlow=0.45+Math.sin(this.anim*0.05)*0.25;
    this.rockOrbits.forEach(r=>r.ang+=r.spd);

    // ======= HEAVY, SLOW MOVEMENT — "đi chậm nhưng tạo cảm giác rất nặng" =======
    const dx=player.x-this.x,dist=Math.abs(dx),dir=dx>0?1:-1;
    if(!this.rockWallActive&&!this.earthCoreCharging&&!this.smashActive){
      const spd=isP2?1.9:1.35,idealDist=260;
      if(dist>idealDist+70){this.x+=spd*dir;if(this.anim%40===0){screenShake=Math.max(screenShake,3);sfxEarthCrack?.();}}
      else if(dist<idealDist-90)this.x-=spd*0.7*dir;
      this.x=clamp(this.x,80,w-80);
    }
    this.direction=dir;

    // ======= WEIGHTED AI SKILL DECISION (same pattern as Frost King) =======
    const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
    const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
    const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3" && !this.rockWallActive;
    const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
    const canUseS5=this.skillTimer.s5<=0 && isP2 && this.lastSkillUsed!=="s5";

    let weights={s1:30,s2:25,s3:18,s4:20,s5:12};
    if(dist<180) weights.s2=35;  // Earth Smash when close
    if(dist>320) weights.s4=32;  // Boulder Rain when far
    if(this.hp<this.maxHp*0.6) weights.s3=28; // lean on Rock Wall when hurt
    if(isP2) weights.s5=20;

    let totalWeight=0;
    if(canUseS1)totalWeight+=weights.s1;
    if(canUseS2)totalWeight+=weights.s2;
    if(canUseS3)totalWeight+=weights.s3;
    if(canUseS4)totalWeight+=weights.s4;
    if(canUseS5)totalWeight+=weights.s5;

    let selectedSkill=null;
    if(totalWeight>0 && !this.earthCoreCharging && !this.smashActive){
      let decision=rng()*totalWeight,acc=0;
      if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
      if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
      if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
      if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
      if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
    }

    if(selectedSkill==="s1")this._bossEarthSkillStoneSpear(player,w);
    else if(selectedSkill==="s2")this._bossEarthSkillEarthSmash();
    else if(selectedSkill==="s3")this._bossEarthSkillRockWall();
    else if(selectedSkill==="s4")this._bossEarthSkillBoulderRain(player,w);
    else if(selectedSkill==="s5")this._bossEarthSkillEarthCore();

    // ======= ACTIVE SKILL UPDATES =======
    this._updateBossEarthStoneSpear(player,w);
    this._updateBossEarthEarthSmash(player,w);
    this._updateBossEarthRockWall();
    this._updateBossEarthBoulderRain(player,floorY);
    this._updateBossEarthEarthCore(player,w);
  }

  // ===== SKILL 1: STONE SPEAR — mũi đá đâm từ dưới đất =====
  _bossEarthSkillStoneSpear(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";
    const isP2=this.phase===2,count=isP2?5:3;
    for(let i=0;i<count;i++){
      const sx=clamp(player.x+(i-(count-1)/2)*70,60,w-60);
      this.stoneSpearWarnings.push({x:sx,timer:38,dmg:(isP2?16:12)*this.phase2DmgMult});
    }
    sfxEarthRumble?.();
  }
  _updateBossEarthStoneSpear(player,w){
    _compact(this.stoneSpearWarnings,sw=>{
      sw.timer--;
      if(sw.timer<=0){
        this.stoneSpears.push({x:sw.x,life:22,dmg:sw.dmg,hitDone:false});
        sfxRockErupt?.();screenShake=Math.max(screenShake,6);
        return false;
      }
      return true;
    });
    _compact(this.stoneSpears,sp=>{
      sp.life--;
      if(!sp.hitDone&&sp.life>10&&Math.abs(player.x-sp.x)<40&&player.hp>0){
        sp.hitDone=true;applyDamage(player,sp.dmg,this);player.vy=-9;
      }
      return sp.life>0;
    });
  }

  // ===== SKILL 2: EARTH SMASH — đấm xuống đất tạo sóng xung kích =====
  _bossEarthSkillEarthSmash(){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";
    this.smashActive=true;this.smashTimer=34; // wind-up, then slam
  }
  _updateBossEarthEarthSmash(player,w){
    if(this.smashActive){
      this.smashTimer--;
      if(this.smashTimer<=0){
        this.smashActive=false;
        this.smashShockwaves.push({r:10,alpha:1,dmg:(this.phase===2?24:18)*this.phase2DmgMult});
        screenShake=Math.max(screenShake,this.phase===2?22:16);
        sfxEarthCrack?.();
      }
    }
    _compact(this.smashShockwaves,sw=>{
      const prevR=sw.r;
      sw.r+=14;sw.alpha-=0.05;
      if(sw.alpha>0&&player.hp>0&&Math.abs(player.x-this.x)>prevR&&Math.abs(player.x-this.x)<=sw.r){
        applyDamage(player,sw.dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*140,40,w-40);
      }
      return sw.alpha>0;
    });
  }

  // ===== SKILL 3: ROCK WALL — dựng tường đá chắn đòn =====
  _bossEarthSkillRockWall(){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";
    this.rockWallActive=true;this.rockWallTimer=180;this.dmgReducePct=0.5;
    sfxRockErupt?.();
  }
  _updateBossEarthRockWall(){
    if(!this.rockWallActive)return;
    this.rockWallTimer--;
    if(this.rockWallTimer<=0){this.rockWallActive=false;this.dmgReducePct=0;}
  }

  // ===== SKILL 4: BOULDER RAIN — gọi đá từ trên trời rơi xuống =====
  _bossEarthSkillBoulderRain(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";
    const isP2=this.phase===2,count=isP2?6:4;
    for(let i=0;i<count;i++){
      const bx=clamp(player.x+rndInt(-260,260),60,w-60);
      this.boulderWarnings.push({x:bx,timer:50+i*6,dmg:(isP2?20:15)*this.phase2DmgMult});
    }
  }
  _updateBossEarthBoulderRain(player,floorY){
    _compact(this.boulderWarnings,bw=>{
      bw.timer--;
      if(bw.timer<=0){
        this.boulders.push({x:bw.x,y:floorY-360,vy:6,dmg:bw.dmg,hitDone:false});
        return false;
      }
      return true;
    });
    _compact(this.boulders,b=>{
      b.vy+=0.55;b.y+=b.vy;
      if(b.y>=floorY){
        if(!b.hitDone){
          b.hitDone=true;screenShake=Math.max(screenShake,8);sfxRockImpact?.();
          if(Math.abs(player.x-b.x)<55&&player.hp>0)applyDamage(player,b.dmg,this);
        }
        return false;
      }
      return true;
    });
  }

  // ===== ULTIMATE: EARTH CORE — hút năng lượng mặt đất rồi gây nổ diện rộng =====
  _bossEarthSkillEarthCore(){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";
    this.earthCoreCharging=true;this.earthCoreTimer=120; // ~2s channel
    sfxEarthRumble?.();
  }
  _updateBossEarthEarthCore(player,w){
    if(!this.earthCoreCharging)return;
    this.earthCoreTimer--;
    if(this.earthCoreTimer<=0){
      this.earthCoreCharging=false;
      screenShake=Math.max(screenShake,40);
      sfxEarthExplode?.();
      const isP2=this.phase===2,radius=isP2?420:340,dmg=(isP2?40:30)*this.phase2DmgMult;
      if(Math.abs(player.x-this.x)<radius&&player.hp>0){
        applyDamage(player,dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*220,40,w-40);
      }
    }
  }

  // ================================================================
  //  FLAME LORD (Boss 3) — a tall Fire Sorcerer, not a brawler. Never
  //  melees; every skill is cast from range with the staff.
  //  4 skills + Ultimate: Fire Tornado / Summon Fire Spirits /
  //  Inferno Pillars / Meteor Storm / Ultimate "World of Flames".
  //  Same weighted-AI pattern as Boss 1 (Frost King) and Boss 2 (Earth Titan).
  // ================================================================
  _updateBossFlame(player,floorY,w){
    this._floorY=floorY;
    // ======= PHASE 2 CHECK =======
    if(this.phase===1 && this.hp<=this.maxHp*0.35 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.3;this.phase2DmgMult=1.25;
      screenShake=Math.max(screenShake,30);
      this.skillTimer.s1=Math.min(this.skillTimer.s1,120);
    }
    const isP2=this.phase===2;
    this.flameAura.forEach(a=>a.ang+=a.spd);
    this.robeSway+=0.03;
    if(this.staffRaiseTimer>0)this.staffRaiseTimer--;

    // ======= SPELLCASTER MOVEMENT — keeps its distance, drifts rather than stomps
    // (no footstep sound — a sorcerer glides, it doesn't march) =======
    const dx=player.x-this.x,distp=Math.abs(dx),dir=dx>0?1:-1;
    if(!this.worldFlameCharging){
      const spd=isP2?1.5:1.1,idealDist=320;
      if(distp>idealDist+80)this.x+=spd*dir;
      else if(distp<idealDist-100)this.x-=spd*0.8*dir;
      this.x=clamp(this.x,80,w-80);
    }
    this.direction=dir;

    // ======= WEIGHTED AI SKILL DECISION (same pattern as Frost King / Earth Titan) =======
    const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
    const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
    const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
    const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
    const canUseS5=this.skillTimer.s5<=0 && isP2 && this.lastSkillUsed!=="s5";

    let weights={s1:26,s2:22,s3:26,s4:18,s5:14};
    if(distp<200) weights.s3=34;               // Inferno Pillars when close
    if(distp>260) weights.s1=34;                // Fire Tornado to close the gap
    if(distp>300) weights.s4=28;                // Meteor Storm when far
    if(isP2) weights.s5=22;

    let totalWeight=0;
    if(canUseS1)totalWeight+=weights.s1;
    if(canUseS2)totalWeight+=weights.s2;
    if(canUseS3)totalWeight+=weights.s3;
    if(canUseS4)totalWeight+=weights.s4;
    if(canUseS5)totalWeight+=weights.s5;

    let selectedSkill=null;
    if(totalWeight>0 && !this.worldFlameCharging){
      let decision=rng()*totalWeight,acc=0;
      if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
      if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
      if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
      if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
      if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
    }

    if(selectedSkill==="s1")this._bossFlameSkillTornado(player,w);
    else if(selectedSkill==="s2")this._bossFlameSkillSummonSpirits(player,w);
    else if(selectedSkill==="s3")this._bossFlameSkillInfernoPillars(player,w);
    else if(selectedSkill==="s4")this._bossFlameSkillMeteorStorm(player,w);
    else if(selectedSkill==="s5")this._bossFlameSkillWorldOfFlames();

    // ======= ACTIVE SKILL UPDATES =======
    this._updateBossFlameTornado(player,w);
    this._updateBossFlameSpirits(player,w,floorY);
    this._updateBossFlameInfernoPillars(player,floorY);
    this._updateBossFlameMeteorStorm(player,floorY);
    this._updateBossFlameWorldOfFlames(player,w,floorY);
  }

  // ===== SKILL 1: FIRE TORNADO — giơ quyền trượng, triệu hồi lốc lửa truy đuổi người chơi =====
  _bossFlameSkillTornado(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";this.staffRaiseTimer=26;
    const isP2=this.phase===2;
    this.fireTornadoes.push({x:this.x+this.direction*60,y:this._floorY||this.y,life:220,dmg:(isP2?5.25:3.75)*this.phase2DmgMult,tick:0,ang:0});
    sfxFireTornado?.();
    screenShake=Math.max(screenShake,5);
  }
  _updateBossFlameTornado(player,w){
    _compact(this.fireTornadoes,t=>{
      t.life--;t.ang+=0.4;
      const chaseSpd=2.1;
      const tdx=player.x-t.x;
      t.x+=clamp(tdx,-chaseSpd,chaseSpd);
      t.x=clamp(t.x,60,w-60);
      t.tick--;
      if(t.tick<=0&&player.hp>0&&Math.abs(player.x-t.x)<85){
        t.tick=18;applyDamage(player,t.dmg,this);
      }
      return t.life>0;
    });
  }

  // ===== SKILL 2: SUMMON FIRE SPIRITS — triệu hồi 3-5 linh hồn lửa tự tấn công =====
  _bossFlameSkillSummonSpirits(player,w){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";this.staffRaiseTimer=20;
    const isP2=this.phase===2,count=isP2?5:3;
    for(let i=0;i<count;i++){
      const sx=clamp(this.x+(i-(count-1)/2)*50,60,w-60);
      this.fireSpirits.push({x:sx,y:this.y-140-rng()*30,vx:0,vy:0,life:340,dmg:(isP2?6.75:4.5)*this.phase2DmgMult,bob:rng()*Math.PI*2,tick:0});
    }
    sfxSpiritSummon?.();
  }
  _updateBossFlameSpirits(player,w,floorY){
    _compact(this.fireSpirits,s=>{
      s.life--;s.bob+=0.12;
      const sdx=player.x-s.x,sdy=(player.y-90)-s.y,d=Math.max(1,Math.sqrt(sdx*sdx+sdy*sdy));
      const spd=1.6;
      s.x+=(sdx/d)*spd;s.y+=(sdy/d)*spd+Math.sin(s.bob)*0.4;
      s.x=clamp(s.x,50,w-50);
      s.tick--;
      if(s.tick<=0&&player.hp>0&&d<46){
        s.tick=40;applyDamage(player,s.dmg,this);
      }
      return s.life>0;
    });
  }

  // ===== SKILL 3: INFERNO PILLARS — giơ quyền trượng, nhiều cột lửa phun liên tiếp dưới chân người chơi =====
  _bossFlameSkillInfernoPillars(player,w){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";this.staffRaiseTimer=24;
    this.infernoPillarWaves=this.phase===2?4:3;
    sfxLavaRumble?.();
    this._spawnInfernoPillarWave(player,w);
  }
  _spawnInfernoPillarWave(player,w){
    const isP2=this.phase===2,count=isP2?4:3;
    for(let i=0;i<count;i++){
      const px=clamp(player.x+(i-(count-1)/2)*70+rndInt(-18,18),60,w-60);
      this.infernoPillarWarnings.push({x:px,timer:30,dmg:(isP2?12:9)*this.phase2DmgMult});
    }
  }
  _updateBossFlameInfernoPillars(player,floorY){
    _compact(this.infernoPillarWarnings,fw=>{
      fw.timer--;
      if(fw.timer<=0){
        this.infernoPillars.push({x:fw.x,life:26,dmg:fw.dmg,hitDone:false});
        sfxFireBurst?.();screenShake=Math.max(screenShake,6);
        return false;
      }
      return true;
    });
    _compact(this.infernoPillars,fp=>{
      fp.life--;
      if(!fp.hitDone&&fp.life>12&&player.hp>0&&Math.abs(player.x-fp.x)<45){
        fp.hitDone=true;applyDamage(player,fp.dmg,this);
      }
      return fp.life>0;
    });
    // "liên tiếp" — chain into another wave while waves remain, giving a
    // continuous stream of pillars instead of one single burst.
    if(this.infernoPillarWaves>0&&this.infernoPillarWarnings.length===0&&this.infernoPillars.length===0){
      this.infernoPillarWaves--;
      if(this.infernoPillarWaves>0)this._spawnInfernoPillarWave(player,9999);
    }
  }

  // ===== SKILL 4: METEOR STORM — triệu hồi hàng chục thiên thạch rơi ngẫu nhiên =====
  _bossFlameSkillMeteorStorm(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";this.staffRaiseTimer=22;
    const isP2=this.phase===2,count=isP2?14:10;
    for(let i=0;i<count;i++){
      const mx=clamp(rndInt(70,w-70),60,w-60); // scattered across the whole arena — "rơi ngẫu nhiên"
      this.meteorWarnings.push({x:mx,timer:30+rndInt(0,60),dmg:(isP2?9.75:7.5)*this.phase2DmgMult});
    }
    sfxLavaRumble?.();
  }
  _updateBossFlameMeteorStorm(player,floorY){
    _compact(this.meteorWarnings,mw=>{
      mw.timer--;
      if(mw.timer<=0){
        this.meteorRocks.push({x:mw.x,y:floorY-340,vy:5,dmg:mw.dmg,hitDone:false});
        return false;
      }
      return true;
    });
    _compact(this.meteorRocks,m=>{
      m.vy+=0.5;m.y+=m.vy;
      if(m.y>=floorY){
        if(!m.hitDone){
          m.hitDone=true;screenShake=Math.max(screenShake,6);sfxMeteorFall?.();
          if(Math.abs(player.x-m.x)<55&&player.hp>0)applyDamage(player,m.dmg,this);
        }
        return false;
      }
      return true;
    });
  }

  // ===== ULTIMATE: WORLD OF FLAMES — Boss bay lên, giơ quyền trượng, toàn bản đồ
  // hóa biển lửa: dung nham khắp nơi + lốc lửa + thiên thạch + cột lửa cùng lúc =====
  _bossFlameSkillWorldOfFlames(){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";this.staffRaiseTimer=60;
    this.worldFlameCharging=true;this.worldFlameTimer=150; // ~2.5s channel while rising off the ground
    sfxLavaRumble?.();
    screenShake=Math.max(screenShake,12);
  }
  _updateBossFlameWorldOfFlames(player,w,floorY){
    if(this.worldFlameCharging){
      this.worldFlameTimer--;
      this.hoverOffset=Math.min(70,this.hoverOffset+2.2); // "Boss bay lên"
      if(this.worldFlameTimer<=0){
        this.worldFlameCharging=false;this.worldFlameActive=true;this.worldFlameTimer2=180; // ~3s of combined chaos
        screenShake=Math.max(screenShake,38);
        sfxInfernoBurst?.();
        const isP2=this.phase===2,dmg=(isP2?27:21)*this.phase2DmgMult;
        if(player.hp>0)applyDamage(player,dmg,this);
        // scatter lava zones across the whole arena — "Khắp nơi xuất hiện dung nham"
        this.worldFlameLavaZones=[];
        for(let i=0;i<7;i++)this.worldFlameLavaZones.push({x:60+i*((w-120)/6),r:60+rng()*30,tick:rndInt(0,50)});
        this.fireTornadoes.push({x:this.x-140,y:floorY,life:170,dmg:4.5*this.phase2DmgMult,tick:0,ang:0});
        this.fireTornadoes.push({x:this.x+140,y:floorY,life:170,dmg:4.5*this.phase2DmgMult,tick:0,ang:0});
      }
    }
    if(this.worldFlameActive){
      this.worldFlameTimer2--;
      this.hoverOffset=Math.max(0,this.hoverOffset-0.6);
      // continuous rain of meteors + fresh pillar bursts while the world burns
      if(this.worldFlameTimer2%40===0)this.meteorWarnings.push({x:rndInt(70,w-70),timer:26,dmg:6.75*this.phase2DmgMult});
      if(this.worldFlameTimer2%55===0)this._spawnInfernoPillarWave(player,w);
      // burning lava zones tick damage to anyone standing in them
      this.worldFlameLavaZones.forEach(z=>{
        z.tick--;
        if(z.tick<=0){
          z.tick=50;
          if(player.hp>0&&Math.abs(player.x-z.x)<z.r)applyDamage(player,3.75*this.phase2DmgMult,this);
        }
      });
      if(this.worldFlameTimer2<=0){this.worldFlameActive=false;this.worldFlameLavaZones=[];}
    } else if(!this.worldFlameCharging){
      this.hoverOffset=Math.max(0,this.hoverOffset-0.6);
    }
  }

  draw(){if(this.bossId===1)this._drawBoss1();else if(this.bossId===2)this._drawBossEarth();else if(this.bossId===3)this._drawBoss3();else if(this.bossId===4)this._drawBoss4();else if(this.bossId===6)this._drawBossFlame();else if(this.bossId===5)this._drawBoss5();else if(this.bossId===7)this._drawBossTidal();else if(this.bossId===8)this._drawBossVoltage();}
  _drawBoss1(){
    // ❄️ FROST KING — THE FROZEN EMPEROR — v2 with 6 Skills + Phase 2
    const rx=this.x,ry=this.y;
    
    // ===== Draw skill effects =====
    this._drawBoss1SkillEffects();
    
    // ===== Draw trails and aura =====
    this._drawFrostKingFrostTrail();
    this._drawFrostKingAura(rx,ry);
    
    // ===== Draw body with phase indicator =====
    const phaseAlpha=(this.phase===2)?1.0:1.0;
    this._drawFrostKingBody(rx,ry,1,phaseAlpha,this.anim);
    
    // ===== Phase 2 glow =====
    if(this.phase===2){
      ctx.save();
      ctx.shadowColor="rgba(255,150,150,0.8)";
      ctx.shadowBlur=30;
      ctx.strokeStyle="rgba(255,150,150,0.6)";
      ctx.lineWidth=3;
      ctx.beginPath();
      ctx.arc(rx,ry,80,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    
    // ===== HP Bar with phase indicator =====
    const hpLabel=this.phase===2?"❄️ FROST KING - PHASE 2 WRATH":"❄️ FROST KING";
    const hpColor=this.phase===2?"#FF6699":"cyan";
    this._drawHpBar(rx,ry-40,hpLabel,hpColor);
    
    // ===== Action state indicator =====
    if(this.actionState==="preparing"){
      _text(rx,ry-70,"⚠️ CASTING...","orange","11px Arial bold");
    }
  }

  _drawBoss1SkillEffects(){
    const rx=this.x,ry=this.y;

    // ===== Skill 1: Frozen Spears Charging =====
    if(this.spearChargeTimer>0){
      ctx.save();
      const chargeProgress=this.spearChargePhase;
      ctx.globalAlpha=0.6+chargeProgress*0.4;
      ctx.fillStyle="cyan";
      ctx.beginPath();
      ctx.arc(rx,ry-50,20+chargeProgress*15,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
      
      // Spear shapes forming
      for(let i=0;i<8;i++){
        const ang=(i/8)*Math.PI*2+this.anim*0.05;
        const dist=50+chargeProgress*20;
        const sx=rx+Math.cos(ang)*dist;
        const sy=ry+Math.sin(ang)*dist;
        ctx.save();
        ctx.translate(sx,sy);
        ctx.rotate(ang);
        ctx.strokeStyle="rgba(180,240,255,0.8)";
        ctx.lineWidth=3;
        ctx.beginPath();
        ctx.moveTo(-10,-20);ctx.lineTo(0,20);
        ctx.stroke();
        ctx.restore();
      }
    }

    // ===== Skill 2: Ice Prison Warning Circle =====
    if(this.icePrisonWarningTimer>0){
      const warningAlpha=(this.icePrisonWarningTimer/90)*0.8;
      const pulseSize=30+Math.sin(this.anim*0.08)*15;
      ctx.save();
      ctx.strokeStyle=`rgba(100,200,255,${warningAlpha})`;
      ctx.lineWidth=2;
      ctx.setLineDash([5,5]);
      ctx.beginPath();
      ctx.arc(this.icePrisonWarningX,this.icePrisonWarningY,pulseSize,0,Math.PI*2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      
      _text(this.icePrisonWarningX,this.icePrisonWarningY-50,"⚠️ ICE PRISON","cyan","10px Arial bold");
    }

    // ===== Skill 3: Blizzard Meteor Warnings & Falling Meteors =====
    if(this.blizzardActive){
      // Blizzard overlay (semi-transparent snowstorm)
      ctx.save();
      ctx.globalAlpha=0.15;
      ctx.fillStyle="white";
      for(let i=0;i<20;i++){
        const px=campX+50+rng()*W;
        const py=rng()*H;
        ctx.fillRect(px,py,2,2);
      }
      ctx.restore();

      // Meteor warnings
      this.meteorWarnings.forEach(w=>{
        const wAlpha=(w.warningTimer/45)*0.6;
        ctx.save();
        ctx.globalAlpha=wAlpha;
        ctx.fillStyle="rgba(255,150,0,0.8)";
        ctx.beginPath();
        ctx.arc(w.x,w.y,25,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="orange";
        ctx.lineWidth=2;
        ctx.stroke();
        ctx.restore();
      });

      // Falling meteors
      this.meteorSpawns.forEach(m=>{
        const mAlpha=Math.max(0,m.life/180);
        ctx.save();
        ctx.globalAlpha=mAlpha;
        ctx.fillStyle="rgba(200,100,50,0.9)";
        ctx.beginPath();
        ctx.arc(m.x,m.y,m.radius,0,Math.PI*2);
        ctx.fill();
        ctx.strokeStyle="orange";
        ctx.lineWidth=2;
        ctx.stroke();
        // Inner glow
        ctx.fillStyle="rgba(255,180,100,0.5)";
        ctx.beginPath();
        ctx.arc(m.x,m.y,m.radius*0.6,0,Math.PI*2);
        ctx.fill();
        ctx.restore();
      });
    }

    // ===== Skill 4: Frost Dash Ice Trails =====
    this.dashIceTrails.forEach(trail=>{
      const trailAlpha=(trail.life/90)*0.6;
      ctx.save();
      ctx.globalAlpha=trailAlpha;
      ctx.fillStyle="rgba(180,240,255,0.8)";
      ctx.beginPath();
      ctx.ellipse(trail.x,trail.y,30,15,0,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // ===== Skill 5: Absolute Zero Charging & Heat Crystals =====
    if(this.absoluteZeroCharging){
      // Freezing aura expanding
      const chargeProgress=1-(this.absoluteZeroTimer/150);
      ctx.save();
      ctx.globalAlpha=0.3+chargeProgress*0.3;
      ctx.fillStyle="rgba(150,200,255,0.4)";
      ctx.beginPath();
      ctx.arc(rx,ry,50+chargeProgress*100,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
      
      _text(rx,ry-120,"❄️ ABSOLUTE ZERO ❄️","cyan","12px Arial bold");
    }

    // ===== Heat Crystals (Absolute Zero safe zones) =====
    this.heatCrystals.forEach(crystal=>{
      const crystalAlpha=(crystal.life/crystal.maxLife);
      ctx.save();
      ctx.globalAlpha=crystalAlpha;
      ctx.fillStyle="rgba(255,200,0,0.7)";
      ctx.strokeStyle="orange";
      ctx.lineWidth=2;
      ctx.beginPath();
      ctx.arc(crystal.x,crystal.y,crystal.radius,0,Math.PI*2);
      ctx.fill();
      ctx.stroke();
      // Inner glow
      ctx.fillStyle="rgba(255,255,100,0.5)";
      ctx.beginPath();
      ctx.arc(crystal.x,crystal.y,crystal.radius*0.5,0,Math.PI*2);
      ctx.fill();
      ctx.restore();
    });

    // ===== Absolute Zero Frozen Battlefield =====
    if(this.battlefieldFrozen){
      ctx.save();
      ctx.globalAlpha=0.25;
      ctx.fillStyle="cyan";
      ctx.fillRect(0,0,W,H);
      ctx.restore();
      
      _text(W/2,H/2,"❄️ BATTLEFIELD FROZEN ❄️","cyan","24px Arial bold");
    }
  }
  // ---- Ambient orbiting aura: snow + ice crystals + cold mist, always swirling, never idle ----
  _drawFrostKingAura(rx,ry){
    ctx.save();
    this.auraParticles.forEach(p=>{
      const px=rx+Math.cos(p.ang)*p.rad, py=ry-60+Math.sin(p.ang)*p.rad*0.5+Math.sin(p.bob)*4;
      if(p.type==="snow"){ctx.fillStyle="rgba(255,255,255,0.85)";ctx.beginPath();ctx.arc(px,py,p.size*0.5,0,Math.PI*2);ctx.fill();}
      else if(p.type==="crystal"){ctx.save();ctx.translate(px,py);ctx.rotate(p.ang);ctx.fillStyle="rgba(180,240,255,0.8)";ctx.beginPath();ctx.moveTo(0,-p.size);ctx.lineTo(p.size*0.6,0);ctx.lineTo(0,p.size);ctx.lineTo(-p.size*0.6,0);ctx.closePath();ctx.fill();ctx.restore();}
      else{ctx.fillStyle="rgba(210,245,255,0.22)";ctx.beginPath();ctx.arc(px,py,p.size*2.2,0,Math.PI*2);ctx.fill();}
    });
    ctx.restore();
  }
  // ---- Heavy-footstep trail: ground freezes wherever the boss has moved ----
  _drawFrostKingFrostTrail(){
    this.frostTrail.forEach(t=>{
      const a=Math.max(0,t.life/150);
      if(t.puff){ctx.fillStyle=`rgba(220,245,255,${0.4*Math.max(0,t.life/40)})`;ctx.beginPath();ctx.arc(t.x,t.y,t.r+2,0,Math.PI*2);ctx.fill();}
      else{ctx.strokeStyle=`rgba(190,240,255,${0.55*a})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(t.x,t.y,t.r,t.r*0.32,0,0,Math.PI*2);ctx.stroke();
        ctx.fillStyle=`rgba(220,250,255,${0.18*a})`;ctx.beginPath();ctx.ellipse(t.x,t.y,t.r,t.r*0.32,0,0,Math.PI*2);ctx.fill();}
    });
  }
  // ---- Additive FX updater: aura swirl + footstep freeze cracks (no gameplay effect) ----
  _updateFrostKingFX(floorY,w){
    this.auraParticles.forEach(p=>{p.ang+=p.spd;p.bob+=0.05;});
    if(Math.abs(this.x-this.lastFootX)>=42){
      this.lastFootX=this.x;
      this.frostTrail.push({x:this.x,y:floorY,life:150,r:6});
      for(let i=0;i<6;i++)this.frostTrail.push({x:this.x+rndInt(-18,18),y:floorY-rndInt(0,6),life:40,r:2,puff:true,vx:(rng()-0.5)*1.2,vy:-rng()*1.4});
    }
    _compact(this.frostTrail,t=>t.life>0);
    this.frostTrail.forEach(t=>{t.life--;if(t.puff){t.x+=t.vx;t.y+=t.vy;}else if(t.r<34)t.r+=0.35;});
  }
  // ---- The Frost King's body itself: crown, horns, glowing-fog head, spiked crystal shoulders,
  //      long clawed arms, pulsing ice core, heavy legs, drifting mist cloak ----
  _drawFrostKingBody(rx,ry,scale=1,alpha=1,anim=0){
    ctx.save();ctx.globalAlpha=alpha;
    ctx.translate(rx,ry);ctx.scale(scale,scale);
    const cloakDrift=Math.sin(anim*0.03)*6;
    const pulseT=(anim%120)/120,corePulse=Math.pow(Math.sin(pulseT*Math.PI),3); // sharp glow spike once every ~2s
    // misty cloak — no complex animation, just a gentle sway
    ctx.fillStyle="rgba(210,240,255,0.35)";
    ctx.beginPath();ctx.moveTo(-6,-150);ctx.quadraticCurveTo(-70+cloakDrift,-40,-95+cloakDrift*1.4,70);ctx.quadraticCurveTo(-40,50,0,60);ctx.quadraticCurveTo(40,50,95-cloakDrift*1.4,70);ctx.quadraticCurveTo(70-cloakDrift,-40,6,-150);ctx.closePath();ctx.fill();
    // heavy legs
    _rect(-40,20,32,70,"#BFE9FF","#eaffff",3);_rect(8,20,32,70,"#BFE9FF","#eaffff",3);
    // shoulders — giant spiked ice blocks with crystal facets
    for(const side of[-1,1]){
      ctx.save();ctx.translate(side*70,-70);
      ctx.fillStyle="#AEE6FF";ctx.strokeStyle="white";ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(-38,10);ctx.lineTo(-30,-40);ctx.lineTo(0,-55);ctx.lineTo(30,-30);ctx.lineTo(35,15);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#E8FBFF";
      for(let i=0;i<3;i++){const sx=-24+i*22;ctx.beginPath();ctx.moveTo(sx,-38);ctx.lineTo(sx+6,-62);ctx.lineTo(sx+12,-38);ctx.closePath();ctx.fill();}
      ctx.fillStyle="rgba(150,230,255,0.7)";ctx.beginPath();ctx.moveTo(-8,-20);ctx.lineTo(0,-40);ctx.lineTo(8,-20);ctx.lineTo(0,-5);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    // long arms — ice claws with crystal elbow joints
    for(const side of[-1,1]){
      ctx.save();ctx.translate(side*68,-55);ctx.rotate(side*0.18);
      ctx.strokeStyle="#CFF3FF";ctx.lineWidth=16;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(side*18,95);ctx.stroke();
      ctx.fillStyle="#E9FBFF";ctx.beginPath();ctx.arc(side*9,48,7,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#DFF7FF";ctx.strokeStyle="white";ctx.lineWidth=2;
      const hx=side*18,hy=95;
      for(let c=-1;c<=1;c++){ctx.beginPath();ctx.moveTo(hx,hy);ctx.lineTo(hx+c*10,hy+26);ctx.lineTo(hx+c*4,hy+10);ctx.closePath();ctx.fill();ctx.stroke();}
      ctx.restore();
    }
    // torso
    _rect(-34,-90,68,90,"#CDEFFF","white",3);
    // glowing ice core — pulses hard roughly every 2 seconds
    const coreR=10+corePulse*6;
    ctx.save();ctx.shadowColor="#7EEBFF";ctx.shadowBlur=10+corePulse*22;
    const coreGrad=ctx.createRadialGradient(0,-45,0,0,-45,coreR+8);
    coreGrad.addColorStop(0,"rgba(255,255,255,0.9)");coreGrad.addColorStop(0.5,`rgba(130,235,255,${0.7+0.3*corePulse})`);coreGrad.addColorStop(1,"rgba(80,190,255,0)");
    ctx.fillStyle=coreGrad;ctx.beginPath();ctx.arc(0,-45,coreR+8,0,Math.PI*2);ctx.fill();
    ctx.restore();
    // head — crown, horns, glowing eyes, swirling inner fog (never pure white: cyan/blue/white blend)
    ctx.save();ctx.translate(0,-118);
    _oval(-24,-18,48,38,"#DCF6FF","white",2);
    ctx.save();ctx.beginPath();ctx.ellipse(0,0,24,19,0,0,Math.PI*2);ctx.clip();
    for(let i=0;i<4;i++){const mAng=anim*0.02+i*1.6;ctx.fillStyle="rgba(255,255,255,0.25)";ctx.beginPath();ctx.ellipse(Math.cos(mAng)*10,Math.sin(mAng)*6,10,6,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
    ctx.fillStyle="#EAFBFF";ctx.strokeStyle="#9FE0FF";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-18,-8);ctx.quadraticCurveTo(-40,-30,-30,-55);ctx.quadraticCurveTo(-26,-30,-10,-14);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.moveTo(18,-8);ctx.quadraticCurveTo(40,-30,30,-55);ctx.quadraticCurveTo(26,-30,10,-14);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.fillStyle="#BEEBFF";ctx.strokeStyle="white";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(-22,-16);
    for(let i=0;i<5;i++){const px2=-22+i*11,py2=(i%2===0)?-34:-24;ctx.lineTo(px2,py2);}
    ctx.lineTo(22,-16);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.save();ctx.shadowColor="#00F6FF";ctx.shadowBlur=12;ctx.fillStyle="#00E5FF";
    ctx.beginPath();ctx.ellipse(-8,-2,5,3.4,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(8,-2,5,3.4,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.restore(); // head
    ctx.restore(); // whole body
  }
  _drawBoss3(){
    const rx=this.x,ry=this.y,isP2=this.phase===2,szM=isP2?1.5:1.0,wSz=Math.floor(25*szM),head=Math.floor(20*szM),hue=this.rainbowHue;
    const colors7=Array.from({length:7},(_,i)=>hsvHex(((hue+i*51)%360)/360,1,1));
    for(let i=0;i<7;i++){const band=Math.floor(60*szM/7);ctx.fillStyle=colors7[i];ctx.fillRect(rx-wSz,ry-60*szM+i*band,wSz*2,band);}
    ctx.strokeStyle="white";ctx.lineWidth=2;_rectOutline(rx-wSz,ry-60*szM,wSz*2,100*szM,"white",2);
    _oval(rx-head,ry-90*szM,head*2,30*szM,colors7[0],"white");
    ctx.fillStyle=colors7[3];ctx.beginPath();ctx.moveTo(rx,ry-120*szM);ctx.lineTo(rx-head,ry-90*szM);ctx.lineTo(rx+head,ry-90*szM);ctx.closePath();ctx.fill();ctx.stroke();
    const ICONS={fire:"🔥",shadow:"🌑",ice:"❄️",thunder:"⚡",earth:"🪨",water:"🌊",wind:"🌪️"};
    _text(rx,ry-135*szM,`${ICONS[this.currentElement]||"✨"} ${this.currentElement.toUpperCase()}`,"white","10px Arial bold");
    if(this.chainActive){const cx2=this.chainX,cy2=this.chainY;for(let i=0;i<Math.abs(cx2-this.x);i+=20){const lx=this.x+(cx2>this.x?i:-i);_oval(lx-6,cy2-6,12,12,"orange","yellow");}}
    this.clones.forEach(c=>{const cc=hsvHex(c.hue/360,0.8,0.9);ctx.strokeStyle="white";ctx.lineWidth=1;ctx.setLineDash([4,2]);_rect(c.x-18,ry-50,36,85,cc,"white",1);_oval(c.x-12,ry-70,24,20,cc,"white");ctx.setLineDash([]);});
    this._drawHpBar(rx,ry,`${isP2?"👑":"🌈"} RAINBOW BOSS 3 (P${this.phase})`,colors7[0]);
  }
  // ================================================================
  //  THE ABYSSAL (Boss 4) — drawing. A tall, gaunt, distorted shadow
  //  creature: no sword, no staff, no armor. A faceless head with one
  //  glowing eye, a torn dark cloak, over-long limbs, and a body that
  //  is partly dissolving into drifting shadow fragments. Deliberately
  //  NOT the bulky brawler (Earth) or the flowing sorcerer (Flame)
  //  silhouette — an unnatural, slightly hunched stance instead.
  // ================================================================
  _drawBoss4(){
    const rx=this.x,ry=this.y-this.hoverYOffset,isP2=this.phase===2;
    if(this.dead){
      for(let i=0;i<10;i++){const ex=rx+rndInt(-80,80),ey=ry+rndInt(-90,10);_oval(ex-10,ey-10,20,20,rndChoice(["#3a0a55","#150022","#a020f0"]),null);}
      _text(rx,ry-80,"💀 DEFEATED 💀","#c060ff","16px Arial bold");
      return;
    }
    const sz=isP2?1.25:1.0;

    // ---- ambient drifting shadow wisps orbiting the body ----
    this.shadowWisps.forEach(sw=>{
      const ox=rx+Math.cos(sw.ang)*sw.rad,oy=ry-90+Math.sin(sw.ang)*sw.rad*0.4+Math.sin(this.anim*0.05+sw.bob)*4;
      ctx.globalAlpha=0.55;ctx.fillStyle=isP2?"#7a1fb8":"#3a0a55";
      ctx.beginPath();ctx.arc(ox,oy,sw.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    });

    // ---- skill telegraphs ----
    this.voidRifts.forEach(r=>{
      if(!r.erupted){
        const p=1-r.eruptTimer/70;
        ctx.strokeStyle="#a020f0";ctx.lineWidth=2;ctx.setLineDash([5,3]);
        ctx.beginPath();ctx.ellipse(r.x,ry+30,18+p*10,8,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
      }else{
        ctx.strokeStyle="#d080ff";ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(r.x,ry+30,40,16,0,0,Math.PI*2);ctx.stroke();
      }
    });
    this.chainWarnings.forEach(cw=>{const a=1-cw.timer/40;ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.ellipse(cw.x,ry+30,20+a*10,10,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);});
    this.chains.forEach(c=>{
      const a=Math.min(1,c.life/70);ctx.globalAlpha=a;ctx.strokeStyle="#1a1a1a";ctx.lineWidth=4;
      for(let i=0;i<3;i++){const cx=c.x+(i-1)*14;ctx.beginPath();ctx.moveTo(cx,ry+40);ctx.lineTo(cx+rndInt(-3,3),ry-10-i*8);ctx.stroke();}
      ctx.globalAlpha=1;
    });
    if(this.blackHole){
      const bh=this.blackHole;ctx.save();
      ctx.strokeStyle="#a020f0";ctx.lineWidth=2;
      for(let i=0;i<3;i++){ctx.globalAlpha=0.5-i*0.15;ctx.beginPath();ctx.arc(bh.x,ry,bh.r+i*14,0,Math.PI*2);ctx.stroke();}
      ctx.globalAlpha=1;ctx.fillStyle="#0a0012";ctx.beginPath();ctx.arc(bh.x,ry,Math.max(4,bh.r*0.5),0,Math.PI*2);ctx.fill();
      ctx.restore();
    }
    // Ultimate "Abyss" — true full-screen darkening (uses the live camera/viewport,
    // not a fixed box anchored to the boss, so it actually covers the whole visible
    // screen) + a radial vignette centered on the boss + drifting shadow streaks.
    if(this.abyssCharging){
      ctx.save();
      const gx0=campX-30,gx1=campX+W+30;
      const grad=ctx.createRadialGradient(rx,ry-100,30,rx,ry-100,Math.max(W,H)*0.85);
      grad.addColorStop(0,"rgba(10,0,18,0.18)");
      grad.addColorStop(0.55,"rgba(10,0,18,0.5)");
      grad.addColorStop(1,"rgba(4,0,8,0.78)");
      ctx.fillStyle=grad;
      ctx.fillRect(gx0,-30,gx1-gx0,H+60);
      ctx.globalAlpha=0.2;ctx.strokeStyle="#4a1a70";ctx.lineWidth=2;
      for(let i=0;i<4;i++){
        const yy=H*0.25+i*H*0.18;
        ctx.beginPath();
        for(let sx=gx0;sx<=gx1;sx+=30){
          const wy=yy+Math.sin(this.anim*0.03+sx*0.015+i*1.7)*14;
          if(sx===gx0)ctx.moveTo(sx,wy);else ctx.lineTo(sx,wy);
        }
        ctx.stroke();
      }
      ctx.restore();
      _text(rx,ry-220*sz,"🌑 ABYSS 🌑","#c060ff","14px Arial bold");
    }
    if(this.vanishActive){
      _text(rx,ry-200*sz,"...",("#7a1fb8"),"20px Arial bold");
    }

    // ---- body (skip main silhouette while fully vanished) ----
    if(!this.vanishActive || this.vanishTimer>50 || this.vanishTimer<20){
      ctx.save();
      const distortX=1+this.bodyDistort*0.04,distortY=1-this.bodyDistort*0.03;
      ctx.translate(rx,ry);ctx.scale(distortX,distortY);ctx.translate(-rx,-ry);

      // torn cloak, swaying
      ctx.fillStyle=isP2?"#1a0028":"#120018";ctx.strokeStyle="#000";ctx.lineWidth=2;
      ctx.beginPath();
      ctx.moveTo(rx-34*sz,ry-140*sz);
      ctx.lineTo(rx-46*sz+this.cloakSway,ry-10);
      ctx.lineTo(rx-30*sz+this.cloakSway*0.6,ry-30);
      ctx.lineTo(rx-14*sz+this.cloakSway,ry-6);
      ctx.lineTo(rx+14*sz-this.cloakSway,ry-6);
      ctx.lineTo(rx+30*sz-this.cloakSway*0.6,ry-30);
      ctx.lineTo(rx+46*sz-this.cloakSway,ry-10);
      ctx.lineTo(rx+34*sz,ry-140*sz);
      ctx.closePath();ctx.fill();ctx.stroke();

      // gaunt torso, tall and thin
      ctx.fillStyle=isP2?"#241033":"#1a0e26";
      ctx.beginPath();
      ctx.moveTo(rx-20*sz,ry-30);ctx.lineTo(rx-24*sz,ry-150*sz);ctx.lineTo(rx-10*sz,ry-175*sz);
      ctx.lineTo(rx+10*sz,ry-175*sz);ctx.lineTo(rx+24*sz,ry-150*sz);ctx.lineTo(rx+20*sz,ry-30);
      ctx.closePath();ctx.fill();ctx.stroke();

      // over-long arms hanging past the knees, hint of dissolving edges
      ctx.strokeStyle=isP2?"#241033":"#1a0e26";ctx.lineWidth=9*sz;ctx.lineCap="round";
      const armSwing=Math.sin(this.anim*0.03)*6;
      ctx.beginPath();ctx.moveTo(rx-20*sz,ry-140*sz);ctx.quadraticCurveTo(rx-52*sz+armSwing,ry-90*sz,rx-40*sz+armSwing,ry+10);ctx.stroke();
      ctx.beginPath();ctx.moveTo(rx+20*sz,ry-140*sz);ctx.quadraticCurveTo(rx+52*sz-armSwing,ry-90*sz,rx+40*sz-armSwing,ry+10);ctx.stroke();

      // faceless head, elongated, slightly tilted
      const hx=rx+8*this.direction;
      ctx.fillStyle=isP2?"#2a1440":"#1e0f30";
      ctx.beginPath();ctx.ellipse(hx,ry-192*sz,22*sz,28*sz,0,0,Math.PI*2);ctx.fill();ctx.stroke();

      // single glowing eye
      const eyePulse=0.7+Math.sin(this.anim*0.08)*0.3;
      ctx.save();ctx.shadowColor=isP2?"#e060ff":"#a020f0";ctx.shadowBlur=14*eyePulse;
      ctx.fillStyle=isP2?"#ffb0ff":"#c060ff";
      ctx.beginPath();ctx.ellipse(hx+2*this.direction,ry-192*sz,6*sz*eyePulse,3.5*sz*eyePulse,0,0,Math.PI*2);ctx.fill();
      ctx.restore();

      ctx.restore(); // end distort transform
    }

    // ---- shadow particles flying out and returning to the body ----
    for(let i=0;i<4;i++){
      const t=(this.anim*0.02+i*1.6)%(Math.PI*2),pr=30+Math.sin(t*2)*22;
      const px=rx+Math.cos(t)*pr,py=ry-100+Math.sin(t)*pr*0.5;
      ctx.globalAlpha=0.6;ctx.fillStyle="#3a0a55";ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    }

    // ---- shadow clones (decoys) — visually identical, slightly dimmer ----
    this.shadowClones.forEach(c=>{
      ctx.save();ctx.globalAlpha=0.75;
      ctx.fillStyle="#1a0e26";ctx.strokeStyle="#000";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(c.x-18*sz,ry-28);ctx.lineTo(c.x-22*sz,ry-145*sz);ctx.lineTo(c.x-9*sz,ry-168*sz);
      ctx.lineTo(c.x+9*sz,ry-168*sz);ctx.lineTo(c.x+22*sz,ry-145*sz);ctx.lineTo(c.x+18*sz,ry-28);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.fillStyle="#1e0f30";ctx.beginPath();ctx.ellipse(c.x,ry-186*sz,19*sz,25*sz,0,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#c060ff";ctx.beginPath();ctx.ellipse(c.x,ry-186*sz,4*sz,2.5*sz,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });

    this._drawHpBar(rx,ry,`🌑 THE ABYSSAL (P${this.phase})`,isP2?"#e060ff":"#a020f0",true);
  }
  _drawBossEarth(){
    // 🪨 EARTH TITAN — tall, rock-armored, glowing yellow eyes + orange cracks
    const rx=this.x,ry=this.y,isP2=this.phase===2;
    this._drawBossEarthSkillEffects();

    // ambient orbiting rock debris
    this.rockOrbits.forEach(r=>{
      const ox=rx+Math.cos(r.ang)*r.rad,oy=ry-60+Math.sin(r.ang)*r.rad*0.4;
      ctx.fillStyle="#6a4a2a";ctx.beginPath();ctx.arc(ox,oy,r.size,0,Math.PI*2);ctx.fill();
    });

    const sc=1.35; // taller/bulkier than a normal fighter
    ctx.save();
    // Torso
    ctx.fillStyle=isP2?"#5a3f2a":"#6b4a30";
    ctx.strokeStyle="#2c1f10";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(rx-42*sc,ry-30);ctx.lineTo(rx-52*sc,ry-150*sc);ctx.lineTo(rx-20*sc,ry-175*sc);
    ctx.lineTo(rx+20*sc,ry-175*sc);ctx.lineTo(rx+52*sc,ry-150*sc);ctx.lineTo(rx+42*sc,ry-30);
    ctx.closePath();ctx.fill();ctx.stroke();

    // Shoulder boulders — "Vai có đá lớn"
    _oval(rx-60*sc,ry-165*sc,42*sc,36*sc,"#7a5a3a","#2c1f10",2);
    _oval(rx+18*sc,ry-165*sc,42*sc,36*sc,"#7a5a3a","#2c1f10",2);

    // Huge arms — "Hai tay cực to"
    ctx.fillStyle="#5f4128";
    ctx.beginPath();ctx.ellipse(rx-70*sc,ry-90*sc,20*sc,55*sc,-0.15,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.beginPath();ctx.ellipse(rx+70*sc,ry-90*sc,20*sc,55*sc,0.15,0,Math.PI*2);ctx.fill();ctx.stroke();

    // Head
    _oval(rx-24*sc,ry-215*sc,48*sc,40*sc,"#6b4a30","#2c1f10",2);

    // Glowing yellow eyes — "Mắt phát sáng màu vàng"
    ctx.save();ctx.shadowColor="#ffdd33";ctx.shadowBlur=14;
    _oval(rx-14*sc,ry-200*sc,10*sc,7*sc,"#ffe066",null);
    _oval(rx+4*sc,ry-200*sc,10*sc,7*sc,"#ffe066",null);
    ctx.restore();

    // Glowing orange cracks — "Các khe nứt trên cơ thể phát sáng màu cam"
    ctx.save();
    ctx.strokeStyle=`rgba(255,120,30,${this.crackGlow})`;ctx.lineWidth=2;ctx.shadowColor="#ff7a1e";ctx.shadowBlur=10;
    [[-30,-40,-10,-110],[15,-35,35,-130],[-5,-150,10,-190]].forEach(([x1,y1,x2,y2])=>{
      ctx.beginPath();ctx.moveTo(rx+x1*sc*0.5,ry+y1*sc*0.5);ctx.lineTo(rx+x2*sc*0.5,ry+y2*sc*0.5);ctx.stroke();
    });
    ctx.restore();
    ctx.restore();

    // Rock Wall shield visual
    if(this.rockWallActive){
      _rect(rx-70*sc,ry-190*sc,140*sc,190*sc,"rgba(74,50,32,0.75)","#8a6a4a",3);
      _text(rx,ry-210*sc,"🛡️ ROCK WALL 🛡️","#c9a878","10px Arial bold");
    }

    // Earth Core channel glow
    if(this.earthCoreCharging){
      const p=1-this.earthCoreTimer/120;
      ctx.save();ctx.globalAlpha=0.5+p*0.4;ctx.shadowColor="#ff7a1e";ctx.shadowBlur=30;
      ctx.strokeStyle="#ff7a1e";ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(rx,ry-100,40+p*60,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      _text(rx,ry-230*sc,"🌋 EARTH CORE CHARGING 🌋","orange","11px Arial bold");
    }

    // Phase 2 glow
    if(isP2){
      ctx.save();ctx.shadowColor="rgba(255,120,30,0.8)";ctx.shadowBlur=30;
      ctx.strokeStyle="rgba(255,120,30,0.6)";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(rx,ry-100,95,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }

    // HP bar — stays hidden while the intro cinematic is still revealing the boss
    if(!this._introHideHp){
      const hpLabel=isP2?"🪨 EARTH TITAN - PHASE 2":"🪨 EARTH TITAN";
      this._drawHpBar(rx,ry-40,hpLabel,isP2?"#ff7a1e":"#c68a4a",true);
    }
  }
  _drawBossEarthSkillEffects(){
    const rx=this.x,ry=this.y,baseY=this._floorY||ry;
    // Stone Spear — ground warnings then rising spikes
    this.stoneSpearWarnings.forEach(sw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(sw.timer*0.6)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(sw.x,baseY,26,10,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.stoneSpears.forEach(sp=>{
      const h=Math.min(1,(22-sp.life)/6)*120;
      ctx.save();ctx.fillStyle="#7a5a3a";ctx.strokeStyle="#2c1f10";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(sp.x-16,baseY);ctx.lineTo(sp.x,baseY-h);ctx.lineTo(sp.x+16,baseY);
      ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    });
    // Earth Smash — windup warning + expanding shockwave ring
    if(this.smashActive&&this.smashTimer>0) _text(rx,ry-220,"⚠️ EARTH SMASH ⚠️","orange","11px Arial bold");
    this.smashShockwaves.forEach(sw=>{
      ctx.save();ctx.globalAlpha=Math.max(0,sw.alpha);
      ctx.strokeStyle="#c9a878";ctx.lineWidth=6;ctx.shadowColor="#ff7a1e";ctx.shadowBlur=14;
      ctx.beginPath();ctx.ellipse(rx,baseY,sw.r,sw.r*0.35,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    });
    // Boulder Rain — warning circles then falling boulders
    this.boulderWarnings.forEach(bw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(bw.timer*0.5)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(bw.x,baseY,30,12,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.boulders.forEach(b=>{_oval(b.x-18,b.y-18,36,36,"#7a5a3a","#2c1f10",2);});
  }
  _drawHpBar(rx,ry,label,color,wide=false){
    this._hpLabel = label;
    this._hpColor = color;
    // Thanh máu thực tế sẽ được vẽ ở đầu màn hình (Minecraft style) trong hàm drawActiveBossBars
  }

  // ================================================================
  //  FLAME LORD (Boss 3) — drawing
  //  A tall, slender FIRE SORCERER: flowing flame-cloak, a magic staff
  //  topped with a burning crystal, embers and ash drifting off the
  //  whole body. Deliberately NOT the bulky rock-armored brawler shape
  //  used by the Earth Titan — nothing here reuses that silhouette.
  // ================================================================
  _drawBossFlame(){
    const rx=this.x,ry=this.y-this.hoverOffset,isP2=this.phase===2;
    this._drawBossFlameSkillEffects();

    // Heat-haze shimmer — faint wavy translucent bands rising near the body
    ctx.save();ctx.globalAlpha=0.14+0.05*Math.sin(this.anim*0.07);
    ctx.strokeStyle="#ff8800";ctx.lineWidth=2;
    for(let i=0;i<3;i++){
      const hy=ry-60-i*70;
      ctx.beginPath();
      for(let sx=-60;sx<=60;sx+=10){
        const wy=hy+Math.sin(this.anim*0.12+sx*0.08+i)*4;
        if(sx===-60)ctx.moveTo(rx+sx,wy);else ctx.lineTo(rx+sx,wy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Ambient embers + drifting ash orbiting the whole body — "Toàn thân tỏa ra hạt lửa và tro bụi"
    this.flameAura.forEach(a=>{
      const ox=rx+Math.cos(a.ang)*a.rad,oy=ry-110+Math.sin(a.ang)*a.rad*0.55+Math.sin(a.bob+this.anim*0.08)*5;
      ctx.save();
      if(a.type==="ash"){
        ctx.globalAlpha=0.5;ctx.fillStyle="#8a8378";
        ctx.beginPath();ctx.arc(ox,oy,a.size*0.8,0,Math.PI*2);ctx.fill();
      }else{
        ctx.globalAlpha=0.8;ctx.shadowColor="#ff5500";ctx.shadowBlur=10;
        ctx.fillStyle=Math.sin(a.ang*3+this.anim*0.1)>0?"#ff7700":"#ffcc33";
        ctx.beginPath();ctx.arc(ox,oy,a.size,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    });

    const sc=1.5; // TALL and slender — "Dáng người cao", never bulky like the Earth Titan
    const sway=Math.sin(this.robeSway)*5;
    const staffLift=this.staffRaiseTimer>0?Math.min(1,this.staffRaiseTimer/26):0;
    ctx.save();

    // ---- Flowing flame cloak — wide fluttering hem at the ground, tapering to
    // narrow shoulders. This IS the silhouette; there is no bulky torso block
    // underneath it. ----
    ctx.fillStyle=isP2?"#2a0e08":"#3a1810";
    ctx.strokeStyle="#150804";ctx.lineWidth=2.5;
    ctx.beginPath();
    ctx.moveTo(rx-14*sc,ry-205*sc);                                  // left shoulder
    ctx.quadraticCurveTo(rx-46*sc+sway,ry-130*sc,rx-58*sc+sway*1.4,ry-30);   // flare out
    ctx.quadraticCurveTo(rx-40*sc+sway*1.8,ry-6,rx-64*sc+sway*2.2,ry+4);     // fluttering hem
    ctx.quadraticCurveTo(rx-20*sc,ry-14,rx,ry+8);                    // center hem dip
    ctx.quadraticCurveTo(rx+20*sc,ry-14,rx+64*sc+sway*1.8,ry+4);
    ctx.quadraticCurveTo(rx+40*sc+sway*1.2,ry-6,rx+58*sc+sway,ry-30);
    ctx.quadraticCurveTo(rx+46*sc+sway*0.6,ry-130*sc,rx+14*sc,ry-205*sc);
    ctx.closePath();ctx.fill();ctx.stroke();

    // Inner flame-lit seam down the front of the cloak
    ctx.save();ctx.globalAlpha=0.55+Math.sin(this.anim*0.05)*0.25;
    ctx.strokeStyle="#ff5500";ctx.lineWidth=2;ctx.shadowColor="#ff3300";ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(rx,ry-195*sc);ctx.quadraticCurveTo(rx+6,ry-100*sc,rx,ry+4);ctx.stroke();
    ctx.restore();

    // Slim shoulders / collar of the flame cloak
    _oval(rx-24*sc,ry-215*sc,48*sc,22*sc,isP2?"#3a1810":"#4a2418","#150804",2);

    // Hood — a pointed sorcerer's hood rather than an exposed brawler head
    ctx.fillStyle=isP2?"#2a0e08":"#3a1810";
    ctx.beginPath();
    ctx.moveTo(rx-20*sc,ry-222*sc);
    ctx.quadraticCurveTo(rx,ry-268*sc,rx+20*sc,ry-222*sc);
    ctx.quadraticCurveTo(rx+16*sc,ry-198*sc,rx,ry-194*sc);
    ctx.quadraticCurveTo(rx-16*sc,ry-198*sc,rx-20*sc,ry-222*sc);
    ctx.closePath();ctx.fill();ctx.stroke();

    // Glowing eyes deep under the hood — the only visible part of the face
    ctx.save();ctx.shadowColor="#ffaa00";ctx.shadowBlur=16;
    _oval(rx-11*sc,ry-215*sc,8*sc,6*sc,"#ffcc33",null);
    _oval(rx+3*sc,ry-215*sc,8*sc,6*sc,"#ffcc33",null);
    ctx.restore();
    ctx.restore();

    // ---- Magic staff — held out to the side, raised skyward while casting ----
    const handX=rx+this.direction*44*sc,handY=ry-130*sc; // grip point at mid-body height, not up near the head
    const staffAngle=this.direction*(-1.25+staffLift*1.1); // held out to the side/mid-body at rest, swings upright ONLY while casting
    const staffLen=170*sc;
    const tipX=handX+Math.sin(staffAngle)*staffLen,tipY=handY-Math.cos(staffAngle)*staffLen;
    ctx.save();
    ctx.strokeStyle="#4a2c14";ctx.lineWidth=6*sc*0.55;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(tipX,tipY);ctx.stroke();
    ctx.strokeStyle="#6a4020";ctx.lineWidth=2.4;
    ctx.beginPath();ctx.moveTo(handX,handY);ctx.lineTo(tipX,tipY);ctx.stroke();
    ctx.restore();

    // Burning fire crystal on top of the staff — "Viên tinh thể lửa đang cháy"
    this._drawStaffCrystal(tipX,tipY,0.85+staffLift*0.5);

    // Sleeve-hem embers on the casting hand
    this._drawShoulderFlame(handX,handY+10*sc);

    // World of Flames channel glow
    if(this.worldFlameCharging){
      const p=1-this.worldFlameTimer/150;
      ctx.save();ctx.globalAlpha=0.5+p*0.4;ctx.shadowColor="#ff3300";ctx.shadowBlur=32;
      ctx.strokeStyle="#ff3300";ctx.lineWidth=4;
      ctx.beginPath();ctx.arc(rx,ry-120,40+p*80,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      _text(rx,ry-280*sc,"🔥 WORLD OF FLAMES CHARGING 🔥","orange","11px Arial bold");
    }

    // Phase 2 glow
    if(isP2){
      ctx.save();ctx.shadowColor="rgba(255,60,0,0.85)";ctx.shadowBlur=32;
      ctx.strokeStyle="rgba(255,60,0,0.65)";ctx.lineWidth=3;
      ctx.beginPath();ctx.arc(rx,ry-120,100,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }

    // HP bar — stays hidden while the intro cinematic is still revealing the boss
    if(!this._introHideHp){
      const hpLabel=isP2?"🔥 FLAME LORD - PHASE 2":"🔥 FLAME LORD";
      this._drawHpBar(rx,ry-40,hpLabel,isP2?"#ff3300":"#ff7700",true);
    }
  }
  _drawStaffCrystal(cx,cy,scale=1){
    // The always-burning crystal at the head of the staff — small flame
    // licking up out of a glowing gem, reused for the casting-hand ember too.
    const flick=Math.sin(this.anim*0.22+cx*0.3)*4*scale;
    ctx.save();ctx.shadowColor="#ffaa00";ctx.shadowBlur=18*scale;
    ctx.fillStyle="#ffdd66";
    ctx.beginPath();ctx.arc(cx,cy,9*scale,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#ff6600";ctx.lineWidth=1.6;ctx.stroke();
    ctx.restore();
    this._drawShoulderFlame(cx,cy-8*scale,scale);
  }
  _drawShoulderFlame(fx,fy,scale=1){
    // A small always-burning flame flicker — reused on the staff crystal and casting hand.
    const flick=Math.sin(this.anim*0.25+fx*0.3)*4*scale;
    ctx.save();ctx.shadowColor="#ff6600";ctx.shadowBlur=14*scale;
    ctx.fillStyle="#ffcc33";
    ctx.beginPath();
    ctx.moveTo(fx,fy+14*scale);
    ctx.quadraticCurveTo(fx-9*scale,fy-2*scale+flick,fx,fy-22*scale-flick);
    ctx.quadraticCurveTo(fx+9*scale,fy-2*scale+flick,fx,fy+14*scale);
    ctx.closePath();ctx.fill();
    ctx.fillStyle="#ff5500";ctx.globalAlpha=0.7;
    ctx.beginPath();
    ctx.moveTo(fx,fy+14*scale);
    ctx.quadraticCurveTo(fx-5*scale,fy+2*scale+flick*0.6,fx,fy-10*scale-flick*0.6);
    ctx.quadraticCurveTo(fx+5*scale,fy+2*scale+flick*0.6,fx,fy+14*scale);
    ctx.closePath();ctx.fill();
    ctx.restore();
  }
  _drawBossFlameSkillEffects(){
    const rx=this.x,ry=this.y-this.hoverOffset,baseY=this._floorY||ry;
    // Fire Tornado — a chasing spiral of flame
    this.fireTornadoes.forEach(t=>{
      ctx.save();ctx.globalAlpha=Math.min(1,t.life/40);ctx.shadowColor="#ff5500";ctx.shadowBlur=28;
      // Ground scorch glow at the base — makes the tornado read as bigger/heavier
      ctx.save();ctx.globalAlpha*=0.5;ctx.fillStyle="#ff6600";
      ctx.beginPath();ctx.ellipse(t.x,baseY,85,20,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      for(let i=0;i<4;i++){
        const rr=24+i*18,a2=t.ang+i*1.3;
        ctx.strokeStyle=i%2===0?"#ff7700":"#ffcc33";ctx.lineWidth=6-i*0.9;
        ctx.beginPath();
        for(let k=0;k<=18;k++){
          const kk=k/18,ang=a2+kk*Math.PI*3.4,rad=rr*(1-kk*0.55),px=t.x+Math.cos(ang)*rad,py=baseY-kk*150;
          if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
    // Fire Spirits — small floating flame wisps
    this.fireSpirits.forEach(s=>{
      ctx.save();ctx.shadowColor="#ff5500";ctx.shadowBlur=14;
      ctx.globalAlpha=Math.min(1,s.life/40);
      ctx.fillStyle="#ff7700";
      ctx.beginPath();ctx.arc(s.x,s.y,10,0,Math.PI*2);ctx.fill();
      ctx.fillStyle="#ffdd66";ctx.beginPath();ctx.arc(s.x,s.y-3,5,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    // Inferno Pillars — ground warnings then rising fire columns
    this.infernoPillarWarnings.forEach(fw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(fw.timer*0.6)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(fw.x,baseY,26,10,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.infernoPillars.forEach(fp=>{
      const h=Math.min(1,(26-fp.life)/6)*130;
      ctx.save();ctx.shadowColor="#ff5500";ctx.shadowBlur=16;
      const grad=ctx.createLinearGradient(fp.x,baseY,fp.x,baseY-h);
      grad.addColorStop(0,"#ffdd66");grad.addColorStop(1,"rgba(255,68,0,0)");
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.moveTo(fp.x-16,baseY);ctx.lineTo(fp.x,baseY-h);ctx.lineTo(fp.x+16,baseY);
      ctx.closePath();ctx.fill();ctx.restore();
    });
    // Meteor Storm — warning circles then falling meteors
    this.meteorWarnings.forEach(mw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(mw.timer*0.5)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(mw.x,baseY,30,12,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.meteorRocks.forEach(m=>{
      ctx.save();ctx.shadowColor="#ff5500";ctx.shadowBlur=14;
      _oval(m.x-18,m.y-18,36,36,"#ff6600","#7a1c00",2);
      ctx.restore();
    });
    // World of Flames — lava zones scattered across the arena, plus a full fire wash
    this.worldFlameLavaZones.forEach(z=>{
      ctx.save();ctx.globalAlpha=0.55+Math.sin(this.anim*0.08+z.x*0.01)*0.15;
      ctx.shadowColor="#ff3300";ctx.shadowBlur=14;
      ctx.fillStyle="#ff5500";
      ctx.beginPath();ctx.ellipse(z.x,baseY,z.r,z.r*0.32,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });
    if(this.worldFlameActive){
      const p=this.worldFlameTimer2/180;
      ctx.save();ctx.globalAlpha=0.3+p*0.3;
      const grad=ctx.createLinearGradient(0,baseY-260,0,baseY+20);
      grad.addColorStop(0,"rgba(255,120,0,0)");grad.addColorStop(0.7,"rgba(255,80,0,0.5)");grad.addColorStop(1,"rgba(255,40,0,0.8)");
      ctx.fillStyle=grad;
      ctx.fillRect(rx-2000,baseY-260,4000,280);
      ctx.restore();
    }
  }

  // ================================================================
  //  THE TEMPEST (Boss 5) — a slender, always-airborne wind entity.
  //  5 skills: Wind Blades / Tornado / Wind Dash / Air Prison / Ultimate
  //  "Eye of the Storm", plus a periodic Sky Fall outside the weighted
  //  pool (same recipe as the Abyssal's Darkness Vanish timer). The most
  //  mobile boss so far — it never stands still spamming skills.
  // ================================================================
  _updateBoss5(player,floorY,w){
    this._floorY=floorY;
    this.windSway=Math.sin(this.anim*0.05)*7;
    this.robeFlap=Math.sin(this.anim*0.09)*0.5+Math.sin(this.anim*0.15)*0.3;
    if(!this.skyFallActive)this.hoverYOffset=18+Math.sin(this.anim*0.04)*10;
    this.windWisps.forEach(ww=>ww.ang+=ww.spd);
    this.leafParticles.forEach(lp=>lp.ang+=lp.spd);

    // ======= PHASE 2 CHECK =======
    if(this.phase===1 && this.hp<=this.maxHp*0.35 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.3;this.phase2DmgMult=1.2;
      screenShake=Math.max(screenShake,25);
      this.skillTimer.s5=Math.min(this.skillTimer.s5,200);
    }
    const isP2=this.phase===2;

    // ======= SKY FALL — periodic, outside the weighted skill pool =======
    if(this.skyFallCd>0)this.skyFallCd--;
    if(!this.skyFallActive && this.skyFallCd<=0 && !this.windDashActive && !this.airPrisonActive && !this.eyeStormCharging){
      this.skyFallCd=isP2?440:580;
      this._bossTempestSkillSkyFall(player,w);
    }

    // While mid-dash, mid-prison, mid-skyfall, or mid-ultimate the boss
    // doesn't also drift/pick a new skill — one big thing at a time,
    // same rule the other bosses' special states already follow.
    const busy=this.windDashActive||this.airPrisonActive||this.skyFallActive||this.eyeStormCharging;

    if(!busy){
      // ======= AERIAL DRIFT — never settles, always repositioning =======
      const dx=player.x-this.x,distP=Math.abs(dx),spd=(isP2?3.6:2.8)*this.phase2SpeedMult,idealDist=230;
      if(distP>idealDist+80)this.x+=spd*(dx>0?1:-1);
      else if(distP<idealDist-90)this.x-=spd*0.6*(dx>0?1:-1);
      this.x=clamp(this.x,80,w-80);
      this.direction=dx>=0?1:-1;

      // ======= WEIGHTED AI SKILL DECISION (same pattern as the other bosses) =======
      const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
      const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
      const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
      const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
      const canUseS5=this.skillTimer.s5<=0 && isP2 && this.lastSkillUsed!=="s5";

      let weights={s1:28,s2:22,s3:26,s4:18,s5:14};
      if(distP>340)weights.s3=38; // far away -> favor Wind Dash to close the gap fast
      if(distP<180)weights.s2=32; // too close -> favor Tornado to push them back out
      if(isP2)weights.s5=24;

      let totalWeight=0;
      if(canUseS1)totalWeight+=weights.s1;
      if(canUseS2)totalWeight+=weights.s2;
      if(canUseS3)totalWeight+=weights.s3;
      if(canUseS4)totalWeight+=weights.s4;
      if(canUseS5)totalWeight+=weights.s5;

      let selectedSkill=null;
      if(totalWeight>0){
        let decision=rng()*totalWeight,acc=0;
        if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
        if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
        if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
        if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
        if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
      }

      if(selectedSkill==="s1")this._bossTempestSkillWindBlades(player,w);
      else if(selectedSkill==="s2")this._bossTempestSkillTornado(player,w);
      else if(selectedSkill==="s3")this._bossTempestSkillWindDash(player,w);
      else if(selectedSkill==="s4")this._bossTempestSkillAirPrison(player,w);
      else if(selectedSkill==="s5")this._bossTempestSkillEyeOfStorm(player,w);
    }

    // ======= ACTIVE SKILL UPDATES =======
    this._updateWindBlades(player,w);
    this._updateTornadoes(player,w);
    this._updateWindDash(player,floorY,w);
    this._updateAirPrison(player,w);
    this._updateSkyFall(player,w);
    this._updateEyeOfStorm(player,w);
  }

  // ===== SKILL 1: WIND BLADES — a few wind-slash projectiles, varied speed/lane/angle =====
  _bossTempestSkillWindBlades(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";
    const isP2=this.phase===2,count=isP2?5:3,dir=player.x>=this.x?1:-1;
    for(let i=0;i<count;i++){
      const laneY=this.y-100-i*22-rndInt(0,10);
      const spd=(2.6+rng()*2.2)*(isP2?1.2:1);
      this.windBlades.push({x:this.x+dir*20,y:laneY,vx:dir*spd,vy:Math.sin(i)*0.3,life:110,dmg:(isP2?9:7)*this.phase2DmgMult,hit:false});
    }
    sfxWindGust?.();
  }
  _updateWindBlades(player,w){
    _compact(this.windBlades,b=>{
      b.life--;b.x+=b.vx;b.y+=b.vy;
      if(!b.hit&&Math.abs(player.x-b.x)<26&&Math.abs((player.y-90)-b.y)<50&&player.hp>0){
        b.hit=true;applyDamage(player,b.dmg,this);
      }
      return b.life>0 && b.x>-300 && b.x<w+300;
    });
  }

  // ===== SKILL 2: TORNADO — telegraphed, drifts toward the player, pushes + ticks damage up close =====
  _bossTempestSkillTornado(player,w){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";
    this.tornadoWarnings.push({x:clamp(player.x,80,w-80),timer:45});
    sfxTornadoSwirl?.();
  }
  _updateTornadoes(player,w){
    _compact(this.tornadoWarnings,tw=>{
      tw.timer--;
      if(tw.timer<=0){
        this.tornadoes.push({x:tw.x,targetX:clamp(player.x,80,w-80),r:22,life:170,tick:0});
        screenShake=Math.max(screenShake,4);
        return false;
      }
      return true;
    });
    _compact(this.tornadoes,t=>{
      t.life--;t.tick++;
      const dx=t.targetX-t.x;
      if(Math.abs(dx)>3)t.x+=Math.sign(dx)*1.6;
      t.r=Math.min(46,t.r+0.15);
      const pd=Math.abs(player.x-t.x);
      if(pd<t.r+18&&player.hp>0){
        if(t.tick%18===0)applyDamage(player,(this.phase===2?7:5)*this.phase2DmgMult,this);
        const push=player.x>=t.x?1:-1;
        player.x=clamp(player.x+push*2.2,40,w-40);
        if(t.tick%40===0)player.vy=-6; // cuốn nhẹ lên
      }
      return t.life>0;
    });
  }

  // ===== SKILL 3: WIND DASH — boss becomes a streak of wind, crosses the arena, can turn once =====
  _bossTempestSkillWindDash(player,w){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";
    this.windDashActive=true;this.windDashTimer=60;this.windDashDir=player.x>=this.x?1:-1;
    this.windDashChanged=false;this.windDashSpd=this.phase===2?9:7;
    sfxWindDash?.();
  }
  _updateWindDash(player,floorY,w){
    if(!this.windDashActive){this._updateWindDashTrail(player,w);return;}
    this.windDashTimer--;
    this.windDashTrail.push({x:this.x,life:22});
    this.x+=this.windDashDir*this.windDashSpd;
    this.x=clamp(this.x,60,w-60);
    this.direction=this.windDashDir;
    // one direction change roughly at the midpoint of the dash
    if(!this.windDashChanged&&this.windDashTimer===30){
      this.windDashChanged=true;
      this.windDashDir=player.x>=this.x?1:-1;
      screenShake=Math.max(screenShake,4);
    }
    // damage the player if they're caught in the boss's path mid-dash
    if(Math.abs(player.x-this.x)<40&&player.hp>0&&this.anim%6===0){
      applyDamage(player,(this.phase===2?10:8)*this.phase2DmgMult,this);
    }
    if(this.windDashTimer<=0)this.windDashActive=false;
    this._updateWindDashTrail(player,w);
  }
  _updateWindDashTrail(player,w){
    _compact(this.windDashTrail,t=>{
      t.life--;
      if(t.life>10&&Math.abs(player.x-t.x)<26&&player.hp>0&&this.anim%14===0){
        applyDamage(player,(this.phase===2?4:3)*this.phase2DmgMult,this);
      }
      return t.life>0;
    });
  }

  // ===== SKILL 4: AIR PRISON — wind cage heavily slows the player, then bursts outward =====
  _bossTempestSkillAirPrison(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";
    this.airPrisonActive=true;this.airPrisonTimer=80;this.airPrisonX=player.x;this.airPrisonY=player.y;
    sfxWindGust?.();
  }
  _updateAirPrison(player,w){
    if(!this.airPrisonActive)return;
    this.airPrisonTimer--;
    if(this.airPrisonTimer>70){this.airPrisonX=player.x;this.airPrisonY=player.y;}
    // heavy slow, not a hard stun — the player can still jump/dodge, per spec
    if(Math.abs(player.x-this.airPrisonX)<70&&player.hp>0){
      player.slowTimer=Math.max(player.slowTimer||0,6);
      player._slowPct=Math.max(player._slowPct||0,0.8);
    }
    if(this.airPrisonTimer<=0){
      this.airPrisonActive=false;
      screenShake=Math.max(screenShake,10);
      sfxWindGust?.();
      if(Math.abs(player.x-this.airPrisonX)<90&&player.hp>0){
        applyDamage(player,(this.phase===2?12:9)*this.phase2DmgMult,this);
        const push=player.x>=this.airPrisonX?1:-1;
        player.x=clamp(player.x+push*140,40,w-40);
        player.vy=-6;
      }
    }
  }

  // ===== SPECIAL: SKY FALL — boss climbs, telegraphs a landing zone, then slams down =====
  _bossTempestSkillSkyFall(player,w){
    this.skyFallActive=true;this.skyFallPhase="RISE";this.skyFallTimer=45;
    this.skyFallWarnings=[{x:clamp(player.x,80,w-80),r:0,maxR:95}];
    sfxWindGust?.();
  }
  _updateSkyFall(player,w){
    if(!this.skyFallActive)return;
    if(this.skyFallPhase==="RISE"){
      this.skyFallTimer--;
      this.hoverYOffset=Math.min(260,this.hoverYOffset+7);
      this.skyFallWarnings.forEach(sw=>sw.r=Math.min(sw.maxR,sw.r+2.2));
      if(this.skyFallTimer<=0){this.skyFallPhase="FALL";this.skyFallTimer=10;this.x=this.skyFallWarnings[0].x;}
    }else if(this.skyFallPhase==="FALL"){
      this.skyFallTimer--;
      this.hoverYOffset=Math.max(0,this.hoverYOffset-32);
      if(this.skyFallTimer<=0){
        this.skyFallActive=false;this.hoverYOffset=0;
        screenShake=Math.max(screenShake,20);sfxSkyFallImpact?.();
        const sw=this.skyFallWarnings[0];
        // "Không gây sát thương nếu người chơi né đúng" — only the telegraphed circle hurts.
        if(sw&&Math.abs(player.x-sw.x)<sw.maxR&&player.hp>0){
          applyDamage(player,(this.phase===2?20:15)*this.phase2DmgMult,this);
          const push=player.x>=sw.x?1:-1;player.x=clamp(player.x+push*170,40,w-40);player.vy=-8;
        }
        this.skyFallWarnings=[];
      }
    }
  }

  // ===== ULTIMATE: EYE OF THE STORM — arena-wide storm; boss flickers while tornadoes + blades sweep =====
  _bossTempestSkillEyeOfStorm(player,w){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";
    this.eyeStormCharging=true;this.eyeStormTimer=280;this.eyeStormTick=0;
    sfxStormRoar?.();
  }
  _updateEyeOfStorm(player,w){
    if(!this.eyeStormCharging)return;
    this.eyeStormTimer--;this.eyeStormTick++;
    // the boss keeps zipping to a new spot — "Boss liên tục bay quanh arena"
    if(this.eyeStormTick%50===0){
      this.x=clamp(this.x+rndChoice([-1,1])*rndInt(160,300),90,w-90);
    }
    // "Xuất hiện các lốc nhỏ" — a wandering mini-tornado telegraph
    if(this.eyeStormTick%55===0){
      this.tornadoWarnings.push({x:clamp(rndInt(80,w-80),80,w-80),timer:35});
    }
    // "Các lưỡi gió bay qua" — a wind blade sweeping toward wherever the player currently is
    if(this.eyeStormTick%28===0){
      const dir=player.x>=this.x?1:-1;
      this.windBlades.push({x:this.x,y:this.y-120-rndInt(0,20),vx:dir*4.4,vy:0,life:110,dmg:6*this.phase2DmgMult,hit:false});
    }
    if(this.eyeStormTimer<=0){
      this.eyeStormCharging=false;
      screenShake=Math.max(screenShake,40);sfxStormBurst?.();
      const radius=this.phase===2?480:400,dmg=(this.phase===2?34:26)*this.phase2DmgMult;
      if(Math.abs(player.x-this.x)<radius&&player.hp>0){
        applyDamage(player,dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*210,40,w-40);player.vy=-9;
      }
    }
  }

  // ================================================================
  //  THE TEMPEST (Boss 5) — drawing.
  //  A slender wind humanoid: flowing translucent cloth streamers, wind
  //  currents swirling around the body, hair/cloth always wind-blown,
  //  pale blue/white glowing eyes. Deliberately NOT the bulky armored
  //  brawler shape used by Earth Titan/Frost King — light, airy, never
  //  fully planted on the ground.
  // ================================================================
  _drawBoss5(){
    const rx=this.x,ry=this.y-this.hoverYOffset,isP2=this.phase===2;
    if(this.dead){
      for(let i=0;i<10;i++){const ex=rx+rndInt(-80,80),ey=ry+rndInt(-90,10);_oval(ex-10,ey-10,20,20,rndChoice(["#eaffff","#bfe9ff","#ffffff"]),null);}
      _text(rx,ry-80,"💀 DEFEATED 💀","#bfe9ff","16px Arial bold");
      return;
    }
    const sz=isP2?1.15:1.0;

    this._drawBoss5SkillEffects();

    // ---- ambient wind wisps orbiting the body ----
    this.windWisps.forEach(ww=>{
      const ox=rx+Math.cos(ww.ang)*ww.rad,oy=ry-95+Math.sin(ww.ang)*ww.rad*0.4+Math.sin(this.anim*0.05+ww.bob)*4;
      ctx.globalAlpha=0.5;ctx.strokeStyle=isP2?"#eaffff":"#bfe9ff";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(ox,oy,ww.size*2.4,ww.ang,ww.ang+1.6);ctx.stroke();ctx.globalAlpha=1;
    });
    // ---- drifting dust / leaf particles ----
    this.leafParticles.forEach(lp=>{
      const ox=rx+Math.cos(lp.ang)*lp.rad,oy=ry-70+Math.sin(lp.ang)*lp.rad*0.35;
      ctx.globalAlpha=0.5;ctx.fillStyle=lp.type==="leaf"?"#bfe08a":"#e8e8e8";
      ctx.beginPath();ctx.arc(ox,oy,lp.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    });

    // ---- body: slender, cloth constantly billowing, no armor/weapon ----
    ctx.save();
    const sway=this.windSway;

    // trailing wind-cloth streamers behind the body
    ctx.fillStyle=isP2?"rgba(210,240,255,0.55)":"rgba(190,225,245,0.45)";
    ctx.beginPath();
    ctx.moveTo(rx-16*sz,ry-150*sz);
    ctx.quadraticCurveTo(rx-70*sz+sway,ry-90*sz,rx-40*sz+sway*1.6,ry-8);
    ctx.quadraticCurveTo(rx-20*sz+sway*0.8,ry-40*sz,rx-8*sz,ry-60*sz);
    ctx.closePath();ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rx+16*sz,ry-150*sz);
    ctx.quadraticCurveTo(rx+70*sz-sway,ry-90*sz,rx+40*sz-sway*1.6,ry-8);
    ctx.quadraticCurveTo(rx+20*sz-sway*0.8,ry-40*sz,rx+8*sz,ry-60*sz);
    ctx.closePath();ctx.fill();

    // slender torso — light, airy silhouette
    ctx.fillStyle=isP2?"#eaf6ff":"#dcedf7";ctx.strokeStyle="#9fd0e8";ctx.lineWidth=2;
    ctx.beginPath();
    ctx.moveTo(rx-14*sz,ry-30);ctx.lineTo(rx-16*sz,ry-140*sz);ctx.lineTo(rx-7*sz,ry-168*sz);
    ctx.lineTo(rx+7*sz,ry-168*sz);ctx.lineTo(rx+16*sz,ry-140*sz);ctx.lineTo(rx+14*sz,ry-30);
    ctx.closePath();ctx.fill();ctx.stroke();

    // thin flowing limbs, always mid-motion
    ctx.strokeStyle=isP2?"#eaf6ff":"#dcedf7";ctx.lineWidth=6*sz;ctx.lineCap="round";
    const armSwing=Math.sin(this.anim*0.07)*10;
    ctx.beginPath();ctx.moveTo(rx-14*sz,ry-135*sz);ctx.quadraticCurveTo(rx-42*sz+armSwing,ry-100*sz,rx-30*sz+armSwing,ry-40);ctx.stroke();
    ctx.beginPath();ctx.moveTo(rx+14*sz,ry-135*sz);ctx.quadraticCurveTo(rx+42*sz-armSwing,ry-100*sz,rx+30*sz-armSwing,ry-40);ctx.stroke();

    // hair / headscarf, always wind-blown
    const hx=rx+6*this.direction;
    ctx.fillStyle=isP2?"#eaf6ff":"#dcedf7";
    ctx.beginPath();ctx.ellipse(hx,ry-186*sz,16*sz,20*sz,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.strokeStyle=isP2?"#eaffff":"#cfe8f5";ctx.lineWidth=3;
    for(let i=0;i<3;i++){
      ctx.beginPath();ctx.moveTo(hx-6+i*6,ry-198*sz);
      ctx.quadraticCurveTo(hx-30+i*10-sway,ry-190*sz,hx-46+i*14-sway*1.4,ry-176*sz);
      ctx.stroke();
    }

    // glowing eyes — pale blue/white, never black
    const eyePulse=0.7+Math.sin(this.anim*0.09)*0.3;
    ctx.save();ctx.shadowColor=isP2?"#ffffff":"#bfe9ff";ctx.shadowBlur=14*eyePulse;
    ctx.fillStyle=isP2?"#ffffff":"#eaffff";
    ctx.beginPath();ctx.ellipse(hx+2*this.direction,ry-186*sz,5*sz*eyePulse,3*sz*eyePulse,0,0,Math.PI*2);ctx.fill();
    ctx.restore();

    ctx.restore();

    // ---- small wind currents swirling right around the body ----
    for(let i=0;i<4;i++){
      const t=(this.anim*0.03+i*1.6)%(Math.PI*2),pr=26+Math.sin(t*2)*16;
      const px=rx+Math.cos(t)*pr,py=ry-100+Math.sin(t)*pr*0.5;
      ctx.globalAlpha=0.55;ctx.strokeStyle="#eaffff";ctx.lineWidth=1.2;
      ctx.beginPath();ctx.arc(px,py,4,t,t+1.4);ctx.stroke();ctx.globalAlpha=1;
    }

    if(!this._introHideHp){
      const hpLabel=isP2?"🌪️ THE TEMPEST - PHASE 2":"🌪️ THE TEMPEST";
      this._drawHpBar(rx,ry-40,hpLabel,isP2?"#ffffff":"#7ec8e3",true);
    }
  }
  _drawBoss5SkillEffects(){
    const rx=this.x,ry=this.y-this.hoverYOffset,baseY=this._floorY||this.y;

    // Wind Blades — small crescent slashes
    this.windBlades.forEach(b=>{
      ctx.save();ctx.strokeStyle="#eaffff";ctx.lineWidth=2.5;ctx.globalAlpha=Math.min(1,b.life/40);
      ctx.beginPath();ctx.arc(b.x,b.y,10,0.3,2.6);ctx.stroke();
      ctx.restore();
    });

    // Tornado telegraphs + active tornadoes
    this.tornadoWarnings.forEach(tw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(tw.timer*0.6)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(tw.x,baseY,32,12,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.tornadoes.forEach(t=>{
      ctx.save();ctx.strokeStyle="#cfe8f5";ctx.lineWidth=3;
      for(let i=0;i<3;i++){
        const yy=baseY-i*22,rr=t.r*(1-i*0.18);
        ctx.globalAlpha=0.55-i*0.12;
        ctx.beginPath();ctx.ellipse(t.x,yy,rr,rr*0.4,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
    });

    // Wind Dash trail
    this.windDashTrail.forEach(t=>{
      ctx.globalAlpha=Math.max(0,t.life/22)*0.6;
      ctx.strokeStyle="#eaffff";ctx.lineWidth=6;
      ctx.beginPath();ctx.moveTo(t.x,baseY-10);ctx.lineTo(t.x,baseY-160);ctx.stroke();
      ctx.globalAlpha=1;
    });
    if(this.windDashActive)_text(rx,ry-220,"💨 WIND DASH 💨","#bfe9ff","11px Arial bold");

    // Air Prison cage
    if(this.airPrisonActive){
      const a=Math.min(1,(80-this.airPrisonTimer)/14);
      ctx.save();ctx.globalAlpha=0.55*a;ctx.strokeStyle="#eaffff";ctx.lineWidth=2;
      for(let i=0;i<3;i++){
        ctx.beginPath();ctx.ellipse(this.airPrisonX,baseY-40-i*22,34+i*8,60,0,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();
      _text(this.airPrisonX,baseY-140,"🌀 AIR PRISON 🌀","#bfe9ff","11px Arial bold");
    }

    // Sky Fall telegraph + rising warning text
    this.skyFallWarnings.forEach(sw=>{
      ctx.save();ctx.globalAlpha=0.55;ctx.strokeStyle="red";ctx.lineWidth=3;ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.ellipse(sw.x,baseY,sw.r,sw.r*0.4,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    if(this.skyFallActive&&this.skyFallPhase==="RISE")_text(rx,20,"⚠️ SKY FALL ⚠️","orange","13px Arial bold");

    // Eye of the Storm — true full-screen storm tint (uses the live camera/viewport,
    // not a fixed box anchored to the boss) + sweeping wind-streaks for motion.
    if(this.eyeStormCharging){
      ctx.save();
      const gx0=campX-30,gx1=campX+W+30;
      const grad=ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,"rgba(180,220,240,0.10)");
      grad.addColorStop(0.55,"rgba(180,220,240,0.22)");
      grad.addColorStop(1,"rgba(150,200,225,0.32)");
      ctx.fillStyle=grad;
      ctx.fillRect(gx0,-30,gx1-gx0,H+60);
      ctx.globalAlpha=0.22;ctx.strokeStyle="#eaffff";ctx.lineWidth=2;
      for(let i=0;i<5;i++){
        const yy=H*0.2+i*H*0.15;
        ctx.beginPath();
        for(let sx=gx0;sx<=gx1;sx+=22){
          const wy=yy+Math.sin(this.anim*0.07+sx*0.03+i*1.2)*6;
          if(sx===gx0)ctx.moveTo(sx,wy);else ctx.lineTo(sx,wy);
        }
        ctx.stroke();
      }
      ctx.restore();
      _text(rx,ry-230,"🌪️ EYE OF THE STORM 🌪️","#eaffff","14px Arial bold");
    }
  }

  // ================================================================
  //  THE TIDAL (Boss 6) — an ancient geometric Water God, always grounded
  //  but occasionally water-slides short distances. 7 skills + one
  //  ultimate: Water Spear / Tidal Wave / Water Whirl / Water Prison /
  //  Rising Tide / Trident Rush / Maelstrom / Ocean's Judgment. Entirely
  //  area-control and positioning-based — never a blade brawler, never
  //  a summoner, never a teleport-trickster. Phase 2 triggers at 50% HP
  //  (per spec, unlike the other bosses' 35%).
  // ================================================================
  _updateBossTidal(player,floorY,w){
    this._floorY=floorY;
    this.bodySway=Math.sin(this.anim*0.04)*4;
    this.hoverBob=Math.sin(this.anim*0.05)*3;
    this.waterAura.forEach(wa=>wa.ang+=wa.spd);
    if(this.tridentRaiseTimer>0)this.tridentRaiseTimer--;

    // ======= PHASE 2 CHECK (50% HP, per spec) =======
    if(this.phase===1 && this.hp<=this.maxHp*0.5 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.15;this.phase2DmgMult=1.15;
      screenShake=Math.max(screenShake,28);
      this.skillTimer.s8=Math.min(this.skillTimer.s8,240);
    }
    const isP2=this.phase===2;

    // one big thing at a time — mirrors the other bosses' "busy" rule
    const busy=this.waterPrisonActive||this.tridentRushActive||this.maelstromActive||this.oceanJudgmentCharging;

    if(!busy){
      // ======= GROUND MOVEMENT — normal walk, occasionally water-slides via Trident Rush =======
      const dx=player.x-this.x,distP=Math.abs(dx),spd=(isP2?2.2:1.7)*this.phase2SpeedMult,idealDist=200;
      if(distP>idealDist+70)this.x+=spd*(dx>0?1:-1);
      else if(distP<idealDist-80)this.x-=spd*0.5*(dx>0?1:-1);
      this.x=clamp(this.x,80,w-80);
      this.direction=dx>=0?1:-1;

      // ======= WEIGHTED AI SKILL DECISION (same recipe as the other bosses) =======
      const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
      const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
      const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
      const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
      const canUseS5=this.skillTimer.s5<=0 && this.lastSkillUsed!=="s5";
      const canUseS6=this.skillTimer.s6<=0 && this.lastSkillUsed!=="s6";
      const canUseS7=this.skillTimer.s7<=0 && this.lastSkillUsed!=="s7";
      const canUseS8=this.skillTimer.s8<=0 && isP2 && this.lastSkillUsed!=="s8";

      let weights={s1:22,s2:16,s3:14,s4:10,s5:12,s6:14,s7:10,s8:10};
      if(distP>320)weights.s6=30; // far away -> Trident Rush to close the gap fast
      if(distP<150)weights.s2=26; // too close -> Tidal Wave to push them back out
      if(isP2){weights.s8=20;weights.s3+=6;weights.s7+=6;}

      let totalWeight=0;
      if(canUseS1)totalWeight+=weights.s1;
      if(canUseS2)totalWeight+=weights.s2;
      if(canUseS3)totalWeight+=weights.s3;
      if(canUseS4)totalWeight+=weights.s4;
      if(canUseS5)totalWeight+=weights.s5;
      if(canUseS6)totalWeight+=weights.s6;
      if(canUseS7)totalWeight+=weights.s7;
      if(canUseS8)totalWeight+=weights.s8;

      let selectedSkill=null;
      if(totalWeight>0){
        let decision=rng()*totalWeight,acc=0;
        if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
        if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
        if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
        if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
        if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
        if(!selectedSkill&&canUseS6){acc+=weights.s6;if(decision<acc)selectedSkill="s6";}
        if(!selectedSkill&&canUseS7){acc+=weights.s7;if(decision<acc)selectedSkill="s7";}
        if(!selectedSkill&&canUseS8){acc+=weights.s8;if(decision<acc)selectedSkill="s8";}
      }

      if(selectedSkill==="s1")this._bossTidalSkillWaterSpear(player,w);
      else if(selectedSkill==="s2")this._bossTidalSkillTidalWave(player,w);
      else if(selectedSkill==="s3")this._bossTidalSkillWaterWhirl(player,w);
      else if(selectedSkill==="s4")this._bossTidalSkillWaterPrison(player,w);
      else if(selectedSkill==="s5")this._bossTidalSkillRisingTide(player,w);
      else if(selectedSkill==="s6")this._bossTidalSkillTridentRush(player,w);
      else if(selectedSkill==="s7")this._bossTidalSkillMaelstrom(player,w);
      else if(selectedSkill==="s8")this._bossTidalSkillOceanJudgment(player,w);
    }

    // ======= ACTIVE SKILL UPDATES =======
    this._updateWaterSpears(player,w);
    this._updateTidalWaves(player,w);
    this._updateWaterWhirls(player,w);
    this._updateWaterPrison(player,w);
    this._updateRisingTide(player,w);
    this._updateTridentRush(player,floorY,w);
    this._updateMaelstrom(player,w);
    this._updateOceanJudgment(player,w);
  }

  // ===== SKILL 1: WATER SPEAR — a telegraphed volley of water-spear projectiles =====
  _bossTidalSkillWaterSpear(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";this.tridentRaiseTimer=18;
    const isP2=this.phase===2,count=isP2?5:rndChoice([3,3,5]),dir=player.x>=this.x?1:-1;
    for(let i=0;i<count;i++){
      const laneY=this.y-95-i*16-rndInt(0,8);
      const spd=(3.0+rng()*1.6)*(isP2?1.15:1);
      this.waterSpears.push({x:this.x+dir*22,y:laneY,vx:dir*spd,vy:0,life:110,dmg:(isP2?9:7)*this.phase2DmgMult,hit:false});
    }
    sfxTridentThrust?.();
  }
  _updateWaterSpears(player,w){
    _compact(this.waterSpears,sp=>{
      sp.life--;sp.x+=sp.vx;sp.y+=sp.vy;
      if(!sp.hit&&Math.abs(player.x-sp.x)<24&&Math.abs((player.y-90)-sp.y)<48&&player.hp>0){
        sp.hit=true;applyDamage(player,sp.dmg,this);
      }
      return sp.life>0 && sp.x>-300 && sp.x<w+300;
    });
  }

  // ===== SKILL 2: TIDAL WAVE — boss slams the trident down, a geometric wave rolls forward =====
  _bossTidalSkillTidalWave(player,w){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";this.tridentRaiseTimer=14;
    const dir=player.x>=this.x?1:-1;
    this.tidalWaves.push({x:this.x,dir,h:0,life:150,dmg:(this.phase===2?14:11)*this.phase2DmgMult,hitTimer:0});
    screenShake=Math.max(screenShake,6);sfxWaveCrash?.();
  }
  _updateTidalWaves(player,w){
    _compact(this.tidalWaves,t=>{
      t.life--;t.h=Math.min(1,t.h+0.05);
      t.x+=t.dir*(this.phase===2?4.6:3.6);
      if(t.hitTimer>0)t.hitTimer--;
      // "Người chơi có thể né bằng cách: Nhảy" — only hits while grounded near the wave
      if(t.hitTimer<=0 && Math.abs(player.x-t.x)<46 && player.y>=(this._floorY-60) && player.hp>0){
        applyDamage(player,t.dmg,this);
        const push=player.x>=t.x?1:-1;player.x=clamp(player.x+push*90,40,w-40);
        t.hitTimer=40;
      }
      return t.life>0 && t.x>-200 && t.x<w+200;
    });
  }

  // ===== SKILL 3: WATER WHIRL — a whirlpool drifts on the arena, pulls + ticks damage up close =====
  _bossTidalSkillWaterWhirl(player,w){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";
    this.waterWhirls.push({x:clamp(player.x+rndInt(-40,40),100,w-100),r:24,life:220,tick:0});
    sfxWhirlpoolSwirl?.();
  }
  _updateWaterWhirls(player,w){
    _compact(this.waterWhirls,wh=>{
      wh.life--;wh.tick++;
      wh.r=Math.min(50,wh.r+0.1);
      const pd=Math.abs(player.x-wh.x);
      if(pd<160 && player.hp>0){
        const pull=player.x>=wh.x?-1:1;
        player.x=clamp(player.x+pull*1.1,40,w-40);
      }
      if(pd<wh.r+16 && player.hp>0){
        if(wh.tick%22===0)applyDamage(player,(this.phase===2?7:5)*this.phase2DmgMult,this);
        if(wh.tick%60===0){const push=player.x>=wh.x?1:-1;player.x=clamp(player.x+push*80,40,w-40);}
      }
      return wh.life>0;
    });
  }

  // ===== SKILL 4: WATER PRISON — geometric water pillars cage the player briefly, then burst =====
  _bossTidalSkillWaterPrison(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";this.tridentRaiseTimer=16;
    this.waterPrisonActive=true;this.waterPrisonTimer=75;this.waterPrisonX=player.x;this.waterPrisonY=player.y;
    sfxWaterSurge?.();
  }
  _updateWaterPrison(player,w){
    if(!this.waterPrisonActive)return;
    this.waterPrisonTimer--;
    if(this.waterPrisonTimer>65){this.waterPrisonX=player.x;this.waterPrisonY=player.y;}
    // heavy slow, not a hard stun — "Không khóa người chơi quá lâu"
    if(Math.abs(player.x-this.waterPrisonX)<60&&player.hp>0){
      player.slowTimer=Math.max(player.slowTimer||0,6);
      player._slowPct=Math.max(player._slowPct||0,0.75);
    }
    if(this.waterPrisonTimer<=0){
      this.waterPrisonActive=false;
      screenShake=Math.max(screenShake,8);sfxWaveCrash?.();
      // "Sau đó lồng nước vỡ ra và gây một đợt sóng nhỏ"
      if(Math.abs(player.x-this.waterPrisonX)<80&&player.hp>0){
        applyDamage(player,(this.phase===2?10:7)*this.phase2DmgMult,this);
        const push=player.x>=this.waterPrisonX?1:-1;player.x=clamp(player.x+push*110,40,w-40);
      }
    }
  }

  // ===== SKILL 5: RISING TIDE — telegraphed water columns erupt from random ground spots =====
  _bossTidalSkillRisingTide(player,w){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";
    const count=this.phase===2?6:4;
    for(let i=0;i<count;i++){
      this.risingTideWarnings.push({x:clamp(rndInt(80,w-80),80,w-80),timer:40+i*8});
    }
    sfxWaterSurge?.();
  }
  _updateRisingTide(player,w){
    _compact(this.risingTideWarnings,rw=>{
      rw.timer--;
      if(rw.timer<=0){
        this.risingTideColumns.push({x:rw.x,h:0,life:60,hitTimer:0});
        return false;
      }
      return true;
    });
    _compact(this.risingTideColumns,c=>{
      c.life--;c.h=Math.min(1,c.h+0.12);
      if(c.hitTimer>0)c.hitTimer--;
      if(c.h>0.5&&c.hitTimer<=0&&Math.abs(player.x-c.x)<30&&player.hp>0){
        applyDamage(player,(this.phase===2?11:8)*this.phase2DmgMult,this);
        c.hitTimer=30;
      }
      return c.life>0;
    });
  }

  // ===== SKILL 6: TRIDENT RUSH — boss water-slides at the player 1-2x, then spins a small water ring =====
  _bossTidalSkillTridentRush(player,w){
    this.skillTimer.s6=this.skillCd.s6;this.lastSkillUsed="s6";
    this.tridentRushActive=true;this.tridentRushTimer=42;this.tridentRushDir=player.x>=this.x?1:-1;
    this.tridentRushCount=0;this.tridentRushMax=this.phase===2?3:2;
    sfxTridentThrust?.();
  }
  _updateTridentRush(player,floorY,w){
    if(!this.tridentRushActive){this._updateTridentRushTrail(player,w);return;}
    this.tridentRushTimer--;
    this.tridentRushTrail.push({x:this.x,life:20});
    this.x+=this.tridentRushDir*(this.phase===2?7.5:6);
    this.x=clamp(this.x,60,w-60);
    this.direction=this.tridentRushDir;
    if(Math.abs(player.x-this.x)<38&&player.hp>0&&this.anim%6===0){
      applyDamage(player,(this.phase===2?10:8)*this.phase2DmgMult,this);
    }
    if(this.tridentRushTimer<=0){
      this.tridentRushCount++;
      if(this.tridentRushCount<this.tridentRushMax){
        this.tridentRushTimer=42;this.tridentRushDir=player.x>=this.x?1:-1;
      }else{
        this.tridentRushActive=false;
        // "Boss xoay đinh ba và tạo một vòng nước nhỏ xung quanh"
        this.waterWhirls.push({x:this.x,r:18,life:40,tick:0});
        screenShake=Math.max(screenShake,5);
      }
    }
    this._updateTridentRushTrail(player,w);
  }
  _updateTridentRushTrail(player,w){
    _compact(this.tridentRushTrail,t=>{
      t.life--;
      if(t.life>8&&Math.abs(player.x-t.x)<24&&player.hp>0&&this.anim%14===0){
        applyDamage(player,(this.phase===2?4:3)*this.phase2DmgMult,this);
      }
      return t.life>0;
    });
  }

  // ===== SKILL 7: MAELSTROM — a large whirlpool anchors on the arena and pressures the player over time =====
  _bossTidalSkillMaelstrom(player,w){
    this.skillTimer.s7=this.skillCd.s7;this.lastSkillUsed="s7";
    this.maelstromActive=true;this.maelstromTimer=200;this.maelstromX=clamp(player.x,110,w-110);
    sfxWhirlpoolSwirl?.();
  }
  _updateMaelstrom(player,w){
    if(!this.maelstromActive)return;
    this.maelstromTimer--;
    if(Math.abs(player.x-this.maelstromX)<220&&player.hp>0){
      const pull=player.x>=this.maelstromX?-1:1;
      player.x=clamp(player.x+pull*1.4,40,w-40);
    }
    if(this.maelstromTimer%40===0&&Math.abs(player.x-this.maelstromX)<90&&player.hp>0){
      applyDamage(player,(this.phase===2?8:6)*this.phase2DmgMult,this);
    }
    if(this.maelstromTimer<=0){this.maelstromActive=false;}
  }

  // ===== ULTIMATE: OCEAN'S JUDGMENT — channel center-arena; waves + rising columns sweep the arena =====
  _bossTidalSkillOceanJudgment(player,w){
    this.skillTimer.s8=this.skillCd.s8;this.lastSkillUsed="s8";
    this.oceanJudgmentCharging=true;this.oceanJudgmentTimer=300;this.oceanJudgmentTick=0;
    this.x=clamp((this.x+player.x)/2,w*0.35,w*0.65);
    sfxTidalRoar?.();
  }
  _updateOceanJudgment(player,w){
    if(!this.oceanJudgmentCharging)return;
    this.oceanJudgmentTimer--;this.oceanJudgmentTick++;
    if(this.oceanJudgmentTick%36===0){
      this.risingTideWarnings.push({x:clamp(rndInt(80,w-80),80,w-80),timer:30});
    }
    if(this.oceanJudgmentTick%50===0){
      const dir=player.x>=this.x?1:-1;
      this.tidalWaves.push({x:this.x,dir,h:0,life:130,dmg:9*this.phase2DmgMult,hitTimer:0});
    }
    if(this.oceanJudgmentTimer<=0){
      this.oceanJudgmentCharging=false;
      screenShake=Math.max(screenShake,42);sfxOceanBurst?.();
      // "Boss đập đinh ba xuống. Một cột nước khổng lồ phóng thẳng lên."
      const radius=460,dmg=(this.phase===2?32:26)*this.phase2DmgMult;
      if(Math.abs(player.x-this.x)<radius&&player.hp>0){
        applyDamage(player,dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*200,40,w-40);
      }
    }
  }

  // ================================================================
  //  THE TIDAL (Boss 6) — drawing.
  //  Built entirely from flat geometric blocks: stacked cyan/blue
  //  torso plates, cube shoulders, segmented rectangular limbs, a
  //  crowned cube head with glowing eyes, and a glowing geometric
  //  trident. Deliberately NOT a smooth humanoid/mermaid silhouette —
  //  every part reads as an assembled polygon shape.
  // ================================================================
  _drawBossTidal(){
    const rx=this.x,ry=this.y-this.hoverBob,isP2=this.phase===2;
    if(this.dead){
      for(let i=0;i<10;i++){const ex=rx+rndInt(-80,80),ey=ry+rndInt(-90,10);_oval(ex-9,ey-9,18,18,rndChoice(["#66e0ff","#1a8fc4","#eafcff"]),null);}
      _text(rx,ry-80,"💀 DEFEATED 💀","#66e0ff","16px Arial bold");
      return;
    }
    const sz=isP2?1.1:1.0,dir=this.direction;

    this._drawBossTidalSkillEffects();

    // ---- orbiting geometric water cubes/droplets ----
    this.waterAura.forEach(wa=>{
      const ox=rx+Math.cos(wa.ang)*wa.rad,oy=ry-95+Math.sin(wa.ang)*wa.rad*0.4+Math.sin(this.anim*0.05+wa.bob)*3;
      ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle=isP2?"#aef2ff":"#5fd0f0";
      if(wa.type==="cube"){ctx.translate(ox,oy);ctx.rotate(this.anim*0.03+wa.bob);ctx.fillRect(-wa.size,-wa.size,wa.size*2,wa.size*2);}
      else{ctx.beginPath();ctx.arc(ox,oy,wa.size,0,Math.PI*2);ctx.fill();}
      ctx.restore();
    });

    const sway=this.bodySway;

    // ---- legs: two rectangular geometric blocks ----
    _rect(rx-22*sz,ry-34,16*sz,34,isP2?"#0c6f92":"#136f92","#aef2ff",2);
    _rect(rx+6*sz,ry-34,16*sz,34,isP2?"#0c6f92":"#136f92","#aef2ff",2);

    // ---- torso: tiered geometric plates, alternating shades, slight sway ----
    const plateCols=isP2?["#0e7ea8","#1590bd","#1ea8d8"]:["#136f92","#1590bd","#1ea8d8"];
    const plates=[[-26,-64,52,32],[-22,-92,44,30],[-17,-118,34,28]];
    plates.forEach(([px,py,pw,ph],i)=>{
      ctx.save();
      ctx.translate(sway*(i*0.4),0);
      _rect(rx+px*sz,ry+py,pw*sz,ph,plateCols[i],"#aef2ff",2);
      ctx.restore();
    });

    // ---- shoulders: cube blocks ----
    _rect(rx-46*sz,ry-118,20*sz,20,isP2?"#1ea8d8":"#1590bd","#aef2ff",2);
    _rect(rx+26*sz,ry-118,20*sz,20,isP2?"#1ea8d8":"#1590bd","#aef2ff",2);

    // ---- arms: segmented geometric limbs ----
    const armSwing=Math.sin(this.anim*0.06)*0.06;
    ctx.save();
    ctx.translate(rx-40*sz,ry-110);ctx.rotate(-0.25+armSwing);
    ctx.fillStyle=isP2?"#1ea8d8":"#1590bd";ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
    ctx.fillRect(-7,0,14,34);ctx.strokeRect(-7,0,14,34);
    ctx.restore();

    // right arm holds the trident — raises briefly when a skill fires
    const raiseAngle=this.tridentRaiseTimer>0?-1.3:-0.35;
    ctx.save();
    ctx.translate(rx+40*sz,ry-110);ctx.rotate(raiseAngle);
    ctx.fillStyle=isP2?"#1ea8d8":"#1590bd";ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
    ctx.fillRect(-7,0,14,34);ctx.strokeRect(-7,0,14,34);
    this._drawTrident(0,34);
    ctx.restore();

    // ---- head: geometric cube with a crown of small triangular spikes ----
    const hx=rx+4*dir,hy=ry-140*sz;
    _rect(hx-14*sz,hy-14,28*sz,28,isP2?"#1ea8d8":"#1590bd","#aef2ff",2);
    ctx.save();ctx.fillStyle=isP2?"#eafcff":"#aef2ff";
    for(let i=0;i<3;i++){
      const cxp=hx-10*sz+i*10*sz;
      ctx.beginPath();ctx.moveTo(cxp,hy-14);ctx.lineTo(cxp+4*sz,hy-30);ctx.lineTo(cxp+8*sz,hy-14);ctx.closePath();ctx.fill();
    }
    ctx.restore();

    // ---- glowing blue eyes ----
    const eyePulse=0.7+Math.sin(this.anim*0.09)*0.3;
    ctx.save();ctx.shadowColor=isP2?"#ffffff":"#66e0ff";ctx.shadowBlur=14*eyePulse;
    ctx.fillStyle=isP2?"#ffffff":"#eafcff";
    ctx.beginPath();ctx.ellipse(hx-5*sz,hy,4*sz*eyePulse,3*sz*eyePulse,0,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.ellipse(hx+5*sz,hy,4*sz*eyePulse,3*sz*eyePulse,0,0,Math.PI*2);ctx.fill();
    ctx.restore();

    // ---- pulsing water energy lines on torso ----
    ctx.save();ctx.globalAlpha=0.5+0.3*Math.sin(this.anim*0.08);ctx.strokeStyle="#aef2ff";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(rx-6*sz,ry-30);ctx.lineTo(rx-4*sz,ry-118);ctx.stroke();
    ctx.beginPath();ctx.moveTo(rx+6*sz,ry-30);ctx.lineTo(rx+4*sz,ry-118);ctx.stroke();
    ctx.restore();

    if(!this._introHideHp){
      const hpLabel=isP2?"🌊 THE TIDAL - PHASE 2":"🌊 THE TIDAL";
      this._drawHpBar(rx,ry-40,hpLabel,isP2?"#eafcff":"#2ab8e8",true);
    }
  }
  // Small geometric trident — drawn in the caller's already-translated/rotated local
  // space. lx,ly is the grip (hand). The shaft runs outward from the grip (away from
  // the body) and the three prongs sit at the far tip — NOT bunched up near the hand.
  _drawTrident(lx,ly){
    ctx.save();ctx.strokeStyle="#aef2ff";ctx.fillStyle="#bff5ff";ctx.lineWidth=2;
    ctx.shadowColor="#66e0ff";ctx.shadowBlur=8;
    const shaftTip=ly+40,prongTip=shaftTip+16;
    ctx.beginPath();ctx.moveTo(lx,ly-8);ctx.lineTo(lx,shaftTip);ctx.stroke(); // shaft: short butt behind the grip -> long pole out to the prong base
    [-8,0,8].forEach(off=>{ // three prongs, at the far tip, pointing further away from the body
      ctx.beginPath();ctx.moveTo(lx+off,shaftTip);ctx.lineTo(lx+off,prongTip);ctx.stroke();
      ctx.beginPath();ctx.moveTo(lx+off-3,prongTip);ctx.lineTo(lx+off,prongTip+10);ctx.lineTo(lx+off+3,prongTip);ctx.closePath();ctx.fill();
    });
    ctx.restore();
  }
  _drawBossTidalSkillEffects(){
    const rx=this.x,ry=this.y-this.hoverBob,baseY=this._floorY||this.y;

    // Water Spear — small geometric droplet-shaped projectiles
    this.waterSpears.forEach(sp=>{
      ctx.save();ctx.fillStyle="#aef2ff";ctx.globalAlpha=Math.min(1,sp.life/40);
      ctx.beginPath();ctx.moveTo(sp.x,sp.y-8);ctx.lineTo(sp.x-5,sp.y+6);ctx.lineTo(sp.x+5,sp.y+6);ctx.closePath();ctx.fill();
      ctx.restore();
    });

    // Tidal Wave — layered geometric wave: soft back-wash + hard front wedges + foam crest line
    this.tidalWaves.forEach(t=>{
      const waveH=95*t.h;
      ctx.save();
      // soft back-wash layer, taller & lighter, gives the wave visual depth
      ctx.globalAlpha=0.35;ctx.fillStyle="#5fd0f0";
      ctx.beginPath();
      ctx.moveTo(t.x-4*t.dir,baseY);
      ctx.quadraticCurveTo(t.x+70*t.dir,baseY-waveH*0.65,t.x+118*t.dir,baseY-waveH*0.18);
      ctx.lineTo(t.x+118*t.dir,baseY);ctx.closePath();ctx.fill();
      // main body — stacked geometric wedges, darker & crisp-edged
      ctx.globalAlpha=0.9;ctx.fillStyle="#1590bd";ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
      for(let i=0;i<5;i++){
        const wx=t.x+i*16*t.dir,wh=waveH*(1-i*0.14);
        ctx.beginPath();
        ctx.moveTo(wx,baseY);ctx.lineTo(wx,baseY-wh);
        ctx.lineTo(wx+10*t.dir,baseY-wh*0.72);ctx.lineTo(wx+10*t.dir,baseY);
        ctx.closePath();ctx.fill();ctx.stroke();
      }
      // foam crest line riding the top of the wedges
      ctx.globalAlpha=1;ctx.strokeStyle="#eafcff";ctx.lineWidth=3;ctx.lineJoin="round";
      ctx.beginPath();ctx.moveTo(t.x,baseY-waveH*0.98);
      for(let i=0;i<5;i++){const wx=t.x+i*16*t.dir,wh=waveH*(1-i*0.14);ctx.lineTo(wx+10*t.dir,baseY-wh*0.72);}
      ctx.stroke();
      // small procedural foam-spray dots along the crest (no allocation — driven by t.life)
      ctx.fillStyle="#eafcff";ctx.globalAlpha=0.85;
      for(let i=0;i<3;i++){
        const fx=t.x+(i*20+((t.life*3)%20))*t.dir,fh=waveH*(1-Math.min(0.9,i*0.22));
        ctx.beginPath();ctx.arc(fx,baseY-fh*0.9-6,2.4,0,Math.PI*2);ctx.fill();
      }
      ctx.restore();
    });

    // Water Whirl — a real vortex: dark funnel core, spinning geometric rings, small chunks spiraling inward
    this.waterWhirls.forEach(wh=>{
      ctx.save();
      const coreR=wh.r*0.32;
      ctx.globalAlpha=0.55;ctx.fillStyle="#04384a";
      ctx.beginPath();ctx.ellipse(wh.x,baseY,coreR,coreR*0.42,0,0,Math.PI*2);ctx.fill();
      for(let i=0;i<6;i++){
        const rr=wh.r*(1-i*0.13),rot=wh.tick*0.08+i*0.9;
        ctx.globalAlpha=0.62-i*0.07;ctx.strokeStyle=i%2===0?"#5fd0f0":"#aef2ff";ctx.lineWidth=Math.max(1,3-i*0.35);
        ctx.beginPath();ctx.ellipse(wh.x,baseY,rr,rr*0.42,0,rot,rot+4.2);ctx.stroke();
      }
      // geometric water-chunks caught in the spiral, orbiting inward
      for(let i=0;i<5;i++){
        const ang=wh.tick*0.1+i*(Math.PI*2/5);
        const orbit=wh.r*(0.35+0.55*((Math.sin(wh.tick*0.05+i)+1)/2));
        const px=wh.x+Math.cos(ang)*orbit,py=baseY+Math.sin(ang)*orbit*0.42;
        ctx.save();ctx.translate(px,py);ctx.rotate(ang);
        ctx.globalAlpha=0.75;ctx.fillStyle="#eafcff";ctx.fillRect(-3,-3,6,6);
        ctx.restore();
      }
      ctx.restore();
    });

    // Water Prison — a real cage: pillars ringed around the player + a swirling dome roof + containment field
    if(this.waterPrisonActive){
      const a=Math.min(1,(75-this.waterPrisonTimer)/12);
      const cx=this.waterPrisonX,cy=baseY,pillars=6,ringR=46;
      ctx.save();
      ctx.globalAlpha=0.14*a;ctx.fillStyle="#5fd0f0";
      ctx.beginPath();ctx.ellipse(cx,cy-58,ringR+6,66,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=0.6*a;
      for(let i=0;i<pillars;i++){
        const ang=(i/pillars)*Math.PI*2,px2=cx+Math.cos(ang)*ringR,pw=8-Math.abs(Math.cos(ang))*2;
        ctx.fillStyle="rgba(95,208,240,0.4)";ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
        ctx.fillRect(px2-pw/2,cy-104,pw,104);ctx.strokeRect(px2-pw/2,cy-104,pw,104);
      }
      for(let i=0;i<3;i++){
        const rr=52-i*9,rot=this.anim*0.05+i*1.4;
        ctx.globalAlpha=(0.5-i*0.1)*a;ctx.strokeStyle="#eafcff";ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(cx,cy-104,rr,rr*0.4,0,rot,rot+4);ctx.stroke();
      }
      ctx.restore();
      _text(cx,cy-134,"🌊 WATER PRISON 🌊","#aef2ff","11px Arial bold");
    }

    // Rising Tide — warning rings + tapered geometric columns with a splash cap
    this.risingTideWarnings.forEach(rw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(rw.timer*0.5)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(rw.x,baseY,26,10,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.risingTideColumns.forEach(c=>{
      const h=c.h*150;
      ctx.save();
      ctx.globalAlpha=0.45;ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(c.x,baseY,26,9,0,0,Math.PI*2);ctx.stroke();
      ctx.globalAlpha=0.4;ctx.fillStyle="#5fd0f0";ctx.fillRect(c.x-18,baseY-h,36,h);
      ctx.globalAlpha=0.9;ctx.fillStyle="#1590bd";ctx.strokeStyle="#aef2ff";ctx.lineWidth=2;
      ctx.fillRect(c.x-11,baseY-h,22,h);ctx.strokeRect(c.x-11,baseY-h,22,h);
      ctx.globalAlpha=0.6;ctx.strokeStyle="#eafcff";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(c.x-6,baseY);ctx.lineTo(c.x-6,baseY-h*0.85);ctx.stroke();
      ctx.beginPath();ctx.moveTo(c.x+6,baseY);ctx.lineTo(c.x+6,baseY-h*0.85);ctx.stroke();
      if(c.h>0.7){
        ctx.globalAlpha=0.85;ctx.fillStyle="#eafcff";
        for(let i=-2;i<=2;i++){
          const sx2=c.x+i*8,sy2=baseY-h-6-Math.abs(i)*4;
          ctx.beginPath();ctx.moveTo(sx2-4,baseY-h+2);ctx.lineTo(sx2,sy2);ctx.lineTo(sx2+4,baseY-h+2);ctx.closePath();ctx.fill();
        }
      }
      ctx.restore();
    });

    // Trident Rush trail
    this.tridentRushTrail.forEach(t=>{
      ctx.globalAlpha=Math.max(0,t.life/20)*0.6;
      ctx.strokeStyle="#5fd0f0";ctx.lineWidth=6;
      ctx.beginPath();ctx.moveTo(t.x,baseY-10);ctx.lineTo(t.x,baseY-140);ctx.stroke();
      ctx.globalAlpha=1;
    });
    if(this.tridentRushActive)_text(rx,ry-210,"🔱 TRIDENT RUSH 🔱","#aef2ff","11px Arial bold");

    // Maelstrom — a large, dramatic vortex: dark funnel core + many spinning rings + orbiting chunks
    if(this.maelstromActive){
      ctx.save();
      const coreR=34;
      ctx.globalAlpha=0.5;ctx.fillStyle="#03303f";
      ctx.beginPath();ctx.ellipse(this.maelstromX,baseY,coreR,coreR*0.4,0,0,Math.PI*2);ctx.fill();
      for(let i=0;i<6;i++){
        const rr=40+i*26,rot=this.anim*0.045+i*0.8;
        ctx.globalAlpha=0.42-i*0.05;ctx.strokeStyle=i%2===0?"#2ab8e8":"#aef2ff";ctx.lineWidth=3;
        ctx.beginPath();ctx.ellipse(this.maelstromX,baseY,rr,rr*0.4,0,rot,rot+4.5);ctx.stroke();
      }
      for(let i=0;i<7;i++){
        const ang=this.anim*0.06+i*(Math.PI*2/7);
        const orbit=40+150*((Math.sin(this.anim*0.03+i)+1)/2);
        const px=this.maelstromX+Math.cos(ang)*orbit,py=baseY+Math.sin(ang)*orbit*0.4;
        ctx.save();ctx.translate(px,py);ctx.rotate(ang);
        ctx.globalAlpha=0.7;ctx.fillStyle="#eafcff";ctx.fillRect(-4,-4,8,8);
        ctx.restore();
      }
      ctx.restore();
      _text(this.maelstromX,baseY-210,"🌀 MAELSTROM 🌀","#aef2ff","12px Arial bold");
    }

    // Ocean's Judgment — true full-screen flood tint (uses the live camera/viewport,
    // not a fixed box anchored to the boss, so it actually covers the whole visible
    // screen regardless of arena width or zoom) + sweeping wave-bands for motion.
    if(this.oceanJudgmentCharging){
      ctx.save();
      const gx0=campX-30,gx1=campX+W+30;
      const grad=ctx.createLinearGradient(0,0,0,H);
      grad.addColorStop(0,"rgba(14,126,168,0.10)");
      grad.addColorStop(0.55,"rgba(14,126,168,0.24)");
      grad.addColorStop(1,"rgba(10,90,122,0.42)");
      ctx.fillStyle=grad;
      ctx.fillRect(gx0,-30,gx1-gx0,H+60);
      ctx.globalAlpha=0.28;ctx.strokeStyle="#aef2ff";ctx.lineWidth=3;
      for(let i=0;i<4;i++){
        const yy=H*0.28+i*H*0.16;
        ctx.beginPath();
        for(let sx=gx0;sx<=gx1;sx+=26){
          const wy=yy+Math.sin(this.anim*0.05+sx*0.02+i*1.3)*9;
          if(sx===gx0)ctx.moveTo(sx,wy);else ctx.lineTo(sx,wy);
        }
        ctx.stroke();
      }
      ctx.restore();
      _text(rx,ry-240,"🌊 OCEAN'S JUDGMENT 🌊","#aef2ff","14px Arial bold");
    }
  }

  // ================================================================
  //  THE VOLTAGE (Boss 7 — FINAL BOSS) — a Lightning entity, the fastest
  //  and most mobile of the 7 elemental bosses. 6 skills + a channeled
  //  special (Overcharge, own cooldown outside the weighted pool) + an
  //  arena-wide ultimate (Thunderstorm). Fights through unpredictable
  //  repositioning, chains, fields and arena-wide lightning — never a
  //  straightforward brawler. Phase 2 triggers at 50% HP (per spec,
  //  matching The Tidal).
  // ================================================================
  _updateBossVoltage(player,floorY,w){
    this._floorY=floorY;
    this.bodyJitter=Math.sin(this.anim*0.11)*2+Math.sin(this.anim*0.23)*1.4;
    this.arcPulse=(this.arcPulse+0.06)%(Math.PI*2);
    this.voltAura.forEach(va=>va.ang+=va.spd);
    this.bodyBlocks.forEach(bb=>bb.drift+=0.03);

    // ======= PHASE 2 CHECK (50% HP, per spec) =======
    if(this.phase===1 && this.hp<=this.maxHp*0.5 && !this.phase2Entered){
      this.phase=2;this.phase2Entered=true;this.phase2SpeedMult=1.15;this.phase2DmgMult=1.15;
      screenShake=Math.max(screenShake,30);
      this.skillTimer.s8=Math.min(this.skillTimer.s8,260);
    }
    const isP2=this.phase===2;

    // ======= SPECIAL: OVERCHARGE — own cooldown, outside the weighted pool (mirrors The Tempest's Sky Fall) =======
    if(this.overchargeCd>0)this.overchargeCd--;
    if(!this.overchargeActive && this.overchargeCd<=0 && !this.lightningDashActive && !this.thunderstormCharging){
      this._bossVoltageStartOvercharge();
    }

    const busy=this.lightningDashActive||this.overchargeActive||this.thunderstormCharging;

    if(!busy){
      // ======= GROUND MOVEMENT — the fastest boss: never idles long, closes/opens distance quickly =======
      const dx=player.x-this.x,distP=Math.abs(dx),spd=(isP2?3.1:2.5)*this.phase2SpeedMult,idealDist=190;
      if(distP>idealDist+60)this.x+=spd*(dx>0?1:-1);
      else if(distP<idealDist-70)this.x-=spd*0.6*(dx>0?1:-1);
      else this.x+=Math.sin(this.anim*0.05)*0.6; // "Boss không đứng yên quá lâu" — small restless shimmer-step
      this.x=clamp(this.x,80,w-80);
      this.direction=dx>=0?1:-1;

      // ======= WEIGHTED AI SKILL DECISION (same recipe as the other bosses) =======
      const canUseS1=this.skillTimer.s1<=0 && this.lastSkillUsed!=="s1";
      const canUseS2=this.skillTimer.s2<=0 && this.lastSkillUsed!=="s2";
      const canUseS3=this.skillTimer.s3<=0 && this.lastSkillUsed!=="s3";
      const canUseS4=this.skillTimer.s4<=0 && this.lastSkillUsed!=="s4";
      const canUseS5=this.skillTimer.s5<=0 && this.lastSkillUsed!=="s5";
      const canUseS6=this.skillTimer.s6<=0 && this.lastSkillUsed!=="s6";
      const canUseS8=this.skillTimer.s8<=0 && isP2 && this.lastSkillUsed!=="s8";

      let weights={s1:20,s2:18,s3:16,s4:12,s5:14,s6:12,s8:10};
      if(distP>340)weights.s3=30; // far away -> Lightning Dash to close the gap instantly
      if(distP<130)weights.s2+=10; // too close -> Thunder Strike to punish standing still
      if(isP2){weights.s8=22;weights.s1+=4;weights.s6+=4;}

      let totalWeight=0;
      if(canUseS1)totalWeight+=weights.s1;
      if(canUseS2)totalWeight+=weights.s2;
      if(canUseS3)totalWeight+=weights.s3;
      if(canUseS4)totalWeight+=weights.s4;
      if(canUseS5)totalWeight+=weights.s5;
      if(canUseS6)totalWeight+=weights.s6;
      if(canUseS8)totalWeight+=weights.s8;

      let selectedSkill=null;
      if(totalWeight>0){
        let decision=rng()*totalWeight,acc=0;
        if(canUseS1){acc+=weights.s1;if(decision<acc)selectedSkill="s1";}
        if(!selectedSkill&&canUseS2){acc+=weights.s2;if(decision<acc)selectedSkill="s2";}
        if(!selectedSkill&&canUseS3){acc+=weights.s3;if(decision<acc)selectedSkill="s3";}
        if(!selectedSkill&&canUseS4){acc+=weights.s4;if(decision<acc)selectedSkill="s4";}
        if(!selectedSkill&&canUseS5){acc+=weights.s5;if(decision<acc)selectedSkill="s5";}
        if(!selectedSkill&&canUseS6){acc+=weights.s6;if(decision<acc)selectedSkill="s6";}
        if(!selectedSkill&&canUseS8){acc+=weights.s8;if(decision<acc)selectedSkill="s8";}
      }

      if(selectedSkill==="s1")this._bossVoltageSkillChainLightning(player,w);
      else if(selectedSkill==="s2")this._bossVoltageSkillThunderStrike(player,w);
      else if(selectedSkill==="s3")this._bossVoltageSkillLightningDash(player,w);
      else if(selectedSkill==="s4")this._bossVoltageSkillElectricField(player,w);
      else if(selectedSkill==="s5")this._bossVoltageSkillVoltageOrbs(player,w);
      else if(selectedSkill==="s6")this._bossVoltageSkillThunderPillars(player,w);
      else if(selectedSkill==="s8")this._bossVoltageSkillThunderstorm(player,w);
    }

    // ======= ACTIVE SKILL UPDATES =======
    this._updateChainLightning(player,w);
    this._updateThunderStrikes(player,w);
    this._updateLightningDash(player,floorY,w);
    this._updateElectricFields(player,w);
    this._updateVoltageOrbs(player,w);
    this._updateThunderPillars(player,w);
    this._updateOvercharge(player,w);
    this._updateThunderstorm(player,w);
  }

  // ===== SKILL 1: CHAIN LIGHTNING — a bolt hits the player, then arcs onward once (bounded) =====
  _bossVoltageSkillChainLightning(player,w){
    this.skillTimer.s1=this.skillCd.s1;this.lastSkillUsed="s1";
    const dir=player.x>=this.x?1:-1;
    this.chainBolts.push({x:this.x+dir*20,y:this.y-95,tx:player.x,ty:player.y-90,life:0,maxLife:26,dmg:(this.phase===2?12:9)*this.phase2DmgMult,hit:false,warnT:16});
    sfxLightningZap?.();
  }
  _updateChainLightning(player,w){
    _compact(this.chainBolts,b=>{
      if(b.warnT>0){b.warnT--;return true;}
      b.life++;
      if(!b.hit && Math.abs(player.x-b.tx)<50 && Math.abs(player.y-b.ty)<70 && player.hp>0){
        b.hit=true;applyDamage(player,b.dmg,this);
        // "Sau khi trúng mục tiêu, tia điện có thể truyền sang các điểm gần đó" — one bounded chain-tail arc, never infinite
        const dir2=b.tx>=b.x?1:-1;
        this.chainBolts.push({x:b.tx,y:b.ty,tx:b.tx+dir2*140,ty:b.ty,life:0,maxLife:16,dmg:b.dmg*0.6,hit:true,warnT:6,isChainTail:true});
      }
      return b.life<b.maxLife;
    });
  }

  // ===== SKILL 2: THUNDER STRIKE — telegraphed strike zone(s) under the player, then lightning slams down =====
  _bossVoltageSkillThunderStrike(player,w){
    this.skillTimer.s2=this.skillCd.s2;this.lastSkillUsed="s2";
    const count=this.phase===2?3:2;
    for(let i=0;i<count;i++){
      this.thunderWarnings.push({x:clamp(player.x+rndInt(-70,70),80,w-80),timer:34+i*10});
    }
  }
  _updateThunderStrikes(player,w){
    _compact(this.thunderWarnings,tw=>{
      tw.timer--;
      if(tw.timer<=0){
        this.thunderStrikes.push({x:tw.x,life:22,hitTimer:0});
        sfxThunderBoom?.();screenShake=Math.max(screenShake,7);
        return false;
      }
      return true;
    });
    _compact(this.thunderStrikes,ts=>{
      ts.life--;
      if(ts.hitTimer>0)ts.hitTimer--;
      if(ts.life>10&&ts.hitTimer<=0&&Math.abs(player.x-ts.x)<34&&player.hp>0){
        applyDamage(player,(this.phase===2?13:10)*this.phase2DmgMult,this);ts.hitTimer=20;
      }
      return ts.life>0;
    });
  }

  // ===== SKILL 3: LIGHTNING DASH — boss becomes a bolt, streaks across the arena, reappears at the far side =====
  _bossVoltageSkillLightningDash(player,w){
    this.skillTimer.s3=this.skillCd.s3;this.lastSkillUsed="s3";
    this.lightningDashActive=true;this.lightningDashTimer=26;this.lightningDashDir=player.x>=this.x?1:-1;
    sfxLightningZap?.();
  }
  _updateLightningDash(player,floorY,w){
    if(!this.lightningDashActive){this._updateLightningDashTrail(player,w);return;}
    this.lightningDashTimer--;
    this.lightningDashTrail.push({x:this.x,y:this.y,life:22});
    this.x+=this.lightningDashDir*(this.phase===2?13:10.5);
    this.x=clamp(this.x,60,w-60);
    this.direction=this.lightningDashDir;
    // "Không gây damage vô lý" — a light contact tick only, mirrors The Tempest's Wind Dash rule
    if(Math.abs(player.x-this.x)<34&&player.hp>0&&this.anim%8===0){
      applyDamage(player,(this.phase===2?6:4)*this.phase2DmgMult,this);
    }
    if(this.lightningDashTimer<=0){
      this.lightningDashActive=false;
      screenShake=Math.max(screenShake,6);
    }
    this._updateLightningDashTrail(player,w);
  }
  _updateLightningDashTrail(player,w){
    _compact(this.lightningDashTrail,t=>{
      t.life--;
      if(t.life>10&&Math.abs(player.x-t.x)<20&&player.hp>0&&this.anim%16===0){
        applyDamage(player,(this.phase===2?3:2)*this.phase2DmgMult,this);
      }
      return t.life>0;
    });
  }

  // ===== SKILL 4: ELECTRIC FIELD — a drifting electrified ground zone, ticks damage the longer the player lingers =====
  _bossVoltageSkillElectricField(player,w){
    this.skillTimer.s4=this.skillCd.s4;this.lastSkillUsed="s4";
    this.electricFields.push({x:clamp(player.x+rndInt(-30,30),120,w-120),r:70,life:260,tick:0,driftDir:rndChoice([-1,1])});
  }
  _updateElectricFields(player,w){
    _compact(this.electricFields,ef=>{
      ef.life--;ef.tick++;
      ef.x=clamp(ef.x+ef.driftDir*0.5,100,w-100);
      if(ef.tick%90===0)ef.driftDir*=-1;
      if(Math.abs(player.x-ef.x)<ef.r&&player.hp>0&&ef.tick%26===0){
        applyDamage(player,(this.phase===2?7:5)*this.phase2DmgMult,this);
      }
      return ef.life>0;
    });
  }

  // ===== SKILL 5: VOLTAGE ORBS — geometric energy orbs orbit the boss, then lock on and launch (capped count) =====
  _bossVoltageSkillVoltageOrbs(player,w){
    this.skillTimer.s5=this.skillCd.s5;this.lastSkillUsed="s5";
    const count=this.phase===2?4:3; // "Không tạo quá nhiều quả cầu cùng lúc"
    for(let i=0;i<count;i++){
      this.voltageOrbs.push({x:this.x,y:this.y-120,orbitAng:(i/count)*Math.PI*2,orbitT:34,vx:0,vy:0,locked:false,life:160,dmg:(this.phase===2?9:7)*this.phase2DmgMult});
    }
    sfxLightningZap?.();
  }
  _updateVoltageOrbs(player,w){
    _compact(this.voltageOrbs,o=>{
      o.life--;
      if(o.orbitT>0){
        o.orbitT--;o.orbitAng+=0.18;
        o.x=this.x+Math.cos(o.orbitAng)*46;o.y=this.y-120+Math.sin(o.orbitAng)*26;
        if(o.orbitT<=0&&!o.locked){
          o.locked=true;
          const dx=player.x-o.x,dy=(player.y-90)-o.y,d=Math.max(1,Math.hypot(dx,dy)),spd=5.4;
          o.vx=dx/d*spd;o.vy=dy/d*spd;
        }
        return true;
      }
      o.x+=o.vx;o.y+=o.vy;
      if(Math.abs(player.x-o.x)<26&&Math.abs((player.y-90)-o.y)<40&&player.hp>0){
        applyDamage(player,o.dmg,this);return false;
      }
      return o.life>0 && o.x>-200 && o.x<w+200;
    });
  }

  // ===== SKILL 6: THUNDER PILLARS — a telegraphed sequence of lightning columns, 1->2->3->4 =====
  _bossVoltageSkillThunderPillars(player,w){
    this.skillTimer.s6=this.skillCd.s6;this.lastSkillUsed="s6";
    const dir=player.x>=this.x?1:-1,startX=clamp(player.x-dir*40,120,w-120);
    const count=this.phase===2?5:4;
    for(let i=0;i<count;i++){
      this.thunderPillarWarnings.push({x:clamp(startX+dir*i*95,90,w-90),timer:24+i*20});
    }
  }
  _updateThunderPillars(player,w){
    _compact(this.thunderPillarWarnings,pw=>{
      pw.timer--;
      if(pw.timer<=0){
        this.thunderPillars.push({x:pw.x,life:24,hitTimer:0});
        sfxThunderBoom?.();screenShake=Math.max(screenShake,5);
        return false;
      }
      return true;
    });
    _compact(this.thunderPillars,tp=>{
      tp.life--;
      if(tp.hitTimer>0)tp.hitTimer--;
      if(tp.life>10&&tp.hitTimer<=0&&Math.abs(player.x-tp.x)<32&&player.hp>0){
        applyDamage(player,(this.phase===2?10:8)*this.phase2DmgMult,this);tp.hitTimer=20;
      }
      return tp.life>0;
    });
  }

  // ===== SPECIAL: OVERCHARGE — boss stops, body blocks tear apart briefly, then a wide electric pulse (own cooldown, outside the weighted pool) =====
  _bossVoltageStartOvercharge(){
    this.overchargeActive=true;this.overchargePhase="charging";this.overchargeTimer=70;this.overchargeCd=560;
    sfxElectricCharge?.();
  }
  _updateOvercharge(player,w){
    if(!this.overchargeActive)return;
    this.overchargeTimer--;
    if(this.overchargePhase==="charging" && this.overchargeTimer<=0){
      this.overchargePhase="release";this.overchargeTimer=16;
      screenShake=Math.max(screenShake,22);sfxThunderBoom?.();
      const radius=200,dmg=(this.phase===2?18:14)*this.phase2DmgMult;
      if(Math.abs(player.x-this.x)<radius&&player.hp>0){
        applyDamage(player,dmg,this);
        const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*140,40,w-40);
      }
    }else if(this.overchargePhase==="release" && this.overchargeTimer<=0){
      this.overchargeActive=false;this.overchargePhase="";
    }
  }

  // ===== ULTIMATE: THUNDERSTORM — arena darkens, storm strikes sweep the ground, then converge on the boss for one huge shockwave =====
  _bossVoltageSkillThunderstorm(player,w){
    this.skillTimer.s8=this.skillCd.s8;this.lastSkillUsed="s8";
    this.thunderstormCharging=true;this.thunderstormPhase="gather";this.thunderstormTimer=90;this.thunderstormTick=0;
    this.x=clamp((this.x+player.x)/2,w*0.35,w*0.65);
    sfxVoltageRoar?.();sfxElectricCharge?.();
  }
  _updateThunderstorm(player,w){
    if(!this.thunderstormCharging)return;
    this.thunderstormTimer--;this.thunderstormTick++;
    if(this.thunderstormPhase==="gather"){
      // "Bầu trời bắt đầu xuất hiện các tia sét. Các vùng cảnh báo xuất hiện trên mặt đất."
      if(this.thunderstormTick%14===0)this.thunderWarnings.push({x:clamp(rndInt(80,w-80),80,w-80),timer:26});
      if(this.thunderstormTimer<=0){this.thunderstormPhase="storm";this.thunderstormTimer=170;this.thunderstormTick=0;}
    }else if(this.thunderstormPhase==="storm"){
      // "Sét bắt đầu đánh xuống liên tục. Boss biến mất. Các tia điện xuất hiện ở nhiều vị trí."
      if(this.thunderstormTick%16===0)this.thunderWarnings.push({x:clamp(rndInt(80,w-80),80,w-80),timer:22});
      if(this.thunderstormTimer<=0){this.thunderstormPhase="converge";this.thunderstormTimer=50;this.thunderstormTick=0;this.x=clamp(player.x,w*0.3,w*0.7);}
    }else if(this.thunderstormPhase==="converge"){
      // "Tất cả các tia điện bắt đầu hội tụ về một điểm. The Voltage xuất hiện trở lại ở trung tâm."
      if(this.thunderstormTimer<=0){
        this.thunderstormPhase="detonate";this.thunderstormTimer=1;
        screenShake=Math.max(screenShake,44);sfxThunderstormBurst?.();
        const radius=480,dmg=(this.phase===2?34:28)*this.phase2DmgMult;
        if(Math.abs(player.x-this.x)<radius&&player.hp>0){
          applyDamage(player,dmg,this);
          const push=player.x>=this.x?1:-1;player.x=clamp(player.x+push*210,40,w-40);
        }
      }
    }else if(this.thunderstormPhase==="detonate"){
      if(this.thunderstormTimer<=0){this.thunderstormCharging=false;this.thunderstormPhase="";}
    }
  }

  // ================================================================
  //  THE VOLTAGE (Boss 7 — FINAL BOSS) — drawing. Built entirely from
  //  yellow/white/electric-blue geometric blocks: stacked torso plates,
  //  cube shoulders, segmented limbs, a cube head linked to the neck by
  //  a visible arc, and several detached floating blocks tethered to
  //  the body only by lightning — deliberately NOT a sealed humanoid
  //  silhouette. "Không phải một sinh vật chứa điện — một sinh vật được
  //  tạo thành từ điện."
  // ================================================================
  _drawBossVoltage(){
    const rx=this.x,ry=this.y,isP2=this.phase===2;
    if(this.dead){
      for(let i=0;i<10;i++){const ex=rx+rndInt(-80,80),ey=ry+rndInt(-90,10);_oval(ex-9,ey-9,18,18,rndChoice(["#fff45c","#66e0ff","#ffffff"]),null);}
      _text(rx,ry-80,"💀 DEFEATED 💀","#fff45c","16px Arial bold");
      return;
    }
    const sz=isP2?1.1:1.0,dir=this.direction,jit=this.bodyJitter;

    this._drawBossVoltageSkillEffects();

    // ---- orbiting geometric energy sparks/cubes ----
    this.voltAura.forEach(va=>{
      const ox=rx+Math.cos(va.ang)*va.rad,oy=ry-95+Math.sin(va.ang)*va.rad*0.4+Math.sin(this.anim*0.08+va.bob)*3;
      ctx.save();ctx.globalAlpha=0.6;ctx.fillStyle=isP2?"#ffffff":"#fff45c";
      if(va.type==="cube"){ctx.translate(ox,oy);ctx.rotate(this.anim*0.05+va.bob);ctx.fillRect(-va.size,-va.size,va.size*2,va.size*2);}
      else{ctx.strokeStyle="#66e0ff";ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(ox-va.size,oy);ctx.lineTo(ox+va.size,oy);ctx.moveTo(ox,oy-va.size);ctx.lineTo(ox,oy+va.size);ctx.stroke();}
      ctx.restore();
    });

    // ---- detached floating geometric blocks, linked to the body only by electric arcs ----
    this.bodyBlocks.forEach(bb=>{
      const bx=rx+bb.ox*sz+Math.sin(bb.drift)*6,by=ry+bb.oy+Math.cos(bb.drift*0.8)*5;
      ctx.save();ctx.strokeStyle=`rgba(255,244,92,${0.5+0.3*Math.sin(this.anim*0.15+bb.drift)})`;ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(rx+bb.ox*0.3,ry-100);
      const midx=(rx+bb.ox*0.3+bx)/2+rndInt(-6,6),midy=(ry-100+by)/2+rndInt(-6,6);
      ctx.lineTo(midx,midy);ctx.lineTo(bx,by);ctx.stroke();
      ctx.restore();
      ctx.save();ctx.translate(bx,by);ctx.rotate(bb.drift);
      ctx.fillStyle=isP2?"#ffffff":"#ffe066";ctx.strokeStyle="#66e0ff";ctx.lineWidth=1.5;
      ctx.fillRect(-bb.size,-bb.size,bb.size*2,bb.size*2);ctx.strokeRect(-bb.size,-bb.size,bb.size*2,bb.size*2);
      ctx.restore();
    });

    // ---- legs: two rectangular geometric blocks (slightly restless — never fully still) ----
    _rect(rx-22*sz+jit*0.3,ry-34,16*sz,34,isP2?"#b8860b":"#8a6d1a","#fff45c",2);
    _rect(rx+6*sz-jit*0.3,ry-34,16*sz,34,isP2?"#b8860b":"#8a6d1a","#fff45c",2);

    // ---- torso: tiered geometric plates, alternating shades ----
    const plateCols=isP2?["#c99a1e","#e0b52a","#fff45c"]:["#8a6d1a","#c99a1e","#e0b52a"];
    const plates=[[-26,-64,52,30],[-21,-90,42,26],[-16,-114,32,24]];
    plates.forEach(([px,py,pw,ph],i)=>{
      ctx.save();ctx.translate(jit*(i*0.5),0);
      _rect(rx+px*sz,ry+py,pw*sz,ph,plateCols[i],"#fff45c",2);
      ctx.restore();
    });

    // ---- shoulders: cube blocks ----
    _rect(rx-46*sz,ry-112,18*sz,18,isP2?"#fff45c":"#e0b52a","#ffffff",2);
    _rect(rx+28*sz,ry-112,18*sz,18,isP2?"#fff45c":"#e0b52a","#ffffff",2);

    // ---- arms: segmented geometric limbs, twitching with current ----
    const armSwing=Math.sin(this.anim*0.14)*0.1;
    ctx.save();ctx.translate(rx-40*sz,ry-104);ctx.rotate(-0.3+armSwing);
    ctx.fillStyle=isP2?"#fff45c":"#e0b52a";ctx.strokeStyle="#66e0ff";ctx.lineWidth=2;
    ctx.fillRect(-7,0,14,30);ctx.strokeRect(-7,0,14,30);
    ctx.restore();
    ctx.save();ctx.translate(rx+40*sz,ry-104);ctx.rotate(0.3-armSwing);
    ctx.fillStyle=isP2?"#fff45c":"#e0b52a";ctx.strokeStyle="#66e0ff";ctx.lineWidth=2;
    ctx.fillRect(-7,0,14,30);ctx.strokeRect(-7,0,14,30);
    ctx.restore();

    // ---- head: geometric cube, floating slightly apart from the neck, linked by an arc ----
    const hx=rx+4*dir+jit,hy=ry-142*sz+Math.sin(this.anim*0.1)*2;
    ctx.save();ctx.strokeStyle="rgba(102,224,255,0.7)";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(rx,ry-124);ctx.lineTo(hx,hy+14);ctx.stroke();
    ctx.restore();
    _rect(hx-14*sz,hy-14,28*sz,28,isP2?"#fff45c":"#e0b52a","#ffffff",2);

    // ---- eyes: glowing electric slits ----
    const eyePulse=0.7+Math.sin(this.anim*0.16)*0.3;
    ctx.save();ctx.shadowColor="#66e0ff";ctx.shadowBlur=16*eyePulse;ctx.fillStyle=isP2?"#ffffff":"#eafcff";
    ctx.fillRect(hx-9*sz,hy-2,7*sz,3*eyePulse);ctx.fillRect(hx+2*sz,hy-2,7*sz,3*eyePulse);
    ctx.restore();

    // ---- constant electric arcs running across the body ----
    ctx.save();ctx.globalAlpha=0.6+0.3*Math.sin(this.anim*0.2);ctx.strokeStyle="#66e0ff";ctx.lineWidth=1.5;
    for(let i=0;i<3;i++){
      const ay=ry-40-i*30,ax1=rx-18+rndInt(-4,4),ax2=rx+18+rndInt(-4,4);
      ctx.beginPath();ctx.moveTo(ax1,ay);ctx.lineTo(rx+rndInt(-6,6),ay-14);ctx.lineTo(ax2,ay-4);ctx.stroke();
    }
    ctx.restore();

    if(!this._introHideHp){
      const hpLabel=isP2?"⚡ THE VOLTAGE - PHASE 2":"⚡ THE VOLTAGE";
      this._drawHpBar(rx,ry-40,hpLabel,isP2?"#ffffff":"#fff45c",true);
    }
  }
  _drawBossVoltageSkillEffects(){
    const rx=this.x,ry=this.y,baseY=this._floorY||this.y;

    // Chain Lightning — a brief telegraph line, then a jagged geometric bolt to the target
    this.chainBolts.forEach(b=>{
      ctx.save();
      if(b.warnT>0){
        ctx.globalAlpha=0.4;ctx.strokeStyle="red";ctx.lineWidth=1.5;ctx.setLineDash([5,4]);
        ctx.beginPath();ctx.moveTo(b.x,b.y);ctx.lineTo(b.tx,b.ty);ctx.stroke();ctx.setLineDash([]);
      }else{
        ctx.globalAlpha=Math.max(0,1-b.life/b.maxLife);ctx.strokeStyle=b.isChainTail?"#aef2ff":"#fff45c";ctx.lineWidth=b.isChainTail?2:3;
        ctx.shadowColor="#66e0ff";ctx.shadowBlur=10;
        ctx.beginPath();ctx.moveTo(b.x,b.y);
        const segs=6;
        for(let i=1;i<=segs;i++){
          const t=i/segs,mx=b.x+(b.tx-b.x)*t+rndInt(-8,8),my=b.y+(b.ty-b.y)*t+rndInt(-8,8);
          ctx.lineTo(mx,my);
        }
        ctx.stroke();
      }
      ctx.restore();
    });

    // Thunder Strike — warning ring, then a vertical geometric lightning bolt slamming down
    this.thunderWarnings.forEach(tw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(tw.timer*0.6)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(tw.x,baseY,24,9,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.thunderStrikes.forEach(ts=>{
      const a=Math.max(0,ts.life/22);
      ctx.save();ctx.globalAlpha=a;ctx.strokeStyle="#fff45c";ctx.lineWidth=5;ctx.shadowColor="#66e0ff";ctx.shadowBlur=14;
      let px=ts.x+rndInt(-6,6),py=baseY-260;ctx.beginPath();ctx.moveTo(px,py);
      for(let i=1;i<=5;i++){py=baseY-260+(260*i/5);px=ts.x+rndInt(-14,14);ctx.lineTo(px,py);}
      ctx.lineTo(ts.x,baseY);ctx.stroke();
      ctx.globalAlpha=a*0.5;ctx.fillStyle="#fff45c";ctx.beginPath();ctx.ellipse(ts.x,baseY,26*a+8,10,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
    });

    // Lightning Dash trail — a bright streak of electricity
    this.lightningDashTrail.forEach(t=>{
      ctx.save();ctx.globalAlpha=Math.max(0,t.life/22)*0.7;ctx.strokeStyle="#66e0ff";ctx.lineWidth=7;
      ctx.beginPath();ctx.moveTo(t.x,t.y-10);ctx.lineTo(t.x,t.y-130);ctx.stroke();
      ctx.restore();
    });
    if(this.lightningDashActive)_text(rx,ry-210,"⚡ LIGHTNING DASH ⚡","#fff45c","11px Arial bold");

    // Electric Field — geometric arcs crawling across a ground zone
    this.electricFields.forEach(ef=>{
      ctx.save();ctx.globalAlpha=0.3;ctx.fillStyle="#fff45c";
      ctx.beginPath();ctx.ellipse(ef.x,baseY,ef.r,ef.r*0.32,0,0,Math.PI*2);ctx.fill();
      ctx.globalAlpha=0.7;ctx.strokeStyle="#66e0ff";ctx.lineWidth=1.5;
      for(let i=0;i<5;i++){
        const ang=this.anim*0.1+i*1.3,ex1=ef.x+Math.cos(ang)*ef.r*0.7,ey1=baseY+Math.sin(ang)*ef.r*0.22;
        ctx.beginPath();ctx.moveTo(ef.x,baseY);ctx.lineTo((ef.x+ex1)/2+rndInt(-4,4),baseY-8);ctx.lineTo(ex1,ey1);ctx.stroke();
      }
      ctx.restore();
    });

    // Voltage Orbs — small glowing geometric energy diamonds
    this.voltageOrbs.forEach(o=>{
      ctx.save();ctx.shadowColor="#66e0ff";ctx.shadowBlur=10;ctx.fillStyle=o.locked?"#fff45c":"#ffe066";
      ctx.translate(o.x,o.y);ctx.rotate(this.anim*0.1);
      ctx.beginPath();ctx.moveTo(0,-7);ctx.lineTo(7,0);ctx.lineTo(0,7);ctx.lineTo(-7,0);ctx.closePath();ctx.fill();
      ctx.restore();
    });

    // Thunder Pillars — warnings + vertical geometric energy columns, in sequence
    this.thunderPillarWarnings.forEach(pw=>{
      ctx.save();ctx.globalAlpha=0.5+Math.sin(pw.timer*0.5)*0.3;
      ctx.strokeStyle="red";ctx.lineWidth=2;ctx.setLineDash([4,3]);
      ctx.beginPath();ctx.ellipse(pw.x,baseY,22,8,0,0,Math.PI*2);ctx.stroke();
      ctx.setLineDash([]);ctx.restore();
    });
    this.thunderPillars.forEach(tp=>{
      const a=Math.max(0,tp.life/24);
      ctx.save();ctx.globalAlpha=a*0.85;ctx.fillStyle="#fff45c";ctx.strokeStyle="#66e0ff";ctx.lineWidth=2;
      ctx.fillRect(tp.x-9,baseY-150*a,18,150*a);ctx.strokeRect(tp.x-9,baseY-150*a,18,150*a);
      ctx.restore();
    });

    // Overcharge — the body crackles brighter while channeling, then a wide ring pulse on release
    if(this.overchargeActive){
      if(this.overchargePhase==="charging"){
        const p=1-Math.max(0,this.overchargeTimer/70);
        ctx.save();ctx.globalAlpha=0.3+0.5*p;ctx.strokeStyle="#66e0ff";ctx.lineWidth=2+3*p;
        ctx.beginPath();ctx.ellipse(rx,ry-90,40+30*p,60+30*p,0,0,Math.PI*2);ctx.stroke();
        ctx.restore();
        _text(rx,ry-220,"⚡ OVERCHARGE ⚡","#fff45c","12px Arial bold");
      }else{
        const p=Math.max(0,this.overchargeTimer/16);
        ctx.save();ctx.globalAlpha=p*0.6;ctx.strokeStyle="#fff45c";ctx.lineWidth=6;
        ctx.beginPath();ctx.ellipse(rx,baseY,220*(1-p)+40,80*(1-p)+20,0,0,Math.PI*2);ctx.stroke();
        ctx.restore();
      }
    }

    // Thunderstorm — a live-viewport darkened storm tint (mirrors Ocean's Judgment) + intermittent sky-flashes
    if(this.thunderstormCharging){
      ctx.save();
      const gx0=campX-30,gx1=campX+W+30;
      ctx.globalAlpha=this.thunderstormPhase==="gather"?0.16:this.thunderstormPhase==="storm"?0.30:0.42;
      ctx.fillStyle="#0a0a1a";ctx.fillRect(gx0,-30,gx1-gx0,H+60);
      if(this.thunderstormPhase==="storm"&&this.thunderstormTick%10<2){ctx.globalAlpha=0.12;ctx.fillStyle="#eafcff";ctx.fillRect(gx0,-30,gx1-gx0,H+60);}
      ctx.restore();
      _text(rx,ry-240,"⚡ THUNDERSTORM ⚡","#fff45c","14px Arial bold");
    }
  }
}

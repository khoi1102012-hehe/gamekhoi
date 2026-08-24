// ================================================================
//  BOSS 3 SKILL CASTING
// ================================================================
function boss3CastSkill(boss,player,skillType){
  const w=W;
  if(skillType==="fire"){for(const ao of[-20,0,20]){const dx=player.x-boss.x,dy=player.y-boss.y,d=Math.max(1,Math.sqrt(dx*dx+dy*dy)),rad=Math.atan2(dy,dx)+ao*Math.PI/180;projectiles.push({x:boss.x,y:boss.y-30,vx:Math.cos(rad)*9,vy:Math.sin(rad)*9,owner:boss,target:player,damage:5,slow:0,slow_pct:0,color:"orange",type:"fireball"});}}
  else if(skillType==="shadow"){const dx=player.x-boss.x;boss.x=clamp(player.x-(dx>0?80:-80),60,w-60);applyDamage(player,6,boss);screenShake=Math.max(screenShake,10);}
  else if(skillType==="ice"){projectiles.push({x:boss.x,y:boss.y-30,vx:10*(player.x>boss.x?1:-1),vy:0,owner:boss,target:player,damage:4,slow:150,slow_pct:0.45,color:"cyan",type:"ice_arrow"});}
  else if(skillType==="thunder"){if(Math.abs(boss.x-player.x)<500){applyDamage(player,7,boss);screenShake=Math.max(screenShake,15);}}
  else if(skillType==="earth"){if(Math.abs(boss.x-player.x)<400){applyDamage(player,8,boss);player.vy=-10;}}
  else if(skillType==="water"){if(Math.abs(boss.x-player.x)<450){const push=player.x>boss.x?1:-1;player.x=clamp(player.x+push*200,40,w-40);applyDamage(player,5,boss);}}
  else if(skillType==="wind"){if(Math.abs(boss.x-player.x)<500){const pull=player.x>boss.x?-1:1;player.x=clamp(player.x+pull*150,40,w-40);applyDamage(player,4,boss);}}
}

// ================================================================
//  DRAWING HELPERS
// ================================================================
function _rect(x,y,w,h,fill,stroke,lw=1){if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}ctx.fillStyle=fill;ctx.fillRect(x,y,w,h);if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.strokeRect(x,y,w,h);}}
function _rectOutline(x,y,w,h,stroke,lw){if(w<0){x+=w;w=-w;}if(h<0){y+=h;h=-h;}ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.strokeRect(x,y,w,h);}
function _oval(x,y,w,h,fill,stroke,lw=1){ctx.beginPath();ctx.ellipse(x+w/2,y+h/2,w/2,h/2,0,0,Math.PI*2);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
function _line(x1,y1,x2,y2,stroke,lw){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function _text(x,y,txt,fill,font){ctx.fillStyle=fill;ctx.font=font;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,x,y);}
// Tapered claw/scratch-mark shape: a thin curved leaf pointed at both ends,
// following a gentle bow along its length — reads as a slash mark rather
// than a plain stroked line.
function _clawMark(cx,cy,angleDeg,length,maxWidth,bow,color,outline){
  const rad=angleDeg*Math.PI/180,dx=Math.cos(rad),dy=Math.sin(rad),nx=-dy,ny=dx,segs=14,pts=[];
  for(let i=0;i<=segs;i++){
    const t=i/segs,taper=Math.sin(t*Math.PI),curve=Math.sin(t*Math.PI)*bow;
    pts.push({px:cx+dx*length*t+nx*curve,py:cy+dy*length*t+ny*curve,ox:nx*taper*maxWidth,oy:ny*taper*maxWidth});
  }
  ctx.beginPath();
  pts.forEach((p,i)=>{const x=p.px+p.ox,y=p.py+p.oy;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});
  for(let i=segs;i>=0;i--){const p=pts[i];ctx.lineTo(p.px-p.ox,p.py-p.oy);}
  ctx.closePath();
  ctx.fillStyle=color;ctx.fill();
  if(outline){ctx.strokeStyle=outline;ctx.lineWidth=1.2;ctx.stroke();}
}

// ================================================================
//  DAMAGE & SKILL UTILS
// ================================================================
function shadowSoulTarget(real){
  // SHADOW — Thoát Xác: while the soul is out, redirect anything that would
  // target the real fighter onto the stationary decoy old body instead.
  if(real&&real._soulActive&&real._soulBody)return real._soulBody;
  return real;
}
function getAllEnemies(attacker){
  if(gameState==="GAMEPLAY"){
    // KHÔNG BỊ CHỌN LÀM MỤC TIÊU: a fighter submerged in Mud Form is dropped
    // from the enemy-selection pool entirely, so opposing skills/AOEs simply
    // have no target to hit while it's active.
    const fighters=[p1,p2].filter(p=>p!==attacker&&p.hp>0&&!(p.charType==="earth"&&p.earthMudActive)).map(p=>shadowSoulTarget(p));
    const oppPuppets=puppets.filter(pu=>pu.owner!==attacker&&pu.hp>0);
    return[...fighters,...oppPuppets];
  }
  if(gameState==="ROAD"){
    const arr=[...roadEnemies.filter(e=>e.hp>0)];
    const fw=getFrontWall();if(fw)arr.push(fw);
    if(roadBoss&&!roadBoss.dead&&roadBoss.hp>0&&!(roadBoss.type===2&&roadBoss.visible===false))arr.push(roadBoss);
    return arr;
  }
  return[...challengeEnemies.filter(e=>e.hp>0),...challengeBosses.filter(b=>!b.dead&&b.hp>0)];
}
function getFrontWall(){const ahead=roadWalls.filter(w=>w.hp>0&&w.x>=p1.x-80);if(!ahead.length)return null;return ahead.reduce((a,b)=>a.x<b.x?a:b);}
// Quái trong Đường Đi trước đây luôn lao thẳng vào người chơi bất kể lính đất
// (con rối) đứng chắn đường ngay trước mặt — giờ chọn mục tiêu gần nhất giữa
// người chơi và các lính đất còn sống, để lính đất thực sự hứng đòn thay người chơi.
function pickRoadMeleeTarget(e){
  const p1Target=shadowSoulTarget(p1);
  const minions=(p1.earthMinions||[]).filter(m=>m.hp>0);
  if(!minions.length)return p1Target;
  let best=p1Target,bestD=Math.abs(p1Target.x-e.x);
  minions.forEach(m=>{const d=Math.abs(m.x-e.x);if(d<bestD){best=m;bestD=d;}});
  return best;
}
// Fixed obstacles (gates) and the 3 major road bosses are anchored set-pieces —
// knockback/push effects should still damage them but must never reposition them.
function isPushable(t){return !(t instanceof RoadWall) && !(t instanceof RoadBoss) && !(t instanceof Fighter && t.charType==="earth" && t.earthMudActive);}
function getRoadTarget(attacker){const cands=getAllEnemies(attacker);if(!cands.length)return null;return cands.reduce((best,c)=>Math.abs(c.x-attacker.x)<Math.abs(best.x-attacker.x)?c:best);}
// Called once per successful hit landed anywhere in applyDamage — feeds the
// floating damage number, the human player's combo counter, and the (throttled)
// hit sound. Kept separate from applyDamage's per-target branches so every
// target type (Fighter, bosses, road enemies, walls...) gets the same feel.
function _afterHit(target,dmgVal,attacker,isCrit){
  spawnDamageNumber(target.x, target.y-70, dmgVal, isCrit);
  if(attacker===p1){
    comboCount++; comboTimer=90;
    if(comboCount>comboMaxThisRun)comboMaxThisRun=comboCount;
    if(comboCount>=5 && comboCount%5===0)sfxComboMilestone(comboCount);
  }
  if(_hitSfxCooldown<=0){ sfxHit(isCrit); _hitSfxCooldown=4; }
  // RED V4 INNATE — HỎA CHỦNG (Fire Seed): every landed hit while transformed
  // builds a stack (max 10). At 10 stacks the NEXT hit (this one) detonates,
  // burning everything nearby, then resets to 0. Replaces the old flat
  // damage-boost-only / invulnerability-only V4 mechanics.
  if(attacker instanceof Fighter && attacker.charType==="red" && attacker.transformActive){
    attacker.hoaChungStacks=(attacker.hoaChungStacks||0)+1;
    attacker.hoaChungFlashTimer=12;
    if(attacker.hoaChungStacks>=10){
      attacker.hoaChungStacks=0;
      triggerHoaChungExplosion(attacker,target);
    }
  }
  // FIRE — every hit from any of Fire's 4 skills ignites the target with a
  // burn (damage-over-time) tick, stronger while in Flame V2. Handled once
  // here so it automatically works for every game mode/target type.
  if(attacker instanceof Fighter && attacker.charType==="fire" && attacker.activeSkill && attacker.activeSkill.indexOf("fire_")===0){
    const v2=attacker.transformActive;
    igniteBurn(target,attacker,v2?3:1.5,v2?6:4);
    if(attacker.activeSkill==="fire_s1"){
      for(let i=0;i<10;i++){const ang=rng()*Math.PI*2,spd=rng()*4+2;hitEffects.push({x:target.x,y:target.y-50,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:22,maxLife:22,particle:true,color:rndChoice(v2?["#00AEFF","#00E5FF","white"]:["#FF6600","#FF4400","orange","yellow"])});}
    }
  }
}
// Fires once Hỏa Chủng reaches 10 stacks: the triggering hit detonates,
// scorching the target a little extra and burning every other nearby enemy
// of the attacker for area damage. Bounded to a small fixed radius/enemy
// list (getAllEnemies is already capped per game mode) so it can never
// runaway/recurse — each secondary hit only adds ordinary stacks again.
function triggerHoaChungExplosion(attacker,centerTarget){
  const cx=centerTarget.x, cy=centerTarget.y;
  const R=170*SR, RY=120*SR;
  screenShake=Math.max(screenShake,14);
  sfxExplosion();
  for(let i=0;i<26;i++){
    const ang=rng()*Math.PI*2,spd=rng()*7+3;
    hitEffects.push({x:cx,y:cy-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3,life:34,maxLife:34,particle:true,color:rndChoice(["#FF2200","#FF6600","#FFAA00","#FFEE88","white"])});
  }
  hitEffects.push({x:cx,y:cy-20,life:26,maxLife:26,color:"#FF6600",ring:true,big:true});
  hitEffects.push({x:cx,y:cy-20,life:36,maxLife:36,color:"#FFDD55",ring:true,big:true,delay:4});
  _text(cx,cy-140,"💥 HỎA CHỦNG BÙNG NỔ 💥","#FFAA00","12px Arial bold");
  const dmg=16;
  applyDamage(centerTarget,dmg*0.6,attacker); // extra ignite payoff on the target that popped the stacks
  getAllEnemies(attacker).forEach(en=>{
    if(en===centerTarget)return;
    const dx=en.x-cx, dy=(en.y!==undefined?en.y:cy)-cy;
    if(Math.abs(dx)<R && Math.abs(dy)<RY) applyDamage(en,dmg,attacker);
  });
}
function applyDamage(target,damage,attacker){
  // TRANSFORM WIND-UP IMMUNITY: while charging a wind-up transform (currently
  // only SHADOW's 4.25s "Bóng Tối Thức Tỉnh" — see castSkill skillNum===5 /
  // applyGravity in 03), the fighter stands frozen and defenseless. Without
  // this, any mob nearby just walks up and kills them mid-animation. Fully
  // invulnerable (no damage, no CC) for the whole wind-up.
  if(target instanceof Fighter&&target.transformWindupTimer>0)return;
  // EARTH MUD IMMUNITY: while in mud form, earth fighter is immune to all damage and CC
  if(target instanceof Fighter&&target.charType==="earth"&&target.earthMudActive)return;
  // THUNDER DASH IMMUNITY: while dashing as a bolt of lightning, the thunder
  // fighter is immune to collisions/CC/pushback/damage for the ~0.3s dash.
  if(target instanceof Fighter&&target.charType==="thunder"&&target.thunderDashTimer>0)return;
  // FIRE DASH IMMUNITY: while streaking through as living flame, immune to hits.
  if(target instanceof Fighter&&target.charType==="fire"&&target.fireDashTimer>0)return;
  // SHADOW SOUL IMMUNITY: while the soul has left the body (Thoát Xác), the real
  // fighter cannot be targeted or damaged — only the decoy old body left behind can.
  if(target instanceof Fighter&&target._soulActive)return;
  // CRITICAL HITS: any attacking Fighter has a flat chance to land a heavier,
  // more satisfying hit (bonus damage + bigger gold number + sharper sfx).
  let isCrit=false;
  if(attacker instanceof Fighter && rng()<CRIT_CHANCE){ damage*=CRIT_MULT; isCrit=true; }
  if(attacker&&attacker.charType==="red")damage*=1.2;
  if(attacker&&attacker.charType==="frost"&&attacker.frostComboBonusPct>0){damage*=1+attacker.frostComboBonusPct;attacker.frostComboBonusPct=0;}
  if(attacker&&attacker.transformActive){const buffs=attacker.getTransformBuffs();damage*=buffs.dmg_mult||1;const ls=buffs.lifesteal||0;if(ls>0&&attacker.hp!==undefined)attacker.hp=Math.min(attacker.maxHp||MAX_HP,attacker.hp+damage*ls);}
  if(target instanceof Fighter){
    if(target.hp<=0)return;
    if(target.charType==="red"&&target.transformInvisActive)return;
    if(target.charType==="earth"&&target.ghostHp>0){target.ghostHp-=damage;if(target.ghostHp<0){const ov=-target.ghostHp;target.ghostHp=0;target.hp-=target.isShielding?ov*0.2:ov;target.hp=Math.max(0,target.hp);}return;}
    // V4 EARTH INNATE: rock armor auto-block (20-30% chance when transformed)
    if(target.charType==="earth"&&target.transformActive&&rng()<0.25){
      // Rock plate shatters to absorb the hit
      const reduced=damage*0.7;
      target.hp-=target.isShielding?reduced*0.2:reduced;
      target.hp=Math.max(0,target.hp);
      // Rock shatter visual
      spawnHitEffect(target.x,target.y-70,"#c68a4a");
      for(let i=0;i<6;i++){const ang=rng()*Math.PI*2,spd=rng()*5+2;hitEffects.push({x:target.x,y:target.y-50,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:22,maxLife:22,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"])});}
      hitEffects.push({x:target.x,y:target.y-50,life:15,maxLife:15,color:"#c68a4a",ring:true});
      screenShake=Math.max(screenShake,5);
      return;
    }
    if(target.charType==="water"&&target.waterShieldHp>0){target.waterShieldHp-=damage;if(target.waterShieldHp<0){const ov=-target.waterShieldHp;target.waterShieldHp=0;target.hp-=target.isShielding?ov*0.2:ov;target.hp=Math.max(0,target.hp);}return;}
    if(target.charType==="earth"&&target.activeSkill==="earth_s3"&&attacker){const ref=damage*0.8;if(attacker.hp!==undefined)attacker.hp=Math.max(0,attacker.hp-(attacker.isShielding?ref*0.2:ref));return;}
    let finalDmg=damage;
    if(target.dmgReduceTimer&&target.dmgReduceTimer>0)finalDmg*=0.3;
    target.hp-=target.isShielding?finalDmg*0.2:finalDmg;
    target.hp=Math.max(0,target.hp);
    spawnHitEffect(target.x,target.y-70,ELEMENT_COLORS[attacker&&attacker.charType]||"white");
    _afterHit(target,finalDmg,attacker,isCrit);
    // The human player's combo resets the instant they take a hit themselves.
    if(target===p1 && attacker!==p1){ comboCount=0; comboTimer=0; }
  }else if(target&&target._isSoulDecoy){spawnHitEffect(target.x,target.y-60,"#7a3aff");}
  else if(target instanceof IcePuppet){if(target.hp<=0)return;target.hp=Math.max(0,target.hp-damage);spawnHitEffect(target.x,target.y-40,"white");_afterHit(target,damage,attacker,isCrit);}
  else if(target instanceof ChallengeEnemy){if(target.hp<=0)return;target.hp=Math.max(0,target.hp-damage);spawnHitEffect(target.x,target.y-50,"orange");_afterHit(target,damage,attacker,isCrit);}
  else if(target instanceof Boss){if(target.dead||target.hp<=0)return;let bDmg=damage;if(target.rockWallActive&&target.dmgReducePct)bDmg*=(1-target.dmgReducePct);target.hp-=bDmg;spawnHitEffect(target.x,target.y-90,"gold");_afterHit(target,bDmg,attacker,isCrit);if(target.hp<=0){target.hp=0;target.dead=true;spawnBossDeathBurst(target.x,target.y);}}
  else if(target instanceof EarthSoldier||target instanceof EarthArcher){if(target.hp<=0)return;target.hp=Math.max(0,target.hp-damage);spawnHitEffect(target.x,target.y-40,"#c68a4a");_afterHit(target,damage,attacker,isCrit);}
  else if(target instanceof RoadWall){if(target.hp<=0)return;target.hp=Math.max(0,target.hp-damage);spawnHitEffect(target.x,H*FLOOR_Y_RATIO-90,"#e8a33d");_afterHit(target,damage,attacker,isCrit);}
  else if(target instanceof RoadEnemy){if(target.hp<=0)return;target.hp=Math.max(0,target.hp-damage);spawnHitEffect(target.x,target.y-50,"#ffaa33");_afterHit(target,damage,attacker,isCrit);if(target.hp<=0)roadKillCount++;}
  else if(target instanceof RoadBoss){
    if(target.dead||target.dying||target.hp<=0)return;
    if(target.type===2&&target.visible===false)return;
    if(target.type===2&&target.armorActive)damage*=0.8; // Nội tại: Giáp Cát giảm 20% sát thương
    target.hp-=damage;target.hitFlash=8;
    spawnHitEffect(target.x,target.y-100,"crimson");
    _afterHit(target,damage,attacker,isCrit);
    if(target.hp<=0){
      target.hp=0;
      if(target.type===2){target.dying=true;target.deathTimer=70;}
      else{target.dead=true;spawnBossDeathBurst(target.x,target.y);}
    }
  }
}
// ---- THUNDER: Chain Lightning ----
// Fires a bolt from (x,y) to the nearest un-chained enemy, then keeps jumping
// to the next nearest enemy (within CHAIN_RANGE) up to maxTargets total,
// losing ~15% damage per jump. Draws a jagged bolt effect for each jump and
// stops the moment no valid target remains in range.
const CHAIN_RANGE=380;
function chainLightning(attacker,fromX,fromY,damage,maxTargets=5,excludeFirst=null,customRange=null){
  const hitSet=new Set();
  let cx=fromX,cy=fromY,curDmg=damage,jumps=0;
  if(excludeFirst)hitSet.add(excludeFirst);
  const range = customRange || CHAIN_RANGE * SR;
  while(jumps<maxTargets){
    const cands=getAllEnemies(attacker).filter(t=>t&&t.hp>0&&!hitSet.has(t)&&dist(cx,cy,t.x,t.y)<range);
    if(!cands.length)break;
    const nextT=cands.reduce((a,b)=>dist(cx,cy,a.x,a.y)<dist(cx,cy,b.x,b.y)?a:b);
    spawnLightningArc(cx,cy,nextT.x,nextT.y-40);
    applyDamage(nextT,curDmg,attacker);
    addShock(nextT,attacker);
    hitSet.add(nextT);
    cx=nextT.x;cy=nextT.y-40;
    curDmg*=0.85; // 15% falloff per jump
    jumps++;
  }
  return jumps;
}
let lightningArcs=[];
function spawnLightningArc(x1,y1,x2,y2){
  const pts=[x1,y1];let cx=x1,cy=y1;
  const steps=6;
  for(let i=1;i<=steps;i++){
    const t=i/steps;
    cx=x1+(x2-x1)*t+rndInt(-14,14);
    cy=y1+(y2-y1)*t+rndInt(-14,14);
    pts.push(cx,cy);
  }
  pts.push(x2,y2);
  lightningArcs.push({pts,life:12,maxLife:12});
}
function updateAndDrawLightningArcs(){
  _compact(lightningArcs,a=>a.life>0);
  lightningArcs.forEach(a=>{
    a.life--;
    const alpha=Math.max(0,a.life/a.maxLife);
    ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor="#FFD700";ctx.shadowBlur=18;
    ctx.strokeStyle="#FFFFFF";ctx.lineWidth=3;ctx.lineCap="round";
    ctx.beginPath();for(let i=0;i<a.pts.length;i+=2){i===0?ctx.moveTo(a.pts[i],a.pts[i+1]):ctx.lineTo(a.pts[i],a.pts[i+1]);}ctx.stroke();
    ctx.strokeStyle="#FFD700";ctx.lineWidth=1.5;ctx.stroke();
    ctx.restore();
  });
}
// ---- THUNDER: Shock Stack ----
// Every hit from a thunder-type attacker builds a stack on the target; at 5
// stacks it detonates (stun + launch + burst damage) and resets to 0.
function addShock(target,attacker){
  if(!attacker||attacker.charType!=="thunder")return;
  if(!(target instanceof Fighter))return;
  if(target.hp<=0)return;
  target.shockStack=(target.shockStack||0)+1;
  if(target.shockStack>=5){
    target.shockStack=0;
    applyDamage(target,18,attacker);
    target.stunTimer=Math.max(target.stunTimer||0,50);
    target.vy=-10;
    screenShake=Math.max(screenShake,18);
    spawnHitEffect(target.x,target.y-70,"#FFFFFF");
    for(let i=0;i<16;i++){const ang=rng()*Math.PI*2,spd=rng()*5+2;hitEffects.push({x:target.x,y:target.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:26,maxLife:26,particle:true,color:rndChoice(["#FFD700","#FFF176","white"])});}
  }
}
function aoeHit(attacker,damage,radius){radius*=SR;getAllEnemies(attacker).forEach(tgt=>{const tr=radius*(tgt.sizeMult||1);if(Math.abs(tgt.x-attacker.x)<tr&&Math.abs(tgt.y-attacker.y)<tr*0.8)applyDamage(tgt,damage,attacker);});}
function aoeHitAt(attacker,damage,cx,cy,radius){radius*=SR;getAllEnemies(attacker).forEach(tgt=>{const tr=radius*(tgt.sizeMult||1);if(Math.abs(tgt.x-cx)<tr&&Math.abs(tgt.y-cy)<tr*0.9)applyDamage(tgt,damage,attacker);});}
// THUNDER GOD JUDGMENT (ultimate): instead of one flat continuous tick, the
// map goes dark and ~30-50 individual lightning strikes crash down at random
// spots for the duration; any enemy caught under a strike takes a real burst
// of damage, gets knocked up, and leaves a brief lingering shock zone.
function thunderJudgmentTick(attacker){
  if(!(attacker.ultiTimer>0))return;
  if(attacker.animFrame%4===0){
    const rangeX=520*SR;
    const sx=attacker.x+rndInt(-rangeX,rangeX);
    getAllEnemies(attacker).forEach(t=>{
      if(t&&t.hp>0&&Math.abs(t.x-sx)<65*SR){
        applyDamage(t,8,attacker);
        if(t instanceof Fighter)t.vy=-9;
        addShock(t,attacker);
        spawnHitEffect(t.x,t.y-60,"#FFFFFF");
      }
    });
    screenShake=Math.max(screenShake,10);
  }
}
function aoePush(attacker,damage,radius){radius*=SR;getAllEnemies(attacker).forEach(tgt=>{if(tgt instanceof Fighter&&tgt.charType==="thunder"&&tgt.thunderDashTimer>0)return;const dx=tgt.x-attacker.x;if(Math.abs(dx)<radius&&Math.abs(tgt.y-attacker.y)<120*SR){if(isPushable(tgt)){const pd=dx>=0?1:-1;tgt.x=clamp(tgt.x+pd*Math.floor(radius*0.5),moveBoundLo(),moveBoundHi());if(tgt instanceof Fighter)tgt.vy=-5;}applyDamage(tgt,damage,attacker);}});}
function getChallengeTarget(attacker){const cands=[...challengeEnemies.filter(e=>e.hp>0),...challengeBosses.filter(b=>!b.dead&&b.hp>0)];if(!cands.length)return null;return cands.reduce((best,c)=>Math.abs(c.x-attacker.x)<Math.abs(best.x-attacker.x)?c:best);}

// ================================================================
//  EARTH S2: MUD FORM TICK
// ================================================================
function tickEarthMud(p){
  if(!p.earthMudActive)return;
  // MIỄN KHỐNG CHẾ: mud form is immune to all crowd control. applyDamage()
  // already blocks damage-attached CC at the source; this clears any CC that
  // gets set directly on the fighter (e.g. boss scripts) so nothing lingers.
  p.stunTimer=0;p.slowTimer=0;
  p.earthMudTimer--;
  // Speed buff
  if(p.earthMudTimer>0){
    // HP regen
    p.hp=Math.min(p.maxHp||MAX_HP,p.hp+(p.earthMudRegen/60));
  }
  // End mud form
  if(p.earthMudTimer<=0){
    p.earthMudActive=false;
    p.isAttacking=false;
    p.activeSkill=null;
    screenShake=6;
  }
}

// ================================================================
//  EARTH S4 — THIÊN THẠCH (Meteor): the meteor's fall itself is purely
//  visual (drawn in Fighter._drawUlti() from p.ultiTimer/_meteorWindup);
//  this function only fires the single impact hit once, near the end of
//  the windup, then leaves the crater/dust visuals to keep playing out
//  for the remaining frames.
// ================================================================
function tickEarthMeteor(p){
  if(p.activeSkill!=="earth_s4"||p.ultiTimer<=0)return;
  const windup=p._meteorWindup||150;
  const triggerAt=Math.max(1,windup-24); // impact lands ~0.4s before the ulti fully ends, leaving time for the shockwave/dust to play
  if(!p._meteorExploded&&p.ultiTimer<=triggerAt){
    p._meteorExploded=true;
    p._meteorExplodeFrame=windup-p.ultiTimer;
    const tx=p._meteorTargetX,ty=p._meteorTargetY;
    // Flat 40 damage to every enemy present, screen-wide — this is meant to
    // hit the whole fight, not just enemies standing near the impact point.
    getAllEnemies(p).forEach(en=>{
      if(en&&en.hp>0){
        applyDamage(en,40,p);
        if(isPushable(en)){if(en instanceof Fighter)en.vy=-11;}
      }
    });
    screenShake=Math.max(screenShake,45);
    sfxExplosion();
    // Crater dust + flying rock debris
    for(let i=0;i<50;i++){
      const ang=rng()*Math.PI*2,spd=rng()*11+3;
      hitEffects.push({x:tx,y:ty-10,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-6,life:44,maxLife:44,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a","#5a4030","#c9a06a"])});
    }
    for(let i=0;i<16;i++){
      hitEffects.push({x:tx+rndInt(-50,50),y:ty+rndInt(-10,10),vy:-rng()*1.3-0.3,vx:(rng()-0.5)*0.7,life:60,maxLife:60,smoke:true,r0:rndInt(16,30),color:rndChoice(["#5a4a3a","#3a2e22","#786040"])});
    }
    hitEffects.push({x:tx,y:ty,life:28,maxLife:28,color:"#c9a06a",ring:true,big:true});
    hitEffects.push({x:tx,y:ty,life:36,maxLife:36,color:"#5a4030",ring:true,big:true});
  }
}

// ================================================================
//  THUNDER S3: LIGHTNING STRIKE WITH DELAYED DAMAGE
// ================================================================
function tickThunderS3(p){
  if(p.activeSkill!=="thunder_s3"||p.thunderS3Targets.length===0)return;
  if(!p.thunderS3DelayTick)p.thunderS3DelayTick=0;
  p.thunderS3DelayTick++;
  // Damage happens after 20 frames (~0.33s) when lightning "touches ground"
  if(p.thunderS3DelayTick>=p.thunderS3MaxTick){
    // Deal damage to targets at their locked positions
    p.thunderS3Targets.forEach(tgt=>{
      if(tgt.targetRef&&tgt.targetRef.hp>0){
        aoeHitAt(p,14,tgt.x,tgt.y,140);
        addShock(tgt.targetRef,p);
        if(tgt.targetRef instanceof Fighter&&tgt.targetRef.hp>0){
          tgt.targetRef.thunderPrisonTimer=150;
          tgt.targetRef.thunderPrisonCenterX=tgt.x;
          tgt.targetRef.thunderPrisonCenterY=tgt.y;
          tgt.targetRef._thunderPrisonCaster=p;
          tgt.targetRef.stunTimer=Math.max(tgt.targetRef.stunTimer||0,20);
        }
      }
    });
    // Clear after damage
    p.thunderS3Targets=[];
    p.thunderS3DelayTick=0;
  }
}

// ================================================================
//  FIRE — Fire Pillar (skill 2): warning telegraph, then the pillar(s)
//  erupt at the locked ground position(s) and deal AOE damage + knockback
//  + ignite burn (burn itself is applied centrally in _afterHit).
// ================================================================
function tickFirePillar(p){
  if(p.activeSkill!=="fire_s2"||!p.firePillarTargets||p.firePillarTargets.length===0)return;
  p.firePillarDelayTick=(p.firePillarDelayTick||0)+1;
  if(p.firePillarDelayTick>=(p.firePillarMaxTick||22)){
    const v2=p.transformActive;
    const buffs=v2?p.getTransformBuffs():{};
    const dmg=v2?22:15, rad=v2?200:160;
    if(!p._firePillarBursts)p._firePillarBursts=[];
    p.firePillarTargets.forEach(t=>{
      aoeHitAt(p,dmg,t.x,t.y,rad);
      const kb=(v2?110:80)*(buffs.knockback_mult||1);
      getAllEnemies(p).forEach(en=>{
        if(en&&en.hp>0&&isPushable(en)&&Math.abs(en.x-t.x)<rad*SR&&Math.abs((en.y||t.y)-t.y)<120*SR){
          const pd=en.x>=t.x?1:-1;
          en.x=clamp(en.x+pd*kb,moveBoundLo(),moveBoundHi());
          if(en instanceof Fighter)en.vy=-9;
        }
      });
      screenShake=Math.max(screenShake,v2?26:18);
      sfxExplosion();
      // A tall, wide, roaring column of fire that lingers for ~0.6s
      p._firePillarBursts.push({x:t.x,y:t.y,life:38,maxLife:38,v2});
      for(let i=0;i<34;i++){const ang=rng()*Math.PI*2,spd=rng()*7+2;hitEffects.push({x:t.x,y:t.y-30,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-5,life:36,maxLife:36,particle:true,color:v2?rndChoice(["#00AEFF","#00E5FF","white","#66F0FF"]):rndChoice(["#FF6600","#FF4400","#FFAA33","#FFDD66"])});}
      hitEffects.push({x:t.x,y:t.y,life:26,maxLife:26,color:v2?"#00CFFF":"#FF6600",ring:true,big:true});
      hitEffects.push({x:t.x,y:t.y,life:34,maxLife:34,color:"white",ring:true,big:true});
    });
    p.firePillarTargets=[];
    p.firePillarDelayTick=0;
  }
}
// ================================================================
//  FIRE — Flame Destroyer (skill 4 / ultimate): giant fireball forms above
//  the target then explodes for a single big AOE hit. Visual growth is
//  drawn in Fighter._drawUlti(); this function only handles the actual
//  damage/knockback/shake trigger at the right moment.
// ================================================================
function tickFireUlti(p){
  if(p.activeSkill!=="fire_s4"||p.ultiTimer<=0)return;
  const windup=p._fireUltiWindup||100;
  const triggerAt=Math.max(1,windup-45); // explode with ~45 frames (~0.75s) left for the big shockwave to play out
  if(!p._fireUltiExploded&&p.ultiTimer<=triggerAt){
    p._fireUltiExploded=true;
    p._fireUltiExplodeFrame=windup-p.ultiTimer;
    const v2=p.transformActive;
    const buffs=v2?p.getTransformBuffs():{};
    const dmg=v2?70:48, rad=v2?380:280;
    aoeHitAt(p,dmg,p._fireUltiTargetX,p._fireUltiTargetY,rad);
    getAllEnemies(p).forEach(en=>{
      if(en&&en.hp>0&&isPushable(en)&&Math.abs(en.x-p._fireUltiTargetX)<rad*SR){
        const pd=en.x>=p._fireUltiTargetX?1:-1;
        const kb=(v2?220:160)*(buffs.knockback_mult||1);
        en.x=clamp(en.x+pd*kb,moveBoundLo(),moveBoundHi());
        if(en instanceof Fighter)en.vy=-13;
      }
    });
    screenShake=Math.max(screenShake,v2?55:40);
    sfxExplosion();
    // Huge particle storm — the actual "big" shockwave rings are drawn every
    // frame directly in Fighter._drawUlti() (see below) so their size isn't
    // limited by the generic hitEffects "ring/big" 80px cap.
    for(let i=0;i<70;i++){
      const ang=rng()*Math.PI*2,spd=rng()*14+4;
      hitEffects.push({x:p._fireUltiTargetX,y:p._fireUltiTargetY-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-4,life:50,maxLife:50,particle:true,color:v2?rndChoice(["#00AEFF","#00E5FF","white","#66F0FF","#0088FF"]):rndChoice(["#FF8800","#FFCC33","#FF4400","white","#FF2200"])});
    }
    for(let i=0;i<18;i++){
      hitEffects.push({x:p._fireUltiTargetX+rndInt(-40,40),y:p._fireUltiTargetY+rndInt(-20,20),vy:-rng()*1.2-0.3,vx:(rng()-0.5)*0.6,life:70,maxLife:70,smoke:true,r0:rndInt(18,34),color:v2?rndChoice(["#0055CC","#1560c4","#3fa9ff"]):rndChoice(["#5a2a00","#8a3a00","#c65a10"])});
    }
  }
}
// ================================================================
//  SHADOW — Void Tentacle (skill F / s2): a portal opens above the target;
//  after a short beat, a tentacle stabs down dealing damage + a 50% slow.
// ================================================================
function tickShadowTentacle(p){
  if(p.activeSkill==="shadow_s2"&&p.shadowTentacleTarget){
    const t=p.shadowTentacleTarget;
    const portalDur=p.shadowTentaclePortalDur||20,waitDur=p.shadowTentacleWaitDur||15,growDur=p.shadowTentacleGrowDur||15;
    const maxTick=p.shadowTentacleMaxTick||(portalDur+waitDur+growDur);
    p.shadowTentacleDelayTick=(p.shadowTentacleDelayTick||0)+1;
    const elapsed=p.shadowTentacleDelayTick;
    // While reaching out (post-wait), keep the tentacle's TIP tracking the live
    // target — if it runs, the tentacle stretches further to still reach it.
    if(elapsed>portalDur&&t.ref&&t.ref.hp>0){t.tipX=t.ref.x;t.tipY=t.ref.y;}
    if(elapsed>=maxTick){
      aoeHitAt(p,17,t.tipX,t.tipY,70);
      getAllEnemies(p).forEach(en=>{
        if(en&&en.hp>0&&Math.abs(en.x-t.tipX)<70*SR&&Math.abs((en.y||t.tipY)-t.tipY)<110*SR){
          if(en instanceof Fighter){en.slowTimer=Math.max(en.slowTimer||0,60);en._slowPct=0.5;}
        }
      });
      // A light tap of impact feedback — no big "boom" burst. The tentacle
      // instead hands off into a slow 0.65s dissolve (see below).
      screenShake=Math.max(screenShake,5);
      spawnHitEffect(t.tipX,t.tipY,"#6a1aa8");
      p._shadowTentacleDissolve={portalX:t.portalX,portalY:t.portalY-90,tipX:t.tipX,tipY:t.tipY,timer:39,maxTimer:39};
      p.shadowTentacleTarget=null;
      p.shadowTentacleDelayTick=0;
    }
  }
  if(p._shadowTentacleDissolve){
    const d=p._shadowTentacleDissolve;
    d.timer--;
    // The dissolve "front" sweeps from the tip (bottom) up to the portal
    // (top) over the fade window — everything below the front has already
    // turned into rising black smoke that drifts up and away.
    const progress=1-Math.max(0,d.timer)/d.maxTimer; // 0 → 1 across the fade
    const frontS=Math.max(0,1-progress); // 1=at tip, 0=at portal
    const dx=d.tipX-d.portalX,dy=d.tipY-d.portalY;
    const frontX=d.portalX+dx*frontS,frontY=d.portalY+dy*frontS;
    if(rng()<0.85){
      hitEffects.push({x:frontX+rndInt(-12,12),y:frontY+rndInt(-8,8),vx:(rng()-0.5)*0.5,vy:-rng()*1.3-0.5,life:34,maxLife:34,smoke:true,r0:rndInt(6,11),color:rndChoice(["#0a0014","#1a0a24","#2a0a3d"])});
    }
    if(d.timer<=0)p._shadowTentacleDissolve=null;
  }
}
// ================================================================
//  SHADOW — Ultimate (skill G / s4): giant portal + giant demon arm slam
//  onto the nearest enemy at cast time, then dissolves into black smoke —
//  fully drawn in drawShadow() in absolute world coords (see below) so it
//  isn't squashed by the caster's own CHAR_VISUAL_SCALE pivot.
// ================================================================
function tickShadowUlti(p){
  if(p.activeSkill==="shadow_s4"&&p.ultiTimer>0){
    const windup=p._shadowUltiWindup||60;
    // Keep the portal/arm tracking the target's CURRENT position while it's
    // still alive — without this the target can walk away during the windup
    // and the arm slams down on empty ground while damage still (invisibly)
    // lands on the moving target, which looks like it's "hitting randomly".
    if(!p._shadowUltiExploded&&p._shadowUltiTargetRef&&p._shadowUltiTargetRef.hp>0){
      p._shadowUltiTargetX=p._shadowUltiTargetRef.x;
      p._shadowUltiTargetY=p._shadowUltiTargetRef.y;
    }
    const triggerAt=3; // impact right near the very end of the slam
    if(!p._shadowUltiExploded&&p.ultiTimer<=triggerAt){
      p._shadowUltiExploded=true;
      const tx=p._shadowUltiTargetX,ty=p._shadowUltiTargetY;
      const ref=p._shadowUltiTargetRef;
      if(ref&&ref.hp>0)applyDamage(ref,30,p);
      else aoeHitAt(p,30,tx,ty,90);
      // Freeze is now a wide AOE around the impact point, not just the single
      // locked-on target — anyone caught under the fist gets frozen too.
      const freezeRX=150*SR,freezeRY=110*SR;
      getAllEnemies(p).forEach(en=>{
        if(en&&en.hp>0&&"stunTimer" in en&&Math.abs(en.x-tx)<freezeRX&&Math.abs((en.y||ty)-ty)<freezeRY){
          en.stunTimer=Math.max(en.stunTimer||0,180); // đóng băng 3 giây
          p._shadowFrozenTargets.push({ref:en,timer:180});
        }
      });
      // A solid thump of impact feedback — the big "boom" burst is gone,
      // it hands off into a 1s smoke dissolve.
      screenShake=Math.max(screenShake,20);
      spawnHitEffect(tx,ty-10,"#6a1aa8");
      const giantH=380; // how tall the whole portal-to-fist structure is
      p._shadowUltiDissolve={portalX:tx,portalY:ty-giantH,tipX:tx,tipY:ty,timer:60,maxTimer:60};
      // Ground crack — bigger, and lingers for a full 2 seconds instead of
      // vanishing with the initial impact spark.
      p._shadowGroundCracks=p._shadowGroundCracks||[];
      p._shadowGroundCracks.push({x:tx,y:ty,timer:120,maxTimer:120,seed:rng()*1000});
    }
  }
  // Tick + draw an actual ice-block over anyone Bàn Tay Vực Thẳm just froze —
  // same look as Frost's Ice Prison — clearing it once the freeze ends.
  if(p._shadowFrozenTargets&&p._shadowFrozenTargets.length){
    _compact(p._shadowFrozenTargets,f=>{
      if(!f.ref||f.ref.hp<=0)return false;
      f.timer--;
      return f.timer>0;
    });
  }
  if(p._shadowGroundCracks&&p._shadowGroundCracks.length){
    _compact(p._shadowGroundCracks,c=>{c.timer--;return c.timer>0;});
  }
  if(p._shadowUltiDissolve){
    const d=p._shadowUltiDissolve;
    d.timer--;
    // Same tip→portal (bottom→top) smoke sweep as Void Tentacle, just scaled
    // up to match the giant fist's size.
    const progress=1-Math.max(0,d.timer)/d.maxTimer;
    const frontS=Math.max(0,1-progress);
    const dx=d.tipX-d.portalX,dy=d.tipY-d.portalY;
    const frontX=d.portalX+dx*frontS,frontY=d.portalY+dy*frontS;
    if(rng()<0.9){
      hitEffects.push({x:frontX+rndInt(-24,24),y:frontY+rndInt(-16,16),vx:(rng()-0.5)*0.6,vy:-rng()*1.6-0.6,life:36,maxLife:36,smoke:true,r0:rndInt(12,20),color:rndChoice(["#0a0014","#1a0a24","#2a0a3d"])});
    }
    if(d.timer<=0)p._shadowUltiDissolve=null;
  }
}
// ================================================================
//  SHADOW — Thoát Xác (skill T / s3): counts down the soul window and, on
//  expiry, converges the dark dots and reforms the fighter back to normal.
// ================================================================
function tickShadowSoul(p){
  if(!p._soulActive)return;
  p._soulTimer--;
  if(rng()<0.6)hitEffects.push({x:p.x+rndInt(-16,16),y:p.y-rndInt(10,75),vx:(rng()-0.5)*0.7,vy:-rng()*1-0.2,life:26,maxLife:26,particle:true,color:rndChoice(["#5a1a8a","#2a0a3d","#9933ff"])});
  if(p._soulTimer<=0){
    p._soulActive=false;p._soulBody=null;
    for(let i=0;i<20;i++)hitEffects.push({x:p.x+rndInt(-22,22),y:p.y-40+rndInt(-30,20),vx:(rng()-0.5)*1.2,vy:-rng()*1.2,life:24,maxLife:24,particle:true,color:rndChoice(["#5a1a8a","#2a0a3d","#9933ff","white"])});
    screenShake=Math.max(screenShake,4);
  }
}
function updateShadow(p){
  if(!p||p.charType!=="shadow")return;
  tickShadowTentacle(p);
  tickShadowUlti(p);
  tickShadowSoul(p);
}
// ================================================================
//  drawShadow(p) — required per-frame draw hook for the Shadow character.
//  Draws the Void Tentacle portal warning + the decoy old body left behind
//  during Thoát Xác. (The character's own body/aura is drawn inside the
//  shared Fighter._drawInner() pipeline, dimmed there while soul is active.)
// ================================================================
function drawShadow(p){
  if(!p||p.charType!=="shadow")return;
  // While transformed into THẦN CHẾT, the portal glows reaper-purple instead
  // of the plain void magenta, to match the new hood/scythe look — the
  // tentacle itself keeps its original shape/behavior.
  const _reaperTint=!!p.transformActive;
  const _tentacleGlow=_reaperTint?"#6654ff":"#9933ff";
  const _tentacleRing=_reaperTint?"#a89bff":"#cc66ff";
  if(p.shadowTentacleTarget){
    const t=p.shadowTentacleTarget;
    const portalDur=p.shadowTentaclePortalDur||20,waitDur=p.shadowTentacleWaitDur||15,growDur=p.shadowTentacleGrowDur||15;
    const elapsed=p.shadowTentacleDelayTick||0;
    const portalX=t.portalX,portalY=t.portalY-90;
    // Phase A — the portal itself grows in.
    const progA=Math.min(1,elapsed/portalDur);
    const portalR=10+progA*36;
    const pulse=elapsed>portalDur?Math.sin(frameCount*0.2)*3:0; // gentle idle pulse while holding open
    ctx.save();ctx.globalAlpha=0.85;ctx.shadowColor=_tentacleGlow;ctx.shadowBlur=18;
    ctx.fillStyle="#0a0014";
    ctx.beginPath();ctx.ellipse(portalX,portalY,portalR+pulse,(portalR+pulse)*0.4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=_tentacleRing;ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(portalX,portalY,portalR+pulse,(portalR+pulse)*0.4,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    // Phase C — a segmented, writhing, diagonally-leaning tentacle grows out
    // of the portal toward the target's CURRENT position (t.tipX/tipY), so it
    // visibly stretches farther if the target has run away since the cast.
    if(elapsed>portalDur+waitDur){
      const progC=Math.min(1,(elapsed-portalDur-waitDur)/growDur);
      const tipX=t.tipX,tipY=t.tipY;
      const dx=tipX-portalX,dy=tipY-portalY;
      const dist=Math.hypot(dx,dy)||1;
      const ux=dx/dist,uy=dy/dist;
      const perpX=-uy,perpY=ux;
      const grownLen=dist*progC;
      const segCount=12;
      const leanBias=30*(p.direction||1); // gives it an inherent slant instead of a dead-straight drop
      const pts=[];
      for(let i=0;i<=segCount;i++){
        const segT=i/segCount;
        if(segT>progC)break;
        const along=dist*segT;
        const baseX=portalX+ux*along,baseY=portalY+uy*along;
        const waveAmp=20*Math.sin(Math.min(1,segT/Math.max(0.001,progC))*Math.PI);
        const wavePhase=segT*Math.PI*2.6-frameCount*0.18;
        const wave=Math.sin(wavePhase)*waveAmp;
        const leanAmt=leanBias*Math.sin(Math.min(1,segT)*Math.PI*0.5);
        pts.push({x:baseX+perpX*wave+leanAmt,y:baseY+perpY*wave});
      }
      if(pts.length>1){
        ctx.save();ctx.shadowColor="#2a0a3d";ctx.shadowBlur=14;ctx.lineCap="round";ctx.lineJoin="round";
        ctx.strokeStyle="#1a0a24";ctx.lineWidth=13;
        ctx.beginPath();pts.forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y));ctx.stroke();
        ctx.strokeStyle="#3a0a55";ctx.lineWidth=7;ctx.stroke();
        ctx.strokeStyle=_tentacleGlow;ctx.lineWidth=2;ctx.globalAlpha=0.7;ctx.stroke();
        // little sucker rings along the body
        ctx.globalAlpha=1;
        pts.forEach((pt,i)=>{if(i%2===0&&i>0){ctx.beginPath();ctx.arc(pt.x,pt.y,4,0,Math.PI*2);ctx.fillStyle="#6a1aa8";ctx.fill();}});
        // pointed tip
        const last=pts[pts.length-1];
        ctx.fillStyle="#0a0014";
        ctx.beginPath();ctx.moveTo(last.x,last.y-9);ctx.lineTo(last.x+7,last.y+9);ctx.lineTo(last.x-7,last.y+9);ctx.closePath();ctx.fill();
        ctx.restore();
      }
    }
    _text(portalX,portalY-45,_reaperTint?"🕳️ THẦN CHẾT TRIỆU HỒI 🕳️":"🕳️ VOID TENTACLE 🕳️",_tentacleRing,"10px Arial bold");
  }
  if(p._shadowTentacleDissolve){
    // The tentacle & portal shrink away from the tip up toward the portal
    // over 0.65s, in step with the rising smoke spawned in tickShadowTentacle.
    const d=p._shadowTentacleDissolve;
    const progress=1-Math.max(0,d.timer)/d.maxTimer;
    const frontS=Math.max(0,1-progress);
    const alpha=Math.max(0,d.timer/d.maxTimer);
    const portalX=d.portalX,portalY=d.portalY,tipX=d.tipX,tipY=d.tipY;
    const dx=tipX-portalX,dy=tipY-portalY;
    const dist=Math.hypot(dx,dy)||1;
    const ux=dx/dist,uy=dy/dist;
    const perpX=-uy,perpY=ux;
    const segCount=12;
    const leanBias=30*(p.direction||1);
    const pts=[];
    for(let i=0;i<=segCount;i++){
      const segT=i/segCount;
      if(segT>frontS)break; // the tip-side portion has already dissolved into smoke
      const along=dist*segT;
      const baseX=portalX+ux*along,baseY=portalY+uy*along;
      const waveAmp=20*Math.sin(segT*Math.PI);
      const wavePhase=segT*Math.PI*2.6-frameCount*0.18;
      const wave=Math.sin(wavePhase)*waveAmp;
      const leanAmt=leanBias*Math.sin(Math.min(1,segT)*Math.PI*0.5);
      pts.push({x:baseX+perpX*wave+leanAmt,y:baseY+perpY*wave});
    }
    if(pts.length>1){
      ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor="#2a0a3d";ctx.shadowBlur=14;ctx.lineCap="round";ctx.lineJoin="round";
      ctx.strokeStyle="#1a0a24";ctx.lineWidth=13;
      ctx.beginPath();pts.forEach((pt,i)=>i===0?ctx.moveTo(pt.x,pt.y):ctx.lineTo(pt.x,pt.y));ctx.stroke();
      ctx.strokeStyle="#3a0a55";ctx.lineWidth=7;ctx.stroke();
      ctx.restore();
    }
    const portalR=46*alpha;
    if(portalR>0.5){
      ctx.save();ctx.globalAlpha=alpha*0.85;ctx.shadowColor="#9933ff";ctx.shadowBlur=18;
      ctx.fillStyle="#0a0014";
      ctx.beginPath();ctx.ellipse(portalX,portalY,portalR,portalR*0.4,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#cc66ff";ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(portalX,portalY,portalR,portalR*0.4,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  }
  if(p.activeSkill==="shadow_s4"&&p.ultiTimer>0&&!p._shadowUltiExploded){
    // G — ULTIMATE: a GIANT portal opens above the target (0.25s), then a
    // giant demon fist slams down out of it (0.5s). Drawn here in absolute
    // world coords (not inside the caster's scaled _drawInner) so its huge
    // size doesn't get squashed toward the caster.
    const tx=p._shadowUltiTargetX,ty=p._shadowUltiTargetY;
    const portalDur=p._shadowUltiPortalDur||30,slamDur=p._shadowUltiSlamDur||30;
    const windup=p._shadowUltiWindup||(portalDur+slamDur);
    const elapsed=windup-p.ultiTimer;
    const giantH=380;
    const portalX=tx,portalY=ty-giantH;
    _text(portalX,portalY-65,"😈 BÀN TAY VỰC THẲM 😈","#cc66ff","15px Arial bold");
    const progA=Math.min(1,elapsed/portalDur);
    const portalR=40+progA*190;
    const pulse=elapsed>portalDur?Math.sin(frameCount*0.25)*6:0;
    ctx.save();ctx.globalAlpha=0.94;ctx.shadowColor="#9933ff";ctx.shadowBlur=40;
    ctx.fillStyle="#0a0014";
    ctx.beginPath();ctx.ellipse(portalX,portalY,portalR+pulse,(portalR+pulse)*0.4,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#cc66ff";ctx.lineWidth=4;
    ctx.beginPath();ctx.ellipse(portalX,portalY,portalR+pulse,(portalR+pulse)*0.4,0,0,Math.PI*2);ctx.stroke();
    ctx.strokeStyle="#6a1aa8";ctx.lineWidth=2;ctx.globalAlpha=0.6;
    ctx.beginPath();ctx.ellipse(portalX,portalY,(portalR+pulse)*0.65,(portalR+pulse)*0.26,0,0,Math.PI*2);ctx.stroke();
    ctx.restore();
    if(elapsed>portalDur){
      const progB=Math.min(1,(elapsed-portalDur)/slamDur);
      const armY=portalY+(ty-portalY)*progB;
      const armTopW=70,armBotW=140;
      ctx.save();ctx.shadowColor="#2a0a3d";ctx.shadowBlur=30;
      ctx.fillStyle="#150a1e";ctx.strokeStyle="#3a0a55";ctx.lineWidth=5;
      ctx.beginPath();
      ctx.moveTo(portalX-armTopW*0.5,portalY);ctx.lineTo(portalX-armBotW*0.5,armY);
      ctx.lineTo(portalX+armBotW*0.5,armY);ctx.lineTo(portalX+armTopW*0.5,portalY);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.strokeStyle="#3a0a55";ctx.lineWidth=2;ctx.globalAlpha=0.7;
      for(let k=1;k<4;k++){
        const kY=portalY+(armY-portalY)*(k/4);
        const kW=(armTopW+(armBotW-armTopW)*(k/4))*0.5;
        ctx.beginPath();ctx.moveTo(portalX-kW,kY);ctx.lineTo(portalX+kW,kY);ctx.stroke();
      }
      ctx.restore();
      const fistR=95;
      ctx.save();ctx.shadowColor="#2a0a3d";ctx.shadowBlur=26;
      ctx.fillStyle="#1a0a24";ctx.strokeStyle="#3a0a55";ctx.lineWidth=5;
      ctx.beginPath();ctx.ellipse(portalX,armY+30,fistR,fistR*0.75,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      for(let i=-2;i<=2;i++){
        ctx.beginPath();ctx.arc(portalX+i*30,armY+4,18,0,Math.PI*2);
        ctx.fillStyle="#241030";ctx.fill();ctx.strokeStyle="#3a0a55";ctx.lineWidth=2;ctx.stroke();
      }
      ctx.restore();
      ctx.save();ctx.fillStyle="#0a0014";ctx.strokeStyle="#6a1aa8";ctx.lineWidth=2;
      for(let i=-2;i<=2;i++){
        const cx=portalX+i*32,cy=armY+60;
        ctx.beginPath();
        ctx.moveTo(cx-14,cy);ctx.quadraticCurveTo(cx-6,cy+55,cx,cy+80);ctx.quadraticCurveTo(cx+6,cy+55,cx+14,cy);
        ctx.closePath();ctx.fill();ctx.stroke();
      }
      ctx.restore();
    }
  }
  if(p._shadowUltiDissolve){
    // The giant arm/fist retract back up into the portal over 0.5s while
    // black smoke rises off it — same treatment as Void Tentacle's dissolve.
    const d=p._shadowUltiDissolve;
    const progress=1-Math.max(0,d.timer)/d.maxTimer;
    const frontS=Math.max(0,1-progress); // 1=fully extended, 0=fully retracted
    const alpha=Math.max(0,d.timer/d.maxTimer);
    const portalX=d.portalX,portalY=d.portalY;
    const armY=portalY+(d.tipY-portalY)*frontS;
    if(frontS>0.03){
      const armTopW=70,armBotW=140;
      ctx.save();ctx.globalAlpha=alpha*0.85;ctx.shadowColor="#2a0a3d";ctx.shadowBlur=22;
      ctx.fillStyle="#150a1e";ctx.strokeStyle="#3a0a55";ctx.lineWidth=4;
      ctx.beginPath();
      ctx.moveTo(portalX-armTopW*0.5,portalY);ctx.lineTo(portalX-armBotW*0.5,armY);
      ctx.lineTo(portalX+armBotW*0.5,armY);ctx.lineTo(portalX+armTopW*0.5,portalY);
      ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
      const fistR=95*Math.min(1,frontS+0.15);
      ctx.save();ctx.globalAlpha=alpha*0.9;ctx.shadowColor="#2a0a3d";ctx.shadowBlur=20;
      ctx.fillStyle="#1a0a24";ctx.strokeStyle="#3a0a55";ctx.lineWidth=4;
      ctx.beginPath();ctx.ellipse(portalX,armY+30*frontS,fistR,fistR*0.75,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.restore();
    }
    const portalR=230*alpha;
    if(portalR>1){
      ctx.save();ctx.globalAlpha=alpha*0.85;ctx.shadowColor="#9933ff";ctx.shadowBlur=30;
      ctx.fillStyle="#0a0014";
      ctx.beginPath();ctx.ellipse(portalX,portalY,portalR,portalR*0.4,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle="#cc66ff";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(portalX,portalY,portalR,portalR*0.4,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  }
  if(p._shadowGroundCracks&&p._shadowGroundCracks.length){
    // Ground cracks radiating out from the ulti's impact point — bigger than
    // the old instant spark, and lingers for a full 2 seconds, fading only
    // near the very end instead of popping out of existence.
    p._shadowGroundCracks.forEach(c=>{
      const life=c.timer/c.maxTimer; // 1 → 0 over 2s
      const alpha=life>0.25?0.85:0.85*(life/0.25); // hold solid, only fade in the last quarter-second
      ctx.save();ctx.globalAlpha=alpha*0.35;ctx.fillStyle="#0a0014";
      ctx.beginPath();ctx.ellipse(c.x,c.y+4,150,42,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle="#9933ff";ctx.lineWidth=3;ctx.shadowColor="#6a1aa8";ctx.shadowBlur=8;
      const spokes=9;
      for(let i=0;i<spokes;i++){
        const ang=(i/spokes)*Math.PI*2+(c.seed||0)*0.001;
        const len=70+((Math.sin((c.seed||0)+i*7)+1)/2)*70; // 70–140px jagged spokes
        let cx=c.x,cy=c.y;
        ctx.beginPath();ctx.moveTo(cx,cy);
        const segs=4;
        for(let s=1;s<=segs;s++){
          const t=s/segs;
          const jag=Math.sin((c.seed||0)+i*13+s*5)*10;
          const nx=c.x+Math.cos(ang)*len*t+Math.cos(ang+Math.PI/2)*jag;
          const ny=(c.y+Math.sin(ang)*len*t*0.35)+Math.sin(ang+Math.PI/2)*jag*0.35;
          ctx.lineTo(nx,ny);
        }
        ctx.stroke();
      }
      ctx.restore();
    });
  }
  if(p._shadowFrozenTargets&&p._shadowFrozenTargets.length){
    // Reuses the same visual language as Frost's Ice Prison so it actually
    // reads as "đóng băng" — a solid ice block encasing the target, not just
    // the generic orange ⛓ STUNNED tag.
    p._shadowFrozenTargets.forEach(f=>{
      const tgt=f.ref;
      if(!tgt||tgt.hp<=0)return;
      const rx=tgt.x,ry=tgt.y-40;
      ctx.save();ctx.globalAlpha=0.82;ctx.fillStyle="rgba(190,235,255,0.5)";ctx.strokeStyle="white";ctx.lineWidth=2;
      ctx.beginPath();ctx.ellipse(rx,ry,42,58,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      ctx.strokeStyle="rgba(255,255,255,0.55)";ctx.lineWidth=1;
      for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(rx-29+i*19,ry-48);ctx.lineTo(rx-21+i*19,ry+48);ctx.stroke();}
      // a little dark-purple tint mixed in so it still reads as SHADOW ice, not Frost's
      ctx.globalAlpha=0.18;ctx.fillStyle="#6a1aa8";
      ctx.beginPath();ctx.ellipse(rx,ry,42,58,0,0,Math.PI*2);ctx.fill();
      ctx.restore();
      _text(rx,ry-68,"🧊 ĐÓNG BĂNG 🧊","#cc66ff","9px Arial bold");
    });
  }
  if(p._soulActive&&p._soulBody){
    const b=p._soulBody,bx=b.x,by=b.y,ry=by-52;
    ctx.save();ctx.translate(bx,by);ctx.scale(CHAR_VISUAL_SCALE,CHAR_VISUAL_SCALE);ctx.translate(-bx,-by);
    ctx.save();ctx.globalAlpha=0.92;
    _rect(bx-28,ry,56,52,"#241030","#0a0014",2);
    _rect(bx-12,ry-20,24,20,"#241030","#0a0014",1);
    _rect(bx-20,ry-60,40,40,"#241030","#0a0014",2);
    ctx.strokeStyle="#7a3aff";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(bx-8,ry-38);ctx.lineTo(bx+4,ry-12);ctx.lineTo(bx-4,ry+18);ctx.stroke();
    ctx.beginPath();ctx.moveTo(bx+10,ry-55);ctx.lineTo(bx+4,ry-30);ctx.stroke();
    ctx.restore();
    ctx.restore();
    _text(bx,ry-72,"🖤","white","11px Arial");
  }
}
// ================================================================
//  updateFire(p) — required per-frame update hook for the Fire character.
//  Houses Fire Pillar's delayed eruption, the Flame Destroyer explosion
//  trigger, and Fire Dash's fading trail. Safe to call every frame for
//  any fighter — it's a no-op unless p.charType==="fire".
// ================================================================
function updateFire(p){
  if(!p||p.charType!=="fire")return;
  tickFirePillar(p);
  tickFireUlti(p);
  if(p.fireDashTrail&&p.fireDashTrail.length){
    p.fireDashTrail.forEach(t=>t.life--);
    _compact(p.fireDashTrail,t=>t.life>0);
  }
}
// ================================================================
//  drawFire(p) — required per-frame draw hook for the Fire character.
//  Draws the fading Fire Dash trail and the Fire Pillar ground warning
//  markers. (The character's body/aura/skills are drawn inside the
//  shared Fighter._drawInner()/_drawSkillFX()/_drawUlti() pipeline.)
// ================================================================
function drawFire(p){
  if(!p||p.charType!=="fire")return;
  const v2=p.transformActive;
  if(p.fireDashTrail&&p.fireDashTrail.length){
    ctx.save();ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=10;
    p.fireDashTrail.forEach(t=>{
      const a=Math.max(0,t.life/20)*0.55;
      ctx.save();ctx.globalAlpha=a;
      _oval(t.x-16,t.y-40,32,32,v2?"#00AEFF":"#FF5500",null);
      ctx.restore();
    });
    ctx.restore();
  }
  if(p.firePillarTargets&&p.firePillarTargets.length){
    p.firePillarTargets.forEach(t=>{
      const prog=(p.firePillarDelayTick||0)/(p.firePillarMaxTick||22);
      const pulse=0.55+0.35*Math.sin(frameCount*0.5);
      ctx.save();
      ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=20;
      // Filled glowing warning disc that grows as the eruption gets closer
      ctx.globalAlpha=0.35*pulse+0.15;
      _oval(t.x-(30+prog*30),t.y-(10+prog*10),(60+prog*60),(20+prog*20),v2?"#0088FF":"#FF3300",null);
      ctx.globalAlpha=0.9;
      ctx.strokeStyle=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.lineWidth=3+prog*2;
      ctx.beginPath();ctx.ellipse(t.x,t.y+6,(35+prog*25)*SR,(12+prog*8)*SR,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
      if(rng()<0.6)hitEffects.push({x:t.x+rndInt(-30,30),y:t.y,vx:(rng()-0.5)*0.8,vy:-rng()*2-0.5,life:18,maxLife:18,particle:true,color:v2?rndChoice(["#00AEFF","#00E5FF"]):rndChoice(["#FF6600","#FFAA33"])});
    });
  }
  // Tall roaring flame column left behind right after a pillar erupts
  if(p._firePillarBursts&&p._firePillarBursts.length){
    _compact(p._firePillarBursts,b=>b.life>0);
    p._firePillarBursts.forEach(b=>{
      b.life--;
      const t=1-b.life/b.maxLife; // 0 -> 1 over the column's lifetime
      const h=Math.sin(Math.min(1,t*3))*260; // rockets up fast, then holds/fades
      const w=70-t*20;
      ctx.save();ctx.globalAlpha=Math.max(0,1-t*0.85);ctx.shadowColor=b.v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=30;
      const grad=ctx.createLinearGradient(0,b.y-h,0,b.y+20);
      if(b.v2){grad.addColorStop(0,"rgba(255,255,255,0.1)");grad.addColorStop(0.35,"rgba(150,230,255,0.7)");grad.addColorStop(0.75,"rgba(0,150,255,0.9)");grad.addColorStop(1,"rgba(0,40,180,0.95)");}
      else{grad.addColorStop(0,"rgba(255,230,150,0.15)");grad.addColorStop(0.35,"rgba(255,150,20,0.75)");grad.addColorStop(0.75,"rgba(255,60,0,0.9)");grad.addColorStop(1,"rgba(140,10,0,0.95)");}
      ctx.fillStyle=grad;
      ctx.beginPath();
      ctx.moveTo(b.x-w*0.5,b.y+20);
      ctx.quadraticCurveTo(b.x-w*0.9,b.y-h*0.5,b.x-w*0.2,b.y-h);
      ctx.quadraticCurveTo(b.x,b.y-h-20,b.x+w*0.2,b.y-h);
      ctx.quadraticCurveTo(b.x+w*0.9,b.y-h*0.5,b.x+w*0.5,b.y+20);
      ctx.closePath();ctx.fill();
      ctx.restore();
      if(frameCount%2===0)for(let i=0;i<2;i++)hitEffects.push({x:b.x+rndInt(-w*0.4,w*0.4),y:b.y-rng()*h,vx:(rng()-0.5)*2,vy:-rng()*2-1,life:22,maxLife:22,particle:true,color:b.v2?rndChoice(["#00AEFF","#00E5FF","white"]):rndChoice(["#FF6600","#FFAA33","#FFDD66"])});
    });
  }
}

// ================================================================
//  EARTH S3: MINION MANAGEMENT
// ================================================================
function tickEarthMinions(p,worldW){
  if(!p.earthMinions)p.earthMinions=[];
  // Remove dead minions
  _compact(p.earthMinions,m=>m.hp>0);
  // Update minions — bám theo địa hình gồ ghề ở chế độ ROAD (trước đây luôn dùng
  // mặt sàn phẳng nên ở khu vực gồ ghề chúng bị lún xuống đất hoặc lơ lửng trên không)
  p.earthMinions.forEach(m=>{
    if(m instanceof EarthSoldier || m instanceof EarthArcher){
      const baseFloorY=H*FLOOR_Y_RATIO;
      const floorY=(gameState==="ROAD"&&typeof terrainHeightAt==="function")?baseFloorY+terrainHeightAt(m.x):baseFloorY;
      m.update(floorY,worldW);
    }
  });
  // Tách các con rối đứng sát nhau ra để không bị chồng chập thành 1 khối duy nhất,
  // giúp người chơi đếm/nhìn rõ từng con.
  const list=p.earthMinions;
  const minGap=32;
  for(let i=0;i<list.length;i++){
    for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];
      const dx=b.x-a.x,adx=Math.abs(dx);
      if(adx<minGap){
        const push=(minGap-adx)/2*(dx>=0?1:-1)||1;
        a.x=clamp(a.x-push,40,worldW-40);
        b.x=clamp(b.x+push,40,worldW-40);
      }
    }
  }
}

function drawEarthMud(p){
  if(!p.earthMudActive)return;
  const rx=p.x,ry=p.y;
  const af=p.animFrame;
  const alpha=Math.max(0.4,Math.sin(af*0.08)*0.3+0.7);
  ctx.save();
  ctx.globalAlpha=alpha*0.6;
  // Mud puddle
  ctx.fillStyle="#5a4a3a";
  ctx.beginPath();ctx.ellipse(rx,ry+20,70,40,0,0,Math.PI*2);ctx.fill();
  // Mud splashes
  for(let i=0;i<6;i++){
    const ang=(af*0.1+i)*(Math.PI*2/6);
    const d=50+Math.sin(af*0.12+i)*15;
    const mx=rx+Math.cos(ang)*d,my=ry+Math.sin(ang)*d+15;
    ctx.fillStyle="#6a5a4a";
    ctx.beginPath();ctx.ellipse(mx,my,15,12,0,0,Math.PI*2);ctx.fill();
  }
  // Glow
  ctx.fillStyle="rgba(138,106,74,0.3)";
  ctx.beginPath();ctx.ellipse(rx,ry+15,90,50,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
}

function drawEarthMinions(p){
  if(!p.earthMinions||!p.earthMinions.length)return;
  p.earthMinions.forEach(m=>{
    if(m.hp>0)m.draw();
  });
}


// ================================================================
//  CAST SKILL
// ================================================================
function castSkill(attacker,target,skillNum){
  if(!["GAMEPLAY","CHALLENGE","ROAD"].includes(gameState))return;
  if(attacker.hp<=0||attacker.stunTimer>0||attacker.isShielding)return;
  if(attacker.transformWindupTimer>0)return; // mid wind-up (currently only SHADOW's V4): lock out all skills, including a second transform, until the sequence finishes
  const sKey=`s${skillNum}`;
  if(attacker.cds[sKey]>0)return;
  if(skillNum===5){
    if(attacker.charType==="shadow"){
      // SHADOW V4 — "Bóng Tối Thức Tỉnh": 3.5s (210-frame) wind-up before the
      // transform actually lands. Reuses the shared transformWindupTimer /
      // transformLandingTimer state machine (see applyGravity() and
      // _drawShadowTransformWindup() in 03-fire-status-and-fighter-class.js)
      // instead of a parallel system — _finalizeTransform() is only invoked
      // once, from applyGravity(), when the timer reaches 0.
      attacker.isAttacking=false;attacker.activeSkill=null;
      attacker.cds.s5=1200;
      // 45 extra frames (0.75s) up front: 15f (0.25s) of nothing, then a
      // 30f (0.5s) camera punch-in/zoom (see shadowCamZoomState() in
      // 07-fx-ticks-ui-and-main-menu.js) — the existing 3.5s (210f) VFX
      // sequence below only starts once that punch-in finishes.
      attacker.transformWindupTimer=255; // 0.75s cam punch-in + 3.5s VFX = 4.25s @ 60fps
      attacker._transformWindupTotal=255;
      attacker._windupCrackled=false;
      attacker._shadowRiftCracked=false;
      attacker._shadowWhispered=false;
      attacker._shadowWindupBurstDone=false;
      sfxEnergyCharge(); // rising charge whoosh — kicks off the "Kích hoạt" phase
      return;
    }
    // V4 TRANSFORM (other elements): transforms instantly on cast — no more
    // fly-up-and-wait windup delay. The 20-ray spark explosion + V4 skin
    // fire off immediately.
    attacker.isAttacking=false;attacker.activeSkill=null;
    attacker.cds.s5=1200;
    screenShake=Math.max(screenShake,10);
    sfxEnergyCharge();
    attacker._finalizeTransform(attacker.y);
    return;}
  if(!(attacker.charType==="shadow"&&skillNum===2)){if(attacker.isAttacking)return;}
  attacker.isAttacking=true;
  if(gameState==="GAMEPLAY"&&target)attacker.direction=attacker.x<target.x?1:-1;
  const skillId=`${attacker.charType}_s${skillNum}`;
  const chTarget=gameState==="CHALLENGE"?getChallengeTarget(attacker):(gameState==="ROAD"?getRoadTarget(attacker):target);
  const combatTarget=chTarget;
  const _isRedDash=attacker.charType==="red"&&skillNum===2; // plain forward gap-closer, not a targeted teleport — must not face backward toward a trailing enemy
  if((gameState==="CHALLENGE"||gameState==="ROAD")&&combatTarget&&!_isRedDash)attacker.direction=combatTarget.x>attacker.x?1:-1;
  if(attacker.charType==="wind"){
    if(skillNum===1){
      // PHONG TRẢM — a fast crescent wind-blade fired straight ahead
      attacker.attackCooldown=10;attacker.activeSkill=skillId;attacker.cds.s1=90;
      projectiles.push({x:attacker.x+34*attacker.direction,y:attacker.y-46,vx:19*attacker.direction,vy:0,owner:attacker,target:combatTarget,
        damage:11,slow:0,slow_pct:0,color:"#90EE90",type:"wind_slash",radius:17});
      return;
    }
    if(skillNum===2){
      // CUỒNG PHONG BỘ — blink-dash through anyone in the way, then a short burst of speed as the wake trails off
      attacker.attackCooldown=13;attacker.activeSkill=skillId;attacker.cds.s2=220;
      const oldX=attacker.x,oldY=attacker.y;
      attacker.windDashTimer=14;
      attacker.x+=210*attacker.direction;
      attacker.x=clamp(attacker.x,moveBoundLo(),moveBoundHi());
      _dashCapture(attacker,oldX,oldY);
      const steps=9;
      for(let i=0;i<=steps;i++){const t=i/steps;attacker.windDashTrail.push({x:oldX+(attacker.x-oldX)*t,y:attacker.y,life:18,maxLife:18});}
      aoeHit(attacker,13,120);
      getAllEnemies(attacker).forEach(t2=>{if(t2&&t2.hp>0&&Math.abs(t2.x-attacker.x)<120*SR&&Math.abs(t2.y-attacker.y)<90*SR&&isPushable(t2)){const pd=t2.x>=attacker.x?1:-1;t2.x=clamp(t2.x+pd*70,moveBoundLo(),moveBoundHi());}});
      attacker.windBoostTimer=45;
      screenShake=Math.max(screenShake,6);
      return;
    }
    if(skillNum===3){
      // LỐC GIAM CẦM — plants a whirling cyclone that drags enemies toward its core, ticking damage, then bursts them upward when it collapses
      attacker.attackCooldown=18;attacker.activeSkill=skillId;attacker.cds.s3=360;
      attacker.windCycloneActive=true;
      attacker.windCycloneX=combatTarget?combatTarget.x:attacker.x+230*attacker.direction;
      attacker.windCycloneY=combatTarget?combatTarget.y:attacker.y;
      attacker.windCycloneTimer=170;attacker.windCycloneTick=0;
      screenShake=Math.max(screenShake,8);
      return;
    }
    if(skillNum===4){
      // ĐẠI PHONG BẠO — a great tempest engulfs the caster: periodic damage + repeated launches to everyone caught nearby
      attacker.attackCooldown=24;attacker.activeSkill=skillId;
      attacker.ultiTimer=150;attacker.windStormTick=0;
      attacker.cds.s4=900;
      screenShake=Math.max(screenShake,12);
      return;
    }
    return;
  }
  if(attacker.charType==="fire"){
    const v2=attacker.transformActive;
    const buffs=v2?attacker.getTransformBuffs():{};
    if(skillNum===1){
      // FIRE BULLET — a single fast fireball (Blox Fruits "Flame Fruit" bullet)
      attacker.attackCooldown=10;attacker.activeSkill=skillId;attacker.cds.s1=85;
      const spd=14*(buffs.proj_speed_mult||1);
      projectiles.push({x:attacker.x+40*attacker.direction,y:attacker.y-42,vx:spd*attacker.direction,vy:0,owner:attacker,target:combatTarget,
        damage:v2?11:7,slow:0,slow_pct:0,color:v2?FIRE_V2_COL:FIRE_V1_COL,type:"fire_bullet",radius:v2?20:15});
      return;
    }
    if(skillNum===2){
      // FIRE PILLAR — a column of fire erupts under the target after a short delay (Blox Fruits "Flame Pillar")
      attacker.attackCooldown=30;attacker.activeSkill=skillId;attacker.cds.s2=230; // must exceed firePillarMaxTick or activeSkill resets before the eruption fires
      const pos=combatTarget?{x:combatTarget.x,y:combatTarget.y}:{x:attacker.x+180*attacker.direction,y:attacker.y};
      attacker.firePillarTargets=v2?[pos,{x:pos.x+70*attacker.direction,y:pos.y}]:[pos]; // V2 erupts a second pillar alongside the first
      attacker.firePillarDelayTick=0;
      attacker.firePillarMaxTick=22;
      screenShake=Math.max(screenShake,6);
      return;
    }
    if(skillNum===3){
      // FIRE DASH — becomes living flame and rockets forward through anyone in the way
      attacker.attackCooldown=14;attacker.activeSkill=skillId;attacker.cds.s3=190;
      const dashDist=190*(buffs.dash_mult||1);
      const oldX=attacker.x,oldY=attacker.y;
      attacker.fireDashTimer=16;
      attacker.x+=dashDist*attacker.direction;
      attacker.x=clamp(attacker.x,moveBoundLo(),moveBoundHi());
      _dashCapture(attacker,oldX,oldY);
      const steps=9;
      for(let i=0;i<=steps;i++){const t=i/steps;attacker.fireDashTrail.push({x:oldX+(attacker.x-oldX)*t,y:attacker.y,life:20,maxLife:20});}
      aoeHit(attacker,v2?15:10,130);
      const kb=(v2?70:50)*(buffs.knockback_mult||1);
      getAllEnemies(attacker).forEach(t2=>{
        if(t2&&t2.hp>0&&Math.abs(t2.x-attacker.x)<130*SR&&Math.abs(t2.y-attacker.y)<90*SR&&isPushable(t2)){
          const pd=t2.x>=attacker.x?1:-1;
          t2.x=clamp(t2.x+pd*kb,moveBoundLo(),moveBoundHi());
          if(t2 instanceof Fighter)t2.vy=-6;
        }
      });
      screenShake=Math.max(screenShake,10);
      return;
    }
    if(skillNum===4){
      // FLAME DESTROYER — summon a giant fireball above the target, then it explodes (ultimate)
      attacker.attackCooldown=30;attacker.activeSkill=skillId;
      const windup=100; // longer than before so the now much-bigger explosion has room to play out
      attacker.ultiTimer=windup;
      attacker._fireUltiWindup=windup;
      attacker._fireUltiExploded=false;
      attacker._fireUltiExplodeFrame=0;
      attacker._fireUltiTargetX=combatTarget?combatTarget.x:attacker.x+220*attacker.direction;
      attacker._fireUltiTargetY=combatTarget?combatTarget.y:attacker.y;
      attacker.cds.s4=1080;
      sfxEnergyCharge();
      screenShake=Math.max(screenShake,8);
      return;
    }
    return;
  }
  if(attacker.charType==="frost"){
    // Log this cast for the Frozen Combo detector (Ice Prison -> Ice Slide -> Ice Spears -> Frozen Domain within 5s)
    attacker.frostComboLog.push({skill:skillNum,t:frameCount});
    if(attacker.frostComboLog.length>12)attacker.frostComboLog.shift();
    checkFrostCombo(attacker);
    if(skillNum===1){
      // ICE SPEARS — 6-8 shards appear behind the player, pause 0.3s, then rocket forward
      attacker.attackCooldown=22;attacker.activeSkill=skillId;attacker.cds.s1=110;
      const cnt=rndInt(6,8);
      for(let i=0;i<cnt;i++){
        const spawnX=attacker.x-34*attacker.direction+rndInt(-16,16);
        const spawnY=attacker.y-40-i*7+rndInt(-6,6);
        projectiles.push({x:spawnX,y:spawnY,vx:0,vy:0,owner:attacker,target:combatTarget,
          damage:9,slow:40,slow_pct:0.4,color:"#AEEBFF",type:"ice_spear",dir:attacker.direction,launchDelay:18});
      }
      return;
    }
    if(skillNum===2){
      // ICE SLIDE — knockback-immune dash that lays a slick ice trail (slows foes for ~3s)
      attacker.attackCooldown=18;attacker.activeSkill=skillId;attacker.cds.s2=260;
      const oldX=attacker.x,oldY=attacker.y;
      attacker.frostSlideActive=26;
      _dashCapture(attacker,oldX,oldY);
      attacker.x+=180*attacker.direction;attacker.x=clamp(attacker.x,moveBoundLo(),moveBoundHi());
      const steps=9;
      for(let i=0;i<=steps;i++){const t=i/steps;attacker.frostSlideTrail.push({x:oldX+(attacker.x-oldX)*t,y:attacker.y,life:180,maxLife:180});}
      aoeHit(attacker,10,110);
      getAllEnemies(attacker).forEach(t2=>{if(t2.hp>0&&Math.abs(t2.x-attacker.x)<110*SR&&Math.abs(t2.y-attacker.y)<90*SR&&isPushable(t2)){t2.x=clamp(t2.x+(t2.x>=attacker.x?1:-1)*36,moveBoundLo(),moveBoundHi());}});
      screenShake=Math.max(screenShake,8);
      return;
    }
    if(skillNum===3){
      // FROZEN DOMAIN — a lingering ice zone that slows/chills anyone standing in it
      attacker.attackCooldown=26;attacker.activeSkill=skillId;attacker.cds.s3=520;
      attacker.frostDomainActive=true;attacker.frostDomainTimer=210;attacker.frostDomainTick=0;
      screenShake=Math.max(screenShake,10);
      return;
    }
    if(skillNum===4){
      // ICE PRISON — locks the target in a block of ice; explodes after 2s or early if hit; bosses are only slowed
      attacker.attackCooldown=20;attacker.activeSkill=skillId;attacker.cds.s4=420;
      const _icyTargets=getAllEnemies(attacker).filter(t=>t&&t.hp>0);
      _icyTargets.forEach(tgt=>{
        const isBoss=(typeof Boss!=="undefined"&&tgt instanceof Boss)||(typeof RoadBoss!=="undefined"&&tgt instanceof RoadBoss);
        applyDamage(tgt,13,attacker);
        if(tgt.hp>0){
          const dur=isBoss?146:240; // ~2.4s slow for bosses, ~4s full lock for everyone else (base + 2s)
          tgt.stunTimer=Math.max(tgt.stunTimer||0,dur);
          tgt._icePrisonTimer=dur;tgt._icePrisonMax=dur;
          tgt._icePrisonHpLast=tgt.hp;
          attacker._icePrisonedTargets.push(tgt);
        }
        spawnHitEffect(tgt.x,tgt.y-40,"#AEEBFF");
      });
      return;
    }
  }
  if(attacker.charType==="shadow"&&skillNum===1){
    attacker.attackCooldown=15;attacker.activeSkill=skillId;attacker.cds.s1=15; // hồi đòn 0.25s @60fps
    if(attacker.transformActive){
      // THẦN CHẾT — BỔ LIỀM: instant downward scythe chop, melee range (the
      // swing animation itself is drawn by _drawReaperWeaponPose over the
      // 15-frame attackCooldown window set above).
      aoeHit(attacker,8,320); // tầm chém liềm: nhân đôi tiếp lần nữa (160 -> 320 raw, ~213px thật trong game sau khi nhân hệ số SR)
      screenShake=Math.max(screenShake,4);
    }else{
      // ĐÁNH THƯỜNG — a single black claw-slash detaches and flies forward like a bullet.
      projectiles.push({x:attacker.x+28*attacker.direction,y:attacker.y-48,vx:17*attacker.direction,vy:0,owner:attacker,target:combatTarget,
        damage:6,slow:0,slow_pct:0,color:"#1a0033",type:"shadow_slash",radius:16});
    }
    return;
  }
  if(attacker.charType==="shadow"&&skillNum===2){
    // F — VOID TENTACLE: portal opens (0.33s) → holds open (0.25s) → tentacle
    // grows out of it toward the target over 0.25s. The portal stays put where
    // it opened, but the tentacle's tip keeps tracking the live target the
    // whole time it's growing, so it stretches further if they run.
    attacker.attackCooldown=54;attacker.activeSkill=skillId;attacker.cds.s2=220;
    const pos=combatTarget?{x:combatTarget.x,y:combatTarget.y,ref:combatTarget}:{x:attacker.x+180*attacker.direction,y:attacker.y,ref:null};
    attacker.shadowTentacleTarget={portalX:pos.x,portalY:pos.y,tipX:pos.x,tipY:pos.y,ref:pos.ref};
    attacker.shadowTentacleDelayTick=0;
    attacker.shadowTentaclePortalDur=20;
    attacker.shadowTentacleWaitDur=15;
    attacker.shadowTentacleGrowDur=15;
    attacker.shadowTentacleMaxTick=50;
    screenShake=Math.max(screenShake,4);
    return;
  }
  if(attacker.charType==="thunder"&&skillNum===3){
    // THUNDER S3: LIGHTNING STRIKE - Lightning bolts fall from sky, damage only when they touch ground
    attacker.attackCooldown=26;attacker.activeSkill=skillId;attacker.cds.s3=280;
    let targets=getAllEnemies(attacker);
    if(!targets.length)targets=combatTarget?[combatTarget]:[{x:attacker.x+200*attacker.direction,y:attacker.y}];
    targets=targets.slice(0,3);
    // Store target positions when skill is cast (locked position)
    attacker.thunderS3Targets=targets.map(t=>({x:t.x,y:t.y,targetRef:t,locked:true}));
    attacker.thunderS3DelayTick=0;
    attacker.thunderBoltXs=targets.map(t=>({x:t.x,y:t.y}));
    attacker.thunderBoltX=attacker.thunderBoltXs.length?attacker.thunderBoltXs[0].x:attacker.x;
    screenShake=25;return;
  }
  if(attacker.charType==="thunder"&&skillNum===2){
    // THUNDER DASH: becomes a bolt of lightning - immune to collisions/CC/
    // pushback/blocking during the dash, then leaves an electric trail
    // that detonates ~0.3s later, shocking/slowing/knocking anyone on it.
    const d=combatTarget?Math.abs(attacker.x-combatTarget.x):400;
    const _oldX=attacker.x,_oldY=attacker.y;
    if(d<W/2)attacker.x-=220*attacker.direction;else attacker.x+=220*attacker.direction;
    attacker.x=clamp(attacker.x,moveBoundLo(),moveBoundHi());
    _dashCapture(attacker,_oldX,_oldY);
    attacker.thunderDashTimer=18; // ~0.3s of dash-immunity (no CC/knockback/blocking)
    const dsteps=8;
    for(let i=0;i<=dsteps;i++){const t=i/dsteps;attacker.thunderDashTrail.push({x:_oldX+(attacker.x-_oldX)*t,y:attacker.y,life:18,armed:18});}
    attacker.attackCooldown=15;attacker.activeSkill=skillId;attacker.cds.s2=165;
    return;
  }
  if(attacker.charType==="red"&&skillNum===3){attacker.attackCooldown=120;attacker.activeSkill=skillId;attacker.cds.s3=360;return;}
  if(attacker.charType==="water"){
    if(skillNum===1){attacker.attackCooldown=10;attacker.activeSkill=skillId;attacker.cds.s1=120;projectiles.push({x:attacker.x+40*attacker.direction,y:attacker.y-42,vx:15*attacker.direction,vy:0,owner:attacker,target:combatTarget,damage:6,slow:0,slow_pct:0,color:"dodgerblue",type:"water_orb",radius:15});}
    else if(skillNum===2){attacker.attackCooldown=15;attacker.activeSkill=skillId;attacker.cds.s2=480;attacker.waterCloudTimer=300;attacker.waterCloudTick=0;attacker.waterCloudDrops=[];}
    else if(skillNum===3){attacker.attackCooldown=30;attacker.activeSkill=skillId;attacker.cds.s3=480;aoePush(attacker,15,520);screenShake=20;}
    else if(skillNum===4){attacker.attackCooldown=20;attacker.activeSkill=skillId;attacker.ultiTimer=120;attacker.cds.s4=1080;attacker.tsunamiWaveXL=attacker.x-80;attacker.tsunamiWaveXR=attacker.x+80;getAllEnemies(attacker).forEach(t=>{if(isPushable(t)){const pd=t.x>attacker.x?1:-1;t.x=clamp(t.x+pd*500,moveBoundLo(),moveBoundHi());if(t instanceof Fighter){t.slowTimer=Math.max(t.slowTimer,120);t.vy=-8;}}applyDamage(t,20,attacker);});screenShake=40;}
    return;
  }
  if(attacker.charType==="shadow"&&skillNum===3){
    // T — THOÁT XÁC: the soul splits from the body. The body stays put as an
    // untargeted, harmless decoy; the soul (the real fighter) turns untargetable
    // and 30% faster for 3 seconds, then the two re-merge back into normal form.
    attacker.attackCooldown=10;attacker.activeSkill=skillId;attacker.cds.s3=480;
    attacker._soulActive=true;attacker._soulTimer=180;attacker._soulMaxTimer=180;
    attacker._soulBody={x:attacker.x,y:attacker.y,direction:attacker.direction,hp:9999,_isSoulDecoy:true};
    for(let i=0;i<16;i++)attacker._dashSmoke.push({x:attacker.x+rndInt(-20,20),y:attacker.y-30+rndInt(-30,10),vx:(rng()-0.5)*1.2,vy:-rng()*1.2-0.3,life:30,r:rndInt(10,22)});
    screenShake=Math.max(screenShake,6);
    return;
  }
  if(attacker.charType==="thunder"&&skillNum===1){
    // NORMAL ATTACK: the strike itself always sparks, and if there's a
    // nearby target the electricity auto-chains to 3-5 enemies (15% falloff
    // per jump) instead of ever hitting just one.
    attacker.attackCooldown=8;attacker.activeSkill=skillId;attacker.cds.s1=90;
    const firstT=combatTarget&&dist(attacker.x,attacker.y,combatTarget.x,combatTarget.y)<(180 * 1.75)*SR?combatTarget:null;
    if(firstT){
      spawnLightningArc(attacker.x,attacker.y-40,firstT.x,firstT.y-40);
      applyDamage(firstT,7,attacker);
      addShock(firstT,attacker);
      chainLightning(attacker,firstT.x,firstT.y-40,7,rndInt(3,5),firstT,320*SR);
    }else{
      aoeHit(attacker,7,160);
    }
    return;
  }
  if(attacker.charType==="shadow"&&skillNum===4&&attacker.transformActive){
    // THẦN CHẾT — ULTI NỔ: khi đang biến hình, Ulti kích nổ một vụ nổ khổng
    // lồ gây 30 sát thương cho TẤT CẢ địch đang có mặt (không giới hạn
    // khoảng cách), đồng thời hồi 40 HP cho bản thân. Kèm theo đó là hào
    // quang đỏ bao quanh cơ thể, kéo dài liên tục cho tới khi hết biến hình
    // (tắt tại tickV4 khi transformActive chuyển về false).
    attacker.attackCooldown=30;attacker.activeSkill=skillId;attacker.cds.s4=900;
    getAllEnemies(attacker).forEach(tgt=>applyDamage(tgt,30,attacker));
    attacker.hp=Math.min(attacker.maxHp||MAX_HP,attacker.hp+40);
    attacker._shadowRedGlow=true;
    screenShake=Math.max(screenShake,22);
    // Chớp sáng trắng ở tâm để mắt bắt được đúng khoảnh khắc nổ, rồi mới tới
    // các vòng sóng nổ đỏ to + chậm + mảnh vụn to lâu tan, cho dễ nhìn rõ hơn.
    hitEffects.push({x:attacker.x,y:attacker.y-50,life:14,maxLife:14,color:"#ffffff",ring:true,big:false});
    for(let i=0;i<55;i++){
      const ang=rng()*Math.PI*2,spd=rng()*8+3,big=rng()<0.4;
      hitEffects.push({x:attacker.x,y:attacker.y-50,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:big?70:50,maxLife:big?70:50,particle:true,size:big?14:7,color:rndChoice(["#ff2222","#ff5555","#aa0000","#ffaaaa","#ff8800"])});
    }
    // 3 vòng sóng nổ lớn, giãn nở chậm rãi và so le thời điểm bắt đầu để tạo
    // cảm giác một vụ nổ thực sự lan ra chứ không lóe lên rồi tắt ngay.
    hitEffects.push({x:attacker.x,y:attacker.y-50,life:55,maxLife:55,color:"#ff2222",shockwave:true,maxR:260,lw:12});
    hitEffects.push({x:attacker.x,y:attacker.y-50,life:65,maxLife:65,color:"#ff6644",shockwave:true,maxR:320,lw:8});
    hitEffects.push({x:attacker.x,y:attacker.y-50,life:75,maxLife:75,color:"#ffaa88",shockwave:true,maxR:380,lw:5});
    return;
  }
  if(attacker.charType==="shadow"&&skillNum===4){
    // G — ULTIMATE: pick the nearest enemy, open a giant portal above their
    // head (0.5s), then a giant demon arm slams down out of it (0.5s —
    // heavier/slower since it's the ultimate), then dissolves into smoke.
    // On impact: 30 damage + stuns the target for 3 seconds.
    attacker.attackCooldown=63;attacker.activeSkill=skillId;
    const portalDur=30,slamDur=30,windup=portalDur+slamDur; // 0.5s + 0.5s @60fps
    attacker.ultiTimer=windup;
    attacker._shadowUltiWindup=windup;
    attacker._shadowUltiPortalDur=portalDur;
    attacker._shadowUltiSlamDur=slamDur;
    attacker._shadowUltiExploded=false;
    attacker._shadowUltiTargetRef=combatTarget||null;
    attacker._shadowUltiTargetX=combatTarget?combatTarget.x:attacker.x+220*attacker.direction;
    attacker._shadowUltiTargetY=combatTarget?combatTarget.y:attacker.y;
    attacker.cds.s4=900; // hồi chiêu 15 giây @60fps
    screenShake=Math.max(screenShake,10);
    return;
  }
  if(attacker.charType!=="earth"){
    if(skillNum===1){attacker.attackCooldown=8;attacker.activeSkill=skillId;attacker.cds.s1=90;aoeHit(attacker,7,160);}
    else if(skillNum===2){attacker.attackCooldown=12;attacker.activeSkill=skillId;attacker.cds.s2=180;const _oldX2=attacker.x,_oldY2=attacker.y;attacker.x+=160*attacker.direction;attacker.x=clamp(attacker.x,moveBoundLo(),moveBoundHi());_dashCapture(attacker,_oldX2,_oldY2);aoeHit(attacker,12,100);}
    else if(skillNum===4){attacker.attackCooldown=180;attacker.activeSkill=skillId;attacker.ultiTimer=180;attacker.cds.s4=1080;}
  }else{
    if(skillNum===1){
      // EARTH BOULDER: throw a massive rock projectile
      attacker.attackCooldown=20;attacker.activeSkill=skillId;attacker.cds.s1=120;
      projectiles.push({x:attacker.x+40*attacker.direction,y:attacker.y-60,vx:12*attacker.direction,vy:-4,owner:attacker,target:combatTarget,
        damage:14,slow:0,slow_pct:0,color:"#8a6a4a",type:"earth_boulder",radius:28,stunDur:25});
      screenShake=Math.max(screenShake,8);
      // Spawn boulder visual particles
      for(let i=0;i<6;i++)hitEffects.push({x:attacker.x+30*attacker.direction,y:attacker.y-50,vy:-rng()*2,vx:attacker.direction*2+rng(),life:15,maxLife:15,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"])});
    }
    else if(skillNum===2){
      // EARTH S2: MUD FORM - Transform into mud, become immune to damage/CC for 5 seconds
      attacker.attackCooldown=14;attacker.activeSkill=skillId;attacker.cds.s2=600;
      attacker.earthMudActive=true;attacker.earthMudTimer=300;attacker.earthMudSpeed=1.2;attacker.earthMudRegen=5;
      attacker._mudBubbles=[];attacker._mudRiseShook=false;
      screenShake=8;
    }
    else if(skillNum===3){
      // EARTH S3: SUMMON MINIONS - Summon 3 melee soldiers + 2 archers (max 5 total)
      attacker.attackCooldown=20;attacker.activeSkill=skillId;attacker.cds.s3=300;
      const minionCount=attacker.earthMinions.filter(m=>m.hp>0).length;
      const toAdd=Math.min(attacker.earthMinionLimit-minionCount,5);
      const soldierNeeded=Math.min(3,toAdd);
      const archerNeeded=Math.min(2,toAdd-soldierNeeded);
      for(let i=0;i<soldierNeeded;i++){
        const ox=attacker.x+(i-1)*40+rndInt(-20,20);
        attacker.earthMinions.push(new EarthSoldier(attacker,ox,attacker.y,attacker.direction));
      }
      for(let i=0;i<archerNeeded;i++){
        const ox=attacker.x+(i-1)*40+rndInt(-20,20);
        attacker.earthMinions.push(new EarthArcher(attacker,ox,attacker.y,attacker.direction));
      }
      screenShake=12;
    }
    // EARTH S4: THIÊN THẠCH — a giant meteor is summoned high in the sky and
    // slowly plunges down; on impact it shakes the world, cracks the ground,
    // and blasts every enemy present for a flat 40 damage.
    else if(skillNum===4){
      const windup=150; // ~2.5s slow, dramatic fall before impact
      attacker.attackCooldown=windup;attacker.activeSkill=skillId;
      attacker.ultiTimer=windup;
      attacker._meteorWindup=windup;
      attacker._meteorExploded=false;
      attacker._meteorExplodeFrame=0;
      attacker._meteorTargetX=combatTarget?combatTarget.x:attacker.x+180*attacker.direction;
      attacker._meteorTargetY=combatTarget?combatTarget.y:attacker.y;
      attacker._meteorCracks=null;
      attacker.cds.s4=1080;
      sfxEnergyCharge();
      screenShake=Math.max(screenShake,6);
    }
  }
}

// ================================================================
//  BOT AI
// ================================================================
function updateBot(){
  if(gameMode==="PVP"||p2.hp<=0)return;
  // SHADOW — Thoát Xác: the bot must chase/attack the stationary decoy old
  // body, not the real (untargetable, faster) soul, same as every other
  // enemy AI in the game.
  const p1t=shadowSoulTarget(p1);
  const dx=p1t.x-p2.x,absD=Math.abs(dx);
  if(botLevel>=1&&absD<140&&rng()<0.03)castSkill(p2,p1t,1);
  if(botLevel>=2){p2.x+=3.0*(p2.speedMult||1)*(p1t.x>p2.x?1:-1);if(rng()<0.01)p2.jump();if(absD>100&&absD<320&&rng()<0.02)castSkill(p2,p1t,3);}
  if(botLevel>=3){p2.isShielding=p1.isAttacking;if(absD<250&&rng()<0.03)castSkill(p2,p1t,4);if(absD<140)castSkill(p2,p1t,1);}
  // FIRE BOT AI — presses Y (skill 5) to transform once the Rage/Ultimate
  // bar is full, then leans hard on the Flame Destroyer ultimate afterward.
  if(p2.charType==="fire"&&botLevel>=1&&p2.hp>0&&p2.stunTimer<=0&&p2.transformWindupTimer===0&&p2.transformLandingTimer===0){
    if(p2.cds.s5<=0&&!p2.transformActive&&rng()<0.05){
      castSkill(p2,p1t,5);
    }else if(p2.transformActive){
      if(p2.cds.s4<=0&&absD<420&&rng()<0.08)castSkill(p2,p1t,4);
      else if(p2.cds.s2<=0&&absD<300&&rng()<0.04)castSkill(p2,p1t,2);
      else if(p2.cds.s3<=0&&absD>90&&absD<260&&rng()<0.05)castSkill(p2,p1t,3);
    }else{
      if(p2.cds.s2<=0&&absD<300&&rng()<0.02)castSkill(p2,p1t,2);
    }
  }
}

// ================================================================
//  PROJECTILE UPDATE
// ================================================================
function updateProjectiles(floorY,player2){
  const active=[];
  for(const proj of projectiles){
    if(proj.type==="ice_spear"&&proj.launchDelay>0){
      // Ice Spears: hover in place behind the caster for 0.3s before rocketing forward
      proj.launchDelay--;
      if(rng()<0.5)hitEffects.push({x:proj.x+rndInt(-4,4),y:proj.y+rndInt(-4,4),vx:0,vy:-0.3,life:12,maxLife:12,particle:true,color:"#DFF7FF"});
      ctx.save();ctx.translate(proj.x,proj.y);ctx.scale(CHAR_VISUAL_SCALE,CHAR_VISUAL_SCALE);ctx.translate(-proj.x,-proj.y);
      ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=8;ctx.fillStyle="#AEEBFF";ctx.strokeStyle="white";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(proj.x,proj.y-9);ctx.lineTo(proj.x+5,proj.y);ctx.lineTo(proj.x,proj.y+9);ctx.lineTo(proj.x-5,proj.y);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();ctx.restore();
      active.push(proj);
      continue;
    }
    if(proj.type==="ice_spear"&&proj.vx===0&&proj.launchDelay<=0)proj.vx=17*(proj.dir||1);
    // HOMING ARROWS: earth archer projectiles automatically track targets
    if(proj.homing&&proj.target&&proj.target.hp>0){
      const dx=proj.target.x-proj.x,dy=proj.target.y-proj.y;
      const dist_to_target=Math.hypot(dx,dy);
      if(dist_to_target>1){
        const homingSpeed=0.3; // Smooth turning speed
        proj.vx+=(dx/dist_to_target)*homingSpeed;
        proj.vy+=(dy/dist_to_target)*homingSpeed;
        // Cap speed
        const projSpd=Math.hypot(proj.vx,proj.vy);
        if(projSpd>12){proj.vx=(proj.vx/projSpd)*12;proj.vy=(proj.vy/projSpd)*12;}
      }
    }
    proj.x+=proj.vx;if(proj.vy!==undefined)proj.y+=proj.vy;
    const px=proj.x,py=proj.y,pDir=proj.vx>=0?1:-1,color=proj.color||"cyan",pType=proj.type||"";
    ctx.save();ctx.translate(px,py);ctx.scale(CHAR_VISUAL_SCALE,CHAR_VISUAL_SCALE);ctx.translate(-px,-py);
    if(pType==="wind_slash"){
      const r=proj.radius||17;
      ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=12;
      ctx.strokeStyle="#CCFFCC";ctx.lineWidth=5;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(px-r*pDir,py-r*0.9);ctx.quadraticCurveTo(px+r*1.4*pDir,py,px-r*pDir,py+r*0.9);ctx.stroke();
      ctx.strokeStyle="#90EE90";ctx.lineWidth=2;ctx.stroke();
      ctx.restore();
      if(!proj.trail)proj.trail=[];
      proj.trail.push({x:px,y:py,life:10});
      _compact(proj.trail,t=>{t.life--;return t.life>0;});
      proj.trail.forEach(t=>{ctx.save();ctx.globalAlpha=Math.max(0,t.life/10)*0.4;_oval(t.x-5,t.y-5,10,10,"#CCFFCC",null);ctx.restore();});
    }
    else if(pType==="water_orb"){
      const r=proj.radius||15;
      ctx.save();ctx.shadowColor="aqua";ctx.shadowBlur=12;
      _oval(px-r,py-r,r*2,r*2,"dodgerblue","aqua",1.5);
      _oval(px-r*0.35,py-r*0.55,r*0.55,r*0.4,"#D6F3FF",null);
      ctx.restore();
      for(let i=0;i<3;i++)_oval(px+rndInt(-r,r)*0.6-2,py+rndInt(-r,r)*0.6-2,4,4,"rgba(200,240,255,0.6)",null);
    }
    else if(pType==="ice_spear"){
      ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=10;
      ctx.fillStyle="#AEEBFF";ctx.strokeStyle="white";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px+15*pDir,py);ctx.lineTo(px-5*pDir,py-7);ctx.lineTo(px-17*pDir,py);ctx.lineTo(px-5*pDir,py+7);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
      if(!proj.trail)proj.trail=[];
      proj.trail.push({x:px,y:py,life:12});
      _compact(proj.trail,t=>{t.life--;return t.life>0;});
      proj.trail.forEach(t=>{ctx.save();ctx.globalAlpha=Math.max(0,t.life/12)*0.45;_oval(t.x-4,t.y-4,8,8,"white",null);ctx.restore();});
    }
    else if(pType==="ice_arrow"){ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(px,py-8);ctx.lineTo(px+20*pDir,py);ctx.lineTo(px,py+8);ctx.lineTo(px-8*pDir,py);ctx.closePath();ctx.fill();}
    else if(pType==="earth_arrow"){
      ctx.save();ctx.shadowColor="#8a6a4a";ctx.shadowBlur=8;
      ctx.fillStyle="#8a6a4a";ctx.strokeStyle="#4a3524";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px,py-6);ctx.lineTo(px+18*pDir,py);ctx.lineTo(px,py+6);ctx.lineTo(px-6*pDir,py);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }
    else if(pType==="ice_slash"){
      ctx.save();ctx.shadowColor="cyan";ctx.shadowBlur=12;
      ctx.strokeStyle="#E0FFFF";ctx.lineWidth=5;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(px-16*pDir,py-16);ctx.quadraticCurveTo(px+12*pDir,py,px-16*pDir,py+16);ctx.stroke();
      ctx.strokeStyle="white";ctx.lineWidth=2;ctx.stroke();
      ctx.restore();
      for(let i=0;i<3;i++)_oval(px-3+rndInt(-6,6),py-3+rndInt(-10,10),6,6,"white",null);
    }
    else if(pType==="fire_bullet"){
      const r=proj.radius||15,v2=proj.color===FIRE_V2_COL;
      ctx.save();ctx.shadowColor=v2?FIRE_V2_COL:FIRE_V1_COL;ctx.shadowBlur=14;
      _oval(px-r,py-r,r*2,r*2,v2?"#0088FF":"#FF4500",v2?"#00E5FF":"#FFCC33",1.5);
      _oval(px-r*0.4,py-r*0.4,r*0.6,r*0.6,"white",null);
      ctx.restore();
      if(!proj.trail)proj.trail=[];
      proj.trail.push({x:px,y:py,life:14});
      _compact(proj.trail,t=>{t.life--;return t.life>0;});
      proj.trail.forEach(t=>{ctx.save();ctx.globalAlpha=Math.max(0,t.life/14)*0.5;const tr=r*0.6;_oval(t.x-tr,t.y-tr,tr*2,tr*2,v2?"#00AEFF":"orange",null);ctx.restore();});
    }
    else if(pType==="earth_boulder"){
      ctx.save();ctx.shadowColor="#8a6a4a";ctx.shadowBlur=10;
      const br=proj.radius||28;
      _oval(px-br,py-br,br*2,br*2,"#6a4a2a","#4a3524",2);
      _oval(px-br*0.6,py-br*0.7,br*0.6,br*0.4,"#8a6a4a",null);
      _oval(px-br*0.3,py-br*0.3,br*0.4,br*0.3,"#a67c52",null);
      ctx.strokeStyle="#3a2518";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(px-8,py-10);ctx.lineTo(px+5,py-5);ctx.lineTo(px+2,py+8);ctx.stroke();
      ctx.beginPath();ctx.moveTo(px-3,py+3);ctx.lineTo(px+10,py-2);ctx.stroke();
      ctx.restore();
      if(!proj.boulderTrail)proj.boulderTrail=[];
      proj.boulderTrail.push({x:px,y:py,life:15});
      _compact(proj.boulderTrail,bt=>{bt.life--;return bt.life>0;});
      proj.boulderTrail.forEach(bt=>{const ba=Math.max(0,bt.life/15)*0.5;ctx.save();ctx.globalAlpha=ba;_oval(bt.x-6,bt.y-4,12,8,"#a67c52",null);ctx.restore();});
      proj.vy=(proj.vy||0)+0.25;
    }
    else if(pType==="shadow_slash"){
      // ĐÁNH THƯỜNG — a single black claw-slash flying forward like a bullet.
      ctx.save();ctx.shadowColor="#9933ff";ctx.shadowBlur=10;
      ctx.strokeStyle="#1a0033";ctx.lineWidth=5;ctx.lineCap="round";
      ctx.beginPath();ctx.moveTo(px-16*pDir,py-14);ctx.quadraticCurveTo(px+12*pDir,py,px-16*pDir,py+14);ctx.stroke();
      ctx.strokeStyle="#6a1aa8";ctx.lineWidth=2;ctx.stroke();
      ctx.restore();
      if(!proj.trail)proj.trail=[];
      proj.trail.push({x:px,y:py,life:9});
      _compact(proj.trail,t=>{t.life--;return t.life>0;});
      proj.trail.forEach(t=>{ctx.save();ctx.globalAlpha=Math.max(0,t.life/9)*0.4;_oval(t.x-4,t.y-4,8,8,"#6a1aa8",null);ctx.restore();});
    }
    else{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-25*pDir,py-6);ctx.lineTo(px-20*pDir,py);ctx.lineTo(px-25*pDir,py+6);ctx.closePath();ctx.fill();}
    ctx.restore();
    let hit=false;
    const owner=proj.owner,dmg=proj.damage,slowF=proj.slow||0,slowP=proj.slow_pct||0;
    if(gameState==="GAMEPLAY"&&player2){const tgt=proj.target;if(tgt instanceof Fighter&&tgt.hp>0&&Math.abs(px-tgt.x)<55*SR&&Math.abs(py-tgt.y)<85*SR){applyDamage(tgt,dmg,owner);if(slowF>0){tgt.slowTimer=Math.max(tgt.slowTimer,slowF);tgt._slowPct=slowP;}if(pType==="ice_spear")tgt.stunTimer=Math.max(tgt.stunTimer||0,30);hit=true;}}
    else if(gameState==="CHALLENGE"){if(owner instanceof Fighter){let exploded=false;challengeEnemies.forEach(e=>{if(e.hp>0&&Math.abs(px-e.x)<60*SR&&Math.abs(py-e.y)<80*SR){applyDamage(e,dmg,owner);if(pType==="ice_spear")e.stunTimer=Math.max(e.stunTimer||0,30);hit=true;exploded=true;}});challengeBosses.forEach(b=>{if(!b.dead&&b.hp>0&&Math.abs(px-b.x)<70*SR&&Math.abs(py-b.y)<100*SR){applyDamage(b,dmg,owner);if(pType==="ice_spear")b.stunTimer=Math.max(b.stunTimer||0,18);hit=true;exploded=true;}});if(exploded){[...challengeEnemies].forEach(e=>{if(e.hp>0&&Math.abs(px-e.x)<120*SR&&Math.abs(py-e.y)<120*SR)applyDamage(e,dmg*0.5,owner);});}}else{const p1t=shadowSoulTarget(p1);if(p1t.hp>0&&Math.abs(px-p1t.x)<55*SR&&Math.abs(py-p1t.y)<85*SR){applyDamage(p1t,dmg,owner);if(p1t===p1&&slowF>0){p1.slowTimer=Math.max(p1.slowTimer,slowF);p1._slowPct=slowP;}hit=true;}}}
    else if(gameState==="ROAD"){
      if(owner instanceof Fighter){
        let exploded=false;
        roadEnemies.forEach(e=>{if(e.hp>0&&Math.abs(px-e.x)<50*SR&&Math.abs(py-e.y)<80*SR){applyDamage(e,dmg,owner);if(pType==="ice_spear")e.stunTimer=Math.max(e.stunTimer||0,30);hit=true;exploded=true;}});
        const fw=getFrontWall();
        if(fw&&Math.abs(px-fw.x)<50*SR&&py>H*0.25){applyDamage(fw,dmg,owner);hit=true;exploded=true;}
        if(roadBoss&&!roadBoss.dead&&Math.abs(px-roadBoss.x)<80*SR&&Math.abs(py-roadBoss.y)<160*SR){applyDamage(roadBoss,dmg,owner);if(pType==="ice_spear")roadBoss.stunTimer=Math.max(roadBoss.stunTimer||0,18);hit=true;exploded=true;}
        if(exploded)roadEnemies.forEach(e=>{if(e.hp>0&&Math.abs(px-e.x)<120*SR&&Math.abs(py-e.y)<120*SR)applyDamage(e,dmg*0.5,owner);});
      }else{
        const p1t=shadowSoulTarget(p1);
        const tgt=(proj.target&&proj.target.hp>0&&proj.target!==p1)?proj.target:p1t;
        if(tgt.hp>0&&Math.abs(px-tgt.x)<45*SR&&Math.abs(py-tgt.y)<80*SR){applyDamage(tgt,dmg,owner);if(tgt===p1&&slowF>0){p1.slowTimer=Math.max(p1.slowTimer,slowF);p1._slowPct=slowP;}hit=true;}
        else if(tgt!==p1t&&p1t.hp>0&&Math.abs(px-p1t.x)<45*SR&&Math.abs(py-p1t.y)<80*SR){applyDamage(p1t,dmg,owner);if(p1t===p1&&slowF>0){p1.slowTimer=Math.max(p1.slowTimer,slowF);p1._slowPct=slowP;}hit=true;}
      }
    }
    const inBounds = gameState==="ROAD" ? (px>roadCameraX-80&&px<roadCameraX+W+80)
      : ((gameState==="GAMEPLAY"||gameState==="CHALLENGE") ? (px>campX-80&&px<campX+W+80) : (px>0&&px<W));
    // Earth boulder special hit detection
    if(pType==="earth_boulder"&&!hit){
      const boulderDmg=proj.damage||14;
      const boulderStun=proj.stunDur||25;
      if(gameState==="ROAD"&&owner instanceof Fighter){
        roadEnemies.forEach(e=>{if(e.hp>0&&Math.abs(px-e.x)<55*SR&&Math.abs(py-e.y)<70*SR){
          applyDamage(e,boulderDmg,owner);e.stunTimer=Math.max(e.stunTimer||0,boulderStun);
          if(isPushable(e)){const pd=e.x>=px?1:-1;e.x=clamp(e.x+pd*80,moveBoundLo(),moveBoundHi());}
          hit=true;
          spawnHitEffect(e.x,e.y-40,"#c68a4a");
          for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,spd=rng()*6+2;hitEffects.push({x:px,y:py,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3,life:25,maxLife:25,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"])});}
        }});
        const fw=getFrontWall();if(fw&&Math.abs(px-fw.x)<55*SR&&py>H*0.25){applyDamage(fw,boulderDmg,owner);hit=true;}
        if(roadBoss&&!roadBoss.dead&&Math.abs(px-roadBoss.x)<70*SR&&Math.abs(py-roadBoss.y)<140*SR){applyDamage(roadBoss,boulderDmg,owner);roadBoss.stunTimer=Math.max(roadBoss.stunTimer||0,15);hit=true;}
      }else{
        const fighters=[p1,p2].filter(f=>f!==owner&&f.hp>0);
        fighters.forEach(f=>{if(Math.abs(px-f.x)<50*SR&&Math.abs(py-f.y)<70*SR){
          applyDamage(f,boulderDmg,owner);f.stunTimer=Math.max(f.stunTimer||0,boulderStun);
          if(isPushable(f)){const pd=f.x>=px?1:-1;f.x=clamp(f.x+pd*80,moveBoundLo(),moveBoundHi());}
          hit=true;
          spawnHitEffect(f.x,f.y-40,"#c68a4a");
          for(let i=0;i<8;i++){const ang=rng()*Math.PI*2,spd=rng()*6+2;hitEffects.push({x:px,y:py,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-3,life:25,maxLife:25,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"])});}
        }});
      }
      // Boulder hits ground
      if(!hit&&py>=floorY-5){
        for(let i=0;i<10;i++){const ang=Math.PI+(rng()-0.5)*Math.PI*0.8,spd=rng()*5+2;hitEffects.push({x:px,y:floorY,vx:Math.cos(ang)*spd,vy:-Math.abs(Math.sin(ang))*spd-1,life:22,maxLife:22,particle:true,color:rndChoice(["#8a6a4a","#6a4a2a","#c68a4a"])});}
        hitEffects.push({x:px,y:floorY,life:18,maxLife:18,color:"#c68a4a",ring:true});
        hit=true;
      }
    }
    if(!hit&&inBounds)active.push(proj);
  }
  projectiles.length=0;projectiles.push(...active);
}

// ================================================================
//  CHALLENGE WAVE SYSTEM
// ================================================================
let _waveSpawnTimer=0;
function startChallenge(stage){
  challengeStage=stage;challengeEnemies=[];challengeBosses=[];
  challengeWaveIdx=0;challengeBossSpawned=false;challengeResult="";
  const floorY=H*FLOOR_Y_RATIO;
  const worldW=W*MAP_SCALE;
  const batches=stage<4?[2,3,4,1]:[2,3,3,2];
  challengeWaveSched=batches.slice(0,3);
  challengeWaveSched.push(10-challengeWaveSched.reduce((a,b)=>a+b,0));
  challengeState="WAVE";_spawnChallengeWave(floorY,worldW);
}
function _spawnChallengeWave(floorY,worldW){
  if(challengeWaveIdx>=challengeWaveSched.length)return;
  const cnt=challengeWaveSched[challengeWaveIdx++];
  const ww=worldW||W*MAP_SCALE;
  for(let i=0;i<cnt;i++){
    const side=rng()<0.5?-1:1;
    const ex=clamp(p1.x+side*rndInt(220,420)+rndInt(-60,60),80,ww-80);
    challengeEnemies.push(new ChallengeEnemy(ex,floorY,challengeStage));
  }
}

// ================================================================
//  FROST COMBO — Ice Prison(4) -> Ice Slide(2) -> Ice Spears(1) -> Frozen Domain(3) within 5s
// ================================================================
function checkFrostCombo(p){
  const log=p.frostComboLog;
  if(log.length<4)return;
  const last4=log.slice(-4);
  const seq=last4.map(e=>e.skill).join(",");
  if(seq==="4,2,1,3"&&(last4[3].t-last4[0].t)<=300){
    p.frostComboLog=[]; // consumed — must redo the full sequence to trigger again
    p.frostComboBonusPct=0.30;
    p.frostComboFX=40;
    screenShake=Math.max(screenShake,16);
    spawnHitEffect(p.x,p.y-60,"white");
    for(let i=0;i<24;i++){const ang=rng()*Math.PI*2,spd=rng()*6+2;hitEffects.push({x:p.x,y:p.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:34,maxLife:34,particle:true,color:rndChoice(["white","#AEEBFF","cyan"])});}
  }
}
// ================================================================
//  FROST PER-FRAME TICK — slide trail, Frozen Domain aura, Ice Prison timing, V4 innate pillars
// ================================================================
function tickFrost(p){
  if(p.charType!=="frost")return;
  if(p.frostSlideActive>0)p.frostSlideActive--;
  if(p.frostComboFX>0)p.frostComboFX--;
  // age the ice slide trail and slow anyone standing on it
  if(p.frostSlideTrail.length){
    p.frostSlideTrail.forEach(t=>t.life--);
    _compact(p.frostSlideTrail,t=>t.life>0);
    if(p.frostSlideTrail.length){
      getAllEnemies(p).forEach(opp=>{
        if(opp.hp<=0)return;
        const onTrail=p.frostSlideTrail.some(t=>Math.abs(t.x-opp.x)<30*SR&&Math.abs(opp.y-p.y)<50*SR);
        if(onTrail){opp.slowTimer=Math.max(opp.slowTimer||0,20);opp._slowPct=Math.max(opp._slowPct||0,0.35);}
      });
    }
  }
  // Frozen Domain — persistent chilling zone
  if(p.frostDomainActive){
    p.frostDomainTimer--;
    p.frostDomainTick++;
    const isBossTgt=t=>(typeof Boss!=="undefined"&&t instanceof Boss)||(typeof RoadBoss!=="undefined"&&t instanceof RoadBoss);
    getAllEnemies(p).forEach(opp=>{
      if(opp.hp<=0)return;
      const d=dist(p.x,p.y,opp.x,opp.y);
      if(d<650*SR){
        const boss=isBossTgt(opp);
        opp.slowTimer=Math.max(opp.slowTimer||0,10);opp._slowPct=Math.max(opp._slowPct||0,boss?0.18:0.35);
        if(p.frostDomainTick%50===0){ // short chill pulse every ~0.8s
          if(boss)opp.stunTimer=Math.max(opp.stunTimer||0,8);
          else opp.stunTimer=Math.max(opp.stunTimer||0,16);
        }
      }
    });
    if(p.frostDomainTimer<=0)p.frostDomainActive=false;
  }
  // Ice Prison — tracks all locked targets, each explodes on expiry or if it's hit early
  if(p._icePrisonedTargets&&p._icePrisonedTargets.length){
    _compact(p._icePrisonedTargets,tgt=>{
      if(!tgt||tgt.hp<=0)return false;
      const tookDamage=tgt._icePrisonHpLast!==undefined&&tgt.hp<tgt._icePrisonHpLast-0.01;
      tgt._icePrisonHpLast=tgt.hp;
      if(tgt._icePrisonTimer>0)tgt._icePrisonTimer--;
      if(tookDamage||tgt._icePrisonTimer<=0){
        aoeHitAt(p,10,tgt.x,tgt.y,90);
        spawnHitEffect(tgt.x,tgt.y-40,"#AEEBFF");
        for(let i=0;i<14;i++){const ang=rng()*Math.PI*2,spd=rng()*5+2;hitEffects.push({x:tgt.x,y:tgt.y-40,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:26,maxLife:26,particle:true,color:"#DFF7FF"});}
        tgt._icePrisonTimer=0;
        return false;
      }
      return true;
    });
  }
  // V4 innate: every 5s while transformed, 5 ice pillars erupt under the nearest foes
  if(p.transformActive){
    p.frostPillarTick++;
    if(p.frostPillarTick>=300){
      p.frostPillarTick=0;
      const picks=getAllEnemies(p).filter(e=>e.hp>0).sort((a,b)=>dist(p.x,p.y,a.x,a.y)-dist(p.x,p.y,b.x,b.y)).slice(0,5);
      picks.forEach(tgt=>{
        aoeHitAt(p,6,tgt.x,tgt.y,60);
        tgt.slowTimer=Math.max(tgt.slowTimer||0,40);tgt._slowPct=Math.max(tgt._slowPct||0,0.3);
        for(let i=0;i<10;i++)hitEffects.push({x:tgt.x+rndInt(-8,8),y:tgt.y-10,vx:(rng()-0.5)*2,vy:-rng()*3-1,life:22,maxLife:22,particle:true,color:"#AEEBFF"});
      });
      if(picks.length)screenShake=Math.max(screenShake,4);
    }
  }else p.frostPillarTick=0;
}

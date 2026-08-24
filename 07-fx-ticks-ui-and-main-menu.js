// ================================================================
//  SHADOW V4 — CINEMATIC CAMERA PUNCH-IN (pre-windup)
//  Drives the camera during the Shadow "Bóng Tối Thức Tỉnh" wind-up
//  (see castSkill skillNum===5 in 06, and _drawShadowTransformWindup in 03):
//   age  0-15 (0.00-0.25s): nothing — camera stays exactly where it is
//   age 15-45 (0.25-0.75s): camera snaps to center on the caster and zooms
//                            in hard, up to SHADOW_CAM_ZOOM_MAX (character
//                            reads roughly boss-sized on screen)
//   age  45+ (0.75s+)     : holds at max zoom while the 3.5s VFX wind-up
//                            (_drawShadowTransformWindup) plays out and the
//                            fighter finally transforms
//   landing (0.5s)        : eases back down to 1.0 while transformLandingTimer
//                            runs out, so the zoom doesn't just snap off
//  Used by updateGameplay / updateChallenge / updateRoad below — each reads
//  this once per frame and folds it into its own existing camera-follow +
//  (for CHALLENGE) boss-intro-zoom logic, rather than adding a parallel
//  camera system.
// ================================================================
const SHADOW_CAM_ZOOM_MAX=2.5;
const SHADOW_CAM_DELAY=15;      // 0.25s: absolutely nothing happens yet
const SHADOW_CAM_ZOOMIN_END=45; // 0.75s elapsed: punch-in finished, VFX wind-up begins exactly here
function shadowCamZoomState(p){
  if(!p||p.charType!=="shadow")return{zoom:1.0,active:false};
  if(p.transformWindupTimer>0){
    const total=p._transformWindupTotal||255;
    const age=total-p.transformWindupTimer;
    if(age<SHADOW_CAM_DELAY)return{zoom:1.0,active:false};
    if(age<SHADOW_CAM_ZOOMIN_END){
      const t=(age-SHADOW_CAM_DELAY)/(SHADOW_CAM_ZOOMIN_END-SHADOW_CAM_DELAY);
      const eased=1-Math.pow(1-t,3); // ease-out cubic: fast punch, settles into place
      return{zoom:1.0+(SHADOW_CAM_ZOOM_MAX-1.0)*eased,active:true};
    }
    return{zoom:SHADOW_CAM_ZOOM_MAX,active:true};
  }
  if(p.transformLandingTimer>0&&p.transformActive&&p.charType==="shadow"){
    const t=1-(p.transformLandingTimer/30);
    const eased=t*t;
    return{zoom:SHADOW_CAM_ZOOM_MAX+(1.0-SHADOW_CAM_ZOOM_MAX)*eased,active:true};
  }
  return{zoom:1.0,active:false};
}

// ================================================================
//  FROST WORLD-SPACE FX — drawn in absolute coordinates (not the per-fighter scaled transform)
// ================================================================
// THUNDER DASH TRAIL: the electric line left behind by Thunder Dash. Each
// segment arms for ~0.3s (18 frames) then detonates once, shocking/slowing/
// knocking back anyone standing on it, before fading out visually.
function tickThunderDash(p){
  if(p.charType!=="thunder"||!p.thunderDashTrail||!p.thunderDashTrail.length)return;
  p.thunderDashTrail.forEach(seg=>{
    if(seg.armed>0){
      seg.armed--;
      if(seg.armed===0&&!seg.exploded){
        seg.exploded=true;
        getAllEnemies(p).forEach(opp=>{
          if(dist(seg.x,seg.y,opp.x,opp.y)<70*SR){
            applyDamage(opp,10,p);
            addShock(opp,p);
            opp.slowTimer=Math.max(opp.slowTimer||0,60);opp._slowPct=0.5;
            if(opp instanceof Fighter){opp.vy=-6;const pd=opp.x>=seg.x?1:-1;opp.x=clamp(opp.x+pd*40,moveBoundLo(),moveBoundHi());}
          }
        });
        spawnHitEffect(seg.x,seg.y-20,"#FFD700");
        screenShake=Math.max(screenShake,8);
      }
    }
    seg.life--;
  });
  _compact(p.thunderDashTrail,s=>s.life>0);
}
function drawThunderDashTrail(p){
  if(p.charType!=="thunder"||!p.thunderDashTrail||!p.thunderDashTrail.length)return;
  p.thunderDashTrail.forEach(seg=>{
    const a=Math.max(0,seg.life/18);
    ctx.save();ctx.globalAlpha=a*(seg.exploded?0.3:0.75);
    ctx.strokeStyle=seg.exploded?"#FFF176":"#FFFFFF";ctx.shadowColor="#FFD700";ctx.shadowBlur=10;ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(seg.x-12,seg.y+4);ctx.lineTo(seg.x+12,seg.y-2);ctx.stroke();
    ctx.restore();
  });
}
function drawFrostSlideTrail(p){
  if(p.charType!=="frost"||!p.frostSlideTrail.length)return;
  p.frostSlideTrail.forEach(t=>{
    const a=Math.max(0,t.life/t.maxLife);
    ctx.save();ctx.globalAlpha=a*0.5;ctx.fillStyle="#AEEBFF";ctx.strokeStyle="white";ctx.lineWidth=1;
    ctx.beginPath();ctx.ellipse(t.x,t.y+4,24,7,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.restore();
  });
}
function drawFrostDomain(p){
  if(p.charType!=="frost"||!p.frostDomainActive)return;
  const rx=p.x,ry=p.y-16,rad=650*SR;
  ctx.save();ctx.globalAlpha=0.16;ctx.fillStyle="#BEEBFF";ctx.beginPath();ctx.ellipse(rx,ry,rad,rad*0.45,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=0.7;ctx.strokeStyle="deepskyblue";ctx.lineWidth=2;ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.ellipse(rx,ry,rad,rad*0.45,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  if(p._domainSnow.length<36&&rng()<0.6)p._domainSnow.push({x:rx+rndInt(-rad,rad),y:ry-rndInt(60,160),vy:rng()*1.4+1,r:rndInt(2,4)});
  _compact(p._domainSnow,s=>s.y<ry+30);
  p._domainSnow.forEach(s=>{s.y+=s.vy;_oval(s.x-s.r,s.y-s.r,s.r*2,s.r*2,"white",null);});
  _text(rx,ry-rad*0.45-14,"❄️ FROZEN DOMAIN ❄️","deepskyblue","11px Arial bold");
}
function drawFrostIcePrison(target){
  if(!target||!(target._icePrisonTimer>0))return;
  const rx=target.x,ry=target.y-40;
  ctx.save();ctx.globalAlpha=0.8;ctx.fillStyle="rgba(190,235,255,0.5)";ctx.strokeStyle="white";ctx.lineWidth=2;
  ctx.beginPath();ctx.ellipse(rx,ry,40,56,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle="rgba(255,255,255,0.55)";ctx.lineWidth=1;
  for(let i=0;i<4;i++){ctx.beginPath();ctx.moveTo(rx-28+i*18,ry-46);ctx.lineTo(rx-20+i*18,ry+46);ctx.stroke();}
  ctx.restore();
  _text(rx,ry-64,"🧊 ICE PRISON 🧊","deepskyblue","9px Arial bold");
}
// ================================================================
//  WIND PER-FRAME TICK — dash trail fade + Lốc Giam Cầm cyclone trap
//  (skill 4 "Đại Phong Bạo" ticks inline in the ulti-timer blocks, same
//  pattern as thunder_s4/frost_s4/earth_s4, since it shares the generic
//  ultiTimer countdown wired into GAMEPLAY/CHALLENGE/ROAD.)
// ================================================================
function tickWind(p){
  if(p.charType!=="wind")return;
  if(p.windDashTimer>0)p.windDashTimer--;
  if(p.windDashTrail.length){
    p.windDashTrail.forEach(t=>t.life--);
    _compact(p.windDashTrail,t=>t.life>0);
  }
  // LỐC GIAM CẦM — stationary cyclone that pulls enemies toward its core,
  // chips damage every ~0.33s, then bursts them upward when it collapses
  if(p.windCycloneActive){
    p.windCycloneTimer--;
    p.windCycloneTick++;
    const cx=p.windCycloneX,cy=p.windCycloneY,pullR=300*SR;
    getAllEnemies(p).forEach(opp=>{
      if(opp.hp<=0)return;
      const d=dist(cx,cy,opp.x,opp.y);
      if(d<pullR){
        if(isPushable(opp)){const pd=opp.x>=cx?-1:1;opp.x=clamp(opp.x+pd*7,moveBoundLo(),moveBoundHi());}
        if(p.windCycloneTick%20===0)applyDamage(opp,10,p);
      }
    });
    if(p.windCycloneTimer<=0){
      p.windCycloneActive=false;
      aoeHitAt(p,20,cx,cy,300);
      getAllEnemies(p).forEach(opp=>{if(opp.hp>0&&dist(cx,cy,opp.x,opp.y)<300*SR){if(opp instanceof Fighter)opp.vy=-14;spawnHitEffect(opp.x,opp.y-40,"#90EE90");}});
      screenShake=Math.max(screenShake,10);
    }
  }
  // hai cơn lốc bắn ra hai bên khi Đại Phong Bạo kết thúc — đẩy văng đối
  // thủ ra xa để giữ khoảng cách tốt hơn sau khi xoay bão
  if(p.windSideCyclones.length){
    p.windSideCyclones.forEach(c=>{
      c.x+=16*c.dir;
      c.life--;
      getAllEnemies(p).forEach(opp=>{
        if(opp.hp<=0||c.hitSet.has(opp))return;
        if(dist(c.x,c.y,opp.x,opp.y)<95*SR){
          c.hitSet.add(opp);
          applyDamage(opp,14,p);
          if(isPushable(opp)){const pd=c.dir>=0?1:-1;opp.x=clamp(opp.x+pd*260,moveBoundLo(),moveBoundHi());}
          if(opp instanceof Fighter)opp.vy=-8;
          spawnHitEffect(opp.x,opp.y-40,"#90EE90");
        }
      });
    });
    _compact(p.windSideCyclones,c=>c.life>0&&c.x>moveBoundLo()-150&&c.x<moveBoundHi()+150);
  }
}
function spawnWindSideCyclones(p){
  p.windSideCyclones.push({x:p.x,y:p.y,dir:1,life:75,hitSet:new Set()});
  p.windSideCyclones.push({x:p.x,y:p.y,dir:-1,life:75,hitSet:new Set()});
  screenShake=Math.max(screenShake,10);
}
function drawWindSideCyclones(p){
  if(!p.windSideCyclones||!p.windSideCyclones.length)return;
  const af=p.animFrame;
  p.windSideCyclones.forEach(c=>{
    const rad=95*SR;
    ctx.save();ctx.globalAlpha=0.22;ctx.fillStyle="#90EE90";
    ctx.beginPath();ctx.ellipse(c.x,c.y,rad,rad*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
    for(let layer=0;layer<6;layer++){
      const frac=layer/6,layerY=c.y+30-frac*150,baseR=rad*(1-frac*0.5)+8,spin=Math.sin(af*0.28+frac*Math.PI*2.2)*(14-frac*4);
      ctx.strokeStyle=["#0f4d0f","#166416","#228B22","#32CD32","#7CFC00","#F0FFF0"][layer];
      ctx.lineWidth=2.5;ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=6;
      ctx.beginPath();ctx.ellipse(c.x+spin,layerY,baseR,15,0,0,Math.PI*2);ctx.stroke();
      ctx.restore();
    }
  });
}
function drawWindDashTrail(p){
  if(p.charType!=="wind"||!p.windDashTrail.length)return;
  p.windDashTrail.forEach(t=>{
    const a=Math.max(0,t.life/t.maxLife);
    ctx.save();ctx.globalAlpha=a*0.55;ctx.strokeStyle="#90EE90";ctx.lineWidth=3;ctx.setLineDash([4,3]);
    ctx.beginPath();ctx.moveTo(t.x-14,t.y+6);ctx.lineTo(t.x+14,t.y-4);ctx.stroke();ctx.setLineDash([]);
    ctx.restore();
  });
}
function drawWindCyclone(p){
  if(p.charType!=="wind"||!p.windCycloneActive)return;
  const cx=p.windCycloneX,cy=p.windCycloneY,af=p.animFrame,rad=300*SR;
  ctx.save();ctx.globalAlpha=0.20;ctx.fillStyle="#90EE90";
  ctx.beginPath();ctx.ellipse(cx,cy,rad,rad*0.5,0,0,Math.PI*2);ctx.fill();ctx.restore();
  ctx.save();ctx.globalAlpha=0.55;ctx.strokeStyle="#CCFFCC";ctx.lineWidth=2;ctx.setLineDash([7,5]);
  ctx.beginPath();ctx.ellipse(cx,cy,rad,rad*0.5,0,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.restore();
  for(let layer=0;layer<10;layer++){
    const frac=layer/10,layerY=cy+50-frac*260,baseR=rad*(1-frac*0.55)+10,spin=Math.sin(af*0.22+frac*Math.PI*2.4)*(26-frac*10);
    ctx.strokeStyle=["#0a330a","#0f4d0f","#166416","#228B22","#2fa82f","#32CD32","#57DE57","#7CFC00","#ADFF2F","#F0FFF0"][layer];
    ctx.lineWidth=3;ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=6;
    ctx.beginPath();ctx.ellipse(cx+spin,layerY,baseR,20,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  }
  if(!p._cycloneDebris)p._cycloneDebris=[0,1,2,3,4].map(i=>({ang:i*72,r:rndInt(40,rad*0.9),s:rndInt(4,9)}));
  p._cycloneDebris.forEach(d=>{
    d.ang+=8;
    const dx=cx+Math.cos(d.ang*Math.PI/180)*d.r,dy=cy-10+Math.sin(d.ang*Math.PI/180)*d.r*0.45;
    ctx.save();ctx.shadowColor="#90EE90";ctx.shadowBlur=6;ctx.fillStyle="#E0FFE0";
    ctx.beginPath();ctx.ellipse(dx,dy,d.s,d.s*0.5,d.ang*Math.PI/180,0,Math.PI*2);ctx.fill();
    ctx.restore();
  });
  _text(cx,cy-rad*0.5-22,"🌀 LỐC GIAM CẦM 🌀","#90EE90","12px Arial bold");
}
// ================================================================
//  V4 TRANSFORM TICK
// ================================================================
function tickV4(p){
  if(!p.transformActive)return;
  if(p.transformTimer>0)p.transformTimer--;
  else{
    p.transformActive=false;p.isFlying=false;p.v4LifestealPct=0;p.ghostHp=0;p.transformInvisActive=false;p.transformInvisTimer=0;p._shadowRedGlow=false;
    if(p.charType==="red"){
      // Small closing burst + distinct sound as the Hỏa Ma Thần fire dies down to embers.
      sfxTransformEnd();
      p.hoaChungStacks=0;p.hoaChungFlashTimer=0;p._fireFlyTrail=[];
      for(let i=0;i<16;i++){const ang=rng()*Math.PI*2,spd=rng()*3+1.5;hitEffects.push({x:p.x,y:p.y-60,vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-1,life:28,maxLife:28,particle:true,color:rndChoice(["#FF6600","#FF9900","#FFCC33","#552200"])});}
      hitEffects.push({x:p.x,y:p.y-60,life:22,maxLife:22,color:"#FF6600",ring:true});
    }
    return;
  }
  if(p.charType==="thunder"){
    // V4 AURA (Storm Field): ~6m radius crackling field around the fighter.
    // Anyone standing in it gets a light shock, builds Shock Stack, and
    // takes damage over time. Occasional random bolts crash nearby too,
    // giving the "storm following the god" feel.
    p.thunderAuraTick++;
    if(p.thunderAuraTick>=15){
      p.thunderAuraTick=0;
      getAllEnemies(p).forEach(opp=>{
        if(dist(p.x,p.y,opp.x,opp.y)<540){
          applyDamage(opp,2.5,p);
          addShock(opp,p);
        }
      });
    }
    if(rng()<0.10){
      const sx=p.x+rndInt(-240,240),sy=p.y-rndInt(200,340);
      spawnLightningArc(sx,sy,sx+rndInt(-20,20),p.y-30);
    }
  }
  if((p.charType==="frost"||p.charType==="red")&&!p.isFlying)p.isFlying=true;
  // RED V4 — HỎA PHI: while streaking through the air as a living flame, anyone
  // caught in the trail takes periodic burn damage (the "quái va vào luồng lửa" rule).
  if(p.charType==="red"&&p.isFlying){
    p.fireFlyDamageTick=(p.fireFlyDamageTick||0)+1;
    if(p.fireFlyDamageTick>=14){
      p.fireFlyDamageTick=0;
      getAllEnemies(p).forEach(opp=>{
        if(dist(p.x,p.y,opp.x,opp.y)<130*SR){
          applyDamage(opp,4,p);
          spawnHitEffect(opp.x,opp.y-40,"#FF6600");
        }
      });
    }
  }
  if(p.charType==="water"){p.waterRegenTick++;if(p.waterRegenTick>=15){p.waterRegenTick=0;p.hp=Math.min(p.maxHp||MAX_HP,p.hp+3);}p.waterSlowAuraTick++;if(p.waterSlowAuraTick>=30){p.waterSlowAuraTick=0;getAllEnemies(p).forEach(opp=>{if(dist(p.x,p.y,opp.x,opp.y)<320){opp.slowTimer=Math.max(opp.slowTimer||0,45);opp._slowPct=0.8;}});}}
  if(p.charType==="wind"){p.windMiniTornadoTick++;if(p.windMiniTornadoTick===1){getAllEnemies(p).forEach(opp=>{if(dist(p.x,p.y,opp.x,opp.y)<160){if(opp instanceof Fighter)opp.vy=-16;applyDamage(opp,5,p);}});}else if(p.windMiniTornadoTick>=120)p.windMiniTornadoTick=0;}
  // EARTH V4: slow aura + ground rumble
  if(p.charType==="earth"&&p.transformActive){
    p.waterSlowAuraTick++; // reusing this timer
    if(p.waterSlowAuraTick>=40){
      p.waterSlowAuraTick=0;
      getAllEnemies(p).forEach(opp=>{
        if(dist(p.x,p.y,opp.x,opp.y)<280){
          opp.slowTimer=Math.max(opp.slowTimer||0,30);
          opp._slowPct=Math.max(opp._slowPct||0,0.4);
        }
      });
    }
    // Ground rumble particles
    if(p.onGround&&p.waterSlowAuraTick%20===0){
      for(let i=0;i<2;i++)hitEffects.push({x:p.x+rndInt(-30,30),y:p.y+2,vy:-rng()*0.3-0.1,vx:(rng()-0.5)*0.5,life:15,maxLife:15,smoke:true,r0:rndInt(3,6),color:rndChoice(["#c68a4a","#a67c52","#8a6a4a"])});
    }
  }
}

// ================================================================
//  WATER RAIN CLOUD TICK (skill 2)
// ================================================================
function tickWaterCloud(p){
  if(p.dmgReduceTimer>0)p.dmgReduceTimer--;
  if(!p.waterCloudTimer||p.waterCloudTimer<=0){p.waterCloudTimer=0;return;}
  p.waterCloudTimer--;
  p.waterCloudTick=(p.waterCloudTick||0)+1;
  if(p.waterCloudTick>=60){p.waterCloudTick=0;p.hp=Math.min(p.maxHp||MAX_HP,p.hp+2);}
  if(!p.waterCloudDrops)p.waterCloudDrops=[];
  if(rng()<0.5&&p.waterCloudDrops.length<20)p.waterCloudDrops.push({x:p.x+rndInt(-45,45),y:p.y-rndInt(60,130),r:rndInt(2,4)});
  p.waterCloudDrops.forEach(d=>{d.y+=6;});
  _compact(p.waterCloudDrops,d=>d.y<p.y+10);
  getAllEnemies(p).forEach(opp=>{
    if(Math.abs(opp.x-p.x)<75&&Math.abs(opp.y-p.y)<100){
      opp.slowTimer=Math.max(opp.slowTimer||0,15);opp._slowPct=0.5;
    }
  });
}

// ================================================================
//  FIGHTERS INIT
// ================================================================
let p1=new Fighter(200,H*FLOOR_Y_RATIO,"red",1);
let p2=new Fighter(800,H*FLOOR_Y_RATIO,"shadow",-1);

// ================================================================
//  FLOOR DRAW
// ================================================================
function drawFloor(floorY,pvpMode,camX=0){
  const fc=frameCount;
  ctx.fillStyle="#1a1a2e";ctx.fillRect(camX,floorY,W,H-floorY);
  ctx.fillStyle="#2d2d44";ctx.fillRect(camX,floorY,W,22);
  ctx.strokeStyle=pvpMode?"#7b68ee":"#e84545";ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(camX,floorY);ctx.lineTo(camX+W,floorY);ctx.stroke();
  ctx.strokeStyle=pvpMode?"#9b88ff":"#ff6666";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(camX,floorY+1);ctx.lineTo(camX+W,floorY+1);ctx.stroke();
  for(let row=0;row<4;row++){const fy2=floorY+22+row*28;ctx.strokeStyle="#252540";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(camX,fy2);ctx.lineTo(camX+W,fy2);ctx.stroke();}
  const tileW=120;const startCol=Math.floor(camX/tileW);for(let col=startCol;col<startCol+Math.ceil(W/tileW)+2;col++){const tx2=col*tileW;for(let row=0;row<5;row++){const fy2=floorY+22+row*28;if(fy2<H){ctx.strokeStyle="#252540";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(tx2,floorY+22);ctx.lineTo(tx2,Math.min(fy2+28,H));ctx.stroke();}}}
  const pulse=Math.abs(fc%120-60)/60,ga=Math.floor(80+pulse*60);
  ctx.strokeStyle=pvpMode?`rgba(${ga},${Math.floor(ga*0.6)},255,1)`:`rgba(${ga},${Math.floor(ga*0.15)},${Math.floor(ga*0.15)},1)`;
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(camX,floorY-1);ctx.lineTo(camX+W,floorY-1);ctx.stroke();
}

// ================================================================
//  HP BAR + COOLDOWN UI
// ================================================================
function drawHpBar(fighter,bx,by,label){
  const bw=(fighter.hp/(fighter.maxHp||MAX_HP))*200;
  _rect(bx,by,200,20,"#333",null,0);_rect(bx,by,Math.max(0,bw),20,fighter===p1?"#ff1a1a":"#b300b3",null,0);
  if(fighter.charType==="water"&&fighter.waterShieldHp>0){const sw=(fighter.waterShieldHp/15)*200;ctx.fillStyle="rgba(0,255,255,0.5)";ctx.fillRect(bx,by,Math.max(0,sw),20);_text(bx+100,by-12,`🛡️ ${Math.floor(fighter.waterShieldHp)} shield`,"aqua","8px Arial bold");}
  _text(bx+100,by-12,`${label} (${fighter.charType.toUpperCase()}): ${getHPDisplay(fighter.hp)}/${fighter.maxHp||MAX_HP} HP`,"white","10px Arial bold");
}
function drawRageBar(bx,by,bw,bh,fighter){
  if(fighter.charType==="shadow"){_drawShadowRageBar(bx,by,bw,bh,fighter);return;}
  const cdMax=1200,cd=fighter.cds.s5||0;
  const ready = cd<=0;
  const fillFrac = ready ? 1 : clamp(1-(cd/cdMax),0,1);
  _rect(bx,by,bw,bh,"#330000","#111",1);
  const fillW=Math.max(0,bw*fillFrac);
  ctx.fillStyle = ready ? "#ff2a2a" : "#cc3333";
  ctx.fillRect(bx,by,fillW,bh);
  _rectOutline(bx,by,bw,bh,"#000",1);
  if(ready||fighter.transformActive){
    if(!fighter._smokeParts)fighter._smokeParts=[];
    if(rng()<0.6)fighter._smokeParts.push({x:bx+rng()*bw,y:by,vy:-rng()*0.8-0.3,life:30,r:rng()*4+2});
    _compact(fighter._smokeParts,s=>s.life>0);
    fighter._smokeParts.forEach(s=>{s.y+=s.vy;s.life--;ctx.beginPath();ctx.fillStyle=`rgba(180,180,180,${Math.max(0,s.life/30*0.5)})`;ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
  }
  _text(bx+bw/2,by+bh/2,ready?"NỘ (SẴN SÀNG)":"NỘ","white","9px Arial bold");
}
// SHADOW's own rage bar: near-black fill, small purple tentacles that wiggle
// along the filled edge, and black smoke (instead of the generic gray) once
// full — kept fully separate from drawRageBar() above so every other
// character's bar is untouched.
function _drawShadowRageBar(bx,by,bw,bh,fighter){
  const cdMax=1200,cd=fighter.cds.s5||0;
  const ready = cd<=0;
  const fillFrac = ready ? 1 : clamp(1-(cd/cdMax),0,1);
  _rect(bx,by,bw,bh,"#0a0612","#000",1);
  const fillW=Math.max(0,bw*fillFrac);
  const grad=ctx.createLinearGradient(bx,by,bx+fillW,by);
  grad.addColorStop(0,"#170a26");
  grad.addColorStop(1,ready?"#6a2fd9":"#3a1a5e");
  ctx.fillStyle=grad;
  ctx.fillRect(bx,by,fillW,bh);
  _rectOutline(bx,by,bw,bh,"#bb44ff",1);
  // wiggling tentacles poking up out of the filled portion
  const tentCount=Math.max(2,Math.round(fillFrac*8));
  for(let i=0;i<tentCount;i++){
    const tx=bx+(i+0.5)*(bw/8);
    if(tx>bx+fillW+3)continue;
    const wig=Math.sin(frameCount*0.15+i*1.7)*3;
    const tipLift=2+Math.abs(Math.sin(frameCount*0.08+i*0.9))*3;
    ctx.save();
    ctx.strokeStyle="#6654ff";ctx.lineWidth=2;ctx.lineCap="round";
    ctx.shadowColor="#bb44ff";ctx.shadowBlur=4;
    ctx.beginPath();
    ctx.moveTo(tx,by+1);
    ctx.quadraticCurveTo(tx+wig,by-bh*0.55,tx+wig*1.4,by-bh*0.9-tipLift);
    ctx.stroke();
    ctx.restore();
  }
  // black smoke once full/ready (or while actively transformed)
  if(ready||fighter.transformActive){
    if(!fighter._shadowRageSmoke)fighter._shadowRageSmoke=[];
    if(rng()<0.7)fighter._shadowRageSmoke.push({x:bx+rng()*bw,y:by,vx:(rng()-0.5)*0.4,vy:-rng()*0.9-0.3,life:34,r:rng()*5+3});
    _compact(fighter._shadowRageSmoke,s=>s.life>0);
    fighter._shadowRageSmoke.forEach(s=>{s.x+=s.vx;s.y+=s.vy;s.life--;ctx.beginPath();ctx.fillStyle=`rgba(8,4,14,${Math.max(0,s.life/34*0.75)})`;ctx.arc(s.x,s.y,s.r,0,Math.PI*2);ctx.fill();});
  }
  _text(bx+bw/2,by+bh/2,ready?"NỘ (SẴN SÀNG)":"NỘ","white","9px Arial bold");
}
function drawCooldownUI(){
  // Skill 1 has no dedicated button anymore (it's the click/space/tap basic
  // attack), so only s2-s4 get a HUD slot — relabeled C1/C2/C3 to stay a
  // clean sequential 1-2-3 for the buttons actually shown.
  const skills=["s2","s3","s4"],p1b=[keyBindings.s2,keyBindings.s3,keyBindings.s4].map(k=>k.toUpperCase()),p2b=["4","3","5"];
  skills.forEach((s,i)=>{const bx=50+i*100;_rect(bx,85,90,25,"#888","#555",1);if(p1.cds[s]>0)_text(bx+45,97,(p1.cds[s]/60).toFixed(1)+"s","black","9px Arial bold");else _text(bx+45,97,`C${i+1}(${p1b[i]})`,"black","8px Arial bold");});
  skills.forEach((s,i)=>{const bx=W-550+i*100;_rect(bx,85,90,25,"#888","#555",1);if(p2.cds[s]>0)_text(bx+45,97,(p2.cds[s]/60).toFixed(1)+"s","black","9px Arial bold");else _text(bx+45,97,`C${i+1}(${p2b[i]})`,"black","8px Arial bold");});
}
function drawCooldownChallenge(){
  const skills=["s2","s3","s4"],p1b=[keyBindings.s2,keyBindings.s3,keyBindings.s4].map(k=>k.toUpperCase());
  skills.forEach((s,i)=>{const bx=50+i*100;_rect(bx,85,90,25,"#888","#555",1);if(p1.cds[s]>0)_text(bx+45,97,(p1.cds[s]/60).toFixed(1)+"s","black","9px Arial bold");else _text(bx+45,97,`C${i+1}(${p1b[i]})`,"black","8px Arial bold");});
}

// ================================================================
//  SETTINGS PANEL (PC/MOBILE mode)
// ================================================================
function drawSettingsPanel() {
  const pw=380, ph=280;
  const px=(W-pw)/2, py=(H-ph)/2;
  _rect(px,py,pw,ph,"#1a1a2e","gold",3);
  _text(W/2, py+30, "⚙️ THIẾT LẬP", "gold", "14px Arial bold");
  _text(W/2, py+65, "Chọn chế độ điều khiển:", "white", "11px Arial");
  // PC button
  const pcActive = platformMode === "PC";
  _rect(px+30, py+90, 130, 44, pcActive?"#1a73e8":"#333", pcActive?"#4af":"gray60", 2);
  _text(px+95, py+112, "💻 MÁY TÍNH", pcActive?"white":"#888", "11px Arial bold");
  // MOBILE button
  const mobActive = platformMode === "MOBILE";
  _rect(px+220, py+90, 130, 44, mobActive?"#34a853":"#333", mobActive?"#6f6":"gray60", 2);
  _text(px+285, py+112, "📱 ĐIỆN THOẠI", mobActive?"white":"#888", "11px Arial bold");
  // Customize button — content depends on current platform mode
  if (pcActive) {
    _rect(px+30, py+150, 320, 44, "#5c3d99", "#c9a6ff", 2);
    _text(W/2, py+172, "⌨️ CHỈNH PHÍM ĐIỀU KHIỂN", "white", "11px Arial bold");
  } else {
    _rect(px+30, py+150, 320, 44, "#a85c00", "#ffb454", 2);
    _text(W/2, py+172, "📱 CHỈNH NÚT CẢM ỨNG", "white", "11px Arial bold");
  }
  // Close
  _rect(px+140, py+214, 100, 36, "#555", "white", 1);
  _text(W/2, py+232, "ĐÓNG", "white", "11px Arial bold");
}

function handleSettingsClick(mx, my) {
  const pw=380, ph=280, px=(W-pw)/2, py=(H-ph)/2;
  // PC button
  if(mx>=px+30&&mx<=px+160&&my>=py+90&&my<=py+134){
    platformMode="PC"; resizeCanvas(); return;
  }
  // MOBILE button
  if(mx>=px+220&&mx<=px+350&&my>=py+90&&my<=py+134){
    platformMode="MOBILE"; resizeCanvas(); return;
  }
  // Customize button
  if(mx>=px+30&&mx<=px+350&&my>=py+150&&my<=py+194){
    showSettings=false;
    if(platformMode==="PC"){ rebindingAction=null; gameState="KEY_EDITOR"; }
    else{ touchEditorSelKey=null; touchEditorDrag=null; gameState="TOUCH_EDITOR"; }
    return;
  }
  // Close
  if(mx>=px+140&&mx<=px+240&&my>=py+214&&my<=py+250){
    showSettings=false; return;
  }
}

// ================================================================
//  PC KEY-REBIND EDITOR
// ================================================================
function drawKeyEditor(){
  ctx.fillStyle="#0d0d1a"; ctx.fillRect(0,0,W,H);
  const pw=460, ph=460, px=(W-pw)/2, py=(H-ph)/2;
  _rect(px,py,pw,ph,"#1a1a2e","gold",3);
  _text(W/2,py+28,"⌨️ CHỈNH PHÍM ĐIỀU KHIỂN","gold","15px Arial bold");
  _text(W/2,py+50,"Bấm vào ô phím rồi nhấn phím bạn muốn dùng","#aaa","10px Arial");
  const rowH=36, startY=py+72;
  KEY_ACTION_ORDER.forEach((act,i)=>{
    const ry=startY+i*rowH;
    _text(px+110,ry+18,KEY_ACTION_LABELS[act],"white","11px Arial bold");
    const bx=px+pw-130, bw=100, bh=28;
    const isRebind = rebindingAction===act;
    _rect(bx,ry+4,bw,bh, isRebind?"#c94b4b":"#333", isRebind?"#ff8080":"#888", 2);
    _text(bx+bw/2, ry+18, isRebind?"Nhấn phím...":keyBindings[act].toUpperCase(), "white", isRebind?"9px Arial bold":"11px Arial bold");
  });
  const doneY=startY+KEY_ACTION_ORDER.length*rowH+22;
  _rect(px+pw/2-140,doneY,120,36,"#2d6a2d","white",1);
  _text(px+pw/2-80,doneY+18,"XONG","white","11px Arial bold");
  _rect(px+pw/2+20,doneY,120,36,"#7a3b3b","white",1);
  _text(px+pw/2+80,doneY+18,"ĐẶT LẠI","white","10px Arial bold");
}
function handleKeyEditorClick(mx,my){
  const pw=460, ph=460, px=(W-pw)/2, py=(H-ph)/2;
  const rowH=36, startY=py+72;
  for(let i=0;i<KEY_ACTION_ORDER.length;i++){
    const ry=startY+i*rowH;
    const bx=px+pw-130, bw=100, bh=28;
    if(mx>=bx&&mx<=bx+bw&&my>=ry+4&&my<=ry+4+bh){ rebindingAction=KEY_ACTION_ORDER[i]; return; }
  }
  const doneY=startY+KEY_ACTION_ORDER.length*rowH+22;
  if(mx>=px+pw/2-140&&mx<=px+pw/2-20&&my>=doneY&&my<=doneY+36){ gameState="MENU"; rebindingAction=null; return; }
  if(mx>=px+pw/2+20&&mx<=px+pw/2+140&&my>=doneY&&my<=doneY+36){
    keyBindings={left:"a", right:"d", up:"w", down:"s", s2:"f", s3:"t", s4:"g", v4:"y", shield:"r"};
    rebindingAction=null; return;
  }
}

// ================================================================
//  MOBILE TOUCH-CONTROL LAYOUT EDITOR
// ================================================================
const _TOUCH_EDITOR_BTN_LABELS = {joystick:"Cần điều khiển", s2:"Chiêu 2", s3:"Chiêu 3", s4:"Chiêu 4", shield:"Khiên", v4:"Biến Hình"};
function _hitTestVBtn(x,y,btn){ return btn && Math.hypot(x-btn.x, y-btn.y) <= ((btn.r||30)+6); }
function drawTouchEditor(){
  ctx.fillStyle="#0d1b2a"; ctx.fillRect(0,0,W,H);
  buildVBtns();
  _text(W/2,24,"📱 CHỈNH NÚT CẢM ỨNG","gold","15px Arial bold");
  _text(W/2,46,"Kéo nút để di chuyển · Chọn nút rồi bấm − / + để đổi cỡ","#aaa","10px Arial");

  _rect(W/2-115,56,230,30,"#2d4a6a","white",1);
  _text(W/2,71, touchMoveStyle==="dpad" ? "🎮 Di chuyển: D-PAD (chạm hướng)" : "🕹️ Di chuyển: CẦN ĐIỀU KHIỂN", "white","10px Arial bold");

  if (touchMoveStyle==="dpad") { if (vBtns1.joystick) drawDpad(vBtns1, {}); }
  else if (vBtns1.joystick) drawJoystick(vBtns1.joystick, false);
  ["s2","s3","s4","shield"].forEach(k => { if (vBtns1[k]) drawSkillBtn(vBtns1[k], {}, k); });
  if (vBtns1.v4) drawUltiBtn(vBtns1.v4, false, true, false);

  if(touchEditorSelKey){
    const btn=vBtns1[touchEditorSelKey];
    if(btn){
      ctx.save(); ctx.strokeStyle="lime"; ctx.lineWidth=3;
      ctx.beginPath(); ctx.arc(btn.x, btn.y, (btn.r||30)+8, 0, Math.PI*2); ctx.stroke();
      ctx.restore();
    }
  }

  _rect(20,16,140,32,"#7a3b3b","white",1); _text(90,32,"ĐẶT LẠI TẤT CẢ","white","9px Arial bold");
  _rect(W-140,16,120,32,"#2d6a2d","white",1); _text(W-80,32,"XONG","white","11px Arial bold");

  if(touchEditorSelKey){
    const by=H-70;
    _text(W/2,by-22,`Đang chỉnh: ${_TOUCH_EDITOR_BTN_LABELS[touchEditorSelKey]}`,"white","11px Arial bold");
    _rect(W/2-140,by-16,44,44,"#333","white",2); _text(W/2-118,by+6,"−","white","20px Arial bold");
    _rect(W/2-40,by-16,80,44,"#444","#888",1); _text(W/2,by+6,`x${mobileLayoutCfg[touchEditorSelKey].scale.toFixed(1)}`,"white","10px Arial bold");
    _rect(W/2+96,by-16,44,44,"#333","white",2); _text(W/2+118,by+6,"+","white","20px Arial bold");
    _rect(W/2+160,by-16,110,44,"#7a3b3b","white",1); _text(W/2+215,by+6,"Đặt lại nút","white","9px Arial bold");
  }
}
function handleTouchEditorPointer(x,y,phase){
  if(phase==="down"){
    if(x>=20&&x<=160&&y>=16&&y<=48){
      Object.keys(mobileLayoutCfg).forEach(k=>{mobileLayoutCfg[k]={dx:0,dy:0,scale:1};});
      mobileLayoutVersion++; touchEditorSelKey=null; touchEditorDrag=null; return;
    }
    if(x>=W-140&&x<=W-20&&y>=16&&y<=48){ gameState="MENU"; touchEditorDrag=null; return; }
    if(x>=W/2-115&&x<=W/2+115&&y>=56&&y<=86){
      touchMoveStyle = touchMoveStyle==="dpad" ? "joystick" : "dpad"; return;
    }
    if(touchEditorSelKey){
      const by=H-70;
      if(x>=W/2-140&&x<=W/2-96&&y>=by-16&&y<=by+28){
        const c=mobileLayoutCfg[touchEditorSelKey]; c.scale=Math.max(0.6,+(c.scale-0.1).toFixed(2)); mobileLayoutVersion++; return;
      }
      if(x>=W/2+96&&x<=W/2+140&&y>=by-16&&y<=by+28){
        const c=mobileLayoutCfg[touchEditorSelKey]; c.scale=Math.min(1.8,+(c.scale+0.1).toFixed(2)); mobileLayoutVersion++; return;
      }
      if(x>=W/2+160&&x<=W/2+270&&y>=by-16&&y<=by+28){
        mobileLayoutCfg[touchEditorSelKey]={dx:0,dy:0,scale:1}; mobileLayoutVersion++; return;
      }
    }
    buildVBtns();
    const order=["joystick","s2","s3","s4","shield","v4"];
    for(const k of order){
      const testBtn = (k==="joystick"&&touchMoveStyle==="dpad") ? {x:vBtns1.joystick.x,y:vBtns1.joystick.y,r:vBtns1.joystick.r*1.6} : vBtns1[k];
      if(_hitTestVBtn(x,y,testBtn)){
        touchEditorSelKey=k;
        touchEditorDrag={key:k, startX:x, startY:y, baseDx:mobileLayoutCfg[k].dx, baseDy:mobileLayoutCfg[k].dy};
        return;
      }
    }
    touchEditorSelKey=null; touchEditorDrag=null;
  }else if(phase==="move"){
    if(!touchEditorDrag) return;
    const c=mobileLayoutCfg[touchEditorDrag.key];
    c.dx = touchEditorDrag.baseDx + (x-touchEditorDrag.startX);
    c.dy = touchEditorDrag.baseDy + (y-touchEditorDrag.startY);
    mobileLayoutVersion++;
  }else if(phase==="up"){
    touchEditorDrag=null;
  }
}


// ================================================================
//  GEAR ICON DRAW
// ================================================================
function drawGearIcon(cx,cy,r){
  _oval(cx-r,cy-r,r*2,r*2,"gray30","white");
  _oval(cx-r/3,cy-r/3,r*2/3,r*2/3,"#111","white");
  for(let i=0;i<8;i++){const rad=i*45*Math.PI/180,x1=cx+(r-3)*Math.cos(rad),y1=cy+(r-3)*Math.sin(rad),x2=cx+(r+5)*Math.cos(rad),y2=cy+(r+5)*Math.sin(rad);_line(x1,y1,x2,y2,"white",4);}
}

// ================================================================
//  MAIN MENU — danh sách chế độ hiển thị giữa màn hình (gồm cả
//  Minigame + Hướng Dẫn, gộp chung với các chế độ chơi để dễ nhìn)
// ================================================================
const MAIN_MENU_MODES = [
  { name:"🤖 Đấu Với Máy",          col:"#34a853" },
  { name:"⚔️ Thử Thách",            col:"#9c27b0" },
  { name:"🛣️ Đường Đi (3 Ma Thú)", col:"#e67e22" },
  { name:"🎮 Minigame",             col:"#3a3a3a" },
  { name:"📖 Hướng Dẫn",            col:"#2c7be5" },
];

// ================================================================
//  MINIGAME SELECT — danh sách các minigame (dàn game chờ)
// ================================================================
const MINIGAME_LIST = [
  {name:"🕹️ Mini Game Tổng Hợp", desc:"8 game nhỏ: bắn mục tiêu, hứng vật phẩm, xếp khối, chạy vô tận, bóng bay, phản xạ màu, lướt sóng, câu cá", col:"#4b3f72", enabled:true, url:"https://khoidoan.site/minigame.html"},
];

function drawMinigameSelect(){
  _text(W/2,H/5,"🎮 DÀN MINIGAME 🎮","gold","28px Arial bold");
  _text(W/2,H/5+26,"Chọn 1 minigame để chơi — sẽ có thêm nhiều game khác ở đây","#999","11px Arial");
  MINIGAME_LIST.forEach((it,i)=>{
    const by1=H/2-150+i*80;
    ctx.save();
    if(!it.enabled) ctx.globalAlpha=0.5;
    _rect(W/2-130,by1,260,60,it.col,"white",2);
    _text(W/2,by1+20,it.name,"white","14px Arial bold");
    _text(W/2,by1+42,it.desc,"#ccc","9px Arial");
    ctx.restore();
  });
  _text(W/2,H-40,"ESC để về menu","#555","11px Arial");
}

function handleMinigameSelectClick(mx,my){
  MINIGAME_LIST.forEach((it,i)=>{
    const by1=H/2-150+i*80;
    if(W/2-130<=mx&&mx<=W/2+130&&by1<=my&&my<=by1+60){
      if(!it.enabled)return;
      if(it.url){ window.location.href=it.url; return; }
      if(it.state==="MINIGAME_DINO"){ dinoStarted=false; gameState="MINIGAME_DINO"; }
    }
  });
}

// ================================================================
//  MINIGAME: KHỦNG LONG (DINO) — đặt trong không gian tọa độ ảo
//  600x200, rồi co giãn/canh giữa vào canvas chính W x H
// ================================================================
const DINO_VW = 600, DINO_VH = 200;
const DINO_GROUND_Y = 160;
const DINO_GRAVITY = 0.6;
const DINO_JUMP_FORCE = -11;

let dinoScore = 0;
let dinoHighScore = 0;
let dinoSpeed = 6;
let dinoIsGameOver = false;
let dinoFrame = 0;
let dinoObstacles = [];
let dinoClouds = [];
let dinoStarted = false;

const dinoChar = {
  x:40, y:DINO_GROUND_Y-40, width:40, height:40, vy:0,
  isJumping:false, isDucking:false, legFrame:0
};

function dinoReset(){
  dinoScore=0; dinoSpeed=6; dinoObstacles=[]; dinoClouds=[];
  dinoChar.y=DINO_GROUND_Y-40; dinoChar.vy=0; dinoChar.isJumping=false; dinoChar.isDucking=false;
  dinoIsGameOver=false; dinoFrame=0; dinoStarted=true;
}
function dinoJump(){
  if(dinoIsGameOver)return;
  if(!dinoChar.isJumping){ dinoChar.vy=DINO_JUMP_FORCE; dinoChar.isJumping=true; }
}
function dinoDuck(state){
  if(dinoIsGameOver)return;
  dinoChar.isDucking = state && !dinoChar.isJumping;
}
function dinoSpawnObstacle(){
  const isBird = Math.random()<0.25 && dinoScore>150;
  if(isBird){
    const heights=[DINO_GROUND_Y-30,DINO_GROUND_Y-60,DINO_GROUND_Y-90];
    dinoObstacles.push({type:'bird',x:DINO_VW,y:heights[Math.floor(Math.random()*heights.length)],width:34,height:24,frame:0});
  }else{
    const wide=Math.random()<0.35;
    const h=30+Math.random()*20;
    dinoObstacles.push({type:'cactus',x:DINO_VW,y:DINO_GROUND_Y-h,width:wide?34:18,height:h});
  }
}
function dinoSpawnCloud(){
  dinoClouds.push({x:DINO_VW,y:20+Math.random()*50,width:46});
}
function dinoRectsCollide(a,b){
  const pad=6;
  return a.x+pad<b.x+b.width-pad && a.x+a.width-pad>b.x+pad && a.y+pad<b.y+b.height-pad && a.y+a.height-pad>b.y+pad;
}
function dinoDrawGround(){
  ctx.strokeStyle='#535353';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,DINO_GROUND_Y);ctx.lineTo(DINO_VW,DINO_GROUND_Y);ctx.stroke();
  ctx.fillStyle='#535353';
  for(let i=0;i<30;i++){
    const x=(i*40-(dinoFrame*dinoSpeed*0.5)%40+DINO_VW)%DINO_VW;
    ctx.fillRect(x,DINO_GROUND_Y+4,12,2);
  }
}
function dinoDrawChar(){
  ctx.fillStyle='#535353';
  const y=dinoChar.isDucking?DINO_GROUND_Y-20:dinoChar.y;
  const h=dinoChar.isDucking?20:dinoChar.height;
  const w=dinoChar.isDucking?55:dinoChar.width;
  ctx.fillRect(dinoChar.x,y,w,h);
  ctx.fillStyle='#f7f7f7';
  ctx.fillRect(dinoChar.x+w-12,y+6,4,4);
  ctx.fillStyle='#535353';
  if(!dinoChar.isJumping&&!dinoIsGameOver){ dinoChar.legFrame+=0.2; }
  if(!dinoChar.isDucking){
    const legOffset=Math.floor(dinoChar.legFrame)%2===0?0:6;
    ctx.fillRect(dinoChar.x+6,y+h,8,8-legOffset);
    ctx.fillRect(dinoChar.x+w-16,y+h,8,8+(legOffset?-legOffset:0));
  }
}
function dinoDrawObstacle(o){
  ctx.fillStyle='#535353';
  if(o.type==='cactus'){ ctx.fillRect(o.x,o.y,o.width,o.height); }
  else{
    o.frame+=0.15;
    const wingUp=Math.floor(o.frame)%2===0;
    ctx.fillRect(o.x,o.y+8,o.width,10);
    ctx.fillRect(o.x+8,wingUp?o.y:o.y+14,18,6);
  }
}
function dinoDrawCloud(c){
  ctx.fillStyle='#c8c8c8';
  ctx.fillRect(c.x,c.y,c.width,6);
  ctx.fillRect(c.x+8,c.y-4,c.width-16,6);
}
function dinoDrawScore(){
  ctx.fillStyle='#535353';
  ctx.font='16px Courier New';
  ctx.textAlign='right';ctx.textBaseline='alphabetic';
  const s=Math.floor(dinoScore).toString().padStart(5,'0');
  ctx.fillText(`HI ${Math.floor(dinoHighScore).toString().padStart(5,'0')}   ${s}`,DINO_VW-10,24);
}
function dinoUpdatePhysics(){
  dinoFrame++;
  dinoChar.vy+=DINO_GRAVITY; dinoChar.y+=dinoChar.vy;
  if(dinoChar.y>=DINO_GROUND_Y-dinoChar.height){
    dinoChar.y=DINO_GROUND_Y-dinoChar.height; dinoChar.vy=0; dinoChar.isJumping=false;
  }
  dinoScore+=0.15;
  if(dinoScore-dinoHighScore>0) dinoHighScore=dinoScore;
  dinoSpeed=6+dinoScore/200;
  if(dinoFrame%Math.max(50,Math.floor(90-dinoSpeed*3))===0) dinoSpawnObstacle();
  if(dinoFrame%150===0) dinoSpawnCloud();
  dinoObstacles.forEach(o=>o.x-=dinoSpeed);
  _compact(dinoObstacles,o=>o.x+o.width>0);
  dinoClouds.forEach(c=>c.x-=dinoSpeed*0.4);
  _compact(dinoClouds,c=>c.x+c.width>0);
  const dinoBox={
    x:dinoChar.x,
    y:dinoChar.isDucking?DINO_GROUND_Y-20:dinoChar.y,
    width:dinoChar.isDucking?55:dinoChar.width,
    height:dinoChar.isDucking?20:dinoChar.height
  };
  for(const o of dinoObstacles){ if(dinoRectsCollide(dinoBox,o)){ dinoIsGameOver=true; break; } }
}
function dinoGetTransform(){
  const availW=W*0.82, availH=H*0.5;
  const s=Math.min(availW/DINO_VW, availH/DINO_VH);
  const offX=W/2-(DINO_VW*s)/2;
  const offY=H*0.30;
  return {s,offX,offY};
}
const DINO_BACK_BTN={x:20,w:150,h:40};
function updateMinigameDino(){
  if(!dinoStarted) dinoReset();
  if(!dinoIsGameOver) dinoUpdatePhysics();

  const {s,offX,offY}=dinoGetTransform();
  ctx.save();
  ctx.fillStyle="#f7f7f7";
  ctx.fillRect(offX-14*s,offY-14*s,DINO_VW*s+28*s,DINO_VH*s+28*s);
  ctx.strokeStyle="#535353";ctx.lineWidth=2;
  ctx.strokeRect(offX-14*s,offY-14*s,DINO_VW*s+28*s,DINO_VH*s+28*s);
  ctx.translate(offX,offY);ctx.scale(s,s);
  dinoClouds.forEach(dinoDrawCloud);
  dinoDrawGround();
  dinoDrawChar();
  dinoObstacles.forEach(dinoDrawObstacle);
  dinoDrawScore();
  ctx.restore();

  _text(W/2,offY-38,"🦖 MINIGAME: KHỦNG LONG 🦖","#eee","20px Arial bold");
  _text(W/2,offY-14, platformMode==="MOBILE" ? "Chạm màn hình để nhảy" : "PHÍM CÁCH / ▲ để nhảy — ▼ để cúi","#999","11px Arial");

  if(dinoIsGameOver){
    ctx.save();
    ctx.fillStyle="rgba(0,0,0,0.4)";
    ctx.fillRect(offX-14*s,offY-14*s,DINO_VW*s+28*s,DINO_VH*s+28*s);
    ctx.restore();
    _text(W/2,offY+DINO_VH*s/2-20,"GAME OVER","white","28px Arial bold");
    _text(W/2,offY+DINO_VH*s/2+10,`Điểm: ${Math.floor(dinoScore)}   Cao nhất: ${Math.floor(dinoHighScore)}`,"white","13px Arial bold");
    _text(W/2,offY+DINO_VH*s/2+34, platformMode==="MOBILE"?"Chạm màn hình để chơi lại":"Nhấn CÁCH / Click để chơi lại","#ddd","12px Arial");
  }

  _rect(DINO_BACK_BTN.x,H-DINO_BACK_BTN.h-16,DINO_BACK_BTN.w,DINO_BACK_BTN.h,"#3a3a3a","white",2);
  _text(DINO_BACK_BTN.x+DINO_BACK_BTN.w/2,H-DINO_BACK_BTN.h-16+DINO_BACK_BTN.h/2,"← Danh sách","white","12px Arial bold");
}
function handleMinigameDinoClick(mx,my){
  const by=H-DINO_BACK_BTN.h-16;
  if(DINO_BACK_BTN.x<=mx&&mx<=DINO_BACK_BTN.x+DINO_BACK_BTN.w&&by<=my&&my<=by+DINO_BACK_BTN.h){
    gameState="MINIGAME_SELECT"; return;
  }
  if(dinoIsGameOver){ dinoReset(); return; }
  dinoJump();
}

// ================================================================
//  ESC BUTTON (mobile)
// ================================================================
function drawEscBtn() {
  if (platformMode !== "MOBILE") return;
  const escR = Math.floor(W*0.04);
  const escX = escR+20, escY = escR+20; // Top-left corner
  ctx.save();
  // Back button background
  ctx.beginPath(); ctx.arc(escX, escY, escR, 0, Math.PI*2);
  ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.8)"; ctx.lineWidth = 2.5; ctx.stroke();
  
  // Draw Back Arrow
  ctx.strokeStyle = "white";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  const arrowSize = escR * 0.5;
  ctx.moveTo(escX + arrowSize * 0.4, escY - arrowSize * 0.6);
  ctx.lineTo(escX - arrowSize * 0.4, escY);
  ctx.lineTo(escX + arrowSize * 0.4, escY + arrowSize * 0.6);
  ctx.stroke();
  ctx.restore();
}

// ================================================================
//  MENU DRAW
// ================================================================
function drawMenu(){
  // Night-sky gradient backdrop (replaces the flat black fill from the main loop)
  const bgGrad=ctx.createLinearGradient(0,0,0,H);
  bgGrad.addColorStop(0,"#05070f");bgGrad.addColorStop(0.55,"#0d1030");bgGrad.addColorStop(1,"#160a2a");
  ctx.fillStyle=bgGrad;ctx.fillRect(0,0,W,H);

  const rngS=(n)=>{let x=Math.sin(n)*10000;return x-Math.floor(x);};
  for(let i=0;i<70;i++){
    const sx=rngS(i*7)*W,sy=rngS(i*13)*H*0.85;
    const tw=0.4+0.6*Math.abs(Math.sin(frameCount*0.02+i*1.7));
    ctx.save();ctx.globalAlpha=tw;_oval(sx-1,sy-1,2,2,"white",null);ctx.restore();
  }

  // Title with a soft pulsing glow + gentle bob
  const bob=Math.sin(frameCount*0.03)*4;
  ctx.save();
  ctx.shadowColor="cyan";ctx.shadowBlur=18+Math.sin(frameCount*0.05)*8;
  _text(W/2,H/5+bob,"GAME KHÔI LÀM","cyan","34px Arial bold");
  ctx.restore();
  if(roadBestDistance>0)_text(W/2,H/5+50,`🏅 Kỷ lục Đường Đi phiên này: ${roadBestDistance}m`,"gold","12px Arial bold");
  drawGearIcon(W-40,40,16);
  if(showSettings){
    drawSettingsPanel();
  }else{
    const modes=MAIN_MENU_MODES;
    const startY=H/2-((modes.length-1)*60)/2;
    modes.forEach((m,i)=>{
      const by1=startY+i*60;
      const pulse=1+Math.sin(frameCount*0.06+i)*0.015;
      ctx.save();
      ctx.translate(W/2,by1+22);ctx.scale(pulse,pulse);ctx.translate(-W/2,-(by1+22));
      _rect(W/2-150,by1,300,45,m.col,"white",2);
      _text(W/2,by1+22,m.name,"white","12px Arial bold");
      ctx.restore();
    });
  }
  // Show current mode indicator
  _text(W-40, H-20, platformMode==="MOBILE"?"📱":"💻", "gray", "12px Arial");
}

// ================================================================
//  CHAR SELECT DRAW
// ================================================================
const CHARS=[
  {id:"shadow",name:"SHADOW (Tối)", desc:"Hố đen xúc tua & Thoát xác",color:"#551a8b"},
  {id:"thunder",name:"THUNDER (Lôi)",desc:"Chain Lightning, Thunder Prison & Thunder God Judgment",color:"gold"},
  {id:"frost", name:"FROST (Băng)", desc:"Tiễn băng & Hồi máu khiên",color:"deepskyblue"},
  {id:"earth", name:"TERRA (Thổ)",  desc:"Giáp đá sống & Tảng đá thần tốc",color:"sienna"},
  {id:"water", name:"WATER (Thủy)", desc:"Khiên xanh & Sóng thần",color:"dodgerblue"},
  {id:"wind",  name:"GIÓ (Phong)",  desc:"Hơi thổi & Lốc xoáy cực đại",color:"#90EE90"},
  {id:"fire",  name:"FIRE (Hỏa)",   desc:"Fire Bullet, Fire Pillar, Fire Dash & Flame Destroyer",color:FIRE_V1_COL},
];
// ---- Lưới (grid) vị trí thẻ nhân vật: xếp thành các hàng gọn (mặc định
// tối đa 3 thẻ/hàng) thay vì 1 hàng dài tràn màn hình. Dùng chung cho cả
// việc vẽ (drawCharSelect) và việc dò click (handleMenuClick) để 2 bên
// luôn khớp nhau. ----
const CHAR_CARD_W = 150, CHAR_CARD_H = 190, CHAR_GAP_X = 18, CHAR_GAP_Y = 20, CHAR_COLS = 3;
function getCharCardLayout(count){
  const cols = Math.min(CHAR_COLS, count);
  const rows = Math.ceil(count/cols);
  const totalH = rows*CHAR_CARD_H + (rows-1)*CHAR_GAP_Y;
  const startY = H/2 - totalH/2 + 10;
  const layout = [];
  for(let i=0;i<count;i++){
    const rowIdx = Math.floor(i/cols);
    const itemsInRow = Math.min(cols, count-rowIdx*cols);
    const rowW = itemsInRow*CHAR_CARD_W + (itemsInRow-1)*CHAR_GAP_X;
    const rowStartX = W/2 - rowW/2;
    const colIdx = i - rowIdx*cols;
    const cx = rowStartX + colIdx*(CHAR_CARD_W+CHAR_GAP_X);
    const cy = startY + rowIdx*(CHAR_CARD_H+CHAR_GAP_Y);
    layout.push({cx,cy,w:CHAR_CARD_W,h:CHAR_CARD_H});
  }
  return layout;
}
function drawCharSelect(title,borderColor){
  _text(W/2,60,title,"yellow","24px Arial bold");
  const layout = getCharCardLayout(CHARS.length);
  CHARS.forEach((ch,i)=>{
    const {cx,cy,w,h}=layout[i];
    const midX=cx+w/2;
    _rect(cx,cy,w,h,"#222",borderColor||"white",2);
    _rect(midX-22,cy+16,44,44,ch.color,"white",1);
    _text(midX,cy+78,ch.name,"white","11px Arial bold");
  });
}

// ================================================================
//  BOT LEVEL SELECT (gộp 3 độ khó Máy thành 1 màn chọn con)
// ================================================================
function drawBotSelect(){
  _text(W/2,H/4,"🤖 CHỌN ĐỘ KHÓ MÁY 🤖","gold","28px Arial bold");
  const levels=[{name:"Máy Cấp 1",desc:"Dễ — hợp cho người mới",col:"#34a853"},{name:"Máy Cấp 2",desc:"Vừa — thử thách hơn",col:"#fbbc05"},{name:"Máy Cấp 3",desc:"Khó — dành cho cao thủ",col:"#ea4335"}];
  levels.forEach((s,i)=>{const by1=H/2-80+i*80;_rect(W/2-100,by1,200,60,s.col,"white",2);_text(W/2,by1+18,s.name,"white","14px Arial bold");_text(W/2,by1+40,s.desc,"white","9px Arial");});
  _text(W/2,H-40,"ESC để về menu","#555","11px Arial");
}

// ================================================================
//  CHALLENGE SELECT
// ================================================================
function drawChallengeSelect(){
  _text(W/2,H/4,"⚔️ CHỌN MÀN THỬ THÁCH ⚔️","gold","28px Arial bold");
  const stages=[{name:"FROST KING",desc:"Quái yếu · Boss: ❄️ FROST KING",col:"deepskyblue"},{name:"EARTH TITAN",desc:"Quái yếu · Boss: 🪨 EARTH TITAN",col:"#8a6a4a"},{name:"FLAME LORD",desc:"Quái mạnh · Boss: 🔥 FLAME LORD",col:"orangered"},{name:"THE ABYSSAL",desc:"Quái elite · Boss: 🌑 THE ABYSSAL",col:"#a020f0"},{name:"THE TEMPEST",desc:"Quái elite · Boss: 🌪️ THE TEMPEST",col:"#7ec8e3"},{name:"THE TIDAL",desc:"Quái elite · Boss: 🌊 THE TIDAL",col:"#2ab8e8"},{name:"THE VOLTAGE",desc:"Boss cuối · Boss: ⚡ THE VOLTAGE",col:"#fff45c"}];
  stages.forEach((s,i)=>{const by1=H/2-140+i*65;_rect(W/2-100,by1,200,52,s.col,"white",2);_text(W/2,by1+16,s.name,"white","13px Arial bold");_text(W/2,by1+35,s.desc,"white","9px Arial");});
  _text(W/2,H-40,"ESC để về menu","#555","11px Arial");
}

// ================================================================
//  MENU CLICK HANDLER
// ================================================================
function handleMenuClick(mx, my) {
  if(gameState==="MENU"){
    // Gear icon
    if(W-60<=mx&&mx<=W-20&&20<=my&&my<=60){showSettings=!showSettings;return;}
    if(showSettings){handleSettingsClick(mx,my);return;}
    const modes=MAIN_MENU_MODES;
    const startY=H/2-((modes.length-1)*60)/2;
    for(let i=0;i<modes.length;i++){
      const by1=startY+i*60;
      if(W/2-150<=mx&&mx<=W/2+150&&by1<=my&&my<=by1+45){
        if(i===0){gameState="BOT_SELECT";return;}
        if(i===1){gameState="CHALLENGE_SELECT";return;}
        if(i===2){gameState="ROAD_CHAR_SELECT";return;}
        if(i===3){window.location.href="https://khoidoan.site/minigame.html";return;}
        if(i===4){window.open("https://khoidoan.site/huongdan.html","_blank");return;}
      }
    }
  }else if(gameState==="MINIGAME_SELECT"){
    handleMinigameSelectClick(mx,my);
  }else if(gameState==="MINIGAME_DINO"){
    handleMinigameDinoClick(mx,my);
  }else if(gameState==="BOT_SELECT"){
    for(let i=0;i<3;i++){const by1=H/2-80+i*80;if(W/2-100<=mx&&mx<=W/2+100&&by1<=my&&my<=by1+60){gameMode="PVE";botLevel=i+1;selectingPlayer=1;gameState="CHAR_SELECT";return;}}
  }else if(gameState==="ROAD_CHAR_SELECT"){
    const _layout=getCharCardLayout(CHARS.length);
    CHARS.forEach((ch,i)=>{const {cx,cy,w,h}=_layout[i];if(cx<=mx&&mx<=cx+w&&cy<=my&&my<=cy+h){selectedP1=ch.id;startRoadMode();}});
  }else if(gameState==="CHALLENGE_SELECT"){
    for(let i=0;i<7;i++){const by1=H/2-140+i*65;if(W/2-100<=mx&&mx<=W/2+100&&by1<=my&&my<=by1+52){challengeStage=i+1;gameState="CHALLENGE_CHAR_SELECT";return;}}
  }else if(gameState==="CHALLENGE_CHAR_SELECT"){
    const _layout=getCharCardLayout(CHARS.length);
    CHARS.forEach((ch,i)=>{const {cx,cy,w,h}=_layout[i];if(cx<=mx&&mx<=cx+w&&cy<=my&&my<=cy+h){selectedP1=ch.id;startChallengeMode(challengeStage);}});
  }else if(gameState==="CHAR_SELECT"){
    const _layout=getCharCardLayout(CHARS.length);
    CHARS.forEach((ch,i)=>{
      const {cx,cy,w,h}=_layout[i];
      if(cx<=mx&&mx<=cx+w&&cy<=my&&my<=cy+h){
        if(selectingPlayer===1){selectedP1=ch.id;if(gameMode==="PVP"){selectingPlayer=2;}else{const avail=CHARS.filter(c=>c.id!==ch.id);selectedP2=rndChoice(avail).id;startMatch();}}
        else{selectedP2=ch.id;startMatch();}
      }
    });
  }else if(gameState==="KEY_EDITOR"){
    handleKeyEditorClick(mx,my);
  }
}

// ================================================================
//  MAIN UPDATE LOOP
// ================================================================
function drawMinecraftBossBar(hp, maxHp, label, color) {
  const barWidth = W * 0.7;
  const barHeight = 24;
  const x = (W - barWidth) / 2;
  const y = 45;

  // Shadow/Border
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(x - 4, y - 4, barWidth + 8, barHeight + 8);

  // Background
  ctx.fillStyle = "#222";
  ctx.fillRect(x, y, barWidth, barHeight);

  // HP Bar
  const pct = Math.max(0, hp / maxHp);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, barWidth * pct, barHeight);

  // Minecraft-style segments
  ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  ctx.lineWidth = 2;
  for (let i = 1; i < 10; i++) {
    const lx = x + (barWidth * i) / 10;
    ctx.beginPath();
    ctx.moveTo(lx, y);
    ctx.lineTo(lx, y + barHeight);
    ctx.stroke();
  }

  // Text
  _text(W / 2, y - 18, label.toUpperCase(), "white", "18px Arial bold");
  _text(W / 2, y + barHeight / 2, `${Math.floor(hp)} / ${maxHp}`, "white", "12px Arial bold");
}

function drawActiveBossBars() {
  if (gameState === "CHALLENGE") {
    challengeBosses.forEach(b => {
      if (!b.dead && b.hp > 0 && !b._introHideHp) {
        drawMinecraftBossBar(b.hp, b.maxHp, b._hpLabel || "BOSS", b._hpColor || "#ff0044");
      }
    });
  } else if (gameState === "ROAD") {
    if (roadBoss && !roadBoss.dead && roadBoss.hp > 0) {
      drawMinecraftBossBar(roadBoss.hp, roadBoss.maxHp, roadBoss._hpLabel || "BOSS", roadBoss._hpColor || "#ff0044");
    }
  }
}

function update(){
  try{
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = (gameState==="GAMEPLAY"||gameState==="CHALLENGE"||gameState==="ROAD"||gameState==="PORTAL_INTRO") ? "#87CEFA" : "black";
  ctx.fillRect(0,0,W,H);
  let dx=0,dy=0;
  if(screenShake>0){dx=rndInt(-screenShake,screenShake);dy=rndInt(-screenShake,screenShake);screenShake*=0.96;if(screenShake<0.8)screenShake=0;}
  frameCount++;
  if(comboTimer>0){comboTimer--;if(comboTimer===0)comboCount=0;}
  if(_hitSfxCooldown>0)_hitSfxCooldown--;
  updateBurnEffects();
  const floorY=H*FLOOR_Y_RATIO;
  ctx.save();ctx.translate(dx,dy);
  if(gameState==="MENU")drawMenu();
  else if(gameState==="MINIGAME_SELECT")drawMinigameSelect();
  else if(gameState==="MINIGAME_DINO")updateMinigameDino();
  else if(gameState==="BOT_SELECT")drawBotSelect();
  else if(gameState==="CHALLENGE_SELECT")drawChallengeSelect();
  else if(gameState==="CHAR_SELECT")drawCharSelect("CHỌN PHÙ THỦY CHIẾN ĐẤU","white");
  else if(gameState==="CHALLENGE_CHAR_SELECT")drawCharSelect(`⚔️ MÀN ${challengeStage} — CHỌN NHÂN VẬT ⚔️`,"gold");
  else if(gameState==="ROAD_CHAR_SELECT")drawCharSelect("🛣️ ĐƯỜNG ĐI — CHỌN NHÂN VẬT 🛣️","#e67e22");
  else if(gameState==="GAMEPLAY")updateGameplay(floorY);
  else if(gameState==="CHALLENGE")updateChallenge(W,H);
  else if(gameState==="ROAD")updateRoad();
  else if(gameState==="PORTAL_INTRO")updateCharacterEntrance();
  else if(gameState==="TOUCH_EDITOR")drawTouchEditor();
  else if(gameState==="KEY_EDITOR")drawKeyEditor();
  ctx.restore();
  // Mobile overlays (outside shake transform)
  if(platformMode==="MOBILE"){
    if(["GAMEPLAY","CHALLENGE","ROAD"].includes(gameState))drawMobileControls();
    drawEscBtn();
  }
  processTouchSkills();
  }catch(err){console.error("Game loop error:",err);}
  requestAnimationFrame(update);
}

// ================================================================
//  GAMEPLAY UPDATE
// ================================================================
function updateGameplay(floorY){
  const worldW=W*MAP_SCALE;
  if(frameCount%60===0){for(const p of[p1,p2]){if(p.charType==="red"&&p.hp>0)p.hp=Math.min(p.maxHp||MAX_HP,p.hp+1);}}
  for(const p of[p1,p2]){if(p.ultiTimer>0&&p.activeSkill==="water_s4"){p.tsunamiWaveXL-=8;p.tsunamiWaveXR+=8;}}
  for(const p of[p1,p2]){
    if(p.slowTimer>0)p.slowTimer--;if(p.stunTimer>0)p.stunTimer--;
    if(p.thunderFTimer>0){p.thunderFTimer--;if(p.thunderFTimer===0)p.thunderFCount=0;}
    for(const s in p.cds)if(p.cds[s]>0)p.cds[s]--;
    tickV4(p);
    tickThunderDash(p);
    tickWaterCloud(p);
    tickFrost(p);
    tickWind(p);
    tickEarthMud(p);
    tickEarthMeteor(p);
    tickThunderS3(p);
    tickEarthMinions(p,worldW);
    updateFire(p);
    updateShadow(p);
  }
  for(const[attacker,pvpTarget]of[[p1,p2],[p2,p1]]){
    if(attacker.ultiTimer>0){
      attacker.ultiTimer--;
      const d=dist(attacker.x,attacker.y,pvpTarget.x,pvpTarget.y);
      if(attacker.activeSkill==="thunder_s4")thunderJudgmentTick(attacker);
      else if(attacker.activeSkill==="frost_s4"&&d<450*SR){applyDamage(pvpTarget,0.18,attacker);pvpTarget.slowTimer=Math.max(pvpTarget.slowTimer,10);}
      else if(attacker.activeSkill==="wind_s4"&&d<600*SR){
        applyDamage(pvpTarget,0.20,attacker);
        attacker.windStormTick++;
        if(attacker.windStormTick%25===0&&isPushable(pvpTarget)){if(pvpTarget instanceof Fighter)pvpTarget.vy=-10;}
      }
      if(attacker.ultiTimer===0){if(attacker.charType==="wind"&&attacker.activeSkill==="wind_s4")spawnWindSideCyclones(attacker);attacker.isAttacking=false;attacker.activeSkill=null;if(attacker.charType==="earth")attacker.earthPillars=[];}
    }

  }
  for(const p of[p1,p2]){if(p.charType==="wind"&&p.windBoostTimer>0)p.windBoostTimer--;}
  const msb=4.3125;
  if(p1.hp>0&&p2.hp>0){
    const p1CanMove=(p1.ultiTimer===0||p1.activeSkill==="water_s4")&&p1.stunTimer===0&&p1.transformWindupTimer===0&&p1.transformLandingTimer===0;
    if(p1CanMove){
      let spd=msb*(p1.isShielding?0.35:1);
      spd*=p1.speedMult||1;
      if(p1.charType==="wind"&&p1.windBoostTimer>0)spd*=1.25;
      if(p1.slowTimer>0)spd*=(1-p1._slowPct);
      if(p1.charType==="earth"&&p1.earthMudActive)spd*=p1.earthMudSpeed;
      if(p1.transformActive)spd*=p1.getTransformBuffs().speed||1;
      if(p1._soulActive)spd*=1.3;
      const goLeft  = keys.has(keyBindings.left)      || (platformMode==="MOBILE"&&touch1.left);
      const goRight = keys.has(keyBindings.right)      || (platformMode==="MOBILE"&&touch1.right);
      const goUp    = keys.has(keyBindings.up)      || (platformMode==="MOBILE"&&touch1.up);
      const goDown  = keys.has(keyBindings.down)      || (platformMode==="MOBILE"&&touch1.down);
      if(goLeft)p1.x-=spd;if(goRight)p1.x+=spd;
      if(p1.charType==="frost"&&p1.transformActive&&p1.isFlying&&goDown)p1.vy=8;
      if(goUp&&!p1._upPrevInput)p1.jump();
      p1._upPrevInput=goUp;
    }
    p1.applyGravity(floorY);
    // PVP mode has been removed — the second fighter is always bot-controlled
    if(p2.ultiTimer===0)updateBot();
    p2.applyGravity(floorY);
  }
  for(const p of[p1,p2]){p.x=clamp(p.x,40,worldW-40);if(p.attackCooldown>0){p.attackCooldown--;if(p.attackCooldown===0&&p.ultiTimer===0){p.isAttacking=false;p.activeSkill=null;}}}

  // Camera follows p1 across the expanded (2.5x) arena — except while a
  // Shadow V4 wind-up is punching the camera in on the caster (see
  // shadowCamZoomState() above).
  const _scz=shadowCamZoomState(p1);
  const CAM_L=W*0.35, CAM_R=W*0.55;
  if(_scz.active){
    const targetCam=clamp(p1.x-W*0.5,0,Math.max(0,worldW-W));
    campX+=(targetCam-campX)*0.16;
  }else{
    if(p1.x-campX>CAM_R) campX=p1.x-CAM_R;
    else if(p1.x-campX<CAM_L) campX=p1.x-CAM_L;
  }
  campX=clamp(campX,0,Math.max(0,worldW-W));

  ctx.save();ctx.translate(-campX,0);
  if(_scz.zoom!==1.0){
    const pivotX=p1.x,pivotY=floorY-80;
    ctx.translate(pivotX,pivotY);ctx.scale(_scz.zoom,_scz.zoom);ctx.translate(-pivotX,-pivotY);
  }
  drawFloor(floorY,false,campX);
  updateProjectiles(floorY,p2);
  _compact(puppets,pu=>pu.hp>0&&pu.life>0);
  puppets.forEach(pu=>pu.update(floorY,worldW));
  puppets.forEach(pu=>pu.draw());
  drawEarthMinions(p1);drawEarthMinions(p2);
  drawFrostSlideTrail(p1);drawFrostDomain(p1);if(p1._icePrisonedTargets)p1._icePrisonedTargets.forEach(drawFrostIcePrison);drawThunderDashTrail(p1);drawWindDashTrail(p1);drawWindCyclone(p1);drawWindSideCyclones(p1);drawEarthMud(p1);drawFire(p1);drawShadow(p1);
  drawFrostSlideTrail(p2);drawFrostDomain(p2);if(p2._icePrisonedTargets)p2._icePrisonedTargets.forEach(drawFrostIcePrison);drawThunderDashTrail(p2);drawWindDashTrail(p2);drawWindCyclone(p2);drawWindSideCyclones(p2);drawEarthMud(p2);drawFire(p2);drawShadow(p2);
  p1.draw();p2.draw();
  updateAndDrawHitEffects();
  updateAndDrawLightningArcs();
  updateAndDrawDmgNumbers();
  ctx.restore();

  drawHpBar(p1,50,40,"P1");
  drawHpBar(p2,W-250,40,"BOT");
  drawRageBar(50,63,200,14,p1);
  drawRageBar(W-250,63,200,14,p2);
  if(platformMode==="PC")drawCooldownUI();
  drawComboCounter();
  drawLowHpVignette();
  drawActiveBossBars();
  if((p1.hp<=0||p2.hp<=0)&&!_gameplayEndSfxDone){
    _gameplayEndSfxDone=true;
    if(p1.hp<=0)sfxDefeat();else sfxVictory();
  }
  if(p1.hp<=0||p2.hp<=0){
    const winner=p1.hp<=0?p2.charType.toUpperCase():p1.charType.toUpperCase();
    _text(W/2,H/2,`${winner} WINS!`,"gold","46px Arial bold");
    _text(W/2,H/2+50,`Combo cao nhất: ${comboMaxThisRun}`,"#ffdd55","13px Arial bold");
    _text(W/2,H/2+80,platformMode==="MOBILE"?"Chạm nút Quay lại về menu | Chạm để chơi lại":"ESC về menu | R chơi lại","white","14px Arial");
  }
}
let _gameplayEndSfxDone=false;

// ================================================================
//  CHALLENGE UPDATE
// ================================================================
let _challengeWaveTimer=0;
function updateChallenge(w,h){
  const worldW=w*MAP_SCALE;
  const floorY=h*FLOOR_Y_RATIO;
  if(p1.slowTimer>0)p1.slowTimer--;if(p1.stunTimer>0)p1.stunTimer--;
  if(p1.thunderFTimer>0){p1.thunderFTimer--;if(p1.thunderFTimer===0)p1.thunderFCount=0;}
  for(const s in p1.cds)if(p1.cds[s]>0)p1.cds[s]--;
  tickV4(p1);
  tickThunderDash(p1);
  tickWaterCloud(p1);
  tickFrost(p1);
  tickWind(p1);
  tickEarthMud(p1);
  tickEarthMeteor(p1);
  tickEarthMinions(p1,worldW);
  updateFire(p1);
  updateShadow(p1);
  if(frameCount%60===0&&p1.charType==="red"&&p1.hp>0)p1.hp=Math.min(p1.maxHp||MAX_HP,p1.hp+1);
  if(p1.ultiTimer>0&&p1.activeSkill==="water_s4"){p1.tsunamiWaveXL-=8;p1.tsunamiWaveXR+=8;}
  if(challengeBossIntroState!=="INTRO_RUNNING"&&p1.stunTimer<=0&&p1.hp>0&&p1.transformWindupTimer===0&&p1.transformLandingTimer===0){
    let spd=4.3125;
    spd*=p1.speedMult||1;
    if(p1.charType==="wind"&&p1.windBoostTimer>0){spd*=1.25;p1.windBoostTimer--;}
    if(p1.slowTimer>0)spd*=(1-p1._slowPct);
    if(p1.charType==="earth"&&p1.earthMudActive)spd*=p1.earthMudSpeed;
    if(p1.transformActive)spd*=p1.getTransformBuffs().speed||1;
    if(p1._soulActive)spd*=1.3;
    const canMoveH=p1.ultiTimer===0||p1.activeSkill==="water_s4";
    const goLeft  = keys.has(keyBindings.left)   || (platformMode==="MOBILE"&&touch1.left);
    const goRight = keys.has(keyBindings.right)   || (platformMode==="MOBILE"&&touch1.right);
    const goUp    = keys.has(keyBindings.up)   || (platformMode==="MOBILE"&&touch1.up);
    const goDown  = keys.has(keyBindings.down)   || (platformMode==="MOBILE"&&touch1.down);
    if(canMoveH){if(goLeft)p1.x-=spd;if(goRight)p1.x+=spd;}
    if(p1.charType==="frost"&&p1.transformActive&&p1.isFlying){if(goUp)p1.vy=-10;if(goDown)p1.vy=8;}
    else{if(goUp&&!p1._upPrevInput)p1.jump();}
    p1._upPrevInput=goUp;
  }
  p1.applyGravity(floorY);
  p1.x=clamp(p1.x,40,worldW-40);
  if(p1.attackCooldown>0){p1.attackCooldown--;if(p1.attackCooldown===0&&p1.ultiTimer===0){p1.isAttacking=false;p1.activeSkill=null;}}
  if(p1.ultiTimer>0){
    p1.ultiTimer--;
    const all=[...challengeEnemies,...challengeBosses.filter(b=>!b.dead&&b.hp>0)];
    all.forEach(tgt=>{
      const d=dist(p1.x,p1.y,tgt.x,tgt.y);
      if(p1.activeSkill==="thunder_s4")thunderJudgmentTick(p1);
      else if(p1.activeSkill==="frost_s4"&&d<450*SR){applyDamage(tgt,0.18,p1);if(tgt instanceof Fighter)tgt.slowTimer=Math.max(tgt.slowTimer,10);}
      else if(p1.activeSkill==="water_s4"&&p1.tsunamiWaveXL<tgt.x&&tgt.x<p1.tsunamiWaveXR){applyDamage(tgt,0.35,p1);tgt.slowTimer=Math.max(tgt.slowTimer||0,20);tgt._slowPct=0.5;}
      else if(p1.activeSkill==="wind_s4"&&d<600*SR){
        applyDamage(tgt,0.20,p1);
        p1.windStormTick++;
        if(p1.windStormTick%25===0&&isPushable(tgt)){if(tgt instanceof Fighter)tgt.vy=-10;}
      }
    });
    if(p1.ultiTimer===0){if(p1.charType==="wind"&&p1.activeSkill==="wind_s4")spawnWindSideCyclones(p1);p1.isAttacking=false;p1.activeSkill=null;if(p1.charType==="earth")p1.earthPillars=[];}
  }

  _compact(challengeEnemies,e=>{if(e.hp>0&&p1.hp>0)e.update(shadowSoulTarget(p1),floorY,worldW);return e.hp>0;});
  if(challengeEnemies.length===0&&challengeState==="WAVE"){
    if(challengeWaveIdx<challengeWaveSched.length){_challengeWaveTimer++;if(_challengeWaveTimer>=120){_challengeWaveTimer=0;_spawnChallengeWave(floorY,worldW);}}
    else if(!challengeBossSpawned){
      challengeBossSpawned=true;_challengeWaveTimer=0;
      const bossX=clamp(p1.x+500,150,worldW-150);
      if(challengeStage===1){
        // Boss 1 (Frost King) gets the full cinematic intro.
        bossIntroManager=new BossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===2){
        // Boss 2 (Earth Titan) — replaces the old Smoke Boss, also gets a full cinematic intro.
        // Uses the exact same generic hookup as Boss 1 above (bossIntroManager,
        // challengeBossIntroState, INTRO_RUNNING/INTRO_DONE) — only the manager
        // class differs. Any future cinematic boss follows this same recipe.
        bossIntroManager=new EarthBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===3){
        // Boss 3 (Flame Lord) — also gets a full cinematic intro. Uses the
        // exact same generic hookup as Boss 1/2 above — only the manager
        // class differs. Any future cinematic boss follows this same recipe.
        bossIntroManager=new FlameBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===4){
        // Boss 4 (The Abyssal) — also gets a full cinematic intro. Uses the
        // exact same generic hookup as Boss 1/2/3 above — only the manager
        // class differs. Any future cinematic boss follows this same recipe.
        bossIntroManager=new AbyssalBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===5){
        // Boss 5 (The Tempest) — also gets a full cinematic intro. Uses the
        // exact same generic hookup as Boss 1/2/3/4 above — only the
        // manager class differs. Any future cinematic boss follows this
        // same recipe.
        bossIntroManager=new TempestBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===6){
        // Boss 6 (The Tidal) — also gets a full cinematic intro. Uses the
        // exact same generic hookup as Boss 1/2/3/4/5 above — only the
        // manager class differs. Any future cinematic boss follows this
        // same recipe.
        bossIntroManager=new TidalBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else if(challengeStage===7){
        // Boss 7 (The Voltage) — FINAL BOSS. Also gets a full cinematic
        // intro. Uses the exact same generic hookup as Boss 1-6 above —
        // only the manager class differs.
        bossIntroManager=new VoltageBossIntroManager(bossX,floorY);
        bossIntroManager.start();
        challengeBossIntroState="INTRO_RUNNING";
        challengeState="BOSS";
      }else{
        challengeBosses.push(new Boss(challengeStage,bossX,floorY));
        challengeState="BOSS";
      }
    }
  }else _challengeWaveTimer=0;
  // Boss intro cinematic
  if(challengeBossIntroState==="INTRO_RUNNING"&&bossIntroManager){
    const introResult=bossIntroManager.update();
    if(introResult.finished){
      challengeBossIntroState="INTRO_DONE";
      if(bossIntroManager.boss){
        // Reuse the exact Boss instance that emerged from the mist during
        // the cinematic (preserves its frost trail/aura state) rather than
        // constructing a fresh one.
        challengeBosses.push(bossIntroManager.boss);
      }
      bossIntroManager=null;
    }
  }
  
  challengeBosses.forEach(b=>{if(!b.dead&&b.hp>0&&p1.hp>0){b.update(shadowSoulTarget(p1),floorY,worldW);if(b.summonEnemies.length){challengeEnemies.push(...b.summonEnemies);b.summonEnemies=[];}}});
  if(p1.hp<=0&&challengeState!=="DONE"){challengeResult="LOSE";challengeState="DONE";}
  const allDead=challengeBosses.length>0&&challengeBosses.every(b=>b.dead);
  if(allDead&&challengeBossSpawned&&challengeEnemies.length===0&&challengeState!=="DONE"){challengeResult="WIN";challengeState="DONE";}

  // Camera follows p1 across the expanded (2.5x) arena — except during the
  // boss cinematic (pans toward the unfolding scene) or a Shadow V4
  // wind-up (punches in on the caster — see shadowCamZoomState() above).
  const _scz=shadowCamZoomState(p1);
  if(challengeBossIntroState==="INTRO_RUNNING"&&bossIntroManager){
    const targetCam=clamp(bossIntroManager.focusX-w*0.45,0,Math.max(0,worldW-w));
    campX+=(targetCam-campX)*0.045;
  }else if(_scz.active){
    const targetCam=clamp(p1.x-w*0.5,0,Math.max(0,worldW-w));
    campX+=(targetCam-campX)*0.16;
    campX=clamp(campX,0,Math.max(0,worldW-w));
  }else{
    const CAM_L=w*0.35, CAM_R=w*0.55;
    if(p1.x-campX>CAM_R) campX=p1.x-CAM_R;
    else if(p1.x-campX<CAM_L) campX=p1.x-CAM_L;
    campX=clamp(campX,0,Math.max(0,worldW-w));
  }

  const introActive=challengeBossIntroState==="INTRO_RUNNING"&&bossIntroManager;
  const camZoom=introActive?bossIntroManager.zoom:_scz.zoom;

  ctx.save();ctx.translate(-campX,0);
  if(camZoom!==1.0){
    // Real camera zoom: actually scales everything drawn in this block
    // (floor, characters, effects) around the cinematic focus point.
    const pivotX=introActive?bossIntroManager.focusX:(_scz.active?p1.x:campX+w/2), pivotY=floorY-80;
    ctx.translate(pivotX,pivotY);ctx.scale(camZoom,camZoom);ctx.translate(-pivotX,-pivotY);
  }
  drawFloor(floorY,false,campX);
  updateProjectiles(floorY,null);
  _compact(puppets,pu=>pu.hp>0&&pu.life>0);
  puppets.forEach(pu=>pu.update(floorY,worldW));
  puppets.forEach(pu=>pu.draw());
  drawEarthMinions(p1);
  drawFrostSlideTrail(p1);drawFrostDomain(p1);if(p1._icePrisonedTargets)p1._icePrisonedTargets.forEach(drawFrostIcePrison);drawThunderDashTrail(p1);drawWindDashTrail(p1);drawWindCyclone(p1);drawWindSideCyclones(p1);drawEarthMud(p1);drawFire(p1);drawShadow(p1);
  p1.draw();
  challengeEnemies.forEach(e=>e.draw());
  challengeBosses.forEach(b=>{if(!b.dead)b.draw();});
  if(introActive){
    bossIntroManager.drawWorld(ctx,w,h);
  }
  updateAndDrawHitEffects();
  updateAndDrawLightningArcs();
  updateAndDrawDmgNumbers();
  ctx.restore();

  // Screen-space cinematic overlays (flash + title card) — drawn AFTER the
  // camera transform is restored so they stay fixed to the screen.
  if(introActive){
    bossIntroManager.drawScreen(ctx,w,h);
  }

  _text(w/2,15,`⚔️ THỬ THÁCH - MÀN ${challengeStage} ⚔️`,"gold","16px Arial bold");
  const bw2=(p1.hp/(p1.maxHp||MAX_HP))*200;
  _rect(50,40,200,20,"#333",null,0);_rect(50,40,Math.max(0,bw2),20,"#ff1a1a",null,0);
  _text(150,30,`P1 (${p1.charType.toUpperCase()}): ${getHPDisplay(p1.hp)}/${p1.maxHp||MAX_HP} HP`,"white","10px Arial bold");
  _text(w/2,85,`Quái còn lại: ${challengeEnemies.length} | Boss: ${challengeBossSpawned?"Đã xuất hiện":"Chưa ra"}`,"white","10px Arial");
  drawRageBar(50,63,200,14,p1);
  if(platformMode==="PC")drawCooldownChallenge();
  drawComboCounter();
  drawLowHpVignette();
  drawActiveBossBars();
  if(challengeState==="DONE"){
    if(!_challengeEndSfxDone){_challengeEndSfxDone=true;if(challengeResult==="WIN")sfxVictory();else sfxDefeat();}
    if(challengeResult==="WIN"){
      _text(w/2,H/2,`✨ CHIẾN THẮNG MÀN ${challengeStage}! ✨`,"gold","36px Arial bold");
      _text(w/2,H/2+45,`Combo cao nhất: ${comboMaxThisRun}`,"#ffdd55","12px Arial bold");
      if(challengeStage===7)_text(w/2,H/2+95,"⚡ BẠN ĐÃ ĐÁNH BẠI THE VOLTAGE — HOÀN THÀNH THỬ THÁCH! ⚡","#fff45c","13px Arial bold");
      if(challengeStage<7)_text(w/2,H/2+75,"Nhấn SPACE để tiếp tục | ESC về menu","white","14px Arial");
      else{_text(w/2,H/2+75,"🎉 HOÀN THÀNH TẤT CẢ 6 MÀN! 🎉","cyan","18px Arial bold");_text(w/2,H/2+110,"Nhấn ESC để về menu","white","12px Arial");}
    }else{
      _text(w/2,H/2,"💀 THẤT BẠI 💀","red","40px Arial bold");
      _text(w/2,H/2+45,`Combo cao nhất: ${comboMaxThisRun}`,"#ffdd55","12px Arial bold");
      _text(w/2,H/2+75,"Nhấn R để thử lại | ESC về menu","white","14px Arial");
    }
  }
}
let _challengeEndSfxDone=false;

// ================================================================
//  INPUT HANDLERS
// ================================================================
function onKeyPress(e){
  const k=e.key.toLowerCase();
  if(k==="escape"){gameState="MENU";showSettings=false;}
  if(k==="r"){
    if(gameState==="GAMEPLAY"&&(p1.hp<=0||p2.hp<=0))startMatch();
    if(gameState==="CHALLENGE"&&challengeState==="DONE"&&challengeResult==="LOSE")startChallengeMode(challengeStage);
    if(gameState==="ROAD"&&(roadState==="LOST"||roadState==="WON"))startRoadMode();
  }
  if(k===" "){if(gameState==="CHALLENGE"&&challengeState==="DONE"&&challengeResult==="WIN"&&challengeStage<7){challengeStage++;gameState="CHALLENGE_CHAR_SELECT";}}
  if(gameState==="MINIGAME_DINO"){
    if(k===" "||k==="arrowup"){ if(dinoIsGameOver) dinoReset(); else dinoJump(); }
    if(k==="arrowdown"){ dinoDuck(true); }
  }
  // Skill 1 ("Chiêu 1") is no longer bound to its own rebindable key — it
  // now fires as the basic attack on SPACE (also on mouse click / mobile tap).
  if(k===" "&&(gameState==="GAMEPLAY"||(gameState==="CHALLENGE"&&challengeState!=="DONE")||gameState==="ROAD")){
    castSkill(p1,p2,1);
  }
  if(k===keyBindings.shield&&gameState==="GAMEPLAY")p1.isShielding=true;
  if(k==="2"&&gameMode==="PVP"&&gameState==="GAMEPLAY")p2.isShielding=true;
  if(k===keyBindings.s2)castSkill(p1,p2,2);
  if(k===keyBindings.s3)castSkill(p1,p2,3);
  if(k===keyBindings.s4)castSkill(p1,p2,4);
  if(k===keyBindings.v4)castSkill(p1,p2,5);
  if(gameMode==="PVP"&&gameState==="GAMEPLAY"){
    if(k==="1")castSkill(p2,p1,1);
    if(k==="4")castSkill(p2,p1,2);
    if(k==="3")castSkill(p2,p1,3);
    if(k==="5")castSkill(p2,p1,4);
    if(k==="6")castSkill(p2,p1,5);
  }
  // Menu navigation
  if(!["GAMEPLAY","CHALLENGE","ROAD"].includes(gameState))return;
  e.preventDefault();
}

// ================================================================
//  GAME START HELPERS
// ================================================================
// ================================================================
//  CHARACTER PORTAL ENTRANCE SYSTEM
//  Chạy TRƯỚC khi trận đấu bắt đầu (state riêng "PORTAL_INTRO"), hoàn
//  toàn tách biệt khỏi combat/AI/damage/timer hiện có. Không đụng tới
//  gameplay, không spawn enemy/boss — chỉ chạy animation cổng + nhân vật
//  bước ra, rồi mới chuyển sang state trận đấu thật (GAMEPLAY/CHALLENGE/
//  ROAD) để hệ thống spawn/AI cũ tiếp quản y như trước.
// ================================================================
const PORTAL_CONFIG = {
  earth:   { color:"#c68a4a", glow:"#f0d9a6", particle:"#a9744a" }, // nâu / vàng đất
  fire:    { color:"#ff6a1a", glow:"#ffcf40", particle:"#ff8c33" }, // đỏ cam / vàng
  water:   { color:"#2fa8ff", glow:"#bfe9ff", particle:"#66c8ff" }, // xanh dương
  wind:    { color:"#8be08b", glow:"#e3fff0", particle:"#aef0ae" }, // xanh lá nhạt / cyan
  thunder: { color:"#ffe14d", glow:"#fff6b0", particle:"#fff08a" }, // vàng điện
  frost:   { color:"#7fe0ff", glow:"#eafcff", particle:"#bff3ff" }, // xanh băng / cyan sáng
  shadow:  { color:"#7a1acc", glow:"#2a0a3d", particle:"#b866ff" }, // tím đậm / tím đen
  red:     { color:"#ff5533", glow:"#ffb066", particle:"#ff7744" }  // (Hỏa Ma Thần) dùng chung tông fire
};

// Mốc thời gian theo frame (@60fps) — tổng ~3.0s, nằm trong khoảng 2–3s yêu cầu.
const PI_OPEN_END  = 30;   // 0.0–0.5s: cổng mở
const PI_WALK_END  = 108;  // 0.5–1.8s: nhân vật bước ra
const PI_READY_END = 132;  // 1.8–2.2s: đứng yên ở vị trí chiến đấu
const PI_CLOSE_END = 156;  // 2.2–2.6s: cổng đóng
const PI_FLASH_END = 180;  // 2.6–3.0s: hiệu ứng READY ngắn → BATTLE START

function _piEase(t){ t=clamp(t,0,1); return t<0.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }

// Bán kính vòng cổng (dùng cả khi vẽ lẫn khi tính bước-ra, để 2 nơi không lệch nhau).
const PORTAL_RING_R = 56;

// Tâm cổng theo trục Y, tính từ chân nhân vật (entranceY = fighter.y = mặt đất):
// Trong Fighter._drawInner(), thân vẽ tại ry=this.y-52 cao 52px (chân ở this.y),
// đầu vẽ tại ry-60..ry-20 → mép trên của đầu ở this.y-112 (chưa scale).
// Fighter.draw() scale toàn bộ hình theo CHAR_VISUAL_SCALE quanh đúng điểm chân
// (this.x,this.y), nên trên màn hình mép đầu hiển thị ở khoảng:
//   this.y - 112*CHAR_VISUAL_SCALE ≈ this.y - 75.
// Đặt tâm cổng ở this.y-70 để vòng cổng bán kính 56 bao trọn nhân vật từ chân
// tới sát đỉnh đầu (đáy vòng ~14px trên mặt đất, đỉnh vòng ~4px trên đầu).
const PORTAL_CENTER_DY = -70;

// entrants: [{fighter, dir}] — dir = hướng nhân vật quay mặt (1 phải / -1 trái).
// nextState: gameState thật sự sẽ vào khi intro xong ("GAMEPLAY"/"CHALLENGE"/"ROAD").
// afterIntroFn: chạy đúng lúc BATTLE_START (vd: spawn wave đầu của Challenge) —
//   đảm bảo "KHÔNG ĐƯỢC ĐỂ ENEMY SPAWN TRƯỚC KHI INTRO KẾT THÚC".
function startCharacterEntrance(entrants, nextState, afterIntroFn, floorY){
  portalEntrants = entrants.map(e=>({
    fighter: e.fighter,
    dir: e.dir,
    // ANCHOR CHUNG — portal VÀ nhân vật luôn đọc đúng 1 điểm này, không tính
    // hai hệ tọa độ riêng. Lấy trực tiếp từ vị trí spawn thật của fighter
    // (W*0.2 / W*0.8 cho GAMEPLAY, 220 cho ROAD, v.v.) — KHÔNG hard-code.
    entranceX: e.fighter.x,
    entranceY: e.fighter.y,
    // Bước ra rất ngắn, nhỏ hơn bán kính cổng (PORTAL_RING_R) — để nhân vật
    // luôn nằm TRONG lòng cổng trong lúc "bước ra", không bao giờ hiện ra
    // ngoài vòng cổng rồi mới chạy vào như trước.
    stepOx: -Math.min(24, PORTAL_RING_R*0.42)*e.dir,
    cfg: PORTAL_CONFIG[e.fighter.charType] || PORTAL_CONFIG.fire,
    t: 0
  }));
  pendingGameState  = nextState;
  pendingAfterIntro = afterIntroFn || null;
  pendingIntroFloorY = floorY!==undefined ? floorY : H*FLOOR_Y_RATIO;
  gameState = "PORTAL_INTRO";
}

function drawCharacterPortal(en){
  const cfg=en.cfg, px=en.entranceX, py=en.entranceY; // luôn dùng anchor chung
  let ringScale=0, ringAlpha=0, charOx=en.stepOx, charAlpha=0;

  if(en.t<=PI_OPEN_END){
    const p=_piEase(en.t/PI_OPEN_END);
    ringScale=p; ringAlpha=p; charAlpha=0; charOx=en.stepOx;
  }else if(en.t<=PI_WALK_END){
    ringScale=1; ringAlpha=1;
    const p=_piEase((en.t-PI_OPEN_END)/(PI_WALK_END-PI_OPEN_END));
    charOx = en.stepOx*(1-p);
    // Nhân vật "hiện dần" ngay trong lòng cổng ở 25% đầu giai đoạn bước ra,
    // rồi mới di chuyển đoạn ngắn còn lại — tránh cảm giác vừa xuất hiện đã
    // đứng cách xa cổng / chạy từ chỗ khác tới.
    charAlpha = clamp(p/0.25,0,1);
  }else if(en.t<=PI_READY_END){
    ringScale=1; ringAlpha=1; charAlpha=1; charOx=0;
  }else if(en.t<=PI_CLOSE_END){
    const p=_piEase((en.t-PI_READY_END)/(PI_CLOSE_END-PI_READY_END));
    ringScale=1-p; ringAlpha=1-p; charAlpha=1; charOx=0;
  }else{
    ringScale=0; ringAlpha=0; charAlpha=1; charOx=0;
  }

  // ---- cổng không gian (tâm tại px, py+PORTAL_CENTER_DY — cùng anchor với nhân vật) ----
  if(ringAlpha>0.01){
    ctx.save();
    ctx.translate(px, py+PORTAL_CENTER_DY);
    ctx.rotate(frameCount*0.03*en.dir);
    ctx.scale(Math.max(0.001,ringScale),Math.max(0.001,ringScale));
    ctx.globalAlpha=ringAlpha;
    const grad=ctx.createRadialGradient(0,0,4,0,0,PORTAL_RING_R+2);
    grad.addColorStop(0,cfg.glow); grad.addColorStop(0.55,cfg.color); grad.addColorStop(1,"rgba(0,0,0,0)");
    ctx.beginPath();ctx.arc(0,0,PORTAL_RING_R,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
    ctx.lineWidth=6;ctx.strokeStyle=cfg.color;ctx.shadowColor=cfg.glow;ctx.shadowBlur=18;
    ctx.beginPath();ctx.arc(0,0,PORTAL_RING_R,0,Math.PI*2);ctx.stroke();
    ctx.shadowBlur=0;
    // hạt năng lượng xoay quanh viền cổng
    for(let i=0;i<10;i++){
      const ang=frameCount*0.05+i*(Math.PI*2/10);
      const rr=PORTAL_RING_R+Math.sin(frameCount*0.1+i)*4;
      ctx.beginPath();ctx.arc(Math.cos(ang)*rr,Math.sin(ang)*rr,3,0,Math.PI*2);
      ctx.fillStyle=cfg.particle;ctx.fill();
    }
    // hiệu ứng méo nhẹ riêng cho SHADOW
    if(en.fighter.charType==="shadow"){
      ctx.globalAlpha=ringAlpha*0.5;
      ctx.beginPath();ctx.arc(0,0,30+Math.sin(frameCount*0.15)*6,0,Math.PI*2);
      ctx.fillStyle="#1a0a2a";ctx.fill();
    }
    ctx.restore();
  }

  // ---- nhân vật bước ra — cùng px làm gốc, chỉ lệch thêm charOx (nhỏ, trong lòng cổng) ----
  if(charAlpha>0.01 && en.fighter && typeof en.fighter.draw==="function"){
    ctx.save();ctx.globalAlpha=charAlpha;
    en.fighter.draw(charOx,0);
    ctx.restore();
  }

  // ---- READY flash ngắn trước BATTLE START ----
  if(en.t>PI_CLOSE_END){
    const p=(en.t-PI_CLOSE_END)/(PI_FLASH_END-PI_CLOSE_END);
    ctx.save();ctx.globalAlpha=1-p;ctx.font="bold 22px Arial";ctx.textAlign="center";
    ctx.fillStyle=cfg.color;ctx.fillText("READY!",px,py+PORTAL_CENTER_DY-95);
    ctx.restore();
  }
}

function updateCharacterEntrance(){
  const floorY = pendingIntroFloorY || H*FLOOR_Y_RATIO;
  // Vẽ nền tương ứng với chế độ sắp vào, để không bị giật hình khi chuyển state.
  if(pendingGameState==="ROAD"){ drawRoadSky(false); drawRoadTerrain(floorY); }
  else { drawFloor(floorY,false,0); }

  let allDone=true;
  portalEntrants.forEach(en=>{
    en.t++;
    if(en.t<PI_FLASH_END) allDone=false;
    drawCharacterPortal(en);
  });

  const title = pendingGameState==="ROAD" ? "🛣️ CHUẨN BỊ LÊN ĐƯỜNG..."
              : pendingGameState==="CHALLENGE" ? "⚔️ CHUẨN BỊ CHIẾN ĐẤU..."
              : "⚔️ TRẬN ĐẤU SẮP BẮT ĐẦU...";
  _text(W/2,46,title,"white","20px Arial bold");

  if(allDone) finishCharacterEntrance();
}

function finishCharacterEntrance(){
  const next=pendingGameState, after=pendingAfterIntro;
  portalEntrants=[]; pendingGameState=null; pendingAfterIntro=null;
  gameState=next;          // chỉ bây giờ mới thật sự vào GAMEPLAY/CHALLENGE/ROAD
  if(after) after();       // ...và chỉ bây giờ mới spawn enemy/wave (nếu có)
}

function startChallengeMode(stage){
  projectiles=[];puppets=[];p1=new Fighter(W*0.2,H*FLOOR_Y_RATIO,selectedP1,1);
  p1.hp=p1.maxHp||MAX_HP;campX=0;_challengeWaveTimer=0;
  challengeEnemies=[];challengeBosses=[];challengeState="";challengeResult="";
  dmgNumbers=[];comboCount=0;comboTimer=0;comboMaxThisRun=0;_challengeEndSfxDone=false;
  bossIntroManager=null;challengeBossIntroState="IDLE";
  startCharacterEntrance([{fighter:p1,dir:1}], "CHALLENGE", ()=>{ startChallenge(stage); }, H*FLOOR_Y_RATIO);
}
function terrainHeightAt(worldX){
  if(!roadTerrain) return 0;
  const idx=Math.max(0,Math.floor(worldX/roadTerrain.segLen));
  return roadTerrain.heights[Math.min(idx,roadTerrain.heights.length-1)]||0;
}
function _generateRoadTerrain(totalLenPx,flatZonesPx){
  const segLen=380;
  const segCount=Math.ceil(totalLenPx/segLen)+6;
  const levels=[-90,-50,50,90]; // negative = raised plateau, positive = dip/valley
  const heights=[0,0,0]; // keep the spawn area flat
  for(let i=3;i<segCount;i++){
    let h = rng()<0.34 ? 0 : rndChoice(levels); // roughly a third of the road stays flat
    const prev=heights[i-1];
    if(Math.abs(h-prev)>110) h = prev + (h>prev?90:-90); // no un-jumpable cliffs between neighbors
    heights.push(h);
  }
  // Force flat ground around each boss set-piece — their fight logic assumes level footing.
  flatZonesPx.forEach(px=>{
    const a=Math.max(0,Math.floor((px-320)/segLen));
    const b=Math.floor((px+320)/segLen);
    for(let i=a;i<=b&&i<heights.length;i++) heights[i]=0;
  });
  return {segLen,heights};
}
function _spreadPositions(count,minX,maxX,avoidRanges,minGap){
  const positions=[]; let guard=0;
  while(positions.length<count && guard<count*50){
    guard++;
    const x=rndInt(minX,maxX);
    if(avoidRanges.some(r=>x>=r[0]&&x<=r[1])) continue;
    if(positions.some(p=>Math.abs(p-x)<minGap)) continue;
    positions.push(x);
  }
  return positions.sort((a,b)=>a-b);
}
let roadClouds=null;
function _initRoadClouds(){
  roadClouds=[];
  for(let i=0;i<8;i++){
    roadClouds.push({x:rndInt(-200,2400),y:rndInt(30,170),w:rndInt(70,150),spd:0.12+rng()*0.18});
  }
}
function _drawCloud(cx,cy,w){
  ctx.save();ctx.globalAlpha=0.9;ctx.fillStyle="#ffffff";
  const h=w*0.42;
  ctx.beginPath();
  ctx.ellipse(cx,cy,w*0.32,h*0.55,0,0,Math.PI*2);
  ctx.ellipse(cx-w*0.28,cy+h*0.12,w*0.24,h*0.42,0,0,Math.PI*2);
  ctx.ellipse(cx+w*0.28,cy+h*0.12,w*0.26,h*0.45,0,0,Math.PI*2);
  ctx.ellipse(cx+w*0.05,cy-h*0.18,w*0.22,h*0.4,0,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}
function drawRoadSky(isBossFight){
  if(!roadClouds)_initRoadClouds();
  if(!isBossFight){
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"#4fa8e8");grad.addColorStop(0.55,"#8fd0f0");grad.addColorStop(1,"#cdeeff");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.globalAlpha=0.55;ctx.fillStyle="#fff6cc";ctx.beginPath();ctx.arc(W-90,80,44,0,Math.PI*2);ctx.fill();ctx.restore();
    roadClouds.forEach(c=>{
      c.x-=c.spd; // gentle drift, independent of camera so the sky always feels alive
      if(c.x<-220)c.x=W+rndInt(50,200);
      _drawCloud(c.x,c.y,c.w);
    });
  }else{
    const grad=ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,"#2a0a3d");grad.addColorStop(0.55,"#4b1466");grad.addColorStop(1,"#170824");
    ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
    ctx.save();ctx.shadowColor="#a866ff";ctx.shadowBlur=30;ctx.fillStyle="#d9b6ff";ctx.beginPath();ctx.arc(W-90,80,34,0,Math.PI*2);ctx.fill();ctx.restore();
    for(let i=0;i<18;i++){
      const sx=(i*137+frameCount*0.2)%W,sy=(i*59)%160;
      ctx.fillStyle=`rgba(255,255,255,${0.15+0.15*Math.sin(frameCount*0.05+i)})`;
      ctx.fillRect(sx,sy,2,2);
    }
  }
}
function drawRoadTerrain(baseFloorY){
  if(!roadTerrain){ drawFloor(baseFloorY,false); return; }
  const segLen=roadTerrain.segLen;
  const startIdx=Math.max(0,Math.floor((roadCameraX-100)/segLen));
  const endIdx=Math.min(roadTerrain.heights.length-1,Math.ceil((roadCameraX+W+100)/segLen));
  for(let i=startIdx;i<=endIdx;i++){
    const segX=i*segLen, segY=baseFloorY+roadTerrain.heights[i];
    _rect(segX,segY,segLen+2,H-segY,"#1a1a2e",null,0);
    _rect(segX,segY,segLen+2,22,"#2d2d44",null,0);
    ctx.strokeStyle="#e84545";ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(segX,segY);ctx.lineTo(segX+segLen+2,segY);ctx.stroke();
    if(i<endIdx){
      const nextY=baseFloorY+roadTerrain.heights[i+1];
      if(nextY!==segY){
        const top=Math.min(segY,nextY), bot=Math.max(segY,nextY);
        _rect(segX+segLen-5,top,12,bot-top,"#241f38","#3a3260",1);
      }
    }
  }
}

const ROAD_BOSS_TRIGGERS_M=[350,800,1300].map(m=>Math.round(m*MAP_SCALE)); // 2.5x longer road between boss encounters
let _roadBossClearDelay=0;
function startRoadMode(){
  projectiles=[];puppets=[];
  const floorY=H*FLOOR_Y_RATIO;
  p1=new Fighter(220,floorY,selectedP1,1);
  p1.hp=p1.maxHp||MAX_HP;
  roadState="RUN";roadDistanceM=0;roadCameraX=0;
  roadWalls=[];roadTraps=[];roadEnemies=[];roadBoss=null;roadBossZoneIndex=0;
  roadBossTriggersPx=ROAD_BOSS_TRIGGERS_M.map(m=>m*ROAD_METER_PX+220);
  _roadBossClearDelay=0;

  const totalLenPx=roadBossTriggersPx[2]+900;
  const bossAvoid=roadBossTriggersPx.map(px=>[px-320,px+320]);
  roadTerrain=_generateRoadTerrain(totalLenPx,roadBossTriggersPx);

  // Fixed roster for the whole run — 18-20 enemies total, ~1/3 ranged casters,
  // spread evenly across the route instead of an endless timer-based spawner.
  const enemyCount=Math.round(rndInt(18,20)*MAP_SCALE);
  const enemyXs=_spreadPositions(enemyCount,500,totalLenPx-400,bossAvoid,140);
  const casterCount=Math.max(1,Math.round(enemyXs.length/3));
  const casterFlags=new Array(enemyXs.length).fill(false);
  for(let i=0;i<casterCount;i++) casterFlags[Math.min(enemyXs.length-1,Math.floor(i*(enemyXs.length/casterCount)))]=true;
  roadEnemyPlan=enemyXs.map((x,i)=>({x,caster:casterFlags[i],elite:rng()<0.15,spawned:false}));

  const wallCount=Math.round(rndInt(4,6)*MAP_SCALE);
  const wallXs=_spreadPositions(wallCount,900,totalLenPx-500,bossAvoid,650);
  roadWallPlan=wallXs.map((x,i)=>({x,hp:70+i*12,spawned:false}));

  const trapCount=Math.round(rndInt(10,14)*MAP_SCALE);
  const trapXs=_spreadPositions(trapCount,400,totalLenPx-300,bossAvoid,220);
  roadTrapPlan=trapXs.map((x,i)=>({x,type:i%2===0?"spike":"fire",spawned:false}));

  dmgNumbers=[];comboCount=0;comboTimer=0;comboMaxThisRun=0;roadKillCount=0;roadNewRecord=false;_roadEndSfxDone=false;
  startCharacterEntrance([{fighter:p1,dir:1}], "ROAD", ()=>{ roadRunStartFrame=frameCount; }, floorY);
}
function startMatch(){
  projectiles=[];puppets=[];const floorY=H*FLOOR_Y_RATIO;
  p1=new Fighter(W*0.2,floorY,selectedP1,1);
  p2=new Fighter(W*0.8,floorY,selectedP2,-1);
  campX=0;
  dmgNumbers=[];comboCount=0;comboTimer=0;comboMaxThisRun=0;_gameplayEndSfxDone=false;
  startCharacterEntrance([{fighter:p1,dir:1},{fighter:p2,dir:-1}], "GAMEPLAY", null, floorY);
}

// ================================================================
//  ROAD MODE UPDATE ("ĐƯỜNG ĐI" — 3 MA THÚ)
// ================================================================
function updateRoad(){
  const floorY=H*FLOOR_Y_RATIO;
  drawRoadSky(roadState==="BOSS");

  if(p1.slowTimer>0)p1.slowTimer--; if(p1.stunTimer>0)p1.stunTimer--;
  if(p1.poisonTimer>0){p1.poisonTimer--;if(p1.poisonTimer%60===0&&p1.hp>0)applyDamage(p1,2,null);}
  if(p1.thunderFTimer>0){p1.thunderFTimer--; if(p1.thunderFTimer===0)p1.thunderFCount=0;}
  for(const s in p1.cds) if(p1.cds[s]>0)p1.cds[s]--;
  tickV4(p1); tickWaterCloud(p1); tickFrost(p1); tickThunderDash(p1); tickWind(p1); updateFire(p1); updateShadow(p1);
  if(frameCount%60===0 && p1.charType==="red" && p1.hp>0) p1.hp=Math.min(p1.maxHp||MAX_HP,p1.hp+1);
  if(p1.ultiTimer>0 && p1.activeSkill==="water_s4"){p1.tsunamiWaveXL-=8;p1.tsunamiWaveXR+=8;}

  const running = roadState==="RUN" || roadState==="BOSS";
if(running && p1.hp>0 && p1.stunTimer<=0 && p1.transformWindupTimer===0 && p1.transformLandingTimer===0){
    let spd=4.3125;
    spd*=p1.speedMult||1;
    if(p1.charType==="wind"&&p1.windBoostTimer>0){spd*=1.25;p1.windBoostTimer--;}
    if(p1.slowTimer>0)spd*=(1-p1._slowPct);
    if(p1.charType==="earth"&&p1.earthMudActive)spd*=p1.earthMudSpeed;
    if(p1.transformActive)spd*=p1.getTransformBuffs().speed||1;
    if(p1._soulActive)spd*=1.3;
    const canMoveH=p1.ultiTimer===0||p1.activeSkill==="water_s4";
    const goLeft  = keys.has(keyBindings.left) || (platformMode==="MOBILE"&&touch1.left);
    const goRight = keys.has(keyBindings.right) || (platformMode==="MOBILE"&&touch1.right);
    const goUp    = keys.has(keyBindings.up) || (platformMode==="MOBILE"&&touch1.up);
    const goDown  = keys.has(keyBindings.down) || (platformMode==="MOBILE"&&touch1.down);
    if(canMoveH){ if(goLeft)p1.x-=spd; if(goRight)p1.x+=spd; }
    if(p1.charType==="frost"&&p1.transformActive&&p1.isFlying){ if(goUp)p1.vy=-10; if(goDown)p1.vy=8; }
    else{ if(goUp&&!p1._upPrevInput)p1.jump(); }
    p1._upPrevInput=goUp;
  }
  p1.applyGravity(floorY+terrainHeightAt(p1.x));

  // Camera follows the player both forward AND backward (with a small dead
  // zone so it doesn't jitter). This must run BEFORE the camera-edge clamp
  // below, using this frame's already-updated p1.x (which may reflect last
  // frame's knockback), otherwise a forward-only camera would keep re-pinning
  // a knocked-back player to its old edge every frame — the "văng vô map bị
  // kẹt" bug.
  const _scz=shadowCamZoomState(p1);
  const CAM_MARGIN_LEFT=W*0.28, CAM_MARGIN_RIGHT=W*0.55;
  if(_scz.active){
    // Shadow V4 wind-up punch-in: camera snaps to center on the caster
    // instead of the normal forward/backward dead-zone follow.
    const targetCam=Math.max(0,p1.x-W*0.5);
    roadCameraX+=(targetCam-roadCameraX)*0.16;
  }else{
    if(p1.x-roadCameraX>CAM_MARGIN_RIGHT) roadCameraX=p1.x-CAM_MARGIN_RIGHT;
    else if(p1.x-roadCameraX<CAM_MARGIN_LEFT) roadCameraX=p1.x-CAM_MARGIN_LEFT;
  }
  roadCameraX=Math.max(0,roadCameraX);

  p1.x=Math.max(p1.x,roadCameraX+40);
  const frontWall=getFrontWall();
  if(frontWall && frontWall.hp>0 && frontWall.x-p1.x<90){
    const wallTopY=floorY+terrainHeightAt(frontWall.x)-frontWall.height;
    if(p1.y > wallTopY-20) p1.x=Math.min(p1.x,frontWall.x-90); // chỉ chặn nếu player chưa bay cao hơn đỉnh tường
  }
  if(roadBoss && !roadBoss.dead && roadBoss.hp>0 && roadBoss.x-p1.x<170) p1.x=Math.min(p1.x,roadBoss.x-170);

  roadDistanceM=Math.max(0,Math.floor((p1.x-220)/ROAD_METER_PX));

  if(p1.attackCooldown>0){p1.attackCooldown--; if(p1.attackCooldown===0&&p1.ultiTimer===0){p1.isAttacking=false;p1.activeSkill=null;}}

  if(p1.ultiTimer>0){
    p1.ultiTimer--;
    getAllEnemies(p1).forEach(tgt=>{
      const d=dist(p1.x,p1.y,tgt.x,tgt.y);
      if(p1.activeSkill==="thunder_s4")thunderJudgmentTick(p1);
      else if(p1.activeSkill==="frost_s4"&&d<450*SR){applyDamage(tgt,0.18,p1);if(tgt instanceof Fighter)tgt.slowTimer=Math.max(tgt.slowTimer,10);}
      else if(p1.activeSkill==="water_s4"&&p1.tsunamiWaveXL<tgt.x&&tgt.x<p1.tsunamiWaveXR){applyDamage(tgt,0.35,p1);tgt.slowTimer=Math.max(tgt.slowTimer||0,20);tgt._slowPct=0.5;}
      else if(p1.activeSkill==="wind_s4"&&d<600*SR){
        applyDamage(tgt,0.20,p1);
        p1.windStormTick++;
        if(p1.windStormTick%25===0&&isPushable(tgt)){if(tgt instanceof Fighter)tgt.vy=-10;}
      }
    });
    if(p1.ultiTimer===0){if(p1.charType==="wind"&&p1.activeSkill==="wind_s4")spawnWindSideCyclones(p1);p1.isAttacking=false;p1.activeSkill=null;if(p1.charType==="earth")p1.earthPillars=[];}
  }

  if(roadState==="RUN"){
    const revealX=p1.x+W*0.65;
    roadEnemyPlan.forEach(pl=>{
      if(!pl.spawned && pl.x<=revealX){
        pl.spawned=true;
        const tier=Math.floor(pl.x/900);
        roadEnemies.push(new RoadEnemy(pl.x,floorY+terrainHeightAt(pl.x),tier,pl.elite,pl.caster));
      }
    });
    roadWallPlan.forEach(pl=>{
      if(!pl.spawned && pl.x<=revealX){
        pl.spawned=true;
        roadWalls.push(new RoadWall(pl.x,pl.hp,floorY+terrainHeightAt(pl.x)));
      }
    });
    roadTrapPlan.forEach(pl=>{
      if(!pl.spawned && pl.x<=revealX){
        pl.spawned=true;
        roadTraps.push(new RoadTrap(pl.x,pl.type));
      }
    });
    if(roadBossZoneIndex<3 && p1.x>=roadBossTriggersPx[roadBossZoneIndex]){
      roadBoss=new RoadBoss(roadBossZoneIndex+1, p1.x+420, floorY);
      roadState="BOSS";
      roadEnemies=[];
      screenShake=Math.max(screenShake,15);
    }
  }else if(roadState==="BOSS"){
    if(roadBoss){
      if(!roadBoss.dead && (roadBoss.hp>0 || roadBoss.dying) && p1.hp>0) roadBoss.update(shadowSoulTarget(p1));
      if(roadBoss.summonQueue && roadBoss.summonQueue.length){ roadEnemies.push(...roadBoss.summonQueue); roadBoss.summonQueue=[]; }
      if(roadBoss.dead){
        _roadBossClearDelay++;
        if(_roadBossClearDelay>50){
          roadBossZoneIndex++; roadBoss=null; _roadBossClearDelay=0;
          roadState = roadBossZoneIndex>=3 ? "WON" : "RUN";
          if(roadState==="WON"){
            roadNewRecord = roadDistanceM>roadBestDistance;
            if(roadNewRecord)roadBestDistance=roadDistanceM;
          }
        }
      }
    }
  }

  _compact(roadEnemies,e=>{ if(e.hp>0&&p1.hp>0)e.update(pickRoadMeleeTarget(e),floorY+terrainHeightAt(e.x),projectiles); return e.hp>0 && e.x>roadCameraX-200; });
  roadTraps.forEach(t=>{ if(p1.hp>0)t.update(shadowSoulTarget(p1),floorY+terrainHeightAt(t.x)); });
  _compact(roadWalls,w=>w.hp>0 || w.x>roadCameraX-100);

  if(p1.hp<=0 && roadState!=="LOST"){
    roadState="LOST";
    roadNewRecord = roadDistanceM>roadBestDistance;
    if(roadNewRecord)roadBestDistance=roadDistanceM;
  }

  ctx.save();
  ctx.translate(-roadCameraX,0);
  if(_scz.zoom!==1.0){
    const pivotX=p1.x,pivotY=floorY-80;
    ctx.translate(pivotX,pivotY);ctx.scale(_scz.zoom,_scz.zoom);ctx.translate(-pivotX,-pivotY);
  }
  ctx.fillStyle="#13263b";
  const stripeStart=Math.floor(roadCameraX/300)*300;
  for(let i=0;i<40;i++){ const gx=stripeStart+i*300; ctx.fillRect(gx+40,floorY-260,3,260); }
  drawRoadTerrain(floorY);
  roadTraps.forEach(t=>t.draw(floorY+terrainHeightAt(t.x)));
  roadWalls.forEach(w=>w.draw(floorY+terrainHeightAt(w.x)));
  updateProjectiles(floorY,null);
  roadEnemies.forEach(e=>e.draw());
  if(roadBoss && !roadBoss.dead) roadBoss.draw();
  _compact(puppets,pu=>pu.hp>0&&pu.life>0);
  tickEarthMud(p1);
  tickEarthMeteor(p1);
  tickEarthMinions(p1,roadCameraX+W);
  puppets.forEach(pu=>pu.update(floorY+terrainHeightAt(pu.x),roadCameraX+W));
  puppets.forEach(pu=>pu.draw());
  drawEarthMinions(p1);
  drawFrostSlideTrail(p1);drawFrostDomain(p1);if(p1._icePrisonedTargets)p1._icePrisonedTargets.forEach(drawFrostIcePrison);drawThunderDashTrail(p1);drawWindDashTrail(p1);drawWindCyclone(p1);drawWindSideCyclones(p1);drawEarthMud(p1);drawFire(p1);drawShadow(p1);
  p1.draw();
  if(p1.poisonTimer>0){
    for(let i=0;i<3;i++){
      const px=p1.x+rndInt(-16,16),py=p1.y-30-rndInt(0,55);
      _oval(px-7,py-7,14,14,"rgba(170,60,220,0.45)",null);
    }
  }
  updateAndDrawHitEffects();
  updateAndDrawLightningArcs();
  updateAndDrawDmgNumbers();
  ctx.restore();

  _text(W/2,15,"🛣️ ĐƯỜNG ĐI — 3 MA THÚ 🛣️","gold","16px Arial bold");
  const bw2=(p1.hp/(p1.maxHp||MAX_HP))*200;
  _rect(50,40,200,20,"#333",null,0); _rect(50,40,Math.max(0,bw2),20,"#ff1a1a",null,0);
  _text(150,30,`P1 (${p1.charType.toUpperCase()}): ${getHPDisplay(p1.hp)}/${p1.maxHp||MAX_HP} HP`,"white","10px Arial bold");
  drawRageBar(50,63,200,14,p1);
  if(platformMode==="PC")drawCooldownChallenge();
  drawComboCounter();
  drawLowHpVignette();
  drawActiveBossBars();
  const bossNames=["🥚 Trứng Ma Thú","🦂 Vua Bọ Cạp Cát","🐉 Ma Long Vực Thẳm"];
  _text(W-160,30,`Quãng đường: ${roadDistanceM}m`,"white","11px Arial bold");
  if(roadBestDistance>0)_text(W-160,63,`🏅 Kỷ lục: ${roadBestDistance}m`,"gold","9px Arial bold");
  if(roadState==="RUN" && roadBossZoneIndex<3){
    const remainM=Math.max(0,Math.ceil((roadBossTriggersPx[roadBossZoneIndex]-p1.x)/ROAD_METER_PX));
    _text(W-160,48,`Boss tiếp theo (${bossNames[roadBossZoneIndex]}): ${remainM}m`,"#aaa","9px Arial");
  }else if(roadState==="BOSS"){
    _text(W-160,48,`⚔️ Đang chiến đấu: ${bossNames[roadBossZoneIndex]}`,"orange","9px Arial bold");
  }

  if(roadState==="WON"||roadState==="LOST"){
    if(!_roadEndSfxDone){
      _roadEndSfxDone=true;
      if(roadState==="WON")sfxVictory();else sfxDefeat();
      if(roadNewRecord)setTimeout(()=>{ if(gameState==="ROAD")sfxRecord(); },350);
    }
  }
  if(roadState==="WON"){
    _text(W/2,H/2-25,"🏆 CHINH PHỤC ĐƯỜNG ĐI THÀNH CÔNG! 🏆","gold","32px Arial bold");
    _text(W/2,H/2+15,`Quãng đường: ${roadDistanceM}m  •  Quái đã hạ: ${roadKillCount}  •  Combo cao nhất: ${comboMaxThisRun}`,"#dddddd","12px Arial bold");
    if(roadNewRecord)_text(W/2,H/2+42,"🌟 KỶ LỤC MỚI! 🌟","#ffcc00","15px Arial bold");
    _text(W/2,H/2+72,platformMode==="MOBILE"?"Chạm màn hình để chơi lại | Quay lại về menu":"Nhấn R để chơi lại | ESC về menu","white","14px Arial");
  }else if(roadState==="LOST"){
    _text(W/2,H/2-25,"💀 THẤT BẠI 💀","red","40px Arial bold");
    _text(W/2,H/2+20,`Quãng đường: ${roadDistanceM}m  •  Quái đã hạ: ${roadKillCount}  •  Combo cao nhất: ${comboMaxThisRun}`,"#dddddd","12px Arial bold");
    if(roadNewRecord)_text(W/2,H/2+46,"🌟 KỶ LỤC MỚI! 🌟","#ffcc00","15px Arial bold");
    _text(W/2,H/2+74,platformMode==="MOBILE"?"Chạm màn hình để thử lại | Quay lại về menu":"Nhấn R để thử lại | ESC về menu","white","14px Arial");
  }
}
let _roadEndSfxDone=false;

// ================================================================
//  KICK OFF
// ================================================================
update();

// ================================================================
//  ROAD MODE — WALL / TRAP / TRASH ENEMY CLASSES
// ================================================================
class RoadWall{
  constructor(x,hp,y){
    this.x=x;this.hp=hp;this.maxHp=hp;this.width=74;this.height=190;this.anim=0;this.y=y;
  }
  draw(floorY){
    this.anim++;
    if(this.hp<=0)return;
    const rx=this.x,crackFrac=1-this.hp/this.maxHp;
    ctx.save();ctx.shadowColor="#8b5a2b";ctx.shadowBlur=12;
    _rect(rx-this.width/2,floorY-190,this.width,190,"#4a3524","#7a5a3a",3);
    ctx.restore();
    for(let i=0;i<4;i++){
      const ly=floorY-30-i*40;
      ctx.strokeStyle=`rgba(255,${180-i*20},60,${0.5+0.3*Math.sin(this.anim*0.05+i)})`;
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(rx-this.width/2+6,ly);ctx.lineTo(rx+this.width/2-6,ly);ctx.stroke();
    }
    ctx.strokeStyle="black";ctx.lineWidth=2;
    if(crackFrac>0.2){ctx.beginPath();ctx.moveTo(rx-10,floorY-40);ctx.lineTo(rx+5,floorY-90);ctx.lineTo(rx-8,floorY-140);ctx.stroke();}
    if(crackFrac>0.5){ctx.beginPath();ctx.moveTo(rx+15,floorY-20);ctx.lineTo(rx-5,floorY-110);ctx.stroke();}
    if(crackFrac>0.75){for(let i=0;i<8;i++){const px2=rx+rndInt(-30,30),py2=floorY-rndInt(10,180);_oval(px2-3,py2-3,6,6,"#2a1a10",null);}}
    const bw=94;
    _rect(rx-bw/2,floorY-210,bw,8,"#222",null,0);_rect(rx-bw/2,floorY-210,Math.max(0,bw*(this.hp/this.maxHp)),8,"#e8a33d",null,0);
    _text(rx,floorY-222,`🚧 CỔNG CHẮN: ${Math.floor(this.hp)}/${this.maxHp}`,"gold","9px Arial bold");
  }
}

class RoadTrap{
  constructor(x,type){this.x=x;this.type=type;this.anim=rndInt(0,1000);this.hitCooldown=0;}
  update(player,floorY){
    this.anim++;
    if(this.hitCooldown>0){this.hitCooldown--;return;}
    if(player.hp>0&&Math.abs(player.x-this.x)<30&&player.y>=floorY-6){
      applyDamage(player,this.type==="fire"?6:8,null);
      player.slowTimer=Math.max(player.slowTimer,20);
      this.hitCooldown=55;screenShake=Math.max(screenShake,6);
    }
  }
  draw(floorY){
    if(this.type==="spike"){
      for(let i=-1;i<=1;i++){
        const sx=this.x+i*18;
        ctx.fillStyle="#999";ctx.strokeStyle="#444";ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(sx-9,floorY);ctx.lineTo(sx,floorY-34-Math.sin(this.anim*0.05+i)*2);ctx.lineTo(sx+9,floorY);ctx.closePath();ctx.fill();ctx.stroke();
      }
    }else{
      const flick=Math.sin(this.anim*0.3)*4;
      _oval(this.x-30,floorY-8,60,16,"#331100",null);
      for(let i=0;i<6;i++){const fx=this.x+rndInt(-24,24),fh=rndInt(18,34)+flick;ctx.save();ctx.shadowColor="orange";ctx.shadowBlur=8;_oval(fx-6,floorY-fh,12,fh,rndChoice(["#FF4400","#FF8800","yellow"]),null);ctx.restore();}
    }
  }
}

// ================================================================
//  THẦN CHẾT (Grim Reaper) skin — used by any "quái" (RoadEnemy /
//  ChallengeEnemy) that got caught in Shadow's V4 black-smoke burst.
//  Purely cosmetic re-skin: stats/behavior of the mob are untouched.
// ================================================================
function _drawReaperMonster(rx,ry,direction=1){
  const d=direction||1;
  ctx.save();
  ctx.translate(rx,ry);
  ctx.scale(d,1);
  // purple aura
  ctx.save();ctx.globalAlpha=0.45;
  const aura=ctx.createRadialGradient(0,-35,4,0,-35,52);
  aura.addColorStop(0,"rgba(100,75,255,0.28)");
  aura.addColorStop(0.6,"rgba(50,35,150,0.10)");
  aura.addColorStop(1,"rgba(0,0,0,0)");
  ctx.fillStyle=aura;ctx.beginPath();ctx.arc(0,-35,52,0,Math.PI*2);ctx.fill();
  ctx.restore();
  // cape
  ctx.fillStyle="#0d0e17";
  ctx.beginPath();
  ctx.moveTo(-16,-40);ctx.lineTo(-28,4);ctx.lineTo(-15,-2);ctx.lineTo(-8,6);ctx.lineTo(0,-3);ctx.lineTo(8,6);ctx.lineTo(15,-2);ctx.lineTo(28,4);ctx.lineTo(16,-40);
  ctx.closePath();ctx.fill();
  // robe/body
  ctx.fillStyle="#14151f";
  ctx.beginPath();ctx.moveTo(-11,-46);ctx.lineTo(11,-46);ctx.lineTo(15,-14);ctx.lineTo(0,-4);ctx.lineTo(-15,-14);ctx.closePath();ctx.fill();
  // hood
  ctx.fillStyle="#08080f";
  ctx.beginPath();
  ctx.moveTo(-16,-44);
  ctx.quadraticCurveTo(0,-70,16,-44);
  ctx.lineTo(11,-34);ctx.lineTo(-11,-34);
  ctx.closePath();ctx.fill();
  // glowing purple eyes
  ctx.fillStyle="#6654ff";ctx.shadowColor="#7565ff";ctx.shadowBlur=10;
  ctx.beginPath();ctx.moveTo(-7,-48);ctx.lineTo(-2,-46);ctx.lineTo(-6,-43);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(7,-48);ctx.lineTo(2,-46);ctx.lineTo(6,-43);ctx.closePath();ctx.fill();
  ctx.shadowBlur=0;
  // scythe, angled behind
  ctx.save();ctx.globalAlpha=0.9;
  ctx.strokeStyle="#8b877e";ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(14,-6);ctx.lineTo(34,-58);ctx.stroke();
  ctx.strokeStyle="#cfcdc8";ctx.lineWidth=4;
  ctx.beginPath();ctx.moveTo(34,-58);ctx.quadraticCurveTo(52,-70,60,-52);ctx.quadraticCurveTo(46,-60,34,-48);ctx.stroke();
  ctx.restore();
  ctx.restore();
}
class RoadEnemy{
  constructor(x,y,tier,elite=false,caster=false,rabbit=false){
    this.x=x;this.y=y;this.vy=0;this.onGround=false;
    tier=Math.min(12,Math.max(0,tier)); // cap so far-away enemies stay tough but not absurd
    const hpBase=22+tier*6,dmgBase=1+tier*0.22;
    this.hp=this.maxHp=elite?hpBase*2.0:hpBase;
    this.dmg=elite?dmgBase*1.35:dmgBase;
    this.spd=(elite?1.8:2.3)+Math.min(tier,10)*0.04;
    this.elite=elite;this.caster=caster;this.tier=tier;this.rabbit=rabbit;
    this.direction=1;this.attackTimer=rndInt(20,60);this.anim=0;
    this.slowTimer=0;this._slowPct=0.5;this.stunTimer=0;
    this.castTimer=rndInt(60,140);
    this.hopTimer=rndInt(0,20);
  }
  applyGravity(floorY){this.vy+=GRAVITY;this.y+=this.vy;if(this.y>=floorY){this.y=floorY;this.vy=0;this.onGround=true;}else this.onGround=false;}
  update(player,floorY,castArr){
    this.anim++;this.applyGravity(floorY);
    if(this.slowTimer>0)this.slowTimer--;
    if(this.stunTimer>0){this.stunTimer--;return;}
    const dx=player.x-this.x;this.direction=dx>0?1:-1;
    let spd=this.spd*(this.slowTimer>0?(1-this._slowPct):1);
    if(this.rabbit){
      // Hop in bursts instead of gliding: leap forward, land, pause briefly, repeat.
      if(this.hopTimer>0)this.hopTimer--;
      if(this.onGround&&this.hopTimer<=0&&Math.abs(dx)>55){
        this.vy=-6.5;this.hopTimer=26;this.x+=spd*this.direction*13;
      }
    }else if(Math.abs(dx)>55)this.x+=spd*this.direction;
    this.attackTimer--;
    if(this.attackTimer<=0&&Math.abs(dx)<70*(player.sizeMult||1)&&Math.abs(player.y-this.y)<75&&player.hp>0){applyDamage(player,player.isShielding?this.dmg*0.2:this.dmg,null);this.attackTimer=75;}
    if(this.caster){
      this.castTimer--;
      if(this.castTimer<=0&&Math.abs(dx)<650&&player.hp>0){
        this.castTimer=150;
        castArr.push({x:this.x,y:this.y-30,vx:7*this.direction,vy:0,owner:null,target:player,damage:this.dmg*2,slow:0,slow_pct:0,color:"#cc8844",type:"road_bolt"});
      }
    }
  }
  draw(){
    if(this.reaperForm){this._drawReaperForm();return;}
    if(this.rabbit){this._drawRabbit();return;}
    const col=this.elite?"#772222":"#5a3d1a",rx=this.x,ry=this.y;
    ctx.save();
    if(this.elite){ctx.shadowColor="red";ctx.shadowBlur=8;}
    _rect(rx-18,ry-38,36,38,col,this.elite?"orange":"#333",2);
    _rect(rx-13,ry-60,26,26,col,this.elite?"orange":"#333",2);
    ctx.restore();
    _oval(rx+6*this.direction-4,ry-52,8,8,this.caster?"violet":"red",null);
    if(this.elite){for(let i=0;i<2;i++){const hx=rx-6+i*12;ctx.fillStyle="#222";ctx.beginPath();ctx.moveTo(hx-4,ry-60);ctx.lineTo(hx,ry-72);ctx.lineTo(hx+4,ry-60);ctx.closePath();ctx.fill();}}
    if(this.slowTimer>0)_text(rx,ry-90,"❄️","deepskyblue","10px Arial");
    const bw=36*(this.hp/this.maxHp);
    _rect(rx-18,ry-78,36,5,"#333",null,0);_rect(rx-18,ry-78,Math.max(0,bw),5,this.elite?"#ff4444":"#ffaa33",null,0);
  }
  _drawReaperForm(){
    const rx=this.x,ry=this.y;
    _drawReaperMonster(rx,ry,this.direction);
    if(this.slowTimer>0)_text(rx,ry-96,"💨","#bda8ff","10px Arial");
    const bw=36*(this.hp/this.maxHp);
    _rect(rx-18,ry-78,36,5,"#333",null,0);_rect(rx-18,ry-78,Math.max(0,bw),5,"#8866ff",null,0);
  }
  _drawRabbit(){
    const rx=this.x,ry=this.y,d=this.direction;
    const airborne=!this.onGround, squash=airborne?1:1-Math.min(0.12,this.hopTimer*0.005);
    ctx.save();
    ctx.shadowColor="#ffe6ee";ctx.shadowBlur=6;
    // tail (drawn behind the body, opposite the facing direction)
    _oval(rx-10*d-6,ry-24,12,12,"#ffffff","#e8b8c8",1.5);
    // body
    _oval(rx-16,ry-40*squash,32,40*squash,"#ffffff","#dcc3cf",2);
    // head
    const hx=rx+4*d;
    _oval(hx-15,ry-66,30,28,"#ffffff","#dcc3cf",2);
    // long rabbit ears, perked up (tilt slightly with the hop)
    const earTilt=airborne?-8:0;
    ctx.fillStyle="#ffffff";ctx.strokeStyle="#dcc3cf";ctx.lineWidth=1.5;
    ctx.save();ctx.translate(hx-7,ry-64);ctx.rotate((-12+earTilt)*Math.PI/180);
    ctx.beginPath();ctx.ellipse(0,-18,6,20,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffc3d6";ctx.beginPath();ctx.ellipse(0,-18,3,14,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.fillStyle="#ffffff";
    ctx.save();ctx.translate(hx+7,ry-64);ctx.rotate((12-earTilt)*Math.PI/180);
    ctx.beginPath();ctx.ellipse(0,-18,6,20,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.fillStyle="#ffc3d6";ctx.beginPath();ctx.ellipse(0,-18,3,14,0,0,Math.PI*2);ctx.fill();
    ctx.restore();
    ctx.restore();
    // red eyes
    _oval(hx+2*d-4,ry-56,7,7,"red",null);
    _oval(hx+10*d-4,ry-56,7,7,"red",null);
    if(this.elite){for(let i=0;i<2;i++){const hx2=hx-6+i*12;ctx.fillStyle="#c00030";ctx.beginPath();ctx.moveTo(hx2-3,ry-64);ctx.lineTo(hx2,ry-72);ctx.lineTo(hx2+3,ry-64);ctx.closePath();ctx.fill();}}
    if(this.slowTimer>0)_text(rx,ry-98,"❄️","deepskyblue","10px Arial");
    const bw=36*(this.hp/this.maxHp);
    _rect(rx-18,ry-86,36,5,"#333",null,0);_rect(rx-18,ry-86,Math.max(0,bw),5,this.elite?"#ff4444":"#ff9dc2",null,0);
  }
}

// ================================================================
//  ROAD MODE — 3 MAIN BOSSES (MA THÚ)
// ================================================================
class RoadBoss{
  constructor(type,x,floorY){
    this.type=type;this.x=x;this.y=floorY;this.floorY=floorY;this.vy=0;
    this.anim=0;this.dead=false;this.direction=-1;this.stunTimer=0;this.phase=1;
    this.summonQueue=[];this.hitFlash=0;this.skillTimer={};
    this._init();
  }
  _init(){
    if(this.type===1){
      this.hp=this.maxHp=320;this.skillTimer={summon:260};this.bobPhase=0;
    }else if(this.type===2){
      // Vua Bọ Cạp Cát (Sand Scorpion King)
      this.hp=this.maxHp=420;this.moveSpeed=4.3125*0.85;
      this.action="IDLE";this.actionTimer=0;
      this.cd={basic:0,claw:0,tail:0,sand:0,skillGate:180};
      this.postSkillRest=0;this.armorActive=false;this.summonedOnce=false;
      this.clawWarnX=this.x;this.clawHitDone=false;this.tailHitDone=false;
      this.sandStormTimer=0;this.sandStormCenterX=this.x;
      this.legPhase=0;this.dustP=[];
      this.dying=false;this.deathTimer=0;
    }else{
      // ---- Ma Long Vực Thẳm (Abyssal Shadow Dragon) ----
      this.hp=this.maxHp=560;this.phase=1;
      this.skillTimer={breath:260,slam:380,tail:200,roar:560};
      this.wingAngle=0;this.neckSway=0;this.tailSway=0;this.hoverOffset=0;
      this.breathActive=0;this.breathWarn=0;this._breathDir=1;
      this.slamActive=false;this.slamHitDone=false;this.slamPhaseTimer=0;
      this.slamTargetX=this.x;this.slamTargetY=this.floorY-30;this._slamRiseY=this.floorY-320;
      this.tailActive=0;this.tailWarn=0;this.tailHitDone=false;
      this.roarActive=0;this.roarWarn=0;this.prisonX=this.x;this.prisonY=this.floorY-60;
      this.groundSpikes=[];this.emberParticles=[];
      this.y=this.floorY-160;
    }
  }
  update(player){
    this.anim++;
    if(this.hitFlash>0)this.hitFlash--;
    if(this.type===2&&this.dying){this._updateDeath2();return;}
    if(this.stunTimer>0){this.stunTimer--;return;}
    for(const k in this.skillTimer)if(this.skillTimer[k]>0)this.skillTimer[k]--;
    if(this.type===1)this._update1(player);
    else if(this.type===2)this._update2(player);
    else this._update3(player);
    this.x=clamp(this.x,roadCameraX+50,roadCameraX+W-50);
  }
  _update1(player){
    this.y=this.floorY;this.bobPhase+=0.05;
    if(Math.abs(player.x-this.x)<75&&player.hp>0&&rng()<0.015)applyDamage(player,3,null);
    if(this.skillTimer.summon<=0){
      this.skillTimer.summon=420;
      for(let i=0;i<2;i++)this.summonQueue.push(new RoadEnemy(this.x+rndInt(-150,150),this.floorY,3,false,false,true));
      this.hitFlash=Math.max(this.hitFlash,10);screenShake=Math.max(screenShake,10);
    }
  }
  // ---- Vua Bọ Cạp Cát (Sand Scorpion King) — AI, combat & movement ----
  _update2(player){
    const s=this.cd;
    this.y=this.floorY;
    this.legPhase+=0.15;
    // Nội tại: Giáp Cát khi HP < 50%
    const wasArmor=this.armorActive;
    this.armorActive=this.hp<=this.maxHp*0.5;
    if(this.armorActive&&!wasArmor)screenShake=Math.max(screenShake,8);
    // tick cooldowns
    if(s.basic>0)s.basic--; if(s.claw>0)s.claw--; if(s.tail>0)s.tail--; if(s.sand>0)s.sand--;
    if(s.skillGate>0)s.skillGate--;
    if(this.postSkillRest>0)this.postSkillRest--;
    // Bão Cát (Chiêu 3) ongoing effect
    if(this.sandStormTimer>0){
      this.sandStormTimer--;
      if(player.hp>0&&this.sandStormTimer%15===0&&Math.abs(player.x-this.sandStormCenterX)<230){
        player.slowTimer=Math.max(player.slowTimer,20);player._slowPct=Math.max(player._slowPct||0.3,0.3);
      }
    }
    // dust trail particles while moving
    if(rng()<0.5)this.dustP.push({x:this.x-30*this.direction,y:this.floorY-6,life:22,maxLife:22,r:rndInt(3,7)});
    _compact(this.dustP,d=>{d.x-=1.2*this.direction;d.life--;return d.life>0;});

    // Chiêu 4 — Triệu Hồi Bọ Cạp Con (chỉ một lần khi HP < 50%)
    if(!this.summonedOnce&&this.hp<=this.maxHp*0.5&&this.action==="IDLE"){
      this.action="SUMMON_WARN";this.actionTimer=45;this.summonedOnce=true;return;
    }

    const dx=player.x-this.x,dist=Math.abs(dx);

    if(this.action==="IDLE"){
      this.direction=dx>0?1:-1;
      if(dist>90)this.x+=this.moveSpeed*(dx>0?1:-1); // Boss luôn cố gắng tiến lại gần người chơi
      // Ưu tiên đánh thường trước; chỉ dùng kỹ năng sau khi hết "skillGate" và không đang nghỉ sau chiêu trước
      if(s.basic<=0&&dist<=95&&player.hp>0){
        this.action="BASIC_WINDUP";this.actionTimer=22;return;
      }
      if(s.skillGate<=0&&this.postSkillRest<=0){
        if(dist>260&&s.sand<=0){ // người chơi ở xa -> ưu tiên kỹ năng tầm xa (Bão Cát)
          this.action="SAND_CAST";this.actionTimer=60;this.sandStormCenterX=player.x;return;
        }
        if(dist<=150&&s.claw<=0&&rng()<0.5){
          this.action="CLAW_WARN";this.actionTimer=48;this.clawWarnX=player.x;this.clawHitDone=false;return;
        }
        if(dist<=230&&s.tail<=0){
          this.action="TAIL_WARN";this.actionTimer=26;this.tailHitDone=false;return;
        }
      }
    }
    // Đánh thường — Boss dùng hai càng để tấn công
    else if(this.action==="BASIC_WINDUP"){
      this.actionTimer--;
      if(this.actionTimer<=0){this.action="BASIC_STRIKE";this.actionTimer=10;}
    }else if(this.action==="BASIC_STRIKE"){
      this.actionTimer--;
      if(this.actionTimer===6&&player.hp>0&&Math.abs(player.x-this.x)<95){
        applyDamage(player,12,null);screenShake=Math.max(screenShake,6);
      }
      if(this.actionTimer<=0){this.action="BASIC_RECOVER";this.actionTimer=28;s.basic=70;}
    }else if(this.action==="BASIC_RECOVER"){
      this.actionTimer--;if(this.actionTimer<=0)this.action="IDLE";
    }
    // Chiêu 1 — Càng Khổng Lồ
    else if(this.action==="CLAW_WARN"){
      this.actionTimer--;
      if(this.actionTimer<=0){this.action="CLAW_STRIKE";this.actionTimer=14;}
    }else if(this.action==="CLAW_STRIKE"){
      this.actionTimer--;
      if(!this.clawHitDone&&this.actionTimer===8){
        this.clawHitDone=true;
        if(player.hp>0&&Math.abs(player.x-this.clawWarnX)<80){
          applyDamage(player,15,null);
          player.x=clamp(player.x+(player.x>this.x?1:-1)*90,roadCameraX+40,roadCameraX+W-40);
          player.stunTimer=Math.max(player.stunTimer,30);
        }
        screenShake=Math.max(screenShake,16);
      }
      if(this.actionTimer<=0){this.action="CLAW_RECOVER";this.actionTimer=40;s.claw=300;this.postSkillRest=90;}
    }else if(this.action==="CLAW_RECOVER"){
      this.actionTimer--;if(this.actionTimer<=0)this.action="IDLE";
    }
    // Chiêu 2 — Đuôi Độc
    else if(this.action==="TAIL_WARN"){
      this.direction=dx>0?1:-1;
      this.actionTimer--;
      if(this.actionTimer<=0){this.action="TAIL_STRIKE";this.actionTimer=16;this.tailHitDone=false;}
    }else if(this.action==="TAIL_STRIKE"){
      this.actionTimer--;
      this.x+=this.moveSpeed*1.6*this.direction;
      if(!this.tailHitDone&&player.hp>0&&Math.abs(player.x-this.x)<70){
        this.tailHitDone=true;
        applyDamage(player,20,null);
        player.poisonTimer=Math.max(player.poisonTimer||0,300);
        screenShake=Math.max(screenShake,10);
      }
      if(this.actionTimer<=0){this.action="TAIL_RECOVER";this.actionTimer=30;s.tail=210;this.postSkillRest=70;}
    }else if(this.action==="TAIL_RECOVER"){
      this.actionTimer--;if(this.actionTimer<=0)this.action="IDLE";
    }
    // Chiêu 3 — Bão Cát (cắm đuôi xuống đất rồi tạo bão)
    else if(this.action==="SAND_CAST"){
      this.actionTimer--;
      if(this.actionTimer<=0){
        this.sandStormTimer=360;this.sandStormCenterX=this.x;
        s.sand=520;this.postSkillRest=100;screenShake=Math.max(screenShake,18);
        this.action="IDLE";
      }
    }
    // Chiêu 4 — Triệu Hồi Bọ Cạp Con
    else if(this.action==="SUMMON_WARN"){
      this.actionTimer--;
      if(this.actionTimer<=0)this.action="SUMMON_ACT";
    }else if(this.action==="SUMMON_ACT"){
      for(let i=0;i<3;i++){
        const e=new RoadEnemy(this.x+rndInt(-140,140),this.floorY,3,false,false,false);
        e.hp=e.maxHp=30;e.dmg=5;e.spd=3.2;
        this.summonQueue.push(e);
      }
      screenShake=Math.max(screenShake,20);
      this.action="IDLE";this.postSkillRest=60;
    }
  }
  // ---- Death sequence: roar -> nứt -> nổ tung thành cát -> tan dần ----
  _updateDeath2(){
    this.deathTimer--;
    if(this.deathTimer===55)screenShake=Math.max(screenShake,8); // gầm lên
    if(this.deathTimer===35)screenShake=Math.max(screenShake,10); // vết nứt lan ra
    if(this.deathTimer===18){ // nổ tung thành cát
      spawnBossDeathBurst(this.x,this.y-50);
      for(let i=0;i<26;i++){
        const ang=rng()*Math.PI*2,spd=rng()*7+2;
        hitEffects.push({x:this.x+rndInt(-40,40),y:this.y-50-rndInt(0,60),vx:Math.cos(ang)*spd,vy:Math.sin(ang)*spd-2,life:44,maxLife:44,particle:true,color:rndChoice(["#c9a165","#7a5a30","#e8cfa0"])});
      }
      screenShake=Math.max(screenShake,32);
    }
    if(this.deathTimer<=0){this.dead=true;this.dying=false;}
  }
  // ---- Ma Long Vực Thẳm (Abyssal Shadow Dragon) — AI, combat & movement ----
  _update3(player){
    this.wingAngle=(this.wingAngle+4.5)%360;
    this.neckSway=Math.sin(this.anim*0.03)*8;
    this.tailSway=Math.sin(this.anim*0.025)*10;
    this.hoverOffset=Math.sin(this.anim*0.035)*16;
    if(this.hp<=this.maxHp*0.5&&this.phase===1){this.phase=2;screenShake=Math.max(screenShake,30);}
    const isP2=this.phase===2,s=this.skillTimer;

    // Bay lượn giữ khoảng cách lý tưởng với người chơi (trừ khi đang lao xuống)
    if(!this.slamActive){
      const dx=player.x-this.x,spd=isP2?3.4:2.4,ideal=260;
      if(Math.abs(dx)>ideal+60)this.x+=spd*(dx>0?1:-1);
      this.direction=dx>0?1:-1;
      this.y=this.floorY-160+this.hoverOffset;
    }

    // Chiêu 1: Hơi Thở Tử Khí — báo trước rồi phun luồng khí độc tím theo hướng nhìn (nhiều hạt, kéo dài hơn để dễ thấy)
    if(s.breath<=0&&this.breathWarn<=0&&this.breathActive<=0){s.breath=isP2?310:390;this.breathWarn=48;this._breathDir=this.direction;}
    if(this.breathWarn>0){this.breathWarn--; if(this.breathWarn===0)this.breathActive=isP2?110:85;}
    if(this.breathActive>0){
      this.breathActive--;
      if(player.hp>0){
        const dirOk=this._breathDir>0?player.x>this.x:player.x<this.x;
        const inCone=dirOk&&Math.abs(player.x-this.x)<(isP2?540:440)&&Math.abs(player.y-this.y)<170;
        if(inCone&&this.anim%5===0)applyDamage(player,isP2?3:2,null);
      }
      // phun dày đặc nhiều hạt khí độc kích thước khác nhau, bay chậm và tồn tại lâu hơn để dễ nhận biết
      for(let i=0;i<3;i++){
        const life=36+rndInt(0,14);
        this.emberParticles.push({x:this.x+this._breathDir*(40+rndInt(0,24)),y:this.y-30+rndInt(-28,28),vx:this._breathDir*(4.5+rng()*4.5),vy:rndInt(-2,2)*0.6,life,maxLife:life,r:6+rng()*7});
      }
    }
    _compact(this.emberParticles,p=>{p.x+=p.vx;p.y+=p.vy;p.vy*=0.98;p.life--;return p.life>0;});

    // Chiêu 2: Bổ Nhào Vực Thẳm — bay vọt lên rồi lao bổ xuống vị trí người chơi, tạo dư chấn + gai bóng tối
    if(!this.slamActive&&s.slam<=0){
      s.slam=isP2?300:390;this.slamActive=true;this.slamHitDone=false;this.slamPhaseTimer=0;
      this.slamTargetX=player.x;this.slamTargetY=this.floorY-30;this._slamRiseY=this.floorY-320;
    }
    if(this.slamActive){
      this.slamPhaseTimer++;
      if(this.slamPhaseTimer<26){
        this.y+=(this._slamRiseY-this.y)*0.12;
      }else{
        const dx=this.slamTargetX-this.x,dy=this.slamTargetY-this.y,d=Math.max(1,Math.hypot(dx,dy)),spd=isP2?15:12;
        this.x+=dx/d*spd;this.y+=dy/d*spd;
        if(d<40){
          this.slamActive=false;screenShake=Math.max(screenShake,24);
          if(!this.slamHitDone){
            this.slamHitDone=true;
            if(player.hp>0&&Math.abs(this.x-player.x)<130){applyDamage(player,isP2?15:11,null);player.x=clamp(player.x+(player.x>this.x?1:-1)*180,roadCameraX+40,roadCameraX+W-40);}
            // nhiều gai bóng tối cao thấp khác nhau, tồn tại lâu để người chơi dễ nhận biết rồi mới tan dần
            for(let i=0;i<6;i++)this.groundSpikes.push({x:this.x+rndInt(-160,160),rise:0,h:rndInt(45,115),life:130,maxLife:130,hit:false});
          }
        }
      }
    }
    _compact(this.groundSpikes,sp=>{
      if(sp.rise<1)sp.rise=Math.min(1,sp.rise+0.1);
      sp.life--;
      if(!sp.hit&&sp.rise>=1&&player.hp>0&&Math.abs(sp.x-player.x)<28){applyDamage(player,isP2?4:3,null);sp.hit=true;}
      return sp.life>0;
    });

    // Chiêu 3: Quét Đuôi — khi người chơi lại gần, quật đuôi hất văng ra
    if(!this.slamActive&&this.tailWarn<=0&&this.tailActive<=0&&s.tail<=0&&Math.abs(player.x-this.x)<190){
      s.tail=isP2?170:230;this.tailWarn=22;this.tailHitDone=false;
    }
    if(this.tailWarn>0){this.tailWarn--; if(this.tailWarn===0)this.tailActive=16;}
    if(this.tailActive>0){
      this.tailActive--;
      if(!this.tailHitDone&&this.tailActive===8&&player.hp>0&&Math.abs(player.x-this.x)<200){
        this.tailHitDone=true;applyDamage(player,isP2?9:6,null);
        player.x=clamp(player.x+(player.x>this.x?1:-1)*140,roadCameraX+40,roadCameraX+W-40);
      }
    }

    // Chiêu 4: Gầm Thét Vực Thẳm — Lồng Giam Bóng Tối: rồng phát ánh sáng tím, người chơi bị dây xích đen bao quanh,
    // không thể di chuyển / dùng chiêu trong 3 giây (180 khung hình ở 60fps)
    if(!this.slamActive&&s.roar<=0&&this.roarWarn<=0&&this.roarActive<=0){s.roar=isP2?540:660;this.roarWarn=55;}
    if(this.roarWarn>0){
      this.roarWarn--;
      if(this.roarWarn===0){
        this.roarActive=180;
        this.prisonX=player.x;this.prisonY=player.y;
        if(player.hp>0)player.stunTimer=Math.max(player.stunTimer,180);
        screenShake=Math.max(screenShake,26);
      }
    }
    if(this.roarActive>0)this.roarActive--;
  }
  draw(){if(this.type===1)this._draw1();else if(this.type===2){if(this.dying)this._drawDeath2();else this._draw2();}else this._draw3();}
  _draw1(){
    const rx=this.x,ry=this.y,pulse=Math.sin(this.bobPhase)*6;
    ctx.save();
    ctx.shadowColor="#7CFC00";ctx.shadowBlur=this.hitFlash>0?30:14;
    const grad=ctx.createRadialGradient(rx-20,ry-140,10,rx,ry-100,140);
    grad.addColorStop(0,"#e8ffcc");grad.addColorStop(0.5,"#9ecb5c");grad.addColorStop(1,"#3f5c1e");
    ctx.fillStyle=grad;
    ctx.beginPath();ctx.ellipse(rx,ry-100,100+pulse*0.3,140+pulse,0,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle="#2b3d10";ctx.lineWidth=4;ctx.stroke();
    ctx.restore();
    for(let i=0;i<5;i++){
      const ang=(i/5)*Math.PI*2+this.anim*0.003;
      ctx.strokeStyle=`rgba(120,200,60,${0.5+0.3*Math.sin(this.anim*0.05+i)})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(rx,ry-100);ctx.lineTo(rx+Math.cos(ang)*80,ry-100+Math.sin(ang)*110);ctx.stroke();
    }
    const embryoPulse=0.4+0.3*Math.sin(this.anim*0.08);
    ctx.save();ctx.globalAlpha=embryoPulse;ctx.fillStyle="#ffee88";ctx.beginPath();ctx.ellipse(rx,ry-110,26,36,0,0,Math.PI*2);ctx.fill();ctx.restore();
    ctx.strokeStyle="#1a2408";ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(rx-40,ry-180);ctx.lineTo(rx-10,ry-140);ctx.lineTo(rx-35,ry-90);ctx.stroke();
    ctx.beginPath();ctx.moveTo(rx+30,ry-190);ctx.lineTo(rx+15,ry-130);ctx.lineTo(rx+45,ry-70);ctx.stroke();
    for(let i=0;i<3;i++){const dripY=ry-40+(this.anim*1.2+i*60)%150;_oval(rx-60+i*55-4,dripY-6,8,14,"#6a8f2a",null);}
    this._drawHpBar(rx,ry,"🥚 MA THÚ TRỨNG","#9ecb5c");
  }
  // ---- Vua Bọ Cạp Cát (Sand Scorpion King) — rendering ----
  _draw2(){
    const rx=this.x,ry=this.y,d=this.direction,a=this.action;
    // bụi cát phía sau khi di chuyển
    this.dustP.forEach(p=>{const al=p.life/p.maxLife;ctx.save();ctx.globalAlpha=al*0.5;_oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,"#cba36a",null);ctx.restore();});
    // cảnh báo Chiêu 1 - Càng Khổng Lồ (vòng đỏ dưới đất)
    if(a==="CLAW_WARN"){
      const t=Math.max(0,this.actionTimer)/48;
      ctx.save();ctx.strokeStyle=`rgba(255,40,40,${0.4+0.5*(1-t)})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(this.clawWarnX,this.floorY,60,16,0,0,Math.PI*2);ctx.stroke();ctx.restore();
    }
    // tia đỏ báo trước Chiêu 2 - Đuôi Độc
    if(a==="TAIL_WARN"){
      ctx.save();ctx.strokeStyle="rgba(255,30,30,0.75)";ctx.lineWidth=3;ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.moveTo(rx,ry-70);ctx.lineTo(rx+d*230,ry-70);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }
    // Bão Cát đang hoạt động
    if(this.sandStormTimer>0){
      const cx=this.sandStormCenterX;
      for(let i=0;i<14;i++){const ang=(this.anim*0.09+i*0.9)%(Math.PI*2),rr=20+ (i%5)*22;
        _oval(cx+Math.cos(ang)*rr-4,this.floorY-40+Math.sin(ang)*rr*0.4-4,8,8,"#d9b478",null);}
      _text(cx,ry-280,"🏜️ BÃO CÁT 🏜️","#d9b478","12px Arial bold");
    }
    ctx.save();
    if(this.hitFlash>0)ctx.filter="brightness(1.7)";
    if(this.armorActive){ctx.shadowColor="#f0c878";ctx.shadowBlur=22;}
    else{ctx.shadowColor="#c9a165";ctx.shadowBlur=10;}

    const bob=Math.sin(this.legPhase)*3;
    // 6 chân
    ctx.strokeStyle="#5a4021";ctx.lineWidth=6;
    for(let i=0;i<3;i++){
      const lx=rx-(i-1)*26*d,legSw=Math.sin(this.legPhase+i)*8;
      ctx.beginPath();ctx.moveTo(lx,ry-50);ctx.lineTo(lx-14*d+legSw,ry-14);ctx.lineTo(lx-24*d+legSw,ry);ctx.stroke();
      ctx.beginPath();ctx.moveTo(lx,ry-50);ctx.lineTo(lx+14*d-legSw,ry-14);ctx.lineTo(lx+24*d-legSw,ry);ctx.stroke();
    }
    // thân — màu vàng nâu cát, giáp dày trên lưng
    const bodyGrad=ctx.createLinearGradient(rx,ry-110,rx,ry-30);
    bodyGrad.addColorStop(0,"#caa46c");bodyGrad.addColorStop(1,"#7a5a30");
    ctx.fillStyle=bodyGrad;ctx.strokeStyle="#4a3218";ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(rx,ry-58+bob,72,44,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    // mảng giáp lưng
    for(let i=0;i<4;i++){
      const px2=rx-40+i*26*d;
      ctx.fillStyle="#8a6838";ctx.beginPath();
      ctx.moveTo(px2-12,ry-78+bob);ctx.lineTo(px2,ry-98+bob);ctx.lineTo(px2+12,ry-78+bob);ctx.closePath();ctx.fill();ctx.stroke();
    }
    // đầu
    const hx=rx+58*d,hy=ry-64+bob;
    ctx.fillStyle="#caa46c";ctx.beginPath();ctx.ellipse(hx,hy,30,26,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    // mắt phát sáng đỏ
    ctx.shadowColor="red";ctx.shadowBlur=10;ctx.fillStyle="#ff2222";
    _oval(hx+10*d-6,hy-8,10,10,"#ff2222",null);_oval(hx+10*d-6,hy+6,10,10,"#ff2222",null);
    ctx.shadowBlur=0;
    // Giáp Cát nội tại — cát xoay quanh cơ thể khi HP<50%
    if(this.armorActive){
      for(let i=0;i<8;i++){
        const ang=this.anim*0.06+i*(Math.PI/4),rr=90;
        _oval(rx+Math.cos(ang)*rr-4,ry-58+Math.sin(ang)*rr*0.5-4,8,8,"rgba(240,200,120,0.75)",null);
      }
    }
    // hai càng
    const clawUp = (a==="CLAW_WARN") ? 1-Math.max(0,this.actionTimer)/48 : (a==="CLAW_STRIKE"?1:0);
    const clawSwing = a==="CLAW_STRIKE"||a==="BASIC_STRIKE"?1:(a==="BASIC_WINDUP"?0.5:0);
    for(const side of[-1,1]){
      const cx2=rx+34*d+side*26,cy2=ry-70+bob-clawUp*40;
      ctx.save();ctx.translate(cx2,cy2);ctx.rotate(side*0.5-clawSwing*side*0.6*d);
      ctx.fillStyle="#8a6838";ctx.strokeStyle="#4a3218";ctx.lineWidth=2.5;
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(24*d,-6);ctx.lineTo(30*d,10);ctx.lineTo(24*d,20);ctx.lineTo(0,14);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    }
    // đuôi cong với kim độc — vươn xa khi Đuôi Độc
    const tailExt = a==="TAIL_STRIKE"?1:(a==="TAIL_WARN"?0.4:0);
    const tx0=rx-40*d,ty0=ry-90+bob;
    ctx.strokeStyle="#7a5a30";ctx.lineWidth=10;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(rx-10*d,ry-70+bob);
    ctx.quadraticCurveTo(tx0-20*d*(1-tailExt*0.5),ty0-40-tailExt*20,tx0-70*d-tailExt*90*d,ty0-50-tailExt*30);
    ctx.stroke();
    const stingerX=tx0-70*d-tailExt*90*d,stingerY=ty0-50-tailExt*30;
    ctx.fillStyle="#3a1010";ctx.strokeStyle="#c00030";ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(stingerX,stingerY-8);ctx.lineTo(stingerX-16*d,stingerY);ctx.lineTo(stingerX,stingerY+8);ctx.closePath();ctx.fill();ctx.stroke();
    ctx.restore();

    // nhãn trạng thái nội tại
    if(this.armorActive)_text(rx,ry-230,"🛡️ GIÁP CÁT","#f0c878","11px Arial bold");
    this._drawHpBar(rx,ry,"🦂 VUA BỌ CẠP CÁT",this.armorActive?"#f0c878":"#c9a165");
  }
  _drawDeath2(){
    const rx=this.x,ry=this.y,t=this.deathTimer;
    if(t>18){
      // gầm lên rồi xuất hiện vết nứt trên toàn thân
      ctx.save();ctx.shadowColor="#c9a165";ctx.shadowBlur=16;
      const bodyGrad=ctx.createLinearGradient(rx,ry-110,rx,ry-30);
      bodyGrad.addColorStop(0,"#caa46c");bodyGrad.addColorStop(1,"#7a5a30");
      ctx.fillStyle=bodyGrad;ctx.strokeStyle="#4a3218";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(rx,ry-58,72,44,0,0,Math.PI*2);ctx.fill();ctx.stroke();
      if(t<=48){
        const crackA=1-(t-18)/30;
        ctx.strokeStyle=`rgba(20,10,0,${0.6+0.4*crackA})`;ctx.lineWidth=2;
        ctx.beginPath();ctx.moveTo(rx-40,ry-80);ctx.lineTo(rx-10,ry-55);ctx.lineTo(rx-30,ry-30);ctx.stroke();
        ctx.beginPath();ctx.moveTo(rx+20,ry-90);ctx.lineTo(rx+10,ry-60);ctx.lineTo(rx+45,ry-35);ctx.stroke();
      }
      if(t>50)_text(rx,ry-240,"🦂 GẦM LÊN 🦂","#ff6a2a","14px Arial bold");
      ctx.restore();
    }else{
      // nổ tung thành cát — bụi cát bay lên rồi tan dần
      const fade=Math.max(0,t)/18;
      ctx.save();ctx.globalAlpha=fade;
      for(let i=0;i<10;i++){_oval(rx-50+rndInt(-10,10)+i*10,ry-60-rndInt(0,40),10,10,"#c9a165",null);}
      ctx.restore();
    }
  }
  // ---- Ma Long Vực Thẳm (Abyssal Shadow Dragon) — rendering ----
  _draw3(){
    const rx=this.x,ry=this.y,isP2=this.phase===2,d=this.direction,sz=isP2?1.3:1.0;

    // gai bóng tối trồi lên từ đất sau đòn Bổ Nhào — cao thấp khác nhau, tồn tại lâu rồi mới tan dần
    this.groundSpikes.forEach(sp=>{
      const h=(sp.h||70)*sp.rise;
      const alpha=sp.life<35?Math.max(0,sp.life/35):1;
      ctx.save();ctx.globalAlpha=alpha;ctx.shadowColor="#a020c0";ctx.shadowBlur=12;
      ctx.fillStyle="#2a0030";ctx.strokeStyle="#c060ff";ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(sp.x-11,this.floorY);ctx.lineTo(sp.x,this.floorY-h);ctx.lineTo(sp.x+11,this.floorY);ctx.closePath();ctx.fill();ctx.stroke();
      ctx.restore();
    });

    // báo trước Hơi Thở Tử Khí
    if(this.breathWarn>0){
      const t=this.breathWarn/48;
      ctx.save();ctx.strokeStyle=`rgba(160,0,220,${0.35+0.4*(1-t)})`;ctx.lineWidth=3;ctx.setLineDash([8,5]);
      ctx.beginPath();ctx.moveTo(rx+this._breathDir*30,ry-90);ctx.lineTo(rx+this._breathDir*480,ry-90);ctx.stroke();ctx.setLineDash([]);ctx.restore();
      _text(rx,ry-235,"🔥 HÍT HƠI TỬ KHÍ 🔥","#c060ff","12px Arial bold");
    }
    // luồng khí độc đang phun
    if(this.breathActive>0){
      ctx.save();
      const grad=ctx.createLinearGradient(rx,ry-90,rx+this._breathDir*450,ry-90);
      grad.addColorStop(0,"rgba(180,40,255,0.85)");grad.addColorStop(1,"rgba(60,0,90,0)");
      ctx.fillStyle=grad;
      ctx.beginPath();ctx.moveTo(rx+this._breathDir*20,ry-130);ctx.lineTo(rx+this._breathDir*(isP2?480:400),ry-90);ctx.lineTo(rx+this._breathDir*20,ry-50);ctx.closePath();ctx.fill();
      ctx.restore();
    }
    this.emberParticles.forEach(p=>{
      const al=p.life/p.maxLife;
      ctx.save();ctx.globalAlpha=al;ctx.shadowColor="#c060ff";ctx.shadowBlur=14;
      _oval(p.x-p.r,p.y-p.r,p.r*2,p.r*2,al>0.55?"#e6b3ff":"#a020c0",null);
      ctx.restore();
    });

    // báo trước Quét Đuôi
    if(this.tailWarn>0){
      ctx.save();ctx.strokeStyle="rgba(200,40,255,0.7)";ctx.lineWidth=3;ctx.setLineDash([6,4]);
      ctx.beginPath();ctx.moveTo(rx,ry+10);ctx.lineTo(rx-d*220,ry+10);ctx.stroke();ctx.setLineDash([]);ctx.restore();
    }

    // báo trước & hiệu ứng Lồng Giam Bóng Tối
    if(this.roarWarn>0)_text(rx,ry-220,"🐉 CHUẨN BỊ GẦM 🐉","#c060ff","13px Arial bold");
    if(this.roarActive>0){
      const px=this.prisonX,py=this.prisonY,t=this.roarActive;
      const appearT=Math.min(1,(180-t)/18);   // lồng hiện ra dần trong ~0.3s đầu
      const fadeT=t<25?Math.max(0,t/25):1;    // mờ dần trong ~25 khung cuối trước khi tan
      const a=appearT*fadeT;
      ctx.save();ctx.globalAlpha=a;
      // ánh sáng tím tỏa ra từ rồng trước khi bao trùm người chơi
      ctx.strokeStyle="rgba(192,96,255,0.55)";ctx.lineWidth=2;ctx.shadowColor="#c060ff";ctx.shadowBlur=24;
      ctx.beginPath();ctx.moveTo(rx,ry-90);ctx.lineTo(px,py-60);ctx.stroke();
      // vòng ma pháp tím dưới chân người chơi
      ctx.strokeStyle="#c060ff";ctx.lineWidth=3;
      ctx.beginPath();ctx.ellipse(px,py+6,52,16,0,0,Math.PI*2);ctx.stroke();
      // vòm năng lượng tím bao quanh
      ctx.strokeStyle="rgba(192,96,255,0.45)";ctx.lineWidth=2;ctx.shadowBlur=16;
      ctx.beginPath();ctx.ellipse(px,py-70,62,92,0,0,Math.PI*2);ctx.stroke();
      // các dây xích đen quấn quanh, lắc nhẹ, siết chặt dần
      ctx.shadowBlur=0;
      const chainCount=8;
      for(let i=0;i<chainCount;i++){
        const ang=(i/chainCount)*Math.PI*2+this.anim*0.015;
        const baseX=px+Math.cos(ang)*36,baseTopY=py-150;
        ctx.strokeStyle="#0a0a0a";ctx.lineWidth=4;ctx.lineCap="round";
        ctx.beginPath();ctx.moveTo(baseX,baseTopY);
        for(let seg=1;seg<=7;seg++){
          const segY=baseTopY+seg*20;
          const wobble=Math.sin(this.anim*0.28+seg*1.3+i)*4;
          ctx.lineTo(baseX+wobble,segY);
        }
        ctx.stroke();
        for(let seg=1;seg<7;seg+=2){
          const segY=baseTopY+seg*20;
          _oval(baseX-4,segY-4,8,8,"#1a1a1a",null);
        }
      }
      ctx.restore();
      _text(px,py-200,"⛓ GIAM CẦM BÓNG TỐI ⛓","#c060ff","13px Arial bold");
    }

    // ---- cánh: màng gai góc cạnh, phát sáng mạnh hơn ở phase 2 ----
    const wf=Math.sin(this.wingAngle*Math.PI/180)*55;
    ctx.save();ctx.shadowColor=isP2?"#c060ff":"#5a0090";ctx.shadowBlur=isP2?26:14;
    ctx.fillStyle="#0d0018";ctx.strokeStyle=isP2?"#c060ff":"#7a20a0";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(rx-25*sz,ry-110*sz);ctx.lineTo(rx-190*sz,ry-170*sz+wf);ctx.lineTo(rx-150*sz,ry-110*sz+wf*0.5);
    ctx.lineTo(rx-165*sz,ry-60*sz);ctx.lineTo(rx-110*sz,ry-70*sz);ctx.lineTo(rx-80*sz,ry-40*sz);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx+25*sz,ry-110*sz);ctx.lineTo(rx+190*sz,ry-170*sz+wf);ctx.lineTo(rx+150*sz,ry-110*sz+wf*0.5);
    ctx.lineTo(rx+165*sz,ry-60*sz);ctx.lineTo(rx+110*sz,ry-70*sz);ctx.lineTo(rx+80*sz,ry-40*sz);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.restore();

    // ---- đuôi dài, đung đưa, mũi nhọn ở cuối ----
    ctx.save();ctx.strokeStyle="#0d0018";ctx.lineWidth=16*sz;ctx.lineCap="round";
    const td=-d,tailX=rx+td*60,tailY=ry+20*sz+this.tailSway;
    ctx.beginPath();ctx.moveTo(rx,ry+10*sz);ctx.quadraticCurveTo(rx+td*50,ry+40*sz,tailX,tailY);ctx.stroke();
    ctx.strokeStyle=isP2?"#c060ff":"#7a20a0";ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(tailX,tailY-14);ctx.lineTo(tailX+td*22,tailY);ctx.lineTo(tailX,tailY+14);ctx.stroke();
    ctx.restore();

    // ---- thân: vảy tối, viền phát sáng, gai sống lưng ----
    const bodyGrad=ctx.createLinearGradient(rx,ry-150*sz,rx,ry-20);
    bodyGrad.addColorStop(0,"#241033");bodyGrad.addColorStop(0.6,"#12061e");bodyGrad.addColorStop(1,"#05000a");
    ctx.save();ctx.shadowColor=isP2?"#c060ff":"#4a1070";ctx.shadowBlur=isP2?18:8;
    ctx.fillStyle=bodyGrad;ctx.strokeStyle=isP2?"#c060ff":"#5a1090";ctx.lineWidth=3;
    ctx.beginPath();ctx.ellipse(rx,ry-70*sz,60*sz,80*sz,0,0,Math.PI*2);ctx.fill();ctx.stroke();
    ctx.restore();
    for(let i=0;i<5;i++){
      const px2=rx-40*sz+i*22*sz,pyBase=ry-120*sz+Math.abs(i-2)*10*sz;
      ctx.fillStyle=isP2?"#c060ff":"#7a20a0";
      ctx.beginPath();ctx.moveTo(px2-8,pyBase+14);ctx.lineTo(px2,pyBase-10);ctx.lineTo(px2+8,pyBase+14);ctx.closePath();ctx.fill();
    }

    // ---- cổ dài uốn lượn + đầu rồng: sừng, mắt đỏ phát sáng ----
    const hx=rx+50*d*sz,hy=ry-150*sz+this.neckSway;
    ctx.save();ctx.strokeStyle="#12061e";ctx.lineWidth=30*sz;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(rx+10*d,ry-90*sz);ctx.quadraticCurveTo(rx+30*d,ry-130*sz,hx,hy+10);ctx.stroke();
    ctx.restore();
    ctx.save();ctx.shadowColor=isP2?"#ff2244":"#c00030";ctx.shadowBlur=isP2?18:8;
    ctx.fillStyle="#150022";ctx.strokeStyle=isP2?"#c060ff":"#7a20a0";ctx.lineWidth=3;
    ctx.beginPath();
    ctx.moveTo(hx-30,hy);ctx.lineTo(hx+40*d,hy-16);ctx.lineTo(hx+70*d,hy+6);ctx.lineTo(hx+38*d,hy+22);ctx.lineTo(hx-25,hy+26);ctx.closePath();
    ctx.fill();ctx.stroke();
    ctx.restore();
    ctx.strokeStyle=isP2?"#c060ff":"#7a20a0";ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(hx-14,hy-6);ctx.lineTo(hx-30,hy-46);ctx.stroke();
    ctx.beginPath();ctx.moveTo(hx+6,hy-10);ctx.lineTo(hx-2,hy-50);ctx.stroke();
    ctx.save();ctx.shadowColor="#ff2244";ctx.shadowBlur=12;
    _oval(hx+18*d-6,hy-4,12,10,isP2?"#ff4466":"#ff2244",null);
    ctx.restore();

    this._drawHpBar(rx,ry,`🐉 MA LONG VỰC THẲM (P${this.phase})`,isP2?"#c060ff":"#7a20a0",true);
  }
  _drawHpBar(rx,ry,label,color,wide){
    this._hpLabel = label;
    this._hpColor = color;
  }
}

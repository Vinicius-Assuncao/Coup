const ROLE_NAMES={duque:'Duque',assassino:'Assassino',capitao:'Capitão',condessa:'Condessa',embaixador:'Embaixador',inquisidor:'Inquisidor'};

// smart: usa raciocínio sobre as cartas | catch: chance de o bot ser pego blefando | noise: aleatoriedade | bluff: blefe em bloqueios
const DIFF={
  facil:{smart:false,catch:.15,noise:.35,block:.6,bluff:.15},
  medio:{smart:true,catch:.3,noise:.15,block:.8,bluff:.2},
  dificil:{smart:true,catch:.4,noise:.05,block:.92,bluff:.25}
};

const ACT={
  renda:{name:'Renda (+1)',cost:0},
  ajuda:{name:'Ajuda Externa (+2)',cost:0,blockers:['duque']},
  golpe:{name:'Golpe de Estado (pagar 7)',cost:7,target:true,unstoppable:true},
  taxas:{name:'Duque: Taxas (+3)',cost:0,role:'duque'},
  assassinar:{name:'Assassino: Assassinar (pagar 3)',cost:3,role:'assassino',target:true,blockers:['condessa']},
  extorquir:{name:'Capitão: Extorquir (2)',cost:0,role:'capitao',target:true,blockers:['capitao','embaixador']},
  trocar:{name:'Trocar',cost:0,role:'EX'},
  investigar:{name:'Inquisidor: Investigar',cost:0,role:'inquisidor',target:true}
};
const ROLE_ICON={duque:'👑',assassino:'🗡️',capitao:'🛡️',condessa:'👸',embaixador:'📜',inquisidor:'👁️'};
const ICON={renda:'💰',ajuda:'🤝',golpe:'⚔️',taxas:ROLE_ICON.duque,assassinar:ROLE_ICON.assassino,extorquir:ROLE_ICON.capitao,investigar:ROLE_ICON.inquisidor};

const ART={
  duque:'<path d="M26 62 L26 32 L43 46 L55 22 L67 46 L84 32 L84 62Z" fill="#e0a420" stroke="#7a4f08" stroke-width="2" stroke-linejoin="round"/><rect x="26" y="62" width="58" height="8" fill="#b07a10"/><circle cx="55" cy="46" r="3" fill="#b5487f"/><circle cx="36" cy="52" r="2.5" fill="#fff"/><circle cx="74" cy="52" r="2.5" fill="#fff"/>',
  assassino:'<path d="M55 6 L63 52 L55 58 L47 52Z" fill="#c9d1dc" stroke="#3f4a5a" stroke-width="2" stroke-linejoin="round"/><path d="M55 8 L55 54" stroke="#fff" stroke-width="1.5" opacity=".7"/><rect x="34" y="52" width="42" height="6" rx="3" fill="#3f4a5a"/><rect x="51" y="58" width="8" height="16" rx="2" fill="#2a313c"/><circle cx="55" cy="78" r="3" fill="#e0a420"/>',
  capitao:'<path d="M55 10 L82 20 L80 44 Q76 62 55 72 Q34 62 30 44 L28 20Z" fill="#2f7fb3" stroke="#1d4f72" stroke-width="2.5" stroke-linejoin="round"/><path d="M55 20 L55 62" stroke="#dbe9f5" stroke-width="4"/><path d="M40 36 L70 36" stroke="#dbe9f5" stroke-width="4"/><circle cx="55" cy="36" r="4" fill="#e0a420"/>',
  condessa:'<path d="M28 80 Q28 36 55 32 Q82 36 82 80Z" fill="#b9372f" stroke="#6e1f19" stroke-width="2"/><circle cx="55" cy="46" r="12" fill="#f5d0b0" stroke="#7a2e24" stroke-width="1.5"/><path d="M38 40 Q40 22 55 20 Q70 22 72 40" fill="none" stroke="#e0a420" stroke-width="3.5" stroke-linecap="round"/><circle cx="51" cy="46" r="1.6" fill="#3b2a3a"/><circle cx="59" cy="46" r="1.6" fill="#3b2a3a"/><path d="M51 52 Q55 55 59 52" stroke="#b9372f" stroke-width="1.6" fill="none"/>',
  embaixador:'<rect x="32" y="14" width="46" height="50" rx="5" fill="#fdf6e3" stroke="#1f7a50" stroke-width="2.5"/><circle cx="32" cy="39" r="6" fill="#2e9e6a" stroke="#1f7a50" stroke-width="2"/><circle cx="78" cy="39" r="6" fill="#2e9e6a" stroke="#1f7a50" stroke-width="2"/><path d="M41 28 H69 M41 38 H69 M41 48 H60" stroke="#2e9e6a" stroke-width="3.5" stroke-linecap="round"/><path d="M48 66 L55 78 L62 66" fill="#2e9e6a"/>',
  inquisidor:'<path d="M14 42 Q55 6 96 42 Q55 78 14 42Z" fill="#fff8d8" stroke="#a87900" stroke-width="3"/><circle cx="55" cy="42" r="17" fill="#e5b72e" stroke="#a87900" stroke-width="2.5"/><circle cx="55" cy="42" r="7" fill="#5b4300"/><circle cx="60" cy="37" r="3" fill="#fff"/>'
};
const CARD_INFO={
  duque:{c:'#b5487f',bg:'#f8e3ee',e:'Taxas: pega 3 moedas. Bloqueia Ajuda Externa.'},
  assassino:{c:'#3f4a5a',bg:'#e3e8ef',e:'Assassinar: paga 3 e tira 1 influência do alvo.'},
  capitao:{c:'#2f7fb3',bg:'#dcebf6',e:'Extorquir: rouba 2 moedas. Bloqueia Extorsão.'},
  condessa:{c:'#b9372f',bg:'#f7dcd8',e:'Bloqueia Assassinato.'},
  embaixador:{c:'#2e9e6a',bg:'#d9f0e4',e:'Trocar: pega 2 cartas da Corte e troca com as suas.'},
  inquisidor:{c:'#d6a514',bg:'#fff1bd',e:'Trocar ou Investigar.'}
};
const BACK=`<div class="cd back"><svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice"><defs><pattern id="pt" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M8 0L16 8L8 16L0 8Z" fill="none" stroke="#c9a85c" stroke-width="1.2"/></pattern></defs><rect width="100" height="150" fill="url(#pt)"/><circle cx="50" cy="75" r="22" fill="#3b2a3a" stroke="#e0b04a" stroke-width="3"/><text x="50" y="83" text-anchor="middle" font-size="24" fill="#e0b04a" font-family="Cinzel,serif" font-weight="700">C</text></svg></div>`;

// ---------- Estado ----------
let P=[],deck=[],treasury=0,EX='embaixador',DF=DIFF.medio,turn=0;
let KN={}; // Papéis que cada jogador já provou não ter.
let BOT_MEMORY={}; // Bloqueios que ensinaram os bots a evitar repetir uma ação contra o mesmo alvo.

const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const roleName=r=>ROLE_NAMES[r];
const roleButtonClass=r=>`role-${r}`;
const roleOf=k=>{const r=ACT[k].role;return r==='EX'?EX:r;};
const actionRole=k=>ACT[k]?.role?roleOf(k):null;
const actionName=k=>k==='trocar'?`${roleName(EX)}: Trocar`:ACT[k].name;
const actionIcon=k=>k==='trocar'?ROLE_ICON[EX]:(ICON[k]||'');
const blockersOf=k=>{
  const blockers=(ACT[k].blockers||[]).map(r=>r==='EX'?EX:r);
  if(k==='extorquir'&&EX==='inquisidor')return blockers.filter(r=>r==='capitao');
  return blockers;
};
const alive=()=>P.filter(p=>p.alive);
const hidden=p=>p.cards.filter(c=>!c.dead);
const holds=(p,r)=>hidden(p).some(c=>c.role===r);
const rand=n=>Math.floor(Math.random()*n);
const pickRandom=a=>a[rand(a.length)];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=rand(i+1);[a[i],a[j]]=[a[j],a[i]];}}
function fx(k){const f=$('fx');f.className='';void f.offsetWidth;f.className='on-'+k;}
async function step(){await sleep(1100);}
function learn(name,r){(KN[name]=KN[name]||new Set()).add(r);}
const knows=(p,r)=>!!(KN[p.name]&&KN[p.name].has(r));

// ---------- Raciocínio dos bots ----------
const countDead=r=>P.reduce((n,p)=>n+p.cards.filter(x=>x.dead&&x.role===r).length,0);
// Quantas cópias de um papel ainda podem estar com outros jogadores ou no baralho (do ponto de vista de c)
const unseenCount=(c,r)=>5-countDead(r)-hidden(c).filter(x=>x.role===r).length;
// Probabilidade estimada de que o jogador claimer tenha o papel r
function prior(c,claimer,r){
  const u=unseenCount(c,r);
  if(u<=0)return 0;
  const U=deck.length+P.filter(x=>x!==c).reduce((n,x)=>n+hidden(x).length,0);
  if(U<=0)return 0;
  return 1-Math.pow(1-u/U,hidden(claimer).length);
}

function botChallenge(c,claimer,role,affects){
  // Se todas as cópias do papel já são conhecidas, a alegação é mentira com certeza
  if(unseenCount(c,role)<=0)return true;
  let p=prior(c,claimer,role);
  if(knows(claimer,role))p=.03;
  let want=((1-p)-.5)*2.2;          // só desafia quando é bem provável que seja mentira
  if(!affects)want*=.25;             // ação que não afeta o bot: quase nunca desafia
  if(hidden(c).length===1)want-=.15; // com uma carta só, cauteloso (perder é eliminação)
  if(!DF.smart)want*=.6;
  want=Math.min(.95,Math.max(0,want));
  if(Math.random()<DF.noise)return Math.random()<.25; // erro ocasional
  return Math.random()<want;
}

function botMemory(p){
  if(!BOT_MEMORY[p.name])BOT_MEMORY[p.name]={blocked:Object.create(null)};
  return BOT_MEMORY[p.name];
}
function wasBlockedFor(p,type,target){
  return !!(target&&BOT_MEMORY[p.name]?.blocked[`${type}:${target.name}`]);
}
function rememberBlockedAction(actor,target,type){
  if(!actor||actor.human||!target)return;
  const memory=botMemory(actor);
  const key=`${type}:${target.name}`;
  memory.blocked[key]=(memory.blocked[key]||0)+1;
}
function clearBlockedMemoryFor(target){
  if(!target)return;
  for(const memory of Object.values(BOT_MEMORY)){
    for(const key of Object.keys(memory.blocked)){
      if(key.endsWith(`:${target.name}`))delete memory.blocked[key];
    }
  }
}

function botBlock(c,blockers,act){
  const has=blockers.filter(r=>holds(c,r));
  const threat=act.target===c;
  if(has.length){
    const pb=threat?.92:(act.type==='ajuda'?.7:.1);
    if(Math.random()<pb*(1-DF.noise))return has[0];
    return null;
  }
  // Um bot não repete um blefe de bloqueio com uma carta que já provou não ter.
  const bluffOptions=blockers.filter(r=>!knows(c,r));
  if(threat&&act.type!=='golpe'&&hidden(c).length>1&&bluffOptions.length&&Math.random()<DF.bluff){
    return bluffOptions[0];
  }
  return null;
}

function botAction(p){
  const opp=alive().filter(x=>x!==p);
  const hc=hidden(p).length;
  const pc=DF.catch+(hc===1?.1:0);
  const loss=hc===1?8:4;
  const weigh=(ev,role)=>holds(p,role)?ev:ev*(1-pc)-pc*loss;

  let noBlock=1;
  if(!holds(p,'duque'))opp.forEach(x=>{noBlock*=(1-prior(p,x,'duque'));});

  const threat=DF.smart
    ? opp.slice().sort((a,b)=>hidden(a).length-hidden(b).length||b.coins-a.coins)[0]
    : pickRandom(opp);
  const rankTarget=(type,score)=>{
    const available=opp.filter(x=>!wasBlockedFor(p,type,x));
    const pool=available.length?available:opp;
    return DF.smart
      ? pool.slice().sort((a,b)=>score(b)-score(a))[0]
      : pickRandom(pool);
  };
  const assassinTarget=rankTarget('assassinar',x=>hidden(x).length===1?9:5);
  const rich=rankTarget('extorquir',x=>Math.min(2,x.coins));

  if(p.coins>=10)return {type:'golpe',actor:p,target:threat};

  const cands=[];
  const jitter=()=>(Math.random()*2-1)*DF.noise*4;
  const add=(type,ev,target,role)=>{
    // Depois de ser desafiado e perder, o bot não reivindica aquele papel novamente
    // até que suas cartas mudem. Também evita alvos que já bloquearam a mesma ação.
    if(role&&knows(p,role))return;
    if(target&&wasBlockedFor(p,type,target))ev-=100;
    cands.push({type,target:target||null,ev:(role?weigh(ev,role):ev)+jitter()});
  };

  add('renda',1+(p.coins<3?.5:0));
  const knownHelpBlocker=opp.some(x=>wasBlockedFor(p,'ajuda',x));
  add('ajuda',2*noBlock*(knownHelpBlocker?.15:1));
  add('taxas',3,null,'duque');
  if(p.coins>=3)add('assassinar',(hidden(assassinTarget).length===1?9:5)-1.5,assassinTarget,'assassino');
  add('extorquir',Math.min(2,rich.coins),rich,'capitao');
  add('trocar',1.5,null,EX);
  if(EX==='inquisidor')add('investigar',1,pickRandom(opp),'inquisidor');
  if(p.coins>=7)add('golpe',(hidden(threat).length===1?9:6)-3.5,threat);

  cands.sort((a,b)=>b.ev-a.ev);
  const best=cands[0]||{type:'renda',target:null};
  return {type:best.type,actor:p,target:best.target};
}

// ---------- Interface ----------
function log(t,head){
  const d=document.createElement('p');d.textContent=t;if(head)d.className='head';
  $('log').appendChild(d);$('log').scrollTop=1e9;
  if(!head){const n=$('now');n.textContent=t;n.classList.remove('bump');void n.offsetWidth;n.classList.add('bump');}
}

function ask(msg,options){
  return new Promise(res=>{
    const c=$('controls');c.innerHTML='';
    const p=document.createElement('p');p.textContent=msg;c.appendChild(p);
    options.forEach(o=>{
      const b=document.createElement('button');b.textContent=o.label;
      b.className=[o.className,o.primary?'primary':''].filter(Boolean).join(' ');
      if(o.title)b.title=o.title;
      b.onclick=()=>{c.innerHTML='';res(o.value);};
      c.appendChild(b);
    });
  });
}

function faceHtml(role,dead,fresh,challengeFlip=false){
  const i=CARD_INFO[role];
  return `<div class="cd${dead?' dead':''}${fresh?' new-reveal':''}${challengeFlip?' challenge-reveal':''}" style="border-color:${i.c}">
    <div class="t" style="background:${i.c}">${roleName(role)}</div>
    <svg class="art" viewBox="0 0 110 84" style="background:${i.bg}">${ART[role]}</svg>
    <div class="txt">${i.e}</div></div>`;
}

function seatXY(i,n){
  const a=Math.PI/2+i*2*Math.PI/n;
  const compact=window.matchMedia('(max-width: 700px)').matches;
  if(compact)return {x:50+30*Math.cos(a),y:49+31*Math.sin(a)};
  const horizontalRadius=n>=5?30:(n===4?34:40);
  return {x:50+horizontalRadius*Math.cos(a),y:50+36*Math.sin(a)};
}
function pos(p){return p?seatXY(P.indexOf(p),P.length):{x:50,y:50};}
function layoutSeats(){
  document.querySelectorAll('.seat').forEach(el=>{
    const xy=seatXY(+el.dataset.i,P.length);
    el.style.left=xy.x+'%';
    el.style.top=xy.y+'%';
  });
}

// Cria os assentos uma vez por partida; depois só atualiza o conteúdo
function buildSeats(){
  const seats=$('seats');seats.innerHTML='';
  P.forEach((p,i)=>{
    const xy=seatXY(i,P.length);
    const d=document.createElement('div');
    d.dataset.i=i;
    d.className='seat '+(p.human?'me':'sm');
    d.style.left=xy.x+'%';d.style.top=xy.y+'%';
    const side=p.human?'me':(xy.x<50?'left':'right');
    d.innerHTML=`<div class="bslot ${side}"></div><div class="sname">${p.name}${p.human?' · você':''}</div><div class="scoin"></div><div class="hand"></div>`;
    seats.appendChild(d);
  });
  layoutSeats();
}

function renderHand(p,handEl){
  if(p.human && p.exchangePool){
    handEl.innerHTML='';
    p.cards.filter(c=>c.dead).forEach(c=>{
      const holder=document.createElement('div');
      holder.innerHTML=faceHtml(c.role,true,false);
      handEl.appendChild(holder.firstElementChild);
    });
    p.exchangePool.forEach((role,index)=>{
      const holder=document.createElement('div');
      holder.innerHTML=faceHtml(role,false,false);
      const cardEl=holder.firstElementChild;
      cardEl.classList.add('exchange-choice');
      cardEl.dataset.poolIndex=String(index);
      if(p.exchangeSelection?.has(index))cardEl.classList.add('exchange-selected');
      cardEl.title='Selecionar esta carta';
      cardEl.onclick=()=>{
        if(!p.exchangeSelection)p.exchangeSelection=new Set();
        if(p.exchangeSelection.has(index))p.exchangeSelection.delete(index);
        else if(p.exchangeSelection.size<p.exchangeKeep)p.exchangeSelection.add(index);
        renderHand(p,handEl);
        const count=p.exchangeSelection.size;
        const status=$('exchange-status');
        if(status)status.textContent=`Selecione ${p.exchangeKeep} carta(s) para manter (${count}/${p.exchangeKeep}).`;
        const confirm=$('exchange-confirm');
        if(confirm)confirm.disabled=count!==p.exchangeKeep;
      };
      handEl.appendChild(cardEl);
    });
    return;
  }
  p.cards.forEach((c,index)=>{
    const visible=c.dead||(p.human&&!c.faceDown)||c.revealed;
    const state=visible?`${c.role}:${c.dead?'dead':'alive'}:${c.revealed?'shown':''}`:'back';
    const current=handEl.children[index];

    // Atualiza somente a carta que realmente mudou; a troca de turno não recria as mãos.
    if(current&&state==='back'&&current._cardState==='back'&&!current.classList.contains('swap-source-hidden')){
      current._cardRef=c;
    }else if(!current||current._cardRef!==c||current._cardState!==state){
      const holder=document.createElement('div');
      holder.innerHTML=visible?faceHtml(c.role,c.dead,false,!!c.challengeFlip):BACK;
      const next=holder.firstElementChild;
      next._cardRef=c;
      next._cardState=state;
      if(current)current.replaceWith(next);
      else handEl.appendChild(next);
    }else if(c.challengeFlip&&!current.classList.contains('challenge-reveal')){
      current.classList.remove('challenge-reveal');
      void current.offsetWidth;
      current.classList.add('challenge-reveal');
    }
  });
  while(handEl.children.length>p.cards.length){
    handEl.lastElementChild.remove();
  }
}

function render(){
  P.forEach((p,i)=>{
    const d=document.querySelector(`.seat[data-i="${i}"]`);
    if(!d)return;
    d.className='seat '+(p.human?'me':'sm')+(i===turn&&p.alive?' active':'')+(p.alive?'':' out')+(d.querySelector('.badge,.pop')?' event-front':'');

    const coinText=`${p.coins}${p.alive?'':' · fora'}`;
    const coinEl=d.querySelector('.scoin');
    const coinHtml=`<span class="gold"></span>${coinText}`;
    if(coinEl.innerHTML!==coinHtml){
      coinEl.innerHTML=coinHtml;
      coinEl.classList.remove('coin-update');
      void coinEl.offsetWidth;
      coinEl.classList.add('coin-update');
    }

    renderHand(p,d.querySelector('.hand'));
  });
}

// Eventos flutuantes: ficam acima do tabuleiro e do fundo, sem cobrir nomes/cartas.
function seatOf(p){
  const i=P.indexOf(p);
  return document.querySelector(`.seat[data-i="${i}"]`);
}
function eventLayer(){return $('events');}
function intersects(a,b,gap=6){
  return a.left < b.right+gap && a.right+gap > b.left && a.top < b.bottom+gap && a.bottom+gap > b.top;
}
function placeFloatingEvent(el,anchor){
  if(!el||!anchor||!eventLayer())return;
  const anchorRect=anchor.getBoundingClientRect();
  const width=el.offsetWidth||180;
  const height=el.offsetHeight||36;
  const cx=anchorRect.left+anchorRect.width/2;
  const cy=anchorRect.top+anchorRect.height/2;
  const gap=24; // inclui o deslocamento da animação de entrada da tag
  const candidates=[
    [cx,anchorRect.top-height/2-gap],
    [cx,anchorRect.bottom+height/2+gap],
    [anchorRect.left-width/2-gap,cy],
    [anchorRect.right+width/2+gap,cy],
    [cx-width*.42,anchorRect.top-height/2-gap],
    [cx+width*.42,anchorRect.top-height/2-gap],
    [cx-width*.42,anchorRect.bottom+height/2+gap],
    [cx+width*.42,anchorRect.bottom+height/2+gap],
    [cx,anchorRect.top-height/2-gap-height*.8],
    [cx,anchorRect.bottom+height/2+gap+height*.8]
  ];
  const obstacles=[
    ...[...document.querySelectorAll('.seat,.side')].map(x=>x.getBoundingClientRect()),
    ...[...eventLayer().children].filter(x=>x!==el).map(x=>x.getBoundingClientRect())
  ];
  let best=null,bestScore=Infinity;
  for(const [rawX,rawY] of candidates){
    const x=Math.max(width/2+8,Math.min(innerWidth-width/2-8,rawX));
    const y=Math.max(height/2+8,Math.min(innerHeight-height/2-8,rawY));
    const rect={left:x-width/2,right:x+width/2,top:y-height/2,bottom:y+height/2};
    let score=0;
    for(const obstacle of obstacles){
      if(intersects(rect,obstacle,7)){
        const overlapW=Math.max(0,Math.min(rect.right,obstacle.right)-Math.max(rect.left,obstacle.left));
        const overlapH=Math.max(0,Math.min(rect.bottom,obstacle.bottom)-Math.max(rect.top,obstacle.top));
        score+=Math.max(1,overlapW*overlapH);
      }
    }
    if(score<bestScore){bestScore=score;best={x,y};}
    if(score===0)break;
  }
  if(!best)best={x:Math.max(width/2+8,Math.min(innerWidth-width/2-8,cx)),y:Math.max(height/2+8,Math.min(innerHeight-height/2-8,cy))};
  el.style.left=`${best.x}px`;
  el.style.top=`${best.y}px`;
  el.dataset.anchorIndex=String(P.indexOf(P.find(p=>seatOf(p)===anchor)));
  return bestScore===0;
}
function repositionEvents(){
  if(!P.length)return;
  [...(eventLayer()?.children||[])].forEach(el=>{
    const p=P[Number(el.dataset.anchorIndex)];
    const anchor=p&&seatOf(p);
    if(anchor)placeFloatingEvent(el,anchor);
  });
}
function attachFloatingEvent(el,p){
  const anchor=seatOf(p),layer=eventLayer();
  if(!anchor||!layer)return false;
  el.style.visibility='hidden';
  layer.appendChild(el);
  const clearPosition=placeFloatingEvent(el,anchor);
  el.dataset.positionSafe=String(clearPosition);
  el.style.visibility='visible';
  return true;
}

function badge(p,txt,cls){
  const b=document.createElement('div');
  b.className='badge '+(cls||'');
  b.textContent=txt;
  if(!attachFloatingEvent(b,p))return;
  setTimeout(()=>b.remove(),1900);
}

// Popup de decisão ancorado ao jogador, mas renderizado em uma camada fora do tabuleiro.
function askPop(anchor,msg,options){
  return new Promise(res=>{
    const box=document.createElement('div');
    box.className='pop';
    const m=document.createElement('div');m.className='popmsg';m.textContent=msg;
    box.appendChild(m);
    options.forEach(o=>{
      const b=document.createElement('button');b.textContent=o.label;
      b.className=[o.className,o.primary?'primary':''].filter(Boolean).join(' ');
      if(o.title)b.title=o.title;
      b.onclick=()=>{
        box.remove();
        res(o.value);
      };
      box.appendChild(b);
    });
    // Popups permanecem na camada flutuante do tabuleiro em qualquer tamanho de tela.
    // Não são movidos para uma área fixa acima dos botões.
    const attached=attachFloatingEvent(box,anchor);
    if(!attached){res(null);return;}
  });
}

// Escolha de alvo clicando diretamente no jogador na mesa
function askTarget(p,msg){
  return new Promise(res=>{
    log(msg);
    document.querySelectorAll('.seat').forEach(el=>{
      const t=P[+el.dataset.i];
      if(t!==p&&t.alive){
        el.classList.add('targetable');
        el.onclick=()=>{clearTargets();res(t);};
      }
    });
  });
}
function clearTargets(){
  document.querySelectorAll('.seat').forEach(el=>{el.classList.remove('targetable');el.onclick=null;});
}

function pointInsideTable(element){
  const table=$('table');
  const tableRect=table.getBoundingClientRect();
  const rect=element.getBoundingClientRect();
  const originX=tableRect.left+table.clientLeft;
  const originY=tableRect.top+table.clientTop;
  return {
    x:((rect.left+rect.width/2-originX)/table.clientWidth)*100,
    y:((rect.top+rect.height/2-originY)/table.clientHeight)*100
  };
}
function handCardPoints(p,count){
  const hand=seatOf(p)?.querySelector('.hand');
  if(!hand)return Array.from({length:count},()=>pos(p));
  const cards=hidden(p).map(card=>hand.children[p.cards.indexOf(card)]).filter(Boolean);
  return Array.from({length:count},(_,i)=>pointInsideTable(cards.length?cards[i%cards.length]:hand));
}
function nudgePile(pile){
  if(!pile)return;
  pile.classList.remove('pile-motion');
  void pile.offsetWidth;
  pile.classList.add('pile-motion');
}
function coinPoint(p){
  if(p){
    const coin=seatOf(p)?.querySelector('.scoin .gold');
    return coin?pointInsideTable(coin):pos(p);
  }
  const coins=Array.from(document.querySelectorAll('.coin-stack .gold.big'));
  if(!coins.length)return pos(null);
  const boxes=coins.map(coin=>coin.getBoundingClientRect());
  const table=$('table');
  const tableRect=table.getBoundingClientRect();
  const x=(Math.min(...boxes.map(box=>box.left))+Math.max(...boxes.map(box=>box.right)))/2;
  const y=(Math.min(...boxes.map(box=>box.top))+Math.max(...boxes.map(box=>box.bottom)))/2;
  return {
    x:((x-tableRect.left-table.clientLeft)/table.clientWidth)*100,
    y:((y-tableRect.top-table.clientTop)/table.clientHeight)*100
  };
}
function flyingCard(role,point,direction='out'){
  const d=document.createElement('div');
  d.className='fly';
  d.innerHTML=direction==='in'?BACK:faceHtml(role,false,false);
  d.style.left=point.x+'%';
  d.style.top=point.y+'%';
  $('fly').appendChild(d);
  return d;
}
async function animateCardFlight(element,from,to,direction){
  const animation=element.animate([
    {left:from.x+'%',top:from.y+'%',opacity:1,transform:'translate(-50%,-50%) rotate(0deg) scale(1)'},
    {left:to.x+'%',top:to.y+'%',opacity:direction==='out'?.88:1,transform:`translate(-50%,-50%) rotate(${direction==='out'?12:-8}deg) scale(${direction==='out'?.9:1.04})`}
  ],{duration:680,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
  try{await animation.finished;}catch(_error){}
  element.remove();
}
async function animateChallengeExchange(p,index,oldRole,newRole){
  const hand=seatOf(p)?.querySelector('.hand');
  const source=hand?.children[index];
  if(!source)return;
  nudgePile($('deck'));
  const from=pointInsideTable(source);
  const to=pointInsideTable($('deck'));
  source.classList.add('swap-source-hidden');

  // A carta revelada vai ao centro; só depois a nova carta retorna do baralho.
  const outgoing=flyingCard(oldRole,from);
  await animateCardFlight(outgoing,from,to,'out');
  const incoming=flyingCard(newRole,to,'in');
  await animateCardFlight(incoming,to,from,'in');
}

async function animateInvestigationExchange(p,index){
  const hand=seatOf(p)?.querySelector('.hand');
  const source=hand?.children[index];
  if(!source)return;
  nudgePile($('deck'));
  const from=pointInsideTable(source);
  const to=pointInsideTable($('deck'));
  source.classList.add('swap-source-hidden');
  const outgoing=flyingBack(from);
  await animateCardFlight(outgoing,from,to,'out');
  // A nova influência retorna sempre com o verso visível aos demais jogadores.
  const incoming=flyingBack(to);
  await animateCardFlight(incoming,to,from,'in');
}

// Moedas que voam entre o tesouro e os jogadores
function flyCoins(from,to,n){
  if(from===null||to===null)nudgePile($('.coin-stack'));
  const a=coinPoint(from),b=coinPoint(to);
  for(let i=0;i<Math.min(n,6);i++){
    const c=document.createElement('div');
    c.className='coinfly';
    c.style.left=a.x+'%';c.style.top=a.y+'%';
    $('fly').appendChild(c);
    c.animate([
      {left:a.x+'%',top:a.y+'%',opacity:1},
      {left:b.x+'%',top:b.y+'%',opacity:.9}
    ],{duration:900,delay:i*90,easing:'ease-in-out',fill:'forwards'});
    setTimeout(()=>c.remove(),1100+i*90);
  }
}

function renderMinis(){
  const extra=$('variant')?.value||EX;
  $('minis').innerHTML=['duque','assassino','capitao','condessa',extra].map((r,i)=>{
    const rot=[-6,-2,2,5,8][i]+'deg';
    return `<div style="--r:${rot}">${faceHtml(r,false,false)}</div>`;
  }).join('');
}
renderMinis();

// ---------- Partida ----------
function startGame(){
  const n=+$('nBots').value;
  DF=DIFF[$('diff').value];
  EX=$('variant').value;
  renderMinis();
  KN={};
  BOT_MEMORY={};
  $('events').innerHTML='';
  P=[{name:'Você',human:true,coins:0,cards:[],alive:true}];
  for(let i=1;i<=n;i++)P.push({name:'Bot '+i,human:false,coins:0,cards:[],alive:true});
  deck=[];
  for(const r of ['duque','assassino','capitao','condessa',EX])for(let i=0;i<5;i++)deck.push(r);
  shuffle(deck);
  P.forEach(p=>{p.cards=[{role:deck.pop(),dead:false},{role:deck.pop(),dead:false}];});
  treasury=50;
  turn=0;
  $('log').innerHTML='';
  $('setup').hidden=true;
  $('game').hidden=false;
  buildSeats();
  log(`🎲 Jogo iniciado: você contra ${n} bot(s). Carta extra: ${roleName(EX)}.`);
  gameLoop();
}

function nextIdx(i){let n=(i+1)%P.length;while(!P[n].alive)n=(n+1)%P.length;return n;}

async function gameLoop(){
  while(alive().length>1){
    const p=P[turn];
    if(p.alive)await playTurn(p);
    turn=nextIdx(turn);
    render();
  }
  render();
  const w=alive()[0];
  const c=$('controls');c.innerHTML=`<p>🏆 ${w.name} venceu o jogo!</p>`;
  const b=document.createElement('button');b.className='primary';b.textContent='Novo jogo';
  b.onclick=()=>{$('game').hidden=true;$('setup').hidden=false;c.innerHTML='';renderMinis();};
  c.appendChild(b);
}

async function playTurn(p){
  render();
  log(`🎯 Vez de ${p.name} —`,true);
  if(p.human){
    await resolve(await humanAction(p));
  }else{
    $('controls').innerHTML=`<p>${p.name} está pensando...</p>`;
    await sleep(600);
    await resolve(botAction(p));
    await sleep(300);
  }
  render();
}

async function humanAction(p){
  let keys;
  if(p.coins>=10){keys=['golpe'];}
  else{
    keys=['renda','ajuda','taxas','trocar','extorquir'];
    if(p.coins>=3)keys.push('assassinar');
    if(p.coins>=7)keys.push('golpe');
    if(EX==='inquisidor')keys.push('investigar');
  }
  $('controls').classList.add('action-menu');
  const type=await ask(`Sua vez (${p.coins} moedas). Escolha uma ação:`,
    keys.map(k=>{
      const role=actionRole(k);
      const unavailable=role&&!holds(p,role);
      const className=k==='golpe'?'action-coup':role
        ?`action-role role-${role}${unavailable?' action-unavailable':''}`
        :'action-neutral';
      return {label:`${actionIcon(k)} ${actionName(k)}`,value:k,className,
        title:unavailable?`Você não tem ${roleName(role)}; a ação ainda pode ser usada como blefe.`:undefined};
    }));
  $('controls').classList.remove('action-menu');
  const act={type,actor:p};
  if(ACT[type].target)act.target=await askTarget(p,'Clique no jogador alvo:');
  return act;
}

// ---------- Janelas de desafio e bloqueio ----------
// affects(c): se a ação afeta o jogador c (usado pelos bots para decidir se vale desafiar)
async function challengeWindow(claimer,role,affects){
  for(const c of alive().filter(x=>x!==claimer)){
    const want=c.human
      ? await askPop(claimer,`${claimer.name} afirma ser ${roleName(role)}. Desafiar?`,
          [{label:'Desafiar',value:true,primary:true},{label:'Deixar passar',value:false}])
      : botChallenge(c,claimer,role,affects(c));
    if(want){
      fx('gold');
      log(`⚔️ ${c.name} desafia ${claimer.name} (${roleName(role)})!`);
      badge(c,'⚔️ Desafio','gold');
      await step();
      return resolveChallenge(c,claimer,role);
    }
  }
  return true;
}

async function revealChallengeCard(p,card){
  card.revealed=true;
  card.challengeFlip=true;
  render();
  const index=p.cards.indexOf(card);
  const element=seatOf(p)?.querySelector('.hand')?.children[index];
  if(element&&!element.classList.contains('challenge-reveal')){
    element.classList.remove('challenge-reveal');
    void element.offsetWidth;
    element.classList.add('challenge-reveal');
  }
  await sleep(780);
  element?.classList.remove('challenge-reveal');
  card.challengeFlip=false;
}

async function resolveChallenge(ch,cl,role){
  const card=hidden(cl).find(c=>c.role===role);
  if(card){
    log(`✅ ${cl.name} mostra ${roleName(role)}: era verdade e vence o desafio. 💔 ${ch.name} perde uma influência.`);
    badge(cl,'✅ Verdade','ok');
    await revealChallengeCard(cl,card);
    await swapCard(cl,card,{animate:true});
    await loseInfluence(ch);
    return true;
  }
  learn(cl.name,role);
  log(`❌ ${cl.name} não tinha ${roleName(role)}! Perde o desafio.`);
  badge(cl,'❌ Mentira','bad');
  await step();
  await loseInfluence(cl,{challengeReveal:true});
  return false;
}

async function blockWindow(act,blockers){
  const cands=act.type==='ajuda'
    ? alive().filter(x=>x!==act.actor)
    : [act.target].filter(x=>x&&x.alive);
  for(const c of cands){
    let r;
    if(c.human){
      r=await askPop(c,`${act.actor.name} usa ${actionName(act.type)}${act.target?' contra '+act.target.name:''}. Bloquear?`,
        blockers.map(b=>({label:`${ROLE_ICON[b]||'🛡️'} Bloquear com ${roleName(b)}`,value:b,
          className:`${roleButtonClass(b)}${holds(c,b)?'':' action-unavailable'}`,
          title:holds(c,b)?undefined:`Você não tem ${roleName(b)}; ainda pode blefar.`})).concat([{label:'Não bloquear',value:null,className:'neutral'}]));
    }else{
      r=botBlock(c,blockers,act);
    }
    if(!r)continue;
    fx('blue');
    log(`${ROLE_ICON[r]||'🛡️'} ${c.name} afirma ser ${roleName(r)} e bloqueia.`);
    badge(c,`${ROLE_ICON[r]||'🛡️'} Bloqueio`,roleButtonClass(r));
    await step();
    const ok=await challengeWindow(c,r,x=>x===act.actor);
    if(!ok){log('🛡️ O bloqueio falhou.');await step();return null;}
    return {by:c,role:r};
  }
  return null;
}

// ---------- Efeitos ----------
function gain(p,n,icon){
  const g=Math.min(n,treasury);p.coins+=g;treasury-=g;
  log(`${icon} ${p.name} recebe ${g} moeda(s) do Tesouro.`);
  if(g>0){flyCoins(null,p,g);badge(p,'+'+g,'ok');}
}

async function swapCard(p,card,{animate=false,faceDown=false}={}){
  const i=p.cards.indexOf(card);
  if(i<0)return;
  const oldRole=card.role;
  deck.push(oldRole);
  shuffle(deck);
  const newRole=deck.pop();
  if(animate)await animateChallengeExchange(p,i,oldRole,newRole);
  delete KN[p.name];
  clearBlockedMemoryFor(p);
  p.cards[i]={role:newRole,dead:false,revealed:false,faceDown};
  render();
}

async function pickCardByClick(p,cards,message){
  if(!cards.length)return null;
  log(`👆 ${message}`);
  render();
  const hand=seatOf(p)?.querySelector('.hand');
  if(!hand)return cards[0];
  const selectable=cards.map(card=>({card,el:hand.children[p.cards.indexOf(card)]})).filter(x=>x.el);
  selectable.forEach(({el})=>el.classList.add('card-selectable'));
  return await new Promise(resolve=>{
    selectable.forEach(({card,el})=>{
      el.onclick=()=>{
        selectable.forEach(({el:other})=>{other.classList.remove('card-selectable');other.onclick=null;});
        resolve(card);
      };
      el.title='Clique para selecionar esta carta';
    });
  });
}

async function loseInfluence(p,{challengeReveal=false}={}){
  const h=hidden(p);
  if(!h.length)return;
  let card;
  if(h.length===1)card=h[0];
  else if(p.human)card=await pickCardByClick(p,h,'Clique na carta que deseja perder.');
  else{
    const prio=['duque','condessa','capitao','assassino',EX];
    card=h.slice().sort((a,b)=>prio.indexOf(b.role)-prio.indexOf(a.role))[0];
  }
  clearBlockedMemoryFor(p);
  badge(p,'💔 Perde carta','bad');
  card.dead=true;
  card.revealed=!!challengeReveal;
  card.challengeFlip=!!challengeReveal;
  fx('red');
  log(`💔 ${p.name} perde ${roleName(card.role)}.`);
  render();
  if(challengeReveal){
    const index=p.cards.indexOf(card);
    const element=seatOf(p)?.querySelector('.hand')?.children[index];
    if(element&&!element.classList.contains('challenge-reveal')){
      element.classList.remove('challenge-reveal');
      void element.offsetWidth;
      element.classList.add('challenge-reveal');
    }
    await sleep(780);
    element?.classList.remove('challenge-reveal');
    card.challengeFlip=false;
  }
  await step();
  if(!hidden(p).length){
    p.alive=false;treasury+=p.coins;p.coins=0;
    log(`💔 ${p.name} está fora do jogo!`);
    await step();
  }
  render();
}

function flyingBack(point){
  const d=document.createElement('div');
  d.className='fly';d.innerHTML=BACK;
  d.style.left=point.x+'%';d.style.top=point.y+'%';
  $('fly').appendChild(d);return d;
}

async function animateInquisitorDraw(p,count=2,targetCards=[]){
  if(count)nudgePile($('deck'));
  const from=pointInsideTable($('deck'));
  const targets=handCardPoints(p,count);
  for(let i=0;i<count;i++){
    const targetCard=targetCards[i];
    targetCard?.classList.add('exchange-arrival-hidden');
    const to=targetCard?pointInsideTable(targetCard):targets[i];
    const card=flyingBack(from);
    await animateCardFlight(card,from,to,'in');
    targetCard?.classList.remove('exchange-arrival-hidden');
  }
}

async function animateInquisitorReturn(p,count=2,sourceCards=[]){
  if(count)nudgePile($('deck'));
  const sources=handCardPoints(p,count);
  const to=pointInsideTable($('deck'));
  for(let i=0;i<count;i++){
    const sourceCard=sourceCards[i];
    sourceCard?.classList.add('exchange-return-hidden');
    const from=sourceCard?pointInsideTable(sourceCard):sources[i];
    const card=flyingBack(from);
    await animateCardFlight(card,from,to,'out');
  }
}

async function exchange(a){
  delete KN[a.name];
  clearBlockedMemoryFor(a);
  const mine=hidden(a);
  const drawCount=EX==='inquisidor'?1:2;
  const drawn=Array.from({length:drawCount},()=>deck.pop()).filter(x=>x!==undefined);
  const pool=mine.map(c=>c.role).concat(drawn);
  const keep=mine.length;
  let kept=[],returned=[];
  let drawTargets=[],returnSources=[];
  const hand=seatOf(a)?.querySelector('.hand');

  if(a.human){
    a.exchangePool=pool;
    a.exchangeKeep=keep;
    a.exchangeSelection=new Set();
    renderHand(a,hand);
    drawTargets=drawn.map((_,i)=>hand?.querySelector(`[data-pool-index="${mine.length+i}"]`)).filter(Boolean);
  }

  // As cartas compradas viajam sempre com o verso visível para os demais jogadores.
  await animateInquisitorDraw(a,drawn.length,drawTargets);

  if(a.human){
    const controls=$('controls');
    controls.innerHTML='';
    const status=document.createElement('p');
    status.id='exchange-status';
    status.textContent=`Selecione ${keep} carta(s) para manter (0/${keep}).`;
    controls.appendChild(status);
    const confirm=document.createElement('button');
    confirm.id='exchange-confirm';confirm.className='primary';
    confirm.textContent='Confirmar cartas';confirm.disabled=true;
    controls.appendChild(confirm);
    const selection=await new Promise(resolve=>{
      confirm.onclick=()=>resolve([...a.exchangeSelection]);
    });
    kept=selection.map(i=>pool[i]);
    returned=pool.filter((_,i)=>!selection.includes(i));
    returnSources=pool.map((_,i)=>selection.includes(i)?null:hand?.querySelector(`[data-pool-index="${i}"]`)).filter(Boolean);
    delete a.exchangePool;delete a.exchangeKeep;delete a.exchangeSelection;
    controls.innerHTML='';
  }else{
    // O bot escolhe internamente; nenhuma face das cartas compradas é renderizada.
    const prio=['duque','condessa','capitao','assassino',EX];
    const sorted=pool.slice().sort((x,y)=>prio.indexOf(x)-prio.indexOf(y));
    kept=sorted.slice(0,keep);returned=sorted.slice(keep);
  }

  await animateInquisitorReturn(a,returned.length,returnSources);
  mine.forEach((c,i)=>{c.role=kept[i];c.revealed=false;c.challengeFlip=false;});
  deck.push(...returned);shuffle(deck);
  render();
  log(`${actionIcon('trocar')} ${a.name} trocou cartas com a Corte.`);
}

async function investigate(a,t){
  if(!t.alive)return;
  const h=hidden(t);
  if(!h.length)return;
  const card=t.human
    ? await pickCardByClick(t,h,`Clique em uma das cartas de ${t.name} para investigar.`)
    : pickRandom(h);
  log(`${actionIcon('investigar')} ${a.name} investiga ${t.name}.`);
  await step();

  let revealedEl=null;
  if(a.human||t.human){
    card.revealed=true;
    card.challengeFlip=true;
    render();
    const hand=seatOf(t)?.querySelector('.hand');
    revealedEl=hand?.children[t.cards.indexOf(card)]||null;
    await sleep(850);
  }

  let force;
  if(a.human){
    force=await askPop(a,`${t.name} mostra ${roleName(card.role)}. Forçar troca dessa carta?`,
      [{label:'Forçar troca',value:true,primary:true},{label:'Deixar',value:false}]);
  }else{
    force=Math.random()<.5;
  }

  if(a.human||t.human){
    // A carta sempre volta ao verso antes de continuar a resolução.
    if(revealedEl?.isConnected){
      try{await revealedEl.animate([
        {transform:'rotateY(0deg) scale(1)',opacity:1},
        {transform:'rotateY(90deg) scale(.96)',opacity:.9}
      ],{duration:360,easing:'ease-in',fill:'forwards'}).finished;}catch(_error){}
    }
    card.revealed=false;
    card.challengeFlip=false;
    render();
    await sleep(380);
  }

  if(force){
    log(`${actionIcon('investigar')} ${t.name} é forçado a trocar a carta revelada.`);
    if(a.human){
      const index=t.cards.indexOf(card);
      const oldRole=card.role;
      deck.push(oldRole);shuffle(deck);
      const newRole=deck.pop();
      await animateInvestigationExchange(t,index);
      delete KN[t.name];
      clearBlockedMemoryFor(t);
      t.cards[index]={role:newRole,dead:false,revealed:false,faceDown:true};
      render();
    }else{
      await swapCard(t,card,{faceDown:true});
    }
  }
}

async function resolve(act){
  const a=act.actor,t=act.target,info=ACT[act.type];
  if(info.cost){a.coins-=info.cost;treasury+=info.cost;flyCoins(a,null,info.cost);}
  log(`${actionIcon(act.type)} ${a.name} usa ${actionName(act.type)}${t?' contra '+t.name:''}.`);
  const usedRole=actionRole(act.type);
  badge(a,actionIcon(act.type)+' '+actionName(act.type).split(' (')[0],usedRole?`role-${usedRole}`:'');
  await step();
  const refund=()=>{a.coins+=info.cost;treasury-=info.cost;};

  const role=info.role?roleOf(act.type):null;
  if(role){
    const ok=await challengeWindow(a,role,x=>x===t);
    if(!ok){log('⚠️ A ação falha e as moedas são devolvidas ↩️');await step();refund();render();return;}
  }

  const bl=blockersOf(act.type);
  if(bl.length){
    const blk=await blockWindow(act,bl);
    if(blk){
      rememberBlockedAction(a,blk.by,act.type);
      log(`${ROLE_ICON[blk.role]||'🛡️'} A ação foi bloqueada por ${blk.by.name} com ${roleName(blk.role)}.`);
      badge(blk.by,`${ROLE_ICON[blk.role]||'🛡️'} Bloqueado`,roleButtonClass(blk.role));
      await step();render();return;
    }
  }

  switch(act.type){
    case 'renda': gain(a,1,ICON.renda);break;
    case 'ajuda': gain(a,2,ICON.ajuda);break;
    case 'taxas': gain(a,3,ICON.taxas);break;
    case 'extorquir': {
      const amt=Math.min(2,t.coins);
      t.coins-=amt;a.coins+=amt;flyCoins(t,a,amt);
      log(`${ICON.extorquir} ${a.name} rouba ${amt} moeda(s) de ${t.name}.`);
      await step();
      break;
    }
    case 'assassinar':
      if(t.alive){log(`${ICON.assassinar} ${t.name} é assassinado!`);await step();await loseInfluence(t);}
      break;
    case 'golpe':
      if(t.alive){log(`${ICON.golpe} ${a.name} dá um Golpe em ${t.name}!`);await step();await loseInfluence(t);}
      break;
    case 'trocar': await exchange(a);await step();break;
    case 'investigar': await investigate(a,t);break;
  }
  render();
}

// Reposiciona os jogadores quando a tela muda de orientação ou largura.
let seatResizeTimer;
window.addEventListener('resize',()=>{
  clearTimeout(seatResizeTimer);
  seatResizeTimer=setTimeout(()=>{if(P.length){layoutSeats();repositionEvents();}},90);
});
window.addEventListener('scroll',()=>{repositionEvents();},{passive:true});

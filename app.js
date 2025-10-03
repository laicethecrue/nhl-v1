// ===== ÉTAT =====
const state = { page:"menu", points:0, answered:{}, who:{idx:0,revealed:0}, memory:{deck:[],flipped:[],found:{},moves:0,time:60,tick:null} };
const DB = { quiz:[], players:[], teams:[] };
let CURRENT_QS = [];

// ===== CHARGEMENT =====
async function loadData(){
  try{
    const r = await fetch("./nhl-data.json");
    const d = await r.json();
    DB.quiz = d.quiz || [];
    DB.players = d.players || [];
    DB.teams = d.teams || [];
  }catch(e){ console.error("nhl-data.json", e); }
  render();
}

// ===== OUTILS =====
function rewardBadge(p){ return p>=60?"🏆 Or":p>=30?"🥈 Argent":"🥉 Bronze"; }
function qKey(q){ return q.q; }
function ensureRec(q){ const k=qKey(q); if(!state.answered[k]) state.answered[k]={correct:false,tries:[]}; return state.answered[k]; }
function go(p){ state.page=p; render(); }
function reset(){ state.points=0; state.answered={}; alert("Session remise à zéro"); render(); }

// ===== QUIZ =====
function answer(q,choice){
  const rec=ensureRec(q);
  if(choice===q.a){
    const first=rec.tries.length===0;
    if(!rec.correct){
      rec.correct=true;
      if(first) { state.points+=(q.p||10); alert(`✅ +${q.p||10} pts`); }
      else alert("✅ Bonne réponse (0 pt)");
    }else alert("⭐ Déjà validée");
  }else{
    if(!rec.tries.includes(choice)) rec.tries.push(choice);
    alert("❌ Essaie encore");
  }
  render();
}
function renderQuizCard(q,i){
  const rec=ensureRec(q);
  return `
    <div class="card">
      <div class="badge">Q${i+1} • ${(q.p||10)} pts ${rec.correct?"⭐":""}</div>
      <p><b>${q.q}</b></p>
      ${q.c.map((c,j)=>{
        const isGood=j===q.a, tried=rec.tries.includes(j);
        let cls=""; if(rec.correct&&isGood) cls="correct"; else if(tried) cls="wrong";
        return `<button class="${cls} qbtn" data-i="${i}" data-j="${j}">${c}</button>`;
      }).join("")}
    </div>
  `;
}

// ===== QUI SUIS-JE =====
function whoStart(){ state.who.idx=0; state.who.revealed=0; go("who"); }
function whoCur(){ return DB.players[state.who.idx]; }
function whoReveal(){ state.who.revealed=Math.min(whoCur().hints.length, state.who.revealed+1); render(); }
function whoCheck(){
  const inp = (document.getElementById("who-guess").value||"").trim().toLowerCase();
  const name = whoCur().name.toLowerCase();
  if(!inp) return;
  if(inp===name){ state.points+=10; alert("✅ Correct ! +10 pts"); state.who.idx++; state.who.revealed=0; render(); }
  else alert("❌ Non, continue !");
}
function whoSkip(){ state.who.idx++; state.who.revealed=0; render(); }

// ===== MÉMOIRE =====
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function memStart(){
  const base = DB.teams.slice(0,6); // 6 équipes = 12 cartes
  let deck = [];
  base.forEach(t=>{ deck.push({k:t.id+"A",id:t.id,label:t.name}); deck.push({k:t.id+"B",id:t.id,label:t.name}); });
  state.memory.deck = shuffle(deck);
  state.memory.flipped=[]; state.memory.found={}; state.memory.moves=0; state.memory.time=60;
  clearInterval(state.memory.tick);
  state.memory.tick = setInterval(()=>{
    state.memory.time = Math.max(0, state.memory.time-1);
    const el=document.getElementById("mem-timer"); if(el) el.textContent=state.memory.time+"s";
    if(state.memory.time===0) clearInterval(state.memory.tick);
  },1000);
  go("memory");
}
function memFlip(i){
  const M=state.memory;
  if(M.found[i]) return;
  if(M.flipped.includes(i)) return;
  if(M.flipped.length===2) return;
  M.flipped.push(i); render();
  if(M.flipped.length===2){
    M.moves++;
    const [i1,i2]=M.flipped, c1=M.deck[i1], c2=M.deck[i2];
    setTimeout(()=>{
      if(c1.id===c2.id){ M.found[i1]=true; M.found[i2]=true; }
      M.flipped=[]; render();
      const done = Object.keys(M.found).length===M.deck.length;
      if(done){ clearInterval(M.tick); const bonus=Math.max(0,M.time); state.points+=10+bonus; alert(`🏁 Gagné ! Coups:${M.moves} • Bonus:${bonus} • +${10+bonus} pts`); go("menu"); }
    },500);
  }
}

// ===== VUES =====
const V={};
function head(){ return `<div class="card"><div class="kv"><span><b>Points</b></span><b>${state.points} • ${rewardBadge(state.points)}</b></div></div>`; }

V.menu = () => `
  <h2>Menu</h2>
  ${head()}
  <button data-act="quiz">🧩 Quiz NHL</button>
  <button data-act="who">🧠 Qui suis-je ? (joueurs)</button>
  <button data-act="mem">🃏 Mémoire (équipes)</button>
  <button class="small" data-act="reset">🔄 Réinitialiser points</button>
`;

V.quiz = () => {
  CURRENT_QS = DB.quiz;
  if (!CURRENT_QS.length) return head()+`<p>Aucun quiz pour l’instant.</p><button data-act="back">⬅ Retour</button>`;
  let h = head()+`<h2>🧩 Quiz NHL (${CURRENT_QS.length})</h2>`;
  CURRENT_QS.forEach((q,i)=> h += renderQuizCard(q,i));
  return h+`<button data-act="back">⬅ Retour</button>`;
};

V.who = () => {
  const p = DB.players[state.who.idx];
  if (!p) return head()+`<p>Terminé ! 👏</p><button data-act="back">⬅ Retour</button>`;
  const shown = p.hints.slice(0, state.who.revealed || 1).map((t,ix)=>`<div class="kv"><span>Indice ${ix+1}</span><span>${t}</span></div>`).join("");
  return `
    ${head()}
    <h2>🧠 Qui suis-je ?</h2>
    <div class="card">
      <div class="badge">Joueur ${state.who.idx+1}/${DB.players.length}</div>
      ${shown}
      <input id="who-guess" placeholder="Tape le nom du joueur…" style="width:100%;padding:10px;border-radius:8px;border:1px solid #2c3444;background:#0b0f18;color:#e9eef5;margin-top:8px">
      <div class="row" style="display:flex;gap:10px;margin-top:8px">
        <button data-act="whoCheck">✅ Valider</button>
        <button data-act="whoReveal">💡 Un indice de plus</button>
        <button data-act="whoSkip">⏭️ Passer</button>
      </div>
    </div>
    <button data-act="back">⬅ Retour</button>
  `;
};

V.memory = () => {
  const M=state.memory;
  const grid = M.deck.map((c,idx)=>{
    const face = M.found[idx] || M.flipped.includes(idx);
    return `
      <div class="mem-card ${M.found[idx]?"found":""}">
        <button data-act="memFlip" data-i="${idx}">${face?c.label:"🃏"}</button>
      </div>`;
  }).join("");
  return `
    ${head()}
    <h2>🃏 Mémoire</h2>
    <div class="card"><b>Temps:</b> <span id="mem-timer">${M.time}s</span> • <b>Coups:</b> ${M.moves}</div>
    <div class="grid">${grid}</div>
    <button data-act="back">⬅ Retour</button>
  `;
};

// ===== RENDU =====
function render(){
  const root=document.getElementById("app");
  const html = V[state.page] ? V[state.page]() : "<p>Chargement…</p>";
  root.innerHTML = html;
}

// ===== CLICS =====
document.addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const act=b.getAttribute("data-act");

  if(act==="quiz"){ go("quiz"); return; }
  if(act==="who"){ whoStart(); return; }
  if(act==="mem"){ memStart(); return; }
  if(act==="reset"){ reset(); return; }
  if(act==="back"){ go("menu"); return; }

  if(b.classList.contains("qbtn")){
    const i=Number(b.getAttribute("data-i")), j=Number(b.getAttribute("data-j"));
    answer(CURRENT_QS[i], j); return;
  }

  if(act==="whoCheck"){ whoCheck(); return; }
  if(act==="whoReveal"){ whoReveal(); return; }
  if(act==="whoSkip"){ whoSkip(); return; }

  if(act==="memFlip"){ const i=Number(b.getAttribute("data-i")); memFlip(i); return; }
});

// ===== INIT =====
loadData();

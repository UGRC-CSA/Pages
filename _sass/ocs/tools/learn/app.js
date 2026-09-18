const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
// checker levels map onto the system's own alert variants
const ALERT={error:'danger', warn:'warning', info:'info', pass:'success'};
const editor=$('#editor'),preview=$('#preview'),cssout=$('#cssout'),notesEl=$('#notes'),
      briefEl=$('#brief'),chapsEl=$('#chapters'),verdict=$('#verdict'),
      gutter=$('#gutter'),badgesEl=$('#badges'),ccount=$('#ccount'),meterEl=$('#meter');
let active=0, hintLevel=0, lastNotes=[], lastCss='';
const styleTag=document.createElement('style'); document.head.appendChild(styleTag);
let progress=store.get('progress',{});
let drafts=store.get('drafts',{});
const MAXXP=EXERCISES.length*100;

/* ---------- toast ---------- */
let tt;
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('on');
  clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),2200);}

/* ---------- progress ---------- */
function totalXP(){return Object.values(progress).reduce((a,p)=>a+(p.xp||0),0);}
function paintXP(){
  const xp=totalXP(), pct=Math.round(xp/MAXXP*100);
  $('#xptxt').textContent=xp+' XP';
  $('#xpbar').style.width=pct+'%';
  // Eleven two-letter pills were unreadable and told a reader nothing they
  // could act on. The same fact, in words.
  const doneCount=EXERCISES.filter(e=>progress[e.id]?.done).length;
  badgesEl.textContent=`${doneCount} of ${EXERCISES.length} quests`;
  $('#cert').classList.toggle('show', EXERCISES.every(e=>progress[e.id]?.done));
  $('#certXP').textContent=xp;
  $('#certDone').textContent=EXERCISES.filter(e=>progress[e.id]?.done).length;
}
function award(id,xp){
  const cur=progress[id]||{};
  const fresh=!cur.done;
  if((cur.xp||0)>=xp && cur.done) return false;
  progress[id]={done:true,xp:Math.max(cur.xp||0,xp)};
  store.set('progress',progress);
  if(fresh) addCredits(10);
  paintXP(); renderChapters();
  // The per-quest pills that this animated are gone; the quest card itself is
  // now the thing that visibly changes state.

  return true;
}

function paintCredits(){
  const c=credits();
  const el=$('#credtxt'); if(el) el.textContent=c+' cr';
  const list=$('#shoplist'); if(!list) return;
  list.innerHTML=SHOP.map(it=>{
    const has=owns(it.id), afford=c>=it.cost;
    const active=store.get('activeTheme','')===it.id||store.get('activeAccent','')===it.id;
    return `<div class="shopitem ${has?'owned':''}">
      <div><b>${it.name}</b><p>${it.what}</p></div>
      <button class="ocs-btn ocs-btn--sm ${has?'ocs-btn--secondary':'ocs-btn--primary'}" data-buy="${it.id}" ${!has&&!afford?'disabled':''}>
        ${has?(it.id.startsWith('theme')||it.id.startsWith('accent')?(active?'On':'Use'):'Unlocked'):it.cost+' cr'}</button>
    </div>`;}).join('');
  $$('#shoplist [data-buy]').forEach(b=>b.onclick=()=>{
    const it=SHOP.find(x=>x.id===b.dataset.buy);
    if(owns(it.id)){
      if(it.id.startsWith('theme')) store.set('activeTheme', store.get('activeTheme','')===it.id?'':it.id);
      if(it.id.startsWith('accent')) store.set('activeAccent', store.get('activeAccent','')===it.id?'':it.id);
      applyUnlocks(); paintCredits(); return;
    }
    const r=buy(it);
    if(r==='poor') toast('Not enough credits yet');
    else { toast(it.name+' unlocked'); paintCredits(); }
  });
}

/* ---------- step checklist ---------- */
function renderSteps(){
  const e=EXERCISES[active], box=$('#steps'); if(!box) return;
  const {css}=compileScss(editor.value);
  let worstOk=true;
  preview.querySelectorAll('*').forEach(el=>{
    const txt=(el.textContent||el.value||'').trim();
    if(txt&&!el.children.length&&contrastOf(el)<4.5) worstOk=false;
  });
  const done=e.steps.map(st=>{try{return !!st.test(editor.value,css,worstOk);}catch{return false;}});
  box.innerHTML=e.steps.map((st,i)=>
    `<li class="${done[i]?'on':''}"><span class="tk">${done[i]?'&#10003;':i+1}</span>${st.label}</li>`).join('');
  $('#stepcount').textContent=done.filter(Boolean).length+'/'+e.steps.length;
  paintCoach();
}

/* ---------- visual target ---------- */
function showTarget(on){
  const box=$('#targetbox'); if(!box) return;
  box.classList.toggle('on',on);
  $('#targetbtn').textContent=on?'Hide target':'Show target';
  if(!on) return;
  const e=EXERCISES[active];
  const {css}=compileScss(e.solution);
  $('#targetprev').innerHTML=e.html;
  $('#targetstyle').textContent=css.replace(/(^|})\s*([^{}@]+)\{/g,(m,a,sel)=>
    `${a} ${sel.split(',').map(s=>'#targetprev '+s.trim()).join(', ')}{`);
}

/* ---------- chapters + quests ------------------------------------------------
   A chapter opens when the one before it is finished, the same rule the token
   drawer uses. Locking is not there to be strict - it is there so the page a
   beginner lands on shows four quests, not twelve.

   Every state is carried by a class AND by something a screen reader can
   reach: aria-current for the open quest, aria-disabled plus a caption for a
   locked one, and a visually-hidden word for done. Colour is never the only
   thing saying which is which.                                             */

// Chapter 0 is always open. After that, finish the previous one.
function chapterOpen(n){
  return n <= (CHAPTERS[0]?.n ?? 0) || chapterDone(n - 1);
}

function questState(e){
  if (progress[e.id]?.done) return 'done';
  if (!chapterOpen(e.ch))   return 'locked';
  return 'todo';
}

function renderChapters(){
  chapsEl.innerHTML = CHAPTERS.map(c => {
    const list = EXERCISES.filter(e => e.ch === c.n);
    const done = list.filter(e => progress[e.id]?.done).length;
    const open = chapterOpen(c.n);
    const prev = CHAPTERS.find(x => x.n === c.n - 1);

    const quests = list.map(e => {
      const i = EXERCISES.indexOf(e);
      const st = questState(e);
      const isOpen = i === active;
      // The open quest reads as in progress unless it is already solved.
      const cls = ['ocs-card', 'ocs-card--interactive', 'q', `q--${st}`,
                   isOpen && st !== 'done' ? 'q--active' : ''].filter(Boolean).join(' ');

      const badge = st === 'done'
        ? '<span class="q__mark q__mark--done" aria-hidden="true">&#10003;</span>'
        : st === 'locked'
          ? '<span class="q__mark q__mark--locked" aria-hidden="true">'
            + '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">'
            + '<rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.6"/>'
            + '<path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" stroke="currentColor" stroke-width="1.6"/>'
            + '</svg></span>'
          : isOpen ? '<span class="q__mark q__mark--active" aria-hidden="true"></span>' : '';

      const foot = st === 'locked' && prev
        ? `<p class="q__gate">Finish Chapter ${prev.n} first</p>` : '';

      // The state in words, for anyone who cannot see the tint or the badge.
      const said = st === 'done' ? 'Solved. ' : st === 'locked' ? 'Locked. ' : '';

      return `<button class="${cls}" data-i="${i}"
          aria-current="${isOpen}"${st === 'locked' ? ' aria-disabled="true"' : ''}>
        ${badge}
        <span class="ocs-sr-only">${said}</span>
        <span class="q__n">QUEST ${e.id}</span>
        <h4 class="q__t">${e.title}</h4>
        <p class="q__d">${e.learn}</p>
        ${foot}</button>`;
    }).join('');

    return `<section class="ocs-card chap${open ? '' : ' chap--locked'}">
      <div class="chap__head">
        <div class="chap__id">
          <span class="chap__n">CHAPTER ${c.n}</span>
          <h3 class="chap__t">${c.name}</h3>
          <p class="chap__blurb">${c.blurb}</p>
        </div>
        <span class="chap__cnt${done === list.length ? ' is-done' : ''}">${done}/${list.length}</span>
      </div>
      <div class="quests">${quests}</div>
    </section>`;
  }).join('');

  $$('.q').forEach(b => b.onclick = () => {
    if (b.getAttribute('aria-disabled') === 'true') {
      toast('Finish the chapter before this one first');
      return;
    }
    active = +b.dataset.i; hintLevel = 0; coachThread = []; load();
    briefEl.scrollIntoView({block:'start', behavior:'smooth'});
  });
}

/* ---------- brief ---------- */
function renderBrief(){
  const e=EXERCISES[active];
  briefEl.innerHTML=`
    <p class="kicker">Quest ${e.id} &middot; ${e.badge}</p>
    <h3>${e.title}</h3>
    <p>${e.brief}</p>
    <details class="concept"><summary>${e.concept.t}</summary>
      <div class="cbody">${e.concept.b}</div></details>
    <p class="goal"><b>Done when:</b> ${e.goal}</p>
    <div class="hintbar"><button class="ocs-btn ocs-btn--secondary" id="hint">Need a hint?</button>
      <span class="tiny" id="hintleft"></span></div>
    <div class="hints" id="hintlist"></div>`;
  $('#hint').onclick=()=>{ if(hintLevel<e.hints.length){ hintLevel++; paintHints(); } };
  paintHints();
}
function paintHints(){
  const e=EXERCISES[active];
  $('#hintlist').innerHTML=e.hints.slice(0,hintLevel)
    .map((h,i)=>`<div class="ocs-alert ocs-alert--info"><div class="ocs-alert__content">
       <p><b>Hint ${i+1}.</b> ${h}</p></div></div>`).join('');
  const left=e.hints.length-hintLevel;
  $('#hintleft').textContent = left ? `${left} more available` : 'that was the last one';
  $('#hint').disabled=!left;
}

/* ---------- editor ---------- */
function syncGutter(){
  const n=editor.value.split('\n').length;
  gutter.innerHTML=Array.from({length:n},(_,i)=>i+1).join('<br>');
  editor.style.height='auto';editor.style.height=editor.scrollHeight+'px';
  gutter.style.height=editor.style.height;
}
function insertAtCursor(txt){
  const s=editor.selectionStart,en=editor.selectionEnd;
  editor.value=editor.value.slice(0,s)+txt+editor.value.slice(en);
  editor.selectionStart=editor.selectionEnd=s+txt.length;
  editor.focus();syncGutter();run();saveDraft();
}
function saveDraft(){drafts[EXERCISES[active].id]=editor.value;store.set('drafts',drafts);}


/* ---------- coach --------------------------------------------------------------
   The page already knows everything a stuck student needs: which steps are
   ticked, what the checker is complaining about, and the finished code. The
   coach turns that into one instruction at a time, and will make the change
   for you if reading it is not enough.

   No API key, no network. An LLM is not what is missing here - the answer is
   already on the page, it was just never said as a single next action.       */

// The first line where the student's code differs from the finished version,
// ignoring blank lines and whitespace-only changes.
function nextDiff(){
  const e = EXERCISES[active];
  const cur  = editor.value.split('\n');
  const want = (e.solution || '').split('\n');
  const norm = s => s.replace(/\s+/g, ' ').trim();

  for (let i = 0; i < want.length; i++){
    if (norm(cur[i] ?? '') !== norm(want[i])) {
      return {line: i + 1, from: cur[i] ?? '', to: want[i]};
    }
  }
  // Same prefix but the student has extra lines at the end.
  if (cur.length > want.length) return {line: want.length + 1, from: cur[want.length], to: null};
  return null;
}

function coachAdvice(){
  const e = EXERCISES[active];
  if (progress[e.id]?.done) {
    return {head: 'This one is done.', body: 'Pick the next quest above, or change the code and watch what happens.'};
  }

  // Which checklist step is still open? Its label is already written as an
  // instruction, so it is the clearest thing to say.
  const {css} = compileScss(editor.value);
  let worstOk = true;
  preview.querySelectorAll('*').forEach(el => {
    const txt = (el.textContent || el.value || '').trim();
    if (txt && !el.children.length && contrastOf(el) < 4.5) worstOk = false;
  });
  const open = e.steps.findIndex(st => { try { return !st.test(editor.value, css, worstOk); } catch { return true; } });

  // The remaining difference from the finished code is the reliable guide, not
  // the checklist. A quest is only solved when the code also compiles and the
  // checker is quiet, and the steps can all tick before that is true - the
  // last version of this stopped offering help at that point and left the
  // student with an unclosed brace.
  const d = nextDiff();
  const head = open < 0 ? 'Nearly there' : `Step ${open + 1} of ${e.steps.length}`;

  if (!d) {
    return open < 0
      ? {head: 'Every step is ticked.', body: 'If it has not turned green yet, read the Checks panel under the editor. Something in there is still marked as a problem.'}
      : {head, body: e.steps[open].label};
  }
  if (d.to === null) {
    return {head, body: `Delete line ${d.line}. It is not part of the answer.`, line: d.line};
  }
  if (!d.from.trim()) {
    return {head, body: `Add this as line ${d.line}: <code>${esc(d.to.trim())}</code>`, line: d.line, apply: true};
  }
  return {
    head,
    body: `Change line ${d.line}. It says <code>${esc(d.from.trim())}</code> and it needs to say <code>${esc(d.to.trim())}</code>`,
    line: d.line, apply: true
  };
}

function esc(s){
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}

// Apply just the one line the coach is talking about, so a student sees the
// single change happen rather than the whole answer appearing at once.
function coachApply(){
  const d = nextDiff();
  if (!d) return;
  const lines = editor.value.split('\n');
  if (d.to === null) lines.splice(d.line - 1, 1);
  else lines[d.line - 1] = d.to;
  editor.value = lines.join('\n');
  syncGutter(); run(); saveDraft();
  toast(`Line ${d.line} updated`);
  paintCoach();
}


/* ---------- asking the coach ---------------------------------------------------
   Answers come from what the page already contains: the concept written for
   every quest, all 78 tokens, the checker's own explanations, and the hints.
   A question is matched against those by word overlap.

   No key needed. If a student saves a Groq key the coach will send anything it
   cannot answer there instead of shrugging, but that is the extra, not the
   floor.                                                                     */

// Words that carry no meaning for matching.
const STOP = new Set(('a an the is are was were do does did what why how when '
  + 'i im i\'m me my it its this that of to in on for and or but can cant could '
  + 'should would there here about with not no yes please help').split(' '));

const words = s => String(s).toLowerCase().replace(/[^a-z0-9\-_ ]/g, ' ')
  .split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));

// Everything the coach can quote, built once from the lesson content.
function knowledge(){
  const out = [];
  EXERCISES.forEach(e => {
    out.push({q: `${e.concept.t} ${e.title} ${e.learn}`,
              a: `<b>${e.concept.t}</b><br>${e.concept.b}`, w: 3});
    out.push({q: `${e.title} ${e.brief}`, a: `<b>Quest ${e.id}: ${e.title}</b><br>${e.brief}`, w: 1});
  });
  TOKENS.forEach(tk => {
    const name = tk.n.replace('--ocs-', '');
    out.push({token: name, q: `${name} ${tk.n} ${tk.g} token`,
              a: `<code>${tk.n}</code> is a ${tk.g.toLowerCase()} token. Its value is <code>${tk.v}</code>.`
                 + ` Use it as <code>var(${tk.n})</code>.`, w: 2});
  });
  // Things a beginner asks that the lessons never define.
  [['selector what part before the curly brace',
    'The <b>selector</b> is the bit before the <code>{</code>. It says which things on the page this rule applies to. <code>.ocs-demo-btn</code> means "every element with the class ocs-demo-btn".'],
   ['property value colon semicolon line inside braces',
    'Inside the braces you write <b>property: value;</b> one per line. The property is what you are changing, like <code>background</code>. The value is what you are changing it to, like <code>blue</code>. Always end the line with a semicolon.'],
   ['padding space inside',
    '<b>padding</b> is space inside an element, between its edge and its text. More padding makes a button bigger and roomier.'],
   ['margin space outside',
    '<b>margin</b> is space outside an element, pushing other things away from it.'],
   ['px rem unit size',
    '<code>px</code> is a pixel, a fixed size. <code>rem</code> is relative to the reader\'s own text size, so it grows if they have made text bigger. This system uses rem for spacing.'],
   ['hover',
    '<code>&:hover</code> styles an element while the mouse is over it. Nothing changes until someone points at it.'],
   ['contrast readable ratio 4.5',
    'Contrast is how different two colours are. Text needs a ratio of at least <b>4.5:1</b> against its background to be readable. The number under the preview tells you where you are.'],
   ['nesting nested inside indent scss',
    'In SCSS you can put one rule inside another. The inner one only applies inside the outer one. That is nesting, and it is the main thing SCSS adds to CSS.'],
   ['save saved progress lost',
    'Your code saves by itself, per quest, in this browser. Closing the tab will not lose it.'],
   ['stuck lost dont know understand confused',
    null],
  ].forEach(([q, a]) => out.push({q, a, w: 5, faq: true}));
  return out;
}
let KB = null;

function answerLocally(question){
  KB = KB || knowledge();

  // The intent checks run BEFORE the empty-words guard below. "what do i do"
  // is entirely stop words, so the guard used to reject the single most likely
  // question on the page.
  //
  // Only FIRST-PERSON stuck phrasing routes to the next action. Matching a bare
  // "what.*do" sent "what does the selector do" here instead of to its
  // definition.
  if (/\b(i'?m |i am )?(stuck|lost|confused)\b|what (do|should) i do|where do i (start|begin)|help me|i don'?t know what/i.test(question)) {
    const a = coachAdvice();
    return `${a.body}` + (a.apply ? ' Use the button above and I will do it for you.' : '');
  }
  // "why is it not working" reads the checker.
  if (/wrong|not work|broken|fail|error|red|why.*(not|isn)/i.test(question)) {
    const bad = (lastNotes || []).filter(n => n.level !== 'pass');
    if (bad.length) return `<b>${bad[0].title}</b><br>${bad[0].why}<br><b>Fix:</b> ${bad[0].fix}`;
    return 'Nothing is flagged right now. The Checks panel under the editor is empty, so keep going.';
  }

  const qw = words(question);
  if (!qw.length) return null;

  const named = question.match(/--ocs-[a-z0-9-]+/)?.[0] || null;
  let best = null;
  for (const item of KB) {
    if (!item.a) continue;
    const iw = new Set(words(item.q));
    let score = 0;
    qw.forEach(w => { if (iw.has(w)) score += item.w; });

    if (item.token) {
      // A token entry only competes when the question actually names it.
      // Otherwise 78 of them drown out the one hand-written answer.
      if (named && item.q.includes(named)) score += 20;
      else if (!qw.includes(item.token)) continue;
    }
    if (score && (!best || score > best.score)) best = {score, a: item.a};
  }
  return best && best.score >= 3 ? best.a : null;
}

async function askGroq(question){
  const key = store.get('groqKey', '');
  if (!key) return null;
  const e = EXERCISES[active];
  const sys = 'You help a beginner learning CSS and SCSS. Answer in at most three short '
    + 'sentences. One idea per sentence. No jargon unless you define it in the same sentence.';
  const ctx = `The student is on a quest called "${e.title}". The task is: ${e.brief.replace(/<[^>]+>/g,'')}. `
    + `Their code right now is:\n${editor.value}`;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key},
      body: JSON.stringify({model: 'llama-3.3-70b-versatile', max_tokens: 220, temperature: 0.3,
        messages: [{role: 'system', content: sys},
                   {role: 'user', content: ctx + '\n\nQuestion: ' + question}]})
    });
    if (!r.ok) return `That key was refused (HTTP ${r.status}). Check it in Settings below.`;
    const j = await r.json();
    return (j.choices?.[0]?.message?.content || '').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  } catch { return 'Could not reach Groq. You may be offline.'; }
}

// The thread lives here, not in the DOM. paintCoach() rebuilds the panel on
// every keystroke, and reading the messages back out of the element it is about
// to replace dropped whichever one arrived mid-repaint.
let coachThread = [];

function renderThread(){
  const log = $('#coachlog'); if (!log) return;
  log.innerHTML = coachThread
    .map(m => `<div class="coach__msg coach__msg--${m.who}">${m.html}</div>`).join('');
  log.scrollTop = log.scrollHeight;
}

function pushAsk(who, html){
  coachThread.push({who, html});
  renderThread();
}

async function coachAsk(){
  const box = $('#coachq'); const q = box.value.trim();
  if (!q) return;
  pushAsk('you', esc(q));
  box.value = '';
  const local = answerLocally(q);
  if (local) { pushAsk('coach', local); return; }
  pushAsk('coach', '<span class="coach__wait">Thinking…</span>');
  const g = await askGroq(q);
  coachThread.pop();
  pushAsk('coach', g || 'I do not know that one. Try the hint button on the left, or ask '
    + 'your question with the name of the thing in it, like "what is --ocs-accent".');
}

function paintCoach(){
  const box = $('#coach'); if (!box) return;
  const a = coachAdvice();


  box.innerHTML = `
    <div class="coach__top">
      <span class="coach__name">Coach</span>
      <span class="coach__step">${a.head}</span>
    </div>
    <p class="coach__b">${a.body}</p>
    ${a.apply ? '<button class="ocs-btn ocs-btn--primary ocs-btn--sm" id="coachdo">Do this line for me</button>' : ''}
    <div class="coach__log" id="coachlog"></div>
    <form class="coach__ask" id="coachform">
      <input class="ocs-input" id="coachq" placeholder="Ask me anything about this quest…"
             aria-label="Ask the coach a question" autocomplete="off">
      <button class="ocs-btn ocs-btn--primary ocs-btn--sm" type="submit">Ask</button>
    </form>
    <details class="coach__set">
      <summary>Optional: use an AI for open questions</summary>
      <p>The coach answers from this page on its own. Paste a free Groq key and it
         can also answer anything else you ask. The key stays in this browser.</p>
      <div class="coach__setrow">
        <input class="ocs-input" id="groqkey" type="password" placeholder="gsk_…"
               aria-label="Groq API key" autocomplete="off">
        <button class="ocs-btn ocs-btn--secondary ocs-btn--sm" id="groqsave" type="button">Save</button>
      </div>
      <p class="coach__hintline">Get one free at console.groq.com/keys</p>
    </details>`;

  renderThread();
  const b = $('#coachdo'); if (b) b.onclick = coachApply;
  $('#coachform').onsubmit = ev => { ev.preventDefault(); coachAsk(); };
  const k = $('#groqkey'); if (k) k.value = store.get('groqKey', '');
  $('#groqsave').onclick = () => {
    store.set('groqKey', $('#groqkey').value.trim());
    toast($('#groqkey').value.trim() ? 'Key saved in this browser' : 'Key cleared');
  };
}

/* ---------- contrast meter ---------- */
function paintMeter(){
  if(!lastCss.trim()){meterEl.className='meter';meterEl.innerHTML='<span class="dot"></span>nothing compiled';return;}
  let worst=null;
  preview.querySelectorAll('*').forEach(el=>{
    const txt=(el.textContent||el.value||'').trim();
    if(!txt||el.children.length)return;
    const r=contrastOf(el);
    if(worst===null||r<worst)worst=r;
  });
  if(worst===null){meterEl.className='meter';meterEl.innerHTML='<span class="dot"></span>no text yet';return;}
  const ok=worst>=4.5;
  meterEl.className='meter '+(ok?'good':'bad');
  meterEl.innerHTML=`<span class="dot"></span>contrast ${worst.toFixed(2)}:1 ${ok?'passes':'needs 4.5:1'}`;
}

/* ---------- run ---------- */
function load(){
  const e=EXERCISES[active];
  renderChapters();renderBrief();
  editor.value=drafts[e.id]!==undefined?drafts[e.id]:e.start;
  preview.innerHTML=e.html;
    syncGutter();run();
}
function run(){
  const e=EXERCISES[active];
  const {css,errors}=compileScss(editor.value);
  lastCss=css;
  cssout.textContent=css||'/* nothing compiled yet */';
  styleTag.textContent=css.replace(/(^|})\s*([^{}@]+)\{/g,(m,a,sel)=>
    `${a} ${sel.split(',').map(s=>'#preview '+s.trim()).join(', ')}{`);
  paintMeter();
  renderSteps();

  const notes=errors.map(x=>({level:'error',title:x,
    why:'The compiler stopped here, so nothing after this point was applied.',
    fix:'Check your braces and semicolons.'}));
  notes.push(...runChecks(editor.value,css,preview));
  lastNotes=notes;

  const clean=!errors.length&&!notes.some(n=>n.level==='error');
  const passed=clean&&e.pass(editor.value,css);
  verdict.innerHTML=passed?'<span style="color:var(--ok);font-weight:650">&#10003; solved</span>':'';
  ccount.textContent=notes.length?notes.length+' to look at':'all clear';

  if(passed&&award(e.id,100)){
    notes.unshift({level:'pass',title:'Solved. +100 XP',why:e.goal,
      fix:'On to the next quest.'});
    toast(`Quest ${e.id} solved`);
    // Solving the last quest of a chapter opens the next band of tokens.
    checkTokenUnlocks();
  }else if(passed){
    notes.unshift({level:'pass',title:'Still solved.',why:e.goal,fix:'Try the next quest.'});
  }
  notesEl.innerHTML=notes.length
    ? notes.map(n=>`<div class="ocs-alert ocs-alert--${ALERT[n.level]||'info'}">
        <div class="ocs-alert__content"><p class="ocs-alert__title">${n.title}</p>
        <p>${n.why}</p><p><b>Fix:</b> ${n.fix}</p></div></div>`).join('')
    : '<div class="empty">Nothing flagged yet.</div>';
}

/* ---------- token drawer ---------- */
/* rgb(18, 18, 18) -> #121212. Alpha is kept as-is: rgba() is what the token
   says, and rounding it to a hex would be a lie. */
function toHex(c){
  const m=c.match(/^rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)$/);
  if(!m) return c;
  if(m[4]!==undefined && +m[4]<1) return c;
  return '#'+[m[1],m[2],m[3]].map(n=>(+n).toString(16).padStart(2,'0')).join('').toUpperCase();
}

/* ---------- token tiers ----------------------------------------------------
   Seventy-eight tokens on day one is the fastest way to make a beginner close
   the drawer and never open it again. So each group is held back until the
   chapter that teaches it, and the ladder is derived from the lessons rather
   than guessed: every tier holds exactly what its chapter's quests use.

   The last tier is the four groups no lesson touches at all. Those really are
   advanced, and there is nothing to gain from showing them in week one.

   A student is never stuck behind this. "Everything" shows the full list, and
   the choice is remembered.                                              */
const TIERS = [
  {ch:-1, groups:['Semantic colour','Text'],
   why:'available from the start'},
  {ch:1,  groups:['Surface','Border','Spacing'],
   why:'finish Chapter 1 &middot; Colour'},
  {ch:2,  groups:['Radius','Motion'],
   why:'finish Chapter 2 &middot; State'},
  {ch:3,  groups:['Colour ramp','Shadow','Type','Other'],
   why:'finish Chapter 3 &middot; Components'},
];

const chapterDone = ch => EXERCISES.filter(e=>e.ch===ch).every(e=>progress[e.id]?.done);

// The tier a group belongs to, or 0 when a group somehow is not listed - an
// unlisted group stays visible rather than disappearing.
function tierOf(group){
  const i = TIERS.findIndex(t=>t.groups.includes(group));
  return i < 0 ? 0 : i;
}

const tierOpen = i => TIERS[i].ch < 0 || chapterDone(TIERS[i].ch);

function unlockedCount(){
  return TOKENS.filter(t=>tierOpen(tierOf(t.g))).length;
}

/* Show all tokens regardless of tier. Remembered per browser. */
let showAll = store.get('tokensShowAll', false);

function setTokenView(all){
  showAll = all;
  store.set('tokensShowAll', all);
  $('#viewBeginner').classList.toggle('is-on', !all);
  $('#viewAll').classList.toggle('is-on', all);
  $('#viewBeginner').setAttribute('aria-pressed', String(!all));
  $('#viewAll').setAttribute('aria-pressed', String(all));
  renderTokens($('#tsearch').value);
}

/* The line under the toggle: how many are open, and what opens the rest. */
function paintTokenProgress(){
  const open = unlockedCount(), total = TOKENS.length;
  const next = TIERS.find((t,i)=>!tierOpen(i));
  const el = $('#tprog'); if(!el) return;
  if(!next){
    el.innerHTML = `All <b>${total}</b> tokens unlocked. Nothing left to earn here.`;
  }else{
    const n = TOKENS.filter(t=>next.groups.includes(t.g)).length;
    el.innerHTML = `<b>${open}</b> of ${total} unlocked. `
      + `<b>${n}</b> more (${next.groups.join(', ')}) when you ${next.why}.`;
  }
  $('#tsearch').placeholder = `Search ${showAll ? total : open} tokens...`;
}

function renderTokens(filter=''){
  const f=filter.toLowerCase();
  const match=t=>t.n.toLowerCase().includes(f)||t.g.toLowerCase().includes(f)||t.v.toLowerCase().includes(f);

  let html='',last='';
  const locked=new Map();

  for(const t of TOKENS){
    const tier=tierOf(t.g), open=tierOpen(tier);

    // A locked group collapses to one row saying what opens it. The tokens
    // are not listed, so the drawer stays short, but the fact that more exist
    // is never hidden - that is the difference between gating and pretending.
    // Collected here and emitted after the open groups, ordered by tier, so
    // whatever unlocks next sits at the top of the locked list.
    if(!open && !showAll){
      if(!locked.has(t.g) && (!f || t.g.toLowerCase().includes(f))){
        locked.set(t.g, {tier, n:TOKENS.filter(x=>x.g===t.g).length});
      }
      continue;
    }

    if(!match(t)) continue;
    if(t.g!==last){html+=`<div class="tgrp">${t.g}</div>`;last=t.g;}

    // An alias like --ocs-accent: var(--ocs-brand) is a colour even though the
    // build could not fold it to a hex, so paint a swatch for those too.
    const colour = t.c || /^var\(/.test(t.v);
    const sw = colour ? `<span class="sw" style="background:var(${t.n})"></span>`
                      : `<span class="sw sw--none"></span>`;
    const ahead = !open ? ' <span class="tahead">not covered yet</span>' : '';
    html+=`<button class="trow${open?'':' trow--ahead'}" data-t="${t.n}" title="Insert var(${t.n})">
      ${sw}<span class="nm">${t.n.replace('--ocs-','')}${ahead}</span><span class="vl">${t.v}</span></button>`;
  }

  if(locked.size){
    html+=`<div class="tgrp tgrp--locked">Unlock by finishing chapters</div>`;
    [...locked.entries()]
      .sort((a,b)=>a[1].tier-b[1].tier)
      .forEach(([g,{tier,n}])=>{
        html+=`<div class="tlock"><span class="tlock__i" aria-hidden="true">&#128274;</span>
          <span class="tlock__n">${g}</span>
          <span class="tlock__c">${n}</span>
          <span class="tlock__w">${TIERS[tier].why}</span></div>`;
      });
  }

  $('#tlist').innerHTML=html||'<div class="empty">No tokens match that.</div>';

  /* The value baked into TOKENS is the dark-theme one, but this drawer sits
     inside .ocs-light, so var(--ocs-text) here is near-black, not #FFFFFF.
     Showing the build-time hex next to a live swatch would put a black chip
     beside the label "#FFFFFF". Read what the token actually resolves to in
     this context instead, so the chip and the label always agree - which is
     also the point quest 3 makes about theming. */
  $$('#tlist .trow').forEach(b=>{
    const sw=b.querySelector('.sw');
    if(sw && !sw.classList.contains('sw--none')){
      const bg=getComputedStyle(sw).backgroundColor;
      if(bg && bg!=='rgba(0, 0, 0, 0)') b.querySelector('.vl').textContent=toHex(bg);
    }
    b.onclick=()=>{ insertAtCursor(`var(${b.dataset.t})`); toast(`Inserted ${b.dataset.t}`); };
  });

  paintTokenProgress();
}

/* Called after a quest is solved. Announces a tier only on the run that opens
   it, so finishing a chapter is a visible event rather than something a
   student would only notice by reopening the drawer. */
let tiersAnnounced = store.get('tiersAnnounced', []);
function checkTokenUnlocks(){
  TIERS.forEach((t,i)=>{
    if(t.ch < 0 || tiersAnnounced.includes(i) || !tierOpen(i)) return;
    tiersAnnounced.push(i);
    store.set('tiersAnnounced', tiersAnnounced);
    const n = TOKENS.filter(x=>t.groups.includes(x.g)).length;
    toast(`Chapter ${t.ch} done - ${n} new tokens unlocked`);
  });
  renderTokens($('#tsearch').value);
}

function openDrawer(o){
  if(o) renderTokens($('#tsearch').value);
  $('#drawer').classList.toggle('open',o);$('#scrim').classList.toggle('on',o);
  if(o)setTimeout(()=>$('#tsearch').focus(),120);}

/* ---------- export ---------- */
function exportAll(){
  const lines=[`/* OCS SCSS Practice - my solutions */`,`/* ${EXERCISES.filter(e=>progress[e.id]?.done).length}/${EXERCISES.length} quests, ${totalXP()} XP */`,''];
  EXERCISES.forEach(e=>{
    const code=drafts[e.id];
    if(code===undefined)return;
    lines.push(`/* ---- Quest ${e.id}: ${e.title} ${progress[e.id]?.done?'[solved]':''} ---- */`,code,'');
  });
  const blob=new Blob([lines.join('\n')],{type:'text/plain'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download='ocs-practice-solutions.scss';a.click();
  URL.revokeObjectURL(a.href);toast('Downloaded your solutions');
}



/* ---------- submission ------------------------------------------------------
   At 100% a student can produce a receipt to hand in. The receipt is a
   fingerprint of the code they actually wrote, so the same work always gives
   the same code and two identical submissions are visible as such.

   It is deliberately not presented as tamper-proof. Everything here runs in
   the browser, so a determined student can edit any of it; this is a receipt
   in the same sense as a piece of homework, and the UI says so.            */

// djb2. Not a security hash - a short stable fingerprint for spotting two
// identical submissions. crypto.subtle would be no more trustworthy here,
// because the input is under the student's control either way.
function fingerprint(text){
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36).toUpperCase().padStart(7, '0').slice(-7);
}

function submissionData(){
  const name = $('#subname').value.trim();
  const gh   = $('#subgh').value.trim().replace(/^@/, '');
  const quests = EXERCISES.map(e => ({
    id: e.id, ch: e.ch, title: e.title,
    solved: !!progress[e.id]?.done,
    code: drafts[e.id] ?? ''
  }));
  // The fingerprint covers who submitted and what they wrote, and nothing
  // else - not the timestamp, so re-submitting the same work is recognisable.
  const basis = [name.toLowerCase(), gh.toLowerCase(),
                 ...quests.map(q => `${q.id}:${q.code.replace(/\s+/g, ' ').trim()}`)].join('|');
  const fp = fingerprint(basis);
  return {
    name, github: gh,
    course: 'OCS SCSS Practice',
    submitted: new Date().toISOString(),
    quests_solved: quests.filter(q => q.solved).length,
    quests_total: EXERCISES.length,
    xp: totalXP(),
    receipt: `OCS-${fp.slice(0,4)}-${fp.slice(4)}`,
    quests
  };
}

function buildSubmission(){
  const name = $('#subname').value.trim();
  if(!name){ $('#subname').focus(); toast('Add your name first'); return; }

  const data = submissionData();
  window.__submission = data;

  $('#subcode').textContent = data.receipt;
  $('#subsummary').textContent =
    `${data.name}${data.github ? ' (@'+data.github+')' : ''} - `
    + `${data.quests_solved} of ${data.quests_total} quests, ${data.xp} XP, `
    + new Date(data.submitted).toLocaleString();
  $('#submitout').hidden = false;
  store.set('submission', {receipt: data.receipt, name: data.name, github: data.github});
  toast('Receipt generated');
}

function downloadSubmission(){
  const data = window.__submission || submissionData();
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ocs-practice-${(data.github || data.name || 'submission').toLowerCase().replace(/\W+/g,'-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Downloaded your submission');
}

/* ---------- wire up ---------- */
$('#reset').onclick=()=>{editor.value=EXERCISES[active].start;syncGutter();run();saveDraft();toast('Reset to the starting code');};
$('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(editor.value);toast('Copied');}catch{toast('Could not copy');}};
$('#tokbtn').onclick=()=>openDrawer(true);
$('#tokclose').onclick=()=>openDrawer(false);
$('#scrim').onclick=()=>openDrawer(false);
$('#tsearch').addEventListener('input',e=>renderTokens(e.target.value));
$('#viewBeginner').onclick=()=>setTokenView(false);
$('#viewAll').onclick=()=>setTokenView(true);
$('#export').onclick=exportAll;

// Submission. The box only exists once every quest is solved, so these are
// only reachable from the finished state.
$('#submitbtn').onclick=()=>{
  const box=$('#submitbox');
  box.hidden=!box.hidden;
  if(!box.hidden){
    const saved=store.get('submission',null);
    if(saved){ $('#subname').value=saved.name||''; $('#subgh').value=saved.github||''; }
    setTimeout(()=>$('#subname').focus(),60);
  }
};
$('#subgen').onclick=buildSubmission;
$('#subfile').onclick=downloadSubmission;
$('#subcopy').onclick=async()=>{
  try{ await navigator.clipboard.writeText($('#subcode').textContent); toast('Receipt copied'); }
  catch{ toast('Could not copy - select the code instead'); }
};
$('#resetall').onclick=()=>{
  if(!confirm('Clear all progress, saved code and XP? This cannot be undone.'))return;
  progress={};drafts={};store.set('progress',{});store.set('drafts',{});
  paintXP();load();toast('Progress cleared');};

let t;
editor.addEventListener('input',()=>{syncGutter();clearTimeout(t);
  t=setTimeout(()=>{run();saveDraft();},250);});
/* ---------- editor keys ---------------------------------------------------------
   A plain <textarea> puts the caret at column 0 on every Enter, so the second
   line of a rule starts at the left edge and a beginner is fighting the box
   instead of learning CSS. This adds the handful of behaviours an editor is
   expected to have.

   Every edit goes through execCommand('insertText') where it can. It is
   deprecated, but it is the only way to change a textarea and keep the
   browser's own undo stack, and Ctrl+Z working matters more here than
   avoiding a deprecated call. Direct assignment is the fallback.           */

const INDENT = '  ';

function edit(text, selStart, selEnd){
  editor.focus();
  if (selStart !== undefined) editor.setSelectionRange(selStart, selEnd ?? selStart);
  let ok = false;
  try { ok = document.execCommand('insertText', false, text); } catch { ok = false; }
  if (!ok) {
    const s = editor.selectionStart, e = editor.selectionEnd;
    editor.value = editor.value.slice(0, s) + text + editor.value.slice(e);
    editor.setSelectionRange(s + text.length, s + text.length);
  }
  syncGutter();
  editor.dispatchEvent(new Event('input', {bubbles: true}));
}

const lineStart = pos => editor.value.lastIndexOf('\n', pos - 1) + 1;
const indentOf  = line => (line.match(/^[ \t]*/) || [''])[0];

editor.addEventListener('keydown', ev => {
  const v = editor.value, s = editor.selectionStart, e = editor.selectionEnd;
  const ls = lineStart(s);
  const lineSoFar = v.slice(ls, s);
  const pad = indentOf(v.slice(ls, v.indexOf('\n', ls) < 0 ? v.length : v.indexOf('\n', ls)));

  // --- Enter: keep this line's indent; go one deeper after an opening brace --
  if (ev.key === 'Enter' && !ev.shiftKey) {
    ev.preventDefault();
    const before = v.slice(0, s).trimEnd().slice(-1);
    const after  = v.slice(e).trimStart().slice(0, 1);
    const deeper = before === '{';
    const inner  = pad + (deeper ? INDENT : '');

    // Enter between { and } opens a room: an indented blank line with the
    // closing brace put back underneath it.
    if (deeper && after === '}') {
      edit('\n' + inner + '\n' + pad);
      const caret = s + 1 + inner.length;
      editor.setSelectionRange(caret, caret);
      syncGutter();
      return;
    }
    edit('\n' + inner);
    return;
  }

  // --- Tab / Shift+Tab -------------------------------------------------------
  if (ev.key === 'Tab') {
    ev.preventDefault();
    const multi = v.slice(s, e).includes('\n');

    if (!multi && !ev.shiftKey) { edit(INDENT); return; }

    // Whole-line indent or dedent across the selection.
    const from = lineStart(s);
    const to   = v.indexOf('\n', e) < 0 ? v.length : v.indexOf('\n', e);
    const block = v.slice(from, to);
    const out = block.split('\n').map(l =>
      ev.shiftKey ? l.replace(new RegExp('^' + INDENT), '') : INDENT + l).join('\n');
    edit(out, from, to);
    editor.setSelectionRange(from, from + out.length);
    syncGutter();
    return;
  }

  // --- typing } on a blank line lines it up with its opener -------------------
  if (ev.key === '}' && /^[ \t]+$/.test(lineSoFar)) {
    ev.preventDefault();
    const outdented = lineSoFar.slice(0, Math.max(0, lineSoFar.length - INDENT.length));
    edit(outdented + '}', ls, s);
    return;
  }

  // --- { closes itself, so a rule can never be left open by accident ----------
  if (ev.key === '{' && s === e) {
    ev.preventDefault();
    edit('{}');
    const caret = editor.selectionStart - 1;
    editor.setSelectionRange(caret, caret);
    return;
  }

  // --- typing } where one already sits just steps over it ---------------------
  if (ev.key === '}' && s === e && v[s] === '}') {
    ev.preventDefault();
    editor.setSelectionRange(s + 1, s + 1);
    return;
  }

  // --- Backspace inside pure indentation removes a whole level ----------------
  if (ev.key === 'Backspace' && s === e && s > ls && /^[ \t]+$/.test(lineSoFar)
      && lineSoFar.endsWith(INDENT)) {
    ev.preventDefault();
    edit('', s - INDENT.length, s);
    return;
  }
});
document.addEventListener('keydown',ev=>{
  if((ev.metaKey||ev.ctrlKey)&&ev.key==='Enter'){ev.preventDefault();grade();}
  if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='k'){ev.preventDefault();openDrawer(true);}
  if(ev.key==='Escape')openDrawer(false);
});

$('#targetbtn').onclick=()=>showTarget(!$('#targetbox').classList.contains('on'));
$('#shopbtn').onclick=()=>{$('#shop').classList.toggle('on');
  if($('#shop').classList.contains('on'))$('#shop').scrollIntoView({block:'center',behavior:'smooth'});};

/* ---------- first-run guided tour ---------- */
const TOUR=[
 {sel:'#brief', t:'Read the task here', b:'Every quest explains what to do and why it matters. There is a checklist under it that ticks off as you go.'},
 {sel:'.ed-wrap', t:'Type your code here', b:'This is a real code editor. Change something and the page updates as you type. You cannot break anything.'},
 {sel:'#preview', t:'See it live', b:'Whatever you write shows up here instantly. This is the actual thing you are building.'},
 {sel:'#notes', t:'Instant feedback', b:'Automatic checks run on every keystroke and explain anything that looks wrong, in plain words.'},
 {sel:'#tokbtn', t:'Browse the colours', b:'Every colour, size and timing you can use lives here. Click one to drop it into your code. More unlock as you finish chapters.'}
];
let tourI=0;
function tourStep(){
  const s=TOUR[tourI]; const el=document.querySelector(s.sel);
  const sp=$('#spot'), cd=$('#tourcard');
  if(!el){endTour();return;}
  // instant, not smooth: we measure straight after, and a smooth scroll is still
  // animating at that point, which put the spotlight below the fold.
  // scrollIntoView with behavior:'instant' is synchronous, so measure straight after.
  // (rAF is unreliable in background/headless tabs, so no frame wrapper here.)
  el.scrollIntoView({block:'center',behavior:'instant'});
  {
    const r=el.getBoundingClientRect();
    // .tour is position:fixed, so its absolutely-positioned children are already in
    // viewport coordinates. Adding scrollY here pushed the spotlight off-screen.
    sp.style.cssText=`top:${r.top-8}px;left:${r.left-8}px;width:${r.width+16}px;height:${r.height+16}px`;
    cd.innerHTML=`<h4>${s.t}</h4><p>${s.b}</p>
      <div class="trow2"><span class="tiny">${tourI+1} of ${TOUR.length}</span>
      <button class="ocs-btn ocs-btn--ghost ocs-btn--sm" id="tskip">Skip</button>
      <button class="ocs-btn ocs-btn--primary ocs-btn--sm" id="tnext">${tourI===TOUR.length-1?'Start':'Next'}</button></div>`;
    // keep the card on screen: below the target, or above it when there is no room
    const below=r.bottom+14, fitsBelow=below+190<innerHeight;
    cd.style.top=(fitsBelow?below:Math.max(14,r.top-204))+'px';
    cd.style.left=Math.max(14,Math.min(r.left,innerWidth-330))+'px';
    $('#tnext').onclick=()=>{tourI++;tourI<TOUR.length?tourStep():endTour();};
    $('#tskip').onclick=endTour;
  }
}
function startTour(){tourI=0;$('#tour').classList.add('on');tourStep();}
function endTour(){$('#tour').classList.remove('on');store.set('tourDone',true);}
$('#tourbtn').onclick=startTour;

setTokenView(showAll);paintXP();paintCredits();applyUnlocks();load();
if(!store.get('tourDone',false)) setTimeout(startTour,700);

/* ---------------------------------------------------------------
   Small localStorage helper. Every read and write is wrapped, because
   a private window or blocked site data makes localStorage throw
   rather than return null, and that would take the whole page down.
   --------------------------------------------------------------- */
const store = {
  get(k, d){ try { return JSON.parse(localStorage.getItem('ocs.'+k)) ?? d; } catch { return d; } },
  set(k, v){ try { localStorage.setItem('ocs.'+k, JSON.stringify(v)); } catch {} },
  del(k){ try { localStorage.removeItem('ocs.'+k); } catch {} }
};

/* ---------------------------------------------------------------
   Credits. Deliberately NOT a cosmetics casino.
   Research is clear that pure extrinsic reward loops shift focus off
   the learning (Hanus & Fox 2015). So most of what credits buy is a
   tool that lets you learn more. The looks are there because a page
   you enjoy sitting in is a page you stay on, and because recolouring
   this one is the same skill the quests teach.

   Every entry below does something. The first version of this list was
   six items and not one of them was wired to anything: sandbox and
   challenge had no code at all, the editor themes had no CSS, and the
   accents set a --coral variable the stylesheet never used.
   --------------------------------------------------------------- */
const SHOP = [
  // ---- tools: these change what you can do -------------------------------
  {id:'reveal', cost:20, kind:'tool', name:'Answer key',
   what:'Adds a "Show me the answer" button to every quest. Fills the editor with the solution so you can read it and take it apart.'},
  {id:'compare', cost:25, kind:'tool', name:'Light and dark side by side',
   what:'Shows your component on both backgrounds at once. This is how you catch a colour that only works on one of them.'},
  {id:'sandbox', cost:30, kind:'tool', name:'Sandbox',
   what:'A blank canvas with every token available and nothing to solve. Build whatever you like.'},
  {id:'challenge', cost:45, kind:'tool', name:'Challenge quests',
   what:'Three harder builds with no starting code and no step list. A target, and that is all.'},

  // ---- editor: how the code pane looks ------------------------------------
  {id:'theme-dusk', cost:10, kind:'editor', name:'Dusk editor',
   what:'A darker editor, easier at night.'},
  {id:'theme-paper', cost:10, kind:'editor', name:'Paper editor',
   what:'Warm and low contrast, easier on long sessions.'},
  {id:'theme-crt', cost:25, kind:'editor', name:'Phosphor editor',
   what:'Green text, black screen, scanlines and a slow flicker. A 1983 terminal.'},
  {id:'bigtype', cost:10, kind:'editor', name:'Bigger code',
   what:'Steps the editor text up two sizes.'},

  // ---- accent: recolour this page -----------------------------------------
  {id:'accent-blue', cost:8, kind:'accent', name:'Blue accent', what:'Recolour this page from coral to blue.', hex:'#4C8DF5'},
  {id:'accent-green', cost:8, kind:'accent', name:'Green accent', what:'Recolour this page from coral to green.', hex:'#3DBE72'},
  {id:'accent-violet', cost:8, kind:'accent', name:'Violet accent', what:'Recolour this page from coral to violet.', hex:'#9A7BE8'},
  {id:'accent-pick', cost:40, kind:'accent', name:'Any colour you like',
   what:'A colour picker for this page. Everything follows it, exactly the way the tokens you have been writing are supposed to.'},

  // ---- flair ---------------------------------------------------------------
  {id:'confetti', cost:15, kind:'flair', name:'Confetti',
   what:'Solving a quest throws a handful of it across the screen.'},
  {id:'ranks', cost:20, kind:'flair', name:'Ranks',
   what:'A title next to your credits that changes as you finish quests, from Beginner up to Tokensmith.'}
];

const RANKS = [
  [0,'Beginner'], [2,'Apprentice'], [4,'Stylist'], [6,'Themer'],
  [8,'Token wrangler'], [10,'Tokensmith'], [13,'Grandmaster of Braces']
];
function rankFor(solvedCount){
  let name = RANKS[0][1];
  for (const [n, label] of RANKS) if (solvedCount >= n) name = label;
  return name;
}

function credits(){ return store.get('credits', 0); }
function addCredits(n){ store.set('credits', credits()+n); paintCredits(); }
function spend(n){ if(credits()<n) return false; store.set('credits', credits()-n); paintCredits(); return true; }
function owned(){ return store.get('owned', []); }
function owns(id){ return owned().includes(id); }
function buy(item){
  if(owns(item.id)) return 'already';
  if(!spend(item.cost)) return 'poor';
  store.set('owned', [...owned(), item.id]);
  // Turning a look on the moment it is bought is the least surprising thing
  // to do. Tools switch themselves on because there is nothing to choose.
  if(item.kind==='editor') store.set('activeTheme', item.id);
  // accent-pick has no fixed hex, so an `item.hex` guard here skipped it and
  // buying the picker left the previous accent switched on.
  if(item.kind==='accent') store.set('activeAccent', item.id);
  applyUnlocks();
  return 'ok';
}

// Everything a purchase actually changes, in one place, run on load too.
function applyUnlocks(){
  const o = owned(), root = document.documentElement, body = document.body;

  // Editor look. The CSS lives under [data-editor-theme] in page.scss.
  const th = store.get('activeTheme','');
  body.dataset.editorTheme = (o.includes(th) && th.startsWith('theme-')) ? th.replace('theme-','') : '';
  body.dataset.bigtype = o.includes('bigtype') && store.get('bigtype', true) ? 'on' : '';

  // Page accent. The page is built on --ocs-brand, so that is what to move,
  // along with the two tokens derived from it.
  const accId = store.get('activeAccent','');
  const acc = SHOP.find(s => s.id === accId);
  let hex = null;
  if (accId === 'accent-pick' && o.includes('accent-pick')) hex = store.get('pickHex', '#4C8DF5');
  else if (acc && acc.hex && o.includes(accId)) hex = acc.hex;
  if (hex) {
    root.style.setProperty('--ocs-brand', hex);
    root.style.setProperty('--ocs-accent', hex);
    root.style.setProperty('--ocs-brand-border', hex);
  } else {
    root.style.removeProperty('--ocs-brand');
    root.style.removeProperty('--ocs-accent');
    root.style.removeProperty('--ocs-brand-border');
  }

  // Tools just flip a flag the rest of the page reads.
  body.dataset.compare = o.includes('compare') && store.get('compare', true) ? 'on' : '';
  if (typeof renderChapters === 'function') renderChapters();
}

// Confetti, drawn with nothing but divs so there is no library to load.
function celebrate(){
  if (!owns('confetti')) return;
  const colours = ['#EA706E','#4C8DF5','#3DBE72','#F5C24C','#9A7BE8'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < 40; i++) {
    const bit = document.createElement('i');
    bit.style.left = Math.random()*100 + '%';
    bit.style.background = colours[i % colours.length];
    bit.style.animationDelay = (Math.random()*0.35).toFixed(2) + 's';
    bit.style.transform = `rotate(${Math.floor(Math.random()*360)}deg)`;
    box.appendChild(bit);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 2600);
}

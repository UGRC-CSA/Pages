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
   the learning (Hanus & Fox 2015). So credits buy things that let you
   learn MORE, plus a couple of harmless personalisations. The only
   "cost" in the learning path is the full-answer hint, which exists to
   make you try first, never to block you.
   --------------------------------------------------------------- */
const SHOP = [
  {id:'sandbox', cost:30, name:'Sandbox mode',
   what:'A blank canvas with every token available. Build whatever you like, no quest, no checks.'},
  {id:'challenge', cost:40, name:'Challenge quests',
   what:'Three harder builds with no starting code and no step list. Just a target to hit.'},
  {id:'theme-dusk', cost:15, name:'Dusk editor theme', what:'A darker editor, easier at night.'},
  {id:'theme-paper', cost:15, name:'Paper editor theme', what:'Warm and low-contrast, easier on long sessions.'},
  {id:'accent-blue', cost:10, name:'Blue accent', what:'Recolour this page from coral to blue.'},
  {id:'accent-green',cost:10, name:'Green accent', what:'Recolour this page from coral to green.'}
];

function credits(){ return store.get('credits', 0); }
function addCredits(n){ store.set('credits', credits()+n); paintCredits(); }
function spend(n){ if(credits()<n) return false; store.set('credits', credits()-n); paintCredits(); return true; }
function owned(){ return store.get('owned', []); }
function owns(id){ return owned().includes(id); }
function buy(item){
  if(owns(item.id)) return 'already';
  if(!spend(item.cost)) return 'poor';
  store.set('owned', [...owned(), item.id]);
  applyUnlocks();
  return 'ok';
}
function applyUnlocks(){
  const o = owned();
  document.body.dataset.editorTheme = o.includes('theme-dusk') && store.get('activeTheme','')==='theme-dusk' ? 'dusk'
    : o.includes('theme-paper') && store.get('activeTheme','')==='theme-paper' ? 'paper' : '';
  const acc = store.get('activeAccent','');
  document.documentElement.style.setProperty('--coral',
    acc==='accent-blue' ? '#2563A8' : acc==='accent-green' ? '#1F7A45' : '');
}

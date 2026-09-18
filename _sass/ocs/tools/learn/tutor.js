/* ---------------------------------------------------------------
   The checker. Deterministic rules, each one explains WHY.
   Runs on the student's SCSS + the rendered result.
   --------------------------------------------------------------- */
const TOKEN_SUGGEST = {
  '#e06665':'--ocs-accent','#ea706e':'--ocs-accent','#34c759':'--ocs-success',
  '#ff453a':'--ocs-danger','#ff9f0a':'--ocs-warning','#007aff':'--ocs-info',
  '#5293ff':'--ocs-info','#121212':'--ocs-surface-base','#1c1c1e':'--ocs-surface-raised',
  '#2c2c2e':'--ocs-surface-elevated','#ffffff':'--ocs-accent-contrast','#fff':'--ocs-accent-contrast',
  '#949498':'--ocs-text-muted','#000':'--ocs-surface-base','#000000':'--ocs-surface-base'
};

function relLum({r,g,b}) {
  const f = v => { v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4); };
  return 0.2126*f(r)+0.7152*f(g)+0.0722*f(b);
}
function parseRGB(str) {
  const m = String(str).match(/[\d.]+/g);
  if (!m) return null;
  return { r:+m[0], g:+m[1], b:+m[2], a: m[3]===undefined?1:+m[3] };
}
function over(fg,bg){const a=fg.a;return{r:fg.r*a+bg.r*(1-a),g:fg.g*a+bg.g*(1-a),b:fg.b*a+bg.b*(1-a),a:1};}
function paintedBg(el){
  let n=el,stack=[];
  while(n && n!==document.documentElement.parentNode){
    const c=parseRGB(getComputedStyle(n).backgroundColor);
    if(c&&c.a>0)stack.push(c);
    if(c&&c.a===1)break;
    n=n.parentElement;
  }
  let base={r:18,g:18,b:18,a:1};
  for(let i=stack.length-1;i>=0;i--)base=over(stack[i],base);
  return base;
}
function contrastOf(el){
  const bg=paintedBg(el);
  const fg=over(parseRGB(getComputedStyle(el).color)||{r:255,g:255,b:255,a:1},bg);
  const A=relLum(fg),B=relLum(bg);
  return (Math.max(A,B)+0.05)/(Math.min(A,B)+0.05);
}

function runChecks(scss, compiled, previewRoot) {
  const notes = [];
  const src = scss.toLowerCase();

  // Nothing usable was written yet. Say so plainly instead of reporting "all clear",
  // which is what a blank or garbage editor used to produce.
  const looksLikeCss = /\{[\s\S]*\}/.test(scss) && /:/.test(scss);
  if (!scss.trim()) {
    return [{level:'info', title:'Nothing here yet',
      why:'The editor is empty, so there is no CSS to check.',
      fix:'Press <b>Start over</b> to bring back the starting code.'}];
  }
  if (!looksLikeCss) {
    return [{level:'error', title:'That is not CSS yet',
      why:'A CSS rule needs a name, then curly braces, then lines like <code>property: value;</code> inside them. Right now there is nothing the browser can read.',
      fix:'Press <b>Start over</b> to get the first version back. Then change one thing at a time.'}];
  }
  if (!compiled.trim()) {
    return [{level:'error', title:'Nothing compiled',
      why:'There is text in the editor, but no finished rule came out of it. Usually that means a missing <code>{</code>, <code>}</code> or <code>;</code>.',
      fix:'Check that every <code>{</code> has a <code>}</code> to match. Every line inside should end with <code>;</code>.'}];
  }

  // 1. hardcoded colours where a token exists
  const hexes = [...new Set((scss.match(/#[0-9a-fA-F]{3,8}\b/g)||[]).map(h=>h.toLowerCase()))];
  for (const h of hexes) {
    const tok = TOKEN_SUGGEST[h];
    notes.push({
      level:'warn', title:`Hardcoded colour ${h}`,
      why:'A hex code is fixed forever. var(--ocs-accent) changes to whatever colour the reader picked, so the button matches them.',
      fix: tok ? `Swap it for <code>var(${tok})</code>.` : 'Use one of the --ocs-* tokens, or add a new one to _tokens.scss if none fits.'
    });
  }
  if ((scss.match(/rgb\(|rgba\(|hsl\(/gi)||[]).length) {
    notes.push({level:'warn',title:'Literal rgb()/hsl() colour',
      why:'Same problem as a hex code. It won\'t respond to the theme.',
      fix:'Use a --ocs-* token instead. If you need it see-through, color-mix(in srgb, var(--ocs-brand) 20%, transparent) still follows the theme.'});
  }

  // 2. background without a paired foreground
  const setsBg = /background(-color)?\s*:/.test(src);
  const setsFg = /(^|[^-])color\s*:/.test(src);
  if (setsBg && !setsFg) {
    notes.push({level:'warn',title:'Background set, text colour not set',
      why:'Every background token has a matching text token. Set only one and you can end up with text nobody can read.',
      fix:'Add the matching text colour. For example: background: var(--ocs-brand); color: var(--ocs-brand-contrast);'});
  }

  // 3. focus handling
  if (/outline\s*:\s*none/.test(src) && !/focus-visible/.test(src)) {
    notes.push({level:'error',title:'Focus outline removed with nothing replacing it',
      why:'That outline shows keyboard users where they are. Take it away and put nothing back, and the page cannot be used without a mouse.',
      fix:'If you must remove it, add a :focus-visible style with a visible ring. There is a shared one: @include focus-ring; or box-shadow: var(--ocs-focus-ring);'});
  }

  // 4. motion
  if (/transition\s*:\s*all/.test(src)) {
    notes.push({level:'info',title:'transition: all',
      why:'It animates every property that changes, including ones you never meant to animate. That is slower, and it can cause odd flashes.',
      fix:'Name the properties: transition: background-color var(--ocs-duration-fast) var(--ocs-ease);'});
  }
  if (/transform|animation|transition/.test(src) && !/prefers-reduced-motion/.test(src)) {
    notes.push({level:'info',title:'No reduced-motion guard',
      why:'Some people get motion sickness from movement on screen and turn on a system setting to stop it. Nothing in the current OCS SCSS honours it.',
      fix:'Wrap the movement: @media (prefers-reduced-motion: reduce) { transition: none; transform: none; }'});
  }

  // 5. naming
  const badSel = (compiled.match(/^\s*\.([a-z][\w-]*)/gmi)||[])
    .map(s=>s.trim().slice(1)).filter(c=>!c.startsWith('ocs'));
  if (badSel.length) {
    notes.push({level:'warn',title:`Unprefixed class .${badSel[0]}`,
      why:'Pages loads Bootstrap on some templates and has 227 loose class names already. A bare name like this can collide with something else and break a page you never touched.',
      fix:'Prefix it: .ocs-'+badSel[0]+' or follow the existing .ocs__btn--modifier pattern.'});
  }

  // 6. measured contrast on what actually rendered
  if (previewRoot) {
    previewRoot.querySelectorAll('*').forEach(el=>{
      const txt=(el.textContent||'').trim();
      if(!txt||el.children.length)return;
      const r=contrastOf(el);
      const cs=getComputedStyle(el);
      const big=parseFloat(cs.fontSize)>=24||(parseInt(cs.fontWeight,10)>=700&&parseFloat(cs.fontSize)>=18.66);
      const need=big?3:4.5;
      if(r<need){
        notes.push({level:'error',title:`Contrast ${r.toFixed(2)}:1 - needs ${need}:1`,
          why:`The text "${txt.slice(0,24)}" is too close in lightness to what is behind it. At 1.00:1 the two colours are identical and the text is invisible.`,
          fix:'Pick a foreground token solved against this surface, or darken/lighten the background. The pair tokens already clear 4.5:1.'});
      }
    });
  }
  return notes;
}

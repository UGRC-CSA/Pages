const CHAPTERS = [
  {n:0, name:'Warm-up',    blurb:'Never written CSS before? Start here. One line, one change.'},
  {n:1, name:'Colour',      blurb:'How the token system keeps everything readable and themeable.'},
  {n:2, name:'State',       blurb:'Making components respond to hover, focus and disabled.'},
  {n:3, name:'Components',  blurb:'Putting it together into things people actually use.'},
  {n:4, name:'Challenges',   blurb:'No starting code and no step list. Unlocked with credits.', locked:'challenge'},
  {n:5, name:'Sandbox',      blurb:'No quest, no checks. Build whatever you want.', locked:'sandbox'}
];

const EXERCISES = [

 {id:0, ch:0, badge:'Start', title:'Change one word',
  learn:'What CSS is, in about thirty seconds.',
  concept:{t:'What am I even looking at?',
    b:'CSS is how you tell a browser what something should look like. It has three parts. First, <b>what</b> you are styling: <code>.ocs-demo-btn</code>. Second, <b>which part</b> of it you are changing: <code>background</code>. Third, <b>what to change it to</b>: <code>red</code>. Change that last part and the button changes.'},
  brief:'The button on the right is red. Find the word <code>red</code> in the editor and change it to <code>blue</code>. Watch the preview as you type.',
  steps:[{label:'Change <code>red</code> to <code>blue</code>', test:s=>/background\s*:\s*blue/i.test(s)}],
  hints:['Look at line 2. Delete the word <code>red</code> and type <code>blue</code> in its place.',
         'Keep the semicolon at the end of the line.',
         'The line should read <code>background: blue;</code>'],
  start:`.ocs-demo-btn {
  background: red;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
}`,
  html:`<button class="ocs-demo-btn">Click me</button>`,
  goal:'The button turns blue.',
  solution:`.ocs-demo-btn {
  background: blue;
  color: white;
  padding: 10px 18px;
  border: none;
  border-radius: 8px;
}`,
  pass: s => /background\s*:\s*blue/i.test(s)},
/* ============================ CHAPTER 1 ============================ */
 {id:1, ch:1, badge:'Tokens', title:'Use a token, not a hex code',
  learn:'Why a typed-in colour can never follow the reader’s own.',
  concept:{t:'What is a design token?',
    b:'A token is a colour or a size that has a name. Instead of typing <code>#E06665</code> in forty places, you write <code>var(--ocs-accent)</code> everywhere. Then you only have to change it once. Pages has 78 tokens.'},
  brief:'The colours on this button are typed in by hand. A reader can pick their own colour in preferences, but this button ignores it. Swap both colours for tokens.',
  steps:[
    {label:'Swap the background for <code>var(--ocs-accent)</code>', test:s=>/background[^;]*var\(--ocs-accent\)/.test(s)},
    {label:'Swap the text colour for <code>var(--ocs-accent-contrast)</code>', test:s=>/color\s*:[^;]*var\(--ocs-accent-contrast\)/.test(s)},
    {label:'No hex codes left', test:s=>!/#[0-9a-f]{3,8}/i.test(s)}],
  hints:['Tokens look like <code>var(--ocs-something)</code>. Open the token panel on the right to browse them.',
         'The background wants <code>var(--ocs-accent)</code>. Now find its partner for the text.',
         'Full answer: <code>background: var(--ocs-accent); color: var(--ocs-accent-contrast);</code>'],
  start:`.ocs-demo-btn {
  background: #E06665;
  color: #FFFFFF;
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
}`,
  html:`<button class="ocs-demo-btn">Save changes</button>`,
  goal:'No hex codes left, and the text is still easy to read.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
}`,
  pass: s => !/#[0-9a-f]{3,8}/i.test(s) && /var\(--ocs-/.test(s)},

 {id:2, ch:1, badge:'Pairing', title:'Pair a background with its text',
  learn:'Every background colour has a matching text colour.',
  concept:{t:'Why colours come in pairs',
    b:'Every background token has a matching text token right next to it. Take both and the text is always readable. That is how you avoid grey text on a grey button.'},
  brief:'This card has a background colour but no text colour. So the text stays whatever colour the page was already using. Set the text colour too.',
  steps:[
    {label:'Use a background token', test:s=>/background[^;]*var\(--ocs-/.test(s)},
    {label:'Set a text colour from a token', test:s=>/(^|[^-])color\s*:[^;]*var\(--ocs-/m.test(s)},
    {label:'Contrast clears 4.5:1', test:(s,c,ok)=>ok}],
  hints:['A background token and a text token always travel together.',
         'Try <code>var(--ocs-accent-bg)</code> for a soft background. What text colour goes on it?',
         'Full answer: <code>background: var(--ocs-accent-bg); color: var(--ocs-text);</code>'],
  start:`.ocs-demo-card {
  background: var(--ocs-accent);
  padding: 16px;
  border-radius: 12px;
}`,
  html:`<div class="ocs-demo-card">Two assignments due this week</div>`,
  goal:'Background and text both from tokens, and the text is readable.',
  solution:`.ocs-demo-card {
  background: var(--ocs-accent-bg);
  color: var(--ocs-text);
  padding: 16px;
  border-radius: 12px;
}`,
  pass: s => /background[^;]*var\(--ocs-/.test(s) && /(^|[^-])color\s*:[^;]*var\(--ocs-/m.test(s)},

 {id:3, ch:1, badge:'Theming', title:'Make the hover follow the theme',
  learn:'Work out a colour in the browser instead of fixing it in advance.',
  concept:{t:'Two places a colour can be worked out',
    b:'Sass runs once, before anyone opens the page. Whatever it works out gets written into the CSS file and never changes. <code>color-mix()</code> runs in the browser instead. It sees the colour the reader picked, so the hover matches it.'},
  brief:'The hover colour here is typed in by hand. Change the button colour and the hover no longer matches it. <code>color-mix()</code> mixes two colours in the browser, so the hover can follow.',
  // These read the compiled rule, not the letters in the editor. `color-mix(
  // var(--ocs-accent));` used to tick all three: it has no property, no colon,
  // and the browser drops it, but every word the old regexes wanted was there.
  steps:[
    {label:'Remove the hardcoded hover colour', test:s=>!/#[0-9a-f]{3,8}/i.test(s)},
    {label:'Use <code>color-mix()</code> in the hover',
     // Chrome will say it "supports" color-mix() without a colour space, so ask
     // for the `in <space>` explicitly rather than trusting CSS.supports alone.
     test:(s,c)=>declarations(c).some(d => /:hover\b/.test(d.sel) && d.prop
                && /color-mix\s*\(\s*in\s+[a-z-]+/i.test(codeOf(d.value))
                && browserAccepts(d.prop, d.value))},
    {label:'Mix from <code>var(--ocs-accent)</code>',
     test:(s,c)=>declarations(c).some(d => /:hover\b/.test(d.sel) && d.prop
                && /color-mix\s*\(\s*in\s+[a-z-]+[^)]*var\(\s*--ocs-accent\s*\)/i.test(codeOf(d.value))
                && browserAccepts(d.prop, d.value))}],
  hints:['<code>color-mix()</code> takes a colour space, then two colours with a percentage.',
         'Shape: <code>color-mix(in srgb, SOMECOLOUR 85%, black)</code> gives a slightly darker version.',
         'Full answer: <code>background: color-mix(in srgb, var(--ocs-accent) 85%, black);</code>'],
  start:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;

  &:hover {
    background: #B34E4D;
  }
}`,
  html:`<button class="ocs-demo-btn">Hover over me</button>`,
  goal:'The hover uses color-mix() with var(--ocs-accent). No hex codes.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;

  &:hover {
    background: color-mix(in srgb, var(--ocs-accent) 85%, black);
  }
}`,
  pass: (s, c) => !/#[0-9a-f]{3,8}/i.test(s)
    && declarations(c).some(d => /:hover\b/.test(d.sel) && d.prop
         && /color-mix\s*\(\s*in\s+[a-z-]+[^)]*var\(\s*--ocs-accent\s*\)/i.test(codeOf(d.value))
         && browserAccepts(d.prop, d.value))},

/* ============================ CHAPTER 2 ============================ */
 {id:4, ch:2, badge:'Nesting', title:'Build a variant with &',
  learn:'The <code>&</code> shortcut, and how components are named.',
  concept:{t:'The & operator',
    b:'Inside a rule, <code>&</code> means the name of the rule you are already in. So <code>&--ghost</code> inside <code>.ocs-demo-btn</code> becomes <code>.ocs-demo-btn--ghost</code>. That is a second class, not something inside the first one. Two dashes is how this codebase names a different version of a component.'},
  brief:'Add a second version of this button. It should have no background fill, coloured text, and a visible border. Use <code>&</code> so it becomes its own class.',
  steps:[
    {label:'Add a nested block starting with <code>&--ghost</code>', test:s=>/&--ghost/.test(s)},
    {label:'It compiles to <code>.ocs-demo-btn--ghost</code>', test:(s,c)=>/\.ocs-demo-btn--ghost/.test(c)},
    {label:'Ghost has a see-through background', test:s=>/&--ghost[\s\S]*background\s*:\s*transparent/.test(s)}],
  hints:['Add a nested block starting with <code>&--ghost</code>.',
         'Ghost means <code>background: transparent</code>, with text and border taking the accent colour.',
         'Full answer: <code>&--ghost { background: transparent; color: var(--ocs-accent); border-color: var(--ocs-accent-border); }</code>'],
  start:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 8px;

  // add your &--ghost block here
}`,
  html:`<button class="ocs-demo-btn">Primary</button>
<button class="ocs-demo-btn demo-btn--ghost">Ghost</button>`,
  goal:'A &--ghost block that becomes .ocs-demo-btn--ghost.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: 1px solid transparent;
  border-radius: 8px;

  &--ghost {
    background: transparent;
    color: var(--ocs-accent);
    border-color: var(--ocs-accent-border);
  }
}`,
  pass: (s,c) => /&--ghost/.test(s) && /\.ocs-demo-btn--ghost/.test(c)},

 {id:5, ch:2, badge:'Focus', title:'Give it a focus ring',
  learn:'How someone using a keyboard knows where they are.',
  concept:{t:'focus vs focus-visible',
    b:'<code>:focus</code> fires for mouse clicks too. That makes the outline show up when nobody needs it, so people delete it. <code>:focus-visible</code> only fires when the browser thinks you need to see it. That usually means you are using the keyboard. Use that one instead.'},
  brief:'When you press Tab, the browser draws an outline around whatever you landed on. This input removes that outline and puts nothing in its place. Someone using the keyboard now has no idea where they are. Add an outline back for keyboard users only.',
  steps:[
    {label:'Use <code>:focus-visible</code> instead of <code>:focus</code>', test:s=>/focus-visible/.test(s)},
    {label:'Add something you can actually see', test:s=>/box-shadow|outline\s*:\s*(?!none)/.test(s)}],
  hints:['The selector <code>:focus-visible</code> matches keyboard focus but not a mouse click.',
         'Inside <code>&:focus-visible</code>, add something you can see — a <code>box-shadow</code> ring works well.',
         'Full answer: <code>&:focus-visible { outline: none; box-shadow: 0 0 0 3px var(--ocs-accent); }</code>'],
  start:`.ocs-demo-input {
  background: var(--ocs-surface-raised);
  color: var(--ocs-text);
  border: 1px solid var(--ocs-border);
  border-radius: 8px;
  padding: 8px 12px;

  &:focus {
    outline: none;
  }
}`,
  html:`<input class="ocs-demo-input" value="Press Tab to reach me">`,
  goal:'Uses :focus-visible, and you can see it. Press Tab in the preview.',
  solution:`.ocs-demo-input {
  background: var(--ocs-surface-raised);
  color: var(--ocs-text);
  border: 1px solid var(--ocs-border);
  border-radius: 8px;
  padding: 8px 12px;

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px var(--ocs-accent);
  }
}`,
  pass: s => /focus-visible/.test(s) && /(box-shadow|outline\s*:\s*(?!none))/.test(s)},

 {id:6, ch:2, badge:'Disabled', title:'Style the disabled state',
  learn:'Style the state the browser already knows about.',
  concept:{t:'Style from state, not a class',
    b:'A disabled button already has the <code>disabled</code> attribute. Screen readers read that attribute out. If you make your own <code>.is-disabled</code> class instead, you now have two things to keep in step. Forget one and a button looks disabled but still works. Style <code>&:disabled</code> and there is only one thing to get right.'},
  brief:'This button looks the same whether it works or not. Style the real <code>:disabled</code> state so you can tell. Do not add a new class.',
  steps:[
    {label:'Add a <code>&:disabled</code> block', test:s=>/&:disabled|:disabled/.test(s)},
    {label:'It compiles to <code>.ocs-demo-btn:disabled</code>', test:(s,c)=>/\.ocs-demo-btn:disabled/.test(c)},
    {label:'Make it look unavailable', test:s=>/opacity|cursor\s*:\s*not-allowed/.test(s)}],
  hints:['Use the pseudo-class <code>&:disabled</code>, not a class name.',
         'Disabled usually means dimmed and a <code>not-allowed</code> cursor. <code>opacity</code> is the simplest way.',
         'Full answer: <code>&:disabled { opacity: 0.45; cursor: not-allowed; }</code>'],
  start:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;

  // style the disabled state here
}`,
  html:`<button class="ocs-demo-btn">Works</button>
<button class="ocs-demo-btn" disabled>Disabled</button>`,
  goal:'A &:disabled block. The second button should look like you cannot click it.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}`,
  pass: (s,c) => /&:disabled|:disabled/.test(s) && /\.ocs-demo-btn:disabled/.test(c)},

 {id:7, ch:2, badge:'Spacing', title:'Use the spacing scale',
  learn:'Why spacing comes from a fixed set of sizes.',
  concept:{t:'The spacing scale',
    b:'Pages has eleven spacing sizes. They run from <code>--ocs-space-1</code> at 0.25rem up to <code>--ocs-space-16</code> at 4rem. Picking from a fixed set keeps every gap on the page related. Typing your own numbers is what makes a layout feel slightly off.'},
  brief:'The spacing on this card was guessed: 13px, 19px, 7px. Swap each one for a spacing token. Pick the closest size.',
  steps:[
    {label:'Replace the padding numbers with spacing tokens', test:s=>/padding[^;]*var\(--ocs-space-/.test(s)},
    {label:'Replace the gap number too', test:s=>/gap[^;]*var\(--ocs-space-/.test(s)},
    {label:'No raw pixel values left', test:s=>!/(padding|gap)\s*:[^;]*\d+px/.test(s)}],
  hints:['Spacing tokens are <code>var(--ocs-space-1)</code> through <code>var(--ocs-space-16)</code>.',
         '<code>--ocs-space-3</code> is 0.75rem (12px) and <code>--ocs-space-5</code> is 1.25rem (20px).',
         'Full answer: <code>padding: var(--ocs-space-3) var(--ocs-space-5); gap: var(--ocs-space-2);</code>'],
  start:`.ocs-demo-card {
  background: var(--ocs-surface-raised);
  color: var(--ocs-text);
  border: 1px solid var(--ocs-border);
  border-radius: 12px;
  padding: 13px 19px;
  display: flex;
  gap: 7px;
}`,
  html:`<div class="ocs-demo-card"><b>Unit 3</b><span>due Friday</span></div>`,
  goal:'No pixel numbers left in padding or gap.',
  solution:`.ocs-demo-card {
  background: var(--ocs-surface-raised);
  color: var(--ocs-text);
  border: 1px solid var(--ocs-border);
  border-radius: 12px;
  padding: var(--ocs-space-3) var(--ocs-space-5);
  display: flex;
  gap: var(--ocs-space-2);
}`,
  pass: s => /var\(--ocs-space-/.test(s) && !/(padding|gap)\s*:[^;]*\d+px/.test(s)},

/* ============================ CHAPTER 3 ============================ */
 {id:8, ch:3, badge:'Badge', title:'Build a status badge',
  learn:'Build a small component from an empty rule.',
  concept:{t:'Small things get seen the most',
    b:'A badge shows up hundreds of times on a site. A big hero image shows up once. So the small details here matter more. You need a pill shape, tight padding, small bold text, and a background the text stays readable on.'},
  brief:'Build a badge from an empty rule. Make it a pill shape. Give it a soft green background and text you can read on it. Use small text and spacing from the scale.',
  steps:[
    {label:'Make it a pill with <code>--ocs-radius-full</code>', test:s=>/radius-full/.test(s)},
    {label:'Use the success colour set', test:s=>/var\(--ocs-success/.test(s)},
    {label:'Pad it from the spacing scale', test:s=>/padding[^;]*var\(--ocs-space-/.test(s)}],
  hints:['Pill shape comes from <code>border-radius: var(--ocs-radius-full)</code>.',
         'Success has a set: <code>--ocs-success</code>, <code>--ocs-success-bg</code>, <code>--ocs-success-border</code>.',
         'Full answer: <code>background: var(--ocs-success-bg); color: var(--ocs-success); border: 1px solid var(--ocs-success-border); border-radius: var(--ocs-radius-full); padding: var(--ocs-space-1) var(--ocs-space-3); font-size: 0.8rem; font-weight: 600;</code>'],
  start:`.ocs-demo-badge {
  display: inline-block;
  // build it from here
}`,
  html:`<span class="ocs-demo-badge">Passing</span>`,
  goal:'Pill shape, colours from tokens, spacing from the scale, and readable text.',
  solution:`.ocs-demo-badge {
  display: inline-block;
  background: var(--ocs-success-bg);
  color: var(--ocs-success);
  border: 1px solid var(--ocs-success-border);
  border-radius: var(--ocs-radius-full);
  padding: var(--ocs-space-1) var(--ocs-space-3);
  font-size: 0.8rem;
  font-weight: 600;
}`,
  pass: s => /radius-full/.test(s) && /var\(--ocs-success/.test(s) && /var\(--ocs-space-/.test(s)},

 {id:9, ch:3, badge:'Alert', title:'Build an alert with a border accent',
  learn:'Use a border to say something, not just to decorate.',
  concept:{t:'Never let colour be the only clue',
    b:'About 1 in 12 people cannot tell red from green. Say your warning is red and your success message is green. If that colour is the only difference, those readers see no difference at all. Add something else as well: a thick border, an icon, or just the word.'},
  brief:'Build a warning box. Give it a soft background and a thick left border in the warning colour. The text needs to be readable. Use padding from the scale.',
  steps:[
    {label:'Add a thick <code>border-left</code>', test:s=>/border-left/.test(s)},
    {label:'Use the warning colour set', test:s=>/var\(--ocs-warning/.test(s)},
    {label:'Pad it from the spacing scale', test:s=>/padding[^;]*var\(--ocs-space-/.test(s)}],
  hints:['A left accent uses <code>border-left: 4px solid ...</code> on top of a thin border, or on its own.',
         'The warning set is <code>--ocs-warning</code>, <code>--ocs-warning-bg</code>, <code>--ocs-warning-border</code>.',
         'Full answer: <code>background: var(--ocs-warning-bg); color: var(--ocs-text); border-left: 4px solid var(--ocs-warning); border-radius: var(--ocs-radius-md); padding: var(--ocs-space-3) var(--ocs-space-4);</code>'],
  start:`.ocs-demo-alert {
  // build it from here
}`,
  html:`<div class="ocs-demo-alert"><b>Heads up.</b> Your last submission had no tests.</div>`,
  goal:'Soft background, warning-coloured left border, spacing from tokens.',
  solution:`.ocs-demo-alert {
  background: var(--ocs-warning-bg);
  color: var(--ocs-text);
  border-left: 4px solid var(--ocs-warning);
  border-radius: var(--ocs-radius-md);
  padding: var(--ocs-space-3) var(--ocs-space-4);
}`,
  pass: s => /border-left/.test(s) && /var\(--ocs-warning/.test(s) && /var\(--ocs-space-/.test(s)},

 {id:10, ch:3, badge:'Motion', title:'Respect reduced motion',
  learn:'Let people switch the movement off.',
  concept:{t:'prefers-reduced-motion',
    b:'Movement on screen gives some people motion sickness or migraines. Every operating system has a setting to turn it down. The browser tells your CSS about that setting. Nothing in the current OCS stylesheets checks for it, and 71 rules animate. Yours should.'},
  brief:'This button lifts and grows when you hover it. Keep that for people who like it. Turn the movement off for anyone who has asked their computer for less motion.',
  steps:[
    {label:'Add a <code>@media (prefers-reduced-motion: reduce)</code> block', test:s=>/prefers-reduced-motion/.test(s)},
    {label:'Switch the movement off inside it', test:s=>/(transform|transition)\s*:\s*none/.test(s)}],
  hints:['The query is <code>@media (prefers-reduced-motion: reduce)</code>.',
         'You can nest a media query inside the rule in SCSS. Set <code>transition</code> and <code>transform</code> to <code>none</code> inside it.',
         'Full answer: add <code>@media (prefers-reduced-motion: reduce) { transition: none; &:hover { transform: none; } }</code>'],
  start:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  transition: transform var(--ocs-duration-fast) var(--ocs-ease);

  &:hover { transform: translateY(-2px) scale(1.03); }

  // make the movement optional here
}`,
  html:`<button class="ocs-demo-btn">Hover me</button>`,
  goal:'A prefers-reduced-motion block that turns the movement off.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  transition: transform var(--ocs-duration-fast) var(--ocs-ease);

  &:hover { transform: translateY(-2px) scale(1.03); }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover { transform: none; }
  }
}`,
  pass: s => /prefers-reduced-motion/.test(s) && /(transform|transition)\s*:\s*none/.test(s)}

/* ============================ CHALLENGES ============================
   Bought with credits. No starting code and no step list: a target, a
   goal sentence, and the checker. `locked` keeps them out of the
   chapter list until the unlock is owned.                             */
 ,{id:11, ch:4, badge:'Challenge', locked:'challenge', title:'Build a toast from nothing',
  learn:'A whole component with no scaffolding.',
  concept:{t:'No starting code',
    b:'From here you get a description and a target picture. Everything else is yours. Use the token drawer when you cannot remember a name.'},
  brief:'Build a toast: a dark rounded box, readable text, a coloured bar down the left edge, and comfortable padding. Every colour and every size has to come from a token.',
  steps:[
    {label:'Pad it from the spacing scale',
     test:(s,c)=>declarations(c).some(d=>d.prop==='padding' && /var\(--ocs-space-/.test(d.value) && browserAccepts(d.prop,d.value))},
    {label:'Round it from the radius scale',
     test:(s,c)=>declarations(c).some(d=>/^border-radius$/.test(d.prop||'') && /var\(--ocs-radius-/.test(d.value) && browserAccepts(d.prop,d.value))},
    {label:'A coloured bar down the left edge',
     test:(s,c)=>declarations(c).some(d=>/^border-left/.test(d.prop||'') && /var\(--ocs-/.test(d.value) && browserAccepts(d.prop,d.value))},
    {label:'No hex codes anywhere', test:s=>!/#[0-9a-f]{3,8}/i.test(s)}],
  hints:['Start with the box: a background token, a text token, padding and a radius.',
         'The bar is <code>border-left</code>. It takes a width, a style and a colour.',
         'Full answer: <code>border-left: 4px solid var(--ocs-info);</code>'],
  start:`.ocs-demo-toast {
  /* nothing here yet. build it. */
}`,
  html:`<div class="ocs-demo-toast">Saved to your portfolio.</div>`,
  goal:'A dark rounded toast with a coloured left bar, built only from tokens.',
  solution:`.ocs-demo-toast {
  background: var(--ocs-surface-elevated);
  color: var(--ocs-text);
  padding: var(--ocs-space-3) var(--ocs-space-4);
  border-radius: var(--ocs-radius-md);
  border-left: 4px solid var(--ocs-info);
}`,
  pass:(s,c)=>!/#[0-9a-f]{3,8}/i.test(s)
    && declarations(c).some(d=>d.prop==='padding' && /var\(--ocs-space-/.test(d.value))
    && declarations(c).some(d=>/^border-left/.test(d.prop||'') && /var\(--ocs-/.test(d.value))}

 ,{id:12, ch:4, badge:'Challenge', locked:'challenge', title:'Two states, one rule',
  learn:'Hover and focus that agree with each other.',
  concept:{t:'States are a set, not a list',
    b:'A control needs to look different when you point at it and when you tab to it, and the two should feel like the same component. Build both from the same token so they cannot drift apart.'},
  brief:'Build a button that lifts on hover and shows a visible ring on <code>:focus-visible</code>. Both effects must be built from <code>var(--ocs-accent)</code>, and the movement must switch off under reduced motion.',
  steps:[
    {label:'A hover state that uses the accent',
     test:(s,c)=>declarations(c).some(d=>/:hover/.test(d.sel) && d.prop && /var\(--ocs-accent/.test(d.value) && browserAccepts(d.prop,d.value))},
    {label:'A visible <code>:focus-visible</code> ring',
     test:(s,c)=>declarations(c).some(d=>/:focus-visible/.test(d.sel) && /^(outline|box-shadow)/.test(d.prop||'') && !/none/.test(d.value) && browserAccepts(d.prop,d.value))},
    {label:'Movement off under reduced motion', test:s=>/prefers-reduced-motion[\s\S]*(transform|transition)\s*:\s*none/.test(s)}],
  hints:['Give the base button a transition first, then add the two state blocks.',
         'A ring is <code>box-shadow: 0 0 0 3px SOMECOLOUR;</code>',
         'Mix a see-through version: <code>color-mix(in srgb, var(--ocs-accent) 45%, transparent)</code>'],
  start:`.ocs-demo-btn {
  /* build the base, then &:hover and &:focus-visible */
}`,
  html:`<button class="ocs-demo-btn">Publish</button>`,
  goal:'Lifts on hover, rings on keyboard focus, still on reduced motion.',
  solution:`.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: var(--ocs-space-2) var(--ocs-space-4);
  border: none;
  border-radius: var(--ocs-radius-md);
  transition: transform var(--ocs-duration-fast) var(--ocs-ease);

  &:hover {
    transform: translateY(-2px);
    background: color-mix(in srgb, var(--ocs-accent) 85%, black);
  }

  &:focus-visible {
    outline: none;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--ocs-accent) 45%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    transition: none;
    &:hover { transform: none; }
  }
}`,
  pass:(s,c)=>/prefers-reduced-motion/.test(s)
    && declarations(c).some(d=>/:focus-visible/.test(d.sel) && /^(outline|box-shadow)/.test(d.prop||'') && !/none/.test(d.value))
    && declarations(c).some(d=>/:hover/.test(d.sel) && d.prop && /var\(--ocs-accent/.test(d.value))}

 ,{id:13, ch:4, badge:'Challenge', locked:'challenge', title:'A card that survives a theme change',
  learn:'Everything from tokens, nothing typed in.',
  concept:{t:'The real test',
    b:'Change the page colour in Unlocks and watch. A component built from tokens follows it. A component with one typed-in value stands out immediately, and that is the bug this whole page is about.'},
  brief:'Build a card: a raised surface, a border, a heading, body text and padding. Every single value has to be a token. No hex codes, no rgb(), no raw pixels except a border width.',
  steps:[
    {label:'Surface and text both from tokens',
     test:(s,c)=>declarations(c).some(d=>/^background/.test(d.prop||'') && /var\(--ocs-/.test(d.value))
              && declarations(c).some(d=>d.prop==='color' && /var\(--ocs-/.test(d.value))},
    {label:'Padding and radius from the scales',
     test:(s,c)=>declarations(c).some(d=>d.prop==='padding' && /var\(--ocs-space-/.test(d.value))
              && declarations(c).some(d=>/^border-radius/.test(d.prop||'') && /var\(--ocs-radius-/.test(d.value))},
    {label:'No hex, no rgb(), no raw px padding',
     test:s=>!/#[0-9a-f]{3,8}/i.test(s) && !/rgba?\(/i.test(s) && !/padding\s*:[^;]*\d+px/.test(s)}],
  hints:['Surfaces: <code>--ocs-surface-raised</code> and <code>--ocs-surface-elevated</code>.',
         'Borders have their own token: <code>--ocs-border</code>.',
         'Full answer is in the token drawer. Everything you need is already named.'],
  start:`.ocs-demo-card {
  /* every value a token. no exceptions. */
}`,
  html:`<div class="ocs-demo-card"><h4>Weekly report</h4><p>Three things shipped and one rolled back.</p></div>`,
  goal:'A card that recolours itself when the page accent changes.',
  solution:`.ocs-demo-card {
  background: var(--ocs-surface-raised);
  color: var(--ocs-text);
  border: 1px solid var(--ocs-border);
  border-radius: var(--ocs-radius-lg);
  padding: var(--ocs-space-5);
}`,
  pass:s=>!/#[0-9a-f]{3,8}/i.test(s) && !/rgba?\(/i.test(s)
    && /background[^;]*var\(--ocs-/.test(s) && /padding[^;]*var\(--ocs-space-/.test(s)}

 ,{id:14, ch:5, badge:'Sandbox', locked:'sandbox', title:'Sandbox',
  learn:'Nothing to solve. Every token, a blank file, and the live preview.',
  concept:{t:'No checks here',
    b:'The checklist is empty and nothing is marked solved, on purpose. The contrast reading under the preview still works, and so does the token drawer, so you can use this to try something out before you put it in a real component.'},
  brief:'Write whatever you like. The preview shows a heading, a paragraph, a button and an input, so you have something to style. Your work saves in this browser like every other quest.',
  steps:[],
  hints:['Open the token drawer for the full list of names.',
         'The preview markup is a heading, a paragraph, <code>.ocs-demo-btn</code> and <code>.ocs-demo-input</code>.',
         'Nothing is checked here, so nothing can be wrong.'],
  start:`/* Anything you like. The preview has a heading, a paragraph,
   .ocs-demo-btn and .ocs-demo-input to aim at. */

.ocs-demo-btn {
  background: var(--ocs-accent);
  color: var(--ocs-accent-contrast);
  padding: var(--ocs-space-2) var(--ocs-space-4);
  border: none;
  border-radius: var(--ocs-radius-md);
}`,
  html:`<h3>A heading</h3>
<p>A paragraph of body text to check your colours against.</p>
<button class="ocs-demo-btn">A button</button>
<input class="ocs-demo-input" placeholder="An input">`,
  goal:'Whatever you want it to be.',
  solution:null,
  pass:()=>false}
];

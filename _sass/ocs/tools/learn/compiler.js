/* ---------------------------------------------------------------
   Tiny SCSS compiler - the subset you need for component work.
   Handles: nesting, &, $variables, // and comments.
   Deliberately NOT full Sass. See the "what this does not do" note.
   --------------------------------------------------------------- */
function compileScss(src) {
  const errors = [];
  // 1. strip comments
  let s = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  // 2. collect and substitute $variables
  const vars = {};
  s = s.replace(/^\s*\$([\w-]+)\s*:\s*([^;]+);/gm, (_, k, v) => { vars[k] = v.trim(); return ''; });
  let guard = 0;
  while (/\$[\w-]+/.test(s) && guard++ < 10) {
    s = s.replace(/\$([\w-]+)/g, (m, k) => {
      if (k in vars) return vars[k];
      if (!errors.some(e => e.includes(k))) errors.push(`Undefined variable $${k}`);
      return m.replace('$', '__UNDEF_');
    });
  }

  // 3. parse brace tree
  function parse(str) {
    const nodes = []; let buf = '', i = 0;
    while (i < str.length) {
      const c = str[i];
      if (c === '{') {
        let depth = 1, j = i + 1;
        while (j < str.length && depth > 0) {
          if (str[j] === '{') depth++;
          else if (str[j] === '}') depth--;
          j++;
        }
        if (depth !== 0) { errors.push('Unclosed { - check your braces'); return nodes; }
        // buf may hold "decl; decl; selector" - everything after the last ; is the selector
        const cut = buf.lastIndexOf(';');
        const declPart = cut >= 0 ? buf.slice(0, cut + 1) : '';
        const selPart  = cut >= 0 ? buf.slice(cut + 1) : buf;
        if (declPart.trim()) nodes.push({ sel: null, decls: declPart });
        nodes.push({ sel: selPart.trim(), body: str.slice(i + 1, j - 1) });
        buf = ''; i = j;
      } else if (c === '}') {
        errors.push('Extra } - check your braces'); i++;
      } else { buf += c; i++; }
    }
    if (buf.trim()) nodes.push({ sel: null, decls: buf });
    return nodes;
  }

  // 4. flatten nesting, resolving &
  const out = [];
  function walk(body, parentSels) {
    const nodes = parse(body);
    const decls = nodes.filter(n => n.sel === null).map(n => n.decls).join('')
                       .split(';').map(d => d.trim()).filter(Boolean);
    if (decls.length && parentSels.length) {
      out.push({ selector: parentSels.join(', '), decls });
    }
    for (const n of nodes) {
      if (n.sel === null) continue;
      const sels = [];
      for (const p of (parentSels.length ? parentSels : [''])) {
        for (const raw of n.sel.split(',')) {
          const part = raw.trim(); if (!part) continue;
          sels.push(part.includes('&') ? part.replace(/&/g, p) : (p ? `${p} ${part}` : part));
        }
      }
      walk(n.body, sels);
    }
  }
  walk(s, []);

  const css = out.map(r => `${r.selector} {\n  ${r.decls.join(';\n  ')};\n}`).join('\n\n');
  return { css, errors, rules: out, vars };
}

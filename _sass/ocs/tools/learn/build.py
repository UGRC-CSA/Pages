#!/usr/bin/env python3
"""Assemble learn.html (the SCSS practice page) from its parts.

Run from anywhere:  python3 _sass/ocs/tools/learn/build.py
Writes learn.html at the repo root. Run it after a change to the parts in this
folder or to the tokens in _sass/ocs/core (the page inlines assets/css/ocs.css,
so build that first with _sass/ocs/tools/build.sh).

page.scss is compiled here rather than committed as CSS, so the page's own
styling goes through the same token functions as the components it teaches.
The token drawer's list is read from assets/css/ocs.css, so it always matches
what the site ships.
"""
import json, os, pathlib, re, shutil, subprocess, sys

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]          # _sass/ocs/tools/learn -> repo root
OCS_CSS = ROOT / 'assets' / 'css' / 'ocs.css'
OUT = ROOT / 'learn.html'


def find_sass():
    """Dart Sass. `sass` on PATH may be the old Ruby gem (an rbenv shim), which
    cannot compile @use; the same fallbacks as _sass/ocs/tools/build.sh."""
    def is_dart(cmd):
        try:
            v = subprocess.run(cmd + ['--version'], capture_output=True, text=True, timeout=20).stdout
            return bool(v.strip()) and 'Ruby Sass' not in v
        except Exception:
            return False
    if shutil.which('sass') and is_dart(['sass']):
        return ['sass']
    local = pathlib.Path.home() / 'ocs-design-system' / 'dart-sass' / 'sass'
    if local.is_file() and is_dart([str(local)]):
        return [str(local)]
    if shutil.which('npx'):
        return ['npx', '--yes', 'sass']
    sys.exit('Dart Sass not found. Install it: npm install -g sass  (or brew install sass/sass/sass)')


# Which drawer group a token belongs to, by name. The group names are the ones
# app.js ties to chapters (TIERS); a name that matches nothing lands in Other
# and stays visible.
GROUPS = [
    ('Semantic colour', re.compile(r'^--ocs-(brand|info|success|warning|danger|accent)')),
    ('Text',            re.compile(r'^--ocs-text')),
    ('Surface',         re.compile(r'^--ocs-surface-')),
    ('Border',          re.compile(r'^--ocs-border')),
    ('Spacing',         re.compile(r'^--ocs-space-')),
    ('Radius',          re.compile(r'^--ocs-radius-')),
    ('Motion',          re.compile(r'^--ocs-(duration-|ease)')),
    ('Colour ramp',     re.compile(r'^--ocs-(coral|neutral)-')),
    ('Shadow',          re.compile(r'^--ocs-shadow-')),
    ('Type',            re.compile(r'^--ocs-font-')),
]
COLOUR = re.compile(r'^(#[0-9a-fA-F]{3,8}|rgba?\(|hsla?\(|color\()')


def tokens_js(css):
    """`const TOKENS = [...]` from the first :root block of ocs.css: the
    dark-theme values, in group order, as the drawer expects."""
    m = re.search(r':root\s*\{(.*?)\}', css, re.S)
    if not m:
        sys.exit('ocs.css has no :root block')
    rows = []
    for name, value in re.findall(r'(--ocs-[a-z0-9-]+)\s*:\s*([^;]+);', m.group(1)):
        value = ' '.join(value.split())
        group = next((g for g, rx in GROUPS if rx.match(name)), 'Other')
        rows.append({'n': name, 'v': value, 'g': group, 'c': bool(COLOUR.match(value))})
    order = [g for g, _ in GROUPS] + ['Other']
    rows.sort(key=lambda r: order.index(r['g']))          # stable: keeps ocs.css order inside a group
    return 'const TOKENS = ' + json.dumps(rows, separators=(',', ':')) + ';\n', len(rows)


def main():
    if not OCS_CSS.is_file():
        sys.exit(f'{OCS_CSS} is missing; run _sass/ocs/tools/build.sh first')
    page_css = HERE / 'page.css'
    subprocess.run(find_sass() + ['--no-source-map', '--style=expanded',
                                  f'--load-path={ROOT / "_sass"}', str(HERE / 'page.scss'), str(page_css)], check=True)
    tokens, n = tokens_js(OCS_CSS.read_text())
    parts = {
        '__OCSCSS__':    OCS_CSS.read_text(),
        '__PAGECSS__':   page_css.read_text(),
        '__COMPILER__':  (HERE / 'compiler.js').read_text(),
        '__TUTOR__':     (HERE / 'tutor.js').read_text(),
        '__TOKENS__':    tokens,
        '__SHOP__':      (HERE / 'shop.js').read_text(),
        '__EXERCISES__': (HERE / 'exercises.js').read_text(),
        '__APP__':       (HERE / 'app.js').read_text(),
    }
    out = (HERE / 'shell.html').read_text()
    for key, text in parts.items():
        if key not in out:
            sys.exit(f'placeholder {key} missing from shell.html')
        out = out.replace(key, text)
    out = ('<!-- Built by _sass/ocs/tools/learn/build.py from the parts in that folder. '
           'Edit the parts, not this file. -->\n') + out
    OUT.write_text(out)
    page_css.unlink(missing_ok=True)
    print(f'learn.html: {len(out):,} bytes, {n} tokens in the drawer')


if __name__ == '__main__':
    main()

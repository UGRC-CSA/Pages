import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import WebSocket from 'ws';

const api = 'http://127.0.0.1:8585';
const pageUrl = 'http://localhost:4500/student/messages';
const stamp = Date.now();

async function call(cookie, path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${api}${path}`, {
    redirect: 'manual',
    method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: expected ${expected}, got ${response.status}: ${text.slice(0, 200)}`);
  if (!text) return null;
  try { return JSON.parse(text); } catch { return text; }
}

async function login(uid) {
  const response = await fetch(`${api}/authenticate`, { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, password: 'DmPreview123!' }) });
  assert.equal(response.status, 200, `Cannot sign in as ${uid}; start make dm-preview first.`);
  return response.headers.get('set-cookie').split(';')[0];
}

class Socket {
  constructor(cookie, endpoint = '/api/ws-chat') {
    this.frames = [];
    this.ws = new WebSocket(`ws://127.0.0.1:8589${endpoint}/websocket`, {
      headers: { ...(cookie ? { Cookie: cookie } : {}), Origin: 'http://localhost:4500' },
    });
    this.ws.on('message', data => this.frames.push(data.toString()));
    this.ws.on('error', error => { this.error = error; });
  }
  async wait(match) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      const index = this.frames.findIndex(match);
      if (index >= 0) return this.frames.splice(index, 1)[0];
      if (this.error) throw this.error;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error(`Expected WebSocket frame was not received. Frames: ${this.frames.join(' | ')}`);
  }
  async connect() {
    await new Promise((resolve, reject) => { this.ws.once('open', resolve); this.ws.once('error', reject); });
    this.ws.send('CONNECT\naccept-version:1.2\nhost:localhost\n\n\0');
    await this.wait(frame => frame.startsWith('CONNECTED'));
    return this;
  }
  send(command, headers, body = '') {
    this.ws.send(`${command}\n${Object.entries(headers).map(([key, value]) => `${key}:${value}`).join('\n')}\n\n${body}\0`);
  }
  close() { this.ws.close(); }
}

const alice = await login('dm-alice'), bob = await login('dm-bob'), charlie = await login('dm-charlie');
const me = await call(alice, '/api/dm/me');
const peer = await call(bob, '/api/dm/me');
await call(alice, '/api/jokes/');
await call(null, '/api/dm', 'GET', undefined, 401);
const people = await call(alice, '/api/dm/users?q=bo');
assert(people.some(person => person.id === peer.id));
assert(people.every(person => Object.keys(person).sort().join(',') === 'id,name,uid'));
await call(alice, '/api/dm', 'POST', { recipientId: me.id }, 400);
await call(alice, '/api/dm', 'POST', { recipientId: 99999999 }, 404);
const dm = await call(alice, '/api/dm', 'POST', { recipientId: peer.id });
const opened = await Promise.all(Array.from({ length: 8 }, (_, i) => call(i % 2 ? alice : bob, '/api/dm', 'POST', { recipientId: i % 2 ? peer.id : me.id })));
assert(opened.every(item => item.id === dm.id), 'Concurrent opens must reuse one conversation');
const messagesPath = `/api/groups/chat/${dm.id}/messages`;
for (const method of ['GET', 'POST']) await call(charlie, messagesPath, method, method === 'POST' ? { message: 'intrusion' } : undefined, 403);
await call(charlie, `/api/groups/chat/${dm.id}/files`, 'GET', undefined, 403);
await call(charlie, `/api/groups/chat/${dm.id}/files`, 'POST', { filename: 'intrusion.txt', base64Data: 'YQ==' }, 403);
await call(charlie, `/api/dm/${dm.id}/read`, 'POST', { messageId: 'fake' }, 403);
await call(charlie, `/api/groups/${dm.id}`, 'GET', undefined, 404);
await call(charlie, `/api/groups/${dm.id}/members/${(await call(charlie, '/api/dm/me')).id}`, 'POST', undefined, 404);
await call(charlie, `/api/groups/${dm.id}`, 'PUT', { name: 'public' }, 404);
await call(charlie, `/api/groups/${dm.id}`, 'DELETE', undefined, 404);
assert(!(await call(charlie, '/api/groups')).some(group => group.id === dm.id));
assert(!(await call(charlie, '/api/dm')).some(group => group.id === dm.id));
await call(charlie, `/api/files/download?uid=dm-${Math.min(me.id, peer.id)}-${Math.max(me.id, peer.id)}&filename=messages-images/messages.jsonl`, 'GET', undefined, 403);
await call(alice, '/api/groups', 'POST', { name: 'dm-123-456' }, 400);

const initial = await call(bob, messagesPath);
if (initial.length) await call(bob, `/api/dm/${dm.id}/read`, 'POST', { messageId: initial.at(-1).id }, 204);
await call(alice, messagesPath, 'POST', { name: 'dm-bob', message: `HTTP check ${stamp}`, date: 'forged' });
const stored = (await call(bob, messagesPath)).at(-1);
assert.equal(stored.name, 'dm-alice');
assert.equal(stored.message, `HTTP check ${stamp}`);
assert.equal((await call(bob, '/api/dm')).find(item => item.id === dm.id).unreadCount, 1);
await call(bob, messagesPath, 'POST', { message: `Second message ${stamp}` });
await call(bob, `/api/dm/${dm.id}/read`, 'POST', { messageId: stored.id }, 204);
assert.equal((await call(bob, '/api/dm')).find(item => item.id === dm.id).unreadCount, 0);
await call(bob, `${messagesPath}/${stored.id}`, 'DELETE', undefined, 403);
await call(alice, `${messagesPath}/${stored.id}`, 'DELETE');
await call(alice, messagesPath, 'POST', { message: ' ' }, 400);
await call(alice, messagesPath, 'POST', { message: 'x'.repeat(4001) }, 400);
await call(alice, `/api/groups/chat/${dm.id}/files`, 'POST', { filename: '../messages-images/messages.jsonl', base64Data: 'YQ==' }, 400);
console.log('PASS HTTP: authentication, recipient search, duplicate prevention, privacy, sender identity, unread state, deletion, input validation');

const listening = await new Socket(bob).connect();
const outsider = await new Socket(charlie).connect();
try {
  listening.send('SUBSCRIBE', { id: 'dm', destination: `/topic/group/${dm.id}` });
  // Spring's simple broker does not implement STOMP receipts.
  await new Promise(resolve => setTimeout(resolve, 150));
  await call(alice, messagesPath, 'POST', { message: `Realtime check ${stamp}` });
  await listening.wait(frame => frame.includes(`Realtime check ${stamp}`));
  outsider.send('SUBSCRIBE', { id: 'stolen', destination: `/topic/group/${dm.id}` });
  await outsider.wait(frame => frame.startsWith('ERROR'));
} finally { listening.close(); outsider.close(); }
for (const [command, destination] of [['SUBSCRIBE', '/topic/group/*'], ['SEND', `/topic/group/${dm.id}`]]) {
  const attack = await new Socket(alice).connect();
  try { attack.send(command, { id: 'attack', destination }, command === 'SEND' ? '{}' : ''); await attack.wait(frame => frame.startsWith('ERROR')); }
  finally { attack.close(); }
}
const guest = await new Socket(null, '/ws-chat').connect();
try {
  guest.send('SUBSCRIBE', { id: 'guest', destination: `/topic/group/${dm.id}` });
  await guest.wait(frame => frame.startsWith('ERROR'));
} finally { guest.close(); }
console.log('PASS WebSocket: authenticated delivery, outsider rejection, wildcard rejection, broker injection rejection');

let browser;
try {
  browser = await chromium.launch(process.env.DM_BROWSER_PATH ? { executablePath: process.env.DM_BROWSER_PATH } : { channel: 'chrome' });
  const first = await browser.newContext(), second = await browser.newContext(), third = await browser.newContext();
  const a = await first.newPage(), b = await second.newPage(), c = await third.newPage();
  const errors = [];
  for (const page of [a, b, c]) page.on('pageerror', error => errors.push(error.message));
  // The page carries no test-only sign-in control, so the session cookie the
  // HTTP checks above already obtained is installed directly. config.js sends
  // the browser to localhost:8585, and the JWT cookie is scoped to /api.
  async function signIn(page, context, cookie, name) {
    const separator = cookie.indexOf('=');
    await context.addCookies([{
      name: cookie.slice(0, separator),
      value: cookie.slice(separator + 1),
      url: 'http://localhost:8585/api',
    }]);
    await page.goto(pageUrl);
    await page.waitForFunction(who => document.querySelector('#dmAccount').textContent.includes(who), name);
  }
  await signIn(a, first, alice, 'Alice'); await signIn(b, second, bob, 'Bob'); await signIn(c, third, charlie, 'Charlie');
  await a.locator('#dmStatusPill.is-live').waitFor();
  await a.locator('#dmSearch').fill('Bob');
  await a.locator('#dmResults button').filter({ hasText: 'Bob' }).click();
  // The status pill is live from page load, so it says nothing about whether a
  // conversation is open. The composer is enabled only once one is.
  const composerReady = (page) => page.locator('.rt-editor[contenteditable=true]').waitFor();
  await composerReady(a);
  const text = `Browser hello ${stamp} <script>no HTML</script>`;
  await a.locator('.rt-editor').fill(text); await a.locator('#dmSend').click();
  await b.locator('#dmInbox button').filter({ hasText: 'Alice' }).waitFor();
  await b.locator('#dmInbox button').filter({ hasText: 'Alice' }).click();
  await composerReady(b);
  await b.locator('.chat-msg-body').filter({ hasText: text }).waitFor();
  assert.equal(await b.locator('.chat-msg-body script').count(), 0);
  await b.locator('.rt-editor').fill(`Reply ${stamp}`); await b.locator('.rt-editor').press('Enter');
  await a.locator('.chat-msg-body').filter({ hasText: `Reply ${stamp}` }).waitFor();
  await a.reload(); await a.locator('#dmInbox button').filter({ hasText: 'Bob' }).click();
  await composerReady(a);
  await a.locator('.chat-msg-body').filter({ hasText: `Reply ${stamp}` }).waitFor();
  assert.equal(await c.locator('#dmInbox').textContent().then(text => text.includes(`Browser hello ${stamp}`)), false);
  await a.locator('#dmAttachments summary').click();
  await a.locator('#dmFile').setInputFiles({ name: `hello-${stamp}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Shared locally') });
  await a.locator('#dmFiles button').filter({ hasText: `hello-${stamp}.txt` }).waitFor();
  await b.locator('#dmAttachments summary').click();
  await b.locator('#dmFiles button').filter({ hasText: `hello-${stamp}.txt` }).waitFor();
  const downloadPromise = b.waitForEvent('download');
  await b.locator('#dmFiles button').filter({ hasText: `hello-${stamp}.txt` }).click();
  assert.equal((await downloadPromise).suggestedFilename(), `hello-${stamp}.txt`);
  await a.route('**/api/groups/chat/*/messages', route => route.request().method() === 'POST' ? route.fulfill({ status: 503, body: 'Unavailable' }) : route.continue());
  await a.locator('.rt-editor').fill('Keep my draft'); await a.locator('#dmSend').click();
  await a.locator('#dmError').waitFor({ state: 'visible' });
  assert.equal((await a.locator('.rt-editor').textContent()).trim(), 'Keep my draft');
  await a.unroute('**/api/groups/chat/*/messages');
  await a.setViewportSize({ width: 390, height: 844 });
  assert(await a.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Mobile page must not overflow');
  await mkdir('.dm-preview', { recursive: true });

  // Signed out, with the backend up: the page must refuse to work rather than
  // offer a local sandbox, and must not leave any composer or search usable.
  const anon = await browser.newContext();
  const signedOut = await anon.newPage();
  signedOut.on('pageerror', error => errors.push(error.message));
  await signedOut.goto(pageUrl);
  await signedOut.locator('#dmSignIn').waitFor({ state: 'visible' });
  assert.match(await signedOut.locator('#dmStatus').textContent(), /signed out/i);
  assert.equal(await signedOut.locator('.rt-editor[contenteditable=true]').count(), 0, 'Composer editable while signed out');
  assert.equal(await signedOut.locator('#dmSend').isDisabled(), true, 'Send enabled while signed out');
  assert.equal(await signedOut.locator('#dmSearch').isDisabled(), true, 'Search enabled while signed out');
  assert.equal(await signedOut.locator('#dmIdentityList').count(), 0, 'Local identity roster still rendered');
  assert.equal(await signedOut.locator('#dmAttachments').isHidden(), true, 'Attachments shown while signed out');
  await signedOut.screenshot({ path: '.dm-preview/signed-out.png', fullPage: true });
  console.log('PASS Signed out: sign-in prompt, no composer, no search, no local roster');

  await a.screenshot({ path: '.dm-preview/mobile.png', fullPage: true });
  await b.screenshot({ path: '.dm-preview/desktop.png', fullPage: true });
  assert.deepEqual(errors, [], 'No uncaught browser errors');
  console.log('PASS Browser: two users, search/open/reply/reload, literal text rendering, attachment download, failed-send draft retention, mobile layout');
} finally { await browser?.close(); }
console.log('All DM checks passed. Screenshots: .dm-preview/desktop.png and .dm-preview/mobile.png');

/* Browser checks for Messages with no backend running.
 *
 * Run against `make dm-local`, which serves only the Messages page. Nothing
 * here talks to Spring -- that is the point: the page has to stay fully usable
 * when the API is unreachable, the same way the class announcement chat does.
 */
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const pageUrl = 'http://127.0.0.1:4500/student/messages';
const stamp = Date.now();

const browser = await chromium.launch(process.env.DM_BROWSER_PATH
  ? { executablePath: process.env.DM_BROWSER_PATH }
  : { channel: 'chrome' });

async function openPage() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  // Fail loudly on a broken import or a runtime error rather than timing out
  // on a locator further down.
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  // Not 'networkidle': the page pulls icons and the STOMP client from CDNs it
  // does not need in local mode, and those can stay pending.
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  await page.locator('#dmStatusPill.is-preview').waitFor();
  return { context, page, errors };
}

async function becomeUser(page, name) {
  await page.locator('#dmIdentityList button').filter({ hasText: name }).click();
  await page.waitForFunction(
    (who) => document.querySelector('#dmAccount').textContent.includes(who),
    name,
  );
}

async function openConversationWith(page, name) {
  await page.locator('#dmSearch').fill(name.slice(0, 3));
  await page.locator('#dmResults button').filter({ hasText: name }).click();
  await page.locator('#dmChatTitle').filter({ hasText: name }).waitFor();
}

async function send(page, text) {
  await page.locator('.rt-editor').fill(text);
  await page.locator('#dmSend').click();
  await page.locator('.chat-msg-body').filter({ hasText: text }).waitFor();
}

const { page, errors } = await openPage();

/* -- 1. Falls into local mode with no backend, and says so ------------- */
await page.locator('#dmStatusPill.is-preview').waitFor();
assert.equal(await page.locator('#dmStatus').textContent(), 'local');
const note = await page.locator('#dmNoteText').textContent();
assert.match(note, /stay in this browser/i, `Local-mode note not shown: ${note}`);

/* -- 2. Uses the shared group-chat components, not a bespoke UI -------- */
for (const selector of ['.dm-chat .chat-header', '.dm-chat .chat-messages', '.dm-chat .chat-form', '.chat-status-pill']) {
  assert.equal(await page.locator(selector).count(), 1, `Missing group-chat component: ${selector}`);
}
assert.equal(await page.locator('.dm-page-header .dm-page-title').count(), 1, 'Page header missing');

/* -- 3. A conversation round-trips, from both sides -------------------- */
await becomeUser(page, 'Alice');
await openConversationWith(page, 'Bob');
const hello = `Hello Bob ${stamp}`;
await send(page, hello);

await becomeUser(page, 'Bob');
await page.locator('#dmInbox button').filter({ hasText: 'Alice' }).waitFor();
// Unread badge counts the incoming message, not Bob's own.
assert.equal(await page.locator('#dmUnread').textContent(), '1');
await page.locator('#dmInbox button').filter({ hasText: 'Alice' }).click();
await page.locator('.chat-msg-body').filter({ hasText: hello }).waitFor();

const reply = `Reply ${stamp}`;
await send(page, reply);
await page.waitForFunction(() => document.querySelector('#dmUnread').hidden === true);

/* -- 4. Messages cannot be deleted ------------------------------------- */
assert.equal(await page.locator('.dm-delete').count(), 0, 'Delete control is still present');
assert.equal(
  await page.locator('.chat-msg button').count(),
  0,
  'A message row still carries an action button',
);

/* -- 4b. The composer drops the list buttons in a one-to-one -----------
   They stay in the class chats; only this page opts out. */
const toolbarTitles = await page.locator('.rt-toolbar button').evaluateAll((els) => els.map((e) => e.title));
assert.ok(
  !toolbarTitles.some((title) => /list/i.test(title)),
  `List buttons still in the composer: ${toolbarTitles.join(', ')}`,
);

/* -- 5. History survives a reload -------------------------------------- */
await page.reload({ waitUntil: 'domcontentloaded' });
await page.locator('#dmStatusPill.is-preview').waitFor();
await page.locator('#dmInbox button').filter({ hasText: 'Alice' }).click();
await page.locator('.chat-msg-body').filter({ hasText: hello }).waitFor();
await page.locator('.chat-msg-body').filter({ hasText: reply }).waitFor();

/* -- 6. A third person sees none of it --------------------------------- */
await becomeUser(page, 'Charlie');
const charlieInbox = await page.locator('#dmInbox').textContent();
assert.ok(!charlieInbox.includes('Alice'), 'Charlie can see the Alice/Bob conversation');
assert.ok(!charlieInbox.includes(hello), 'Charlie can read the Alice/Bob messages');

/* -- 7. Rich text renders, and does not execute ------------------------ */
await becomeUser(page, 'Alice');
await page.locator('#dmInbox button').filter({ hasText: 'Bob' }).click();
await page.locator('.rt-editor').fill('<img src=x onerror=alert(1)>');
await page.locator('#dmSend').click();
await page.locator('.chat-msg-body').filter({ hasText: '<img src=x onerror=alert(1)>' }).waitFor();
assert.equal(await page.locator('.chat-msg-body script').count(), 0);

/* -- 8. Attachments stay hidden without a backend ---------------------- */
assert.ok(await page.locator('#dmAttachments').isHidden(), 'Attachments shown in local mode');

/* -- 9. Small screens ---------------------------------------------------*/
await page.setViewportSize({ width: 390, height: 780 });
await page.locator('#dmMessages').waitFor({ state: 'visible' });
const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
assert.ok(overflow <= 1, `Page scrolls horizontally on a phone viewport by ${overflow}px`);

await mkdir('.dm-preview', { recursive: true });
await page.screenshot({ path: '.dm-preview/local-mobile.png', fullPage: true });
await page.setViewportSize({ width: 1280, height: 900 });
await page.screenshot({ path: '.dm-preview/local-desktop.png', fullPage: true });

assert.deepEqual(errors, [], `Page errors: ${errors.join(' | ')}`);
await browser.close();
console.log('All backend-free DM checks passed. Screenshots: .dm-preview/local-desktop.png and .dm-preview/local-mobile.png');

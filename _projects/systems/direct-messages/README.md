# Direct messages — issue #17

Private one-to-one conversations, implemented for [UGRC-CSA/Pages #17](https://github.com/UGRC-CSA/Pages/issues/17).

The page runs in two modes and picks between them on load:

| Mode | When | Where messages live |
| --- | --- | --- |
| **Local** | Nobody is signed in, or the API is unreachable | `localStorage`, this browser only |
| **Live** | Signed in and Spring is reachable | The backend, shared between both people |

This is the same arrangement the class announcement chat uses
(`_includes/announcement_chat.html`): the feature never turns into an error
screen, it just says what it is doing. Local mode needs no backend at all — no
Spring, no database, no WebSocket — so the page can be developed, reviewed, and
demonstrated on its own.

**Local mode is per-browser.** Two different people on two different machines
cannot message each other without the backend, because there is nowhere shared
to put the message. What local mode gives you is the whole interface, working,
with real conversations you can send, reload, and switch between — and a roster
switcher so one browser can play both sides. Cross-user delivery is what the
live backend is for.

## UI

The conversation panel is the site's group-chat component, not a bespoke one.
It uses the same markup and classes as the announcement chat and the per-week
chats (`chat-header`, `chat-status-pill`, `chat-messages`, `chat-msg`,
`chat-avatar`, `chat-day`, `chat-form`) and the same rich-text composer, all
styled from `_sass/open-coding/chat-ui.scss`. That partial is shared: the
courses stylesheet imports it too, so a change to the chat look lands on every
chat surface at once.

Around it, this project adds only what a conversation list needs — a page
header, the two-column layout, the inbox, and the person search — in
`sass/main.scss`, using the same tokens.

Messages cannot be deleted, in either mode.

Entry points: the site header ("Messages"), the account menu, and the Student
Toolkit.

## Run it locally

No backend required:

```sh
make dm-local
```

On Windows, use the tool-discovery wrapper from PowerShell:

```powershell
.\scripts\make.ps1 dm-local
```

Open **http://127.0.0.1:4500/student/messages**. The status pill reads `local`
and a banner explains that messages stay in this browser. Use **You are** in the
sidebar to switch between You, Alice, Bob, and Charlie: send as Alice, switch to
Bob to read it and reply, then switch to Charlie to confirm the conversation is
not in their inbox. **Clear local conversations** empties the store.

The preview builds **one page** and the JavaScript, SCSS, and layout it needs.
It does not convert notebooks or build other projects, and it leaves the normal
`_site` build alone; generated files live in `.dm-preview/`. Ctrl+C stops it.

Its layout is a stand-in, not the real one, so it will not reproduce every
site-wide CSS rule — the global `h1 { display: none }` and `.post-content h2`
sizing both only show up in a real build. Check the page under `jekyll serve`
before merging a change to the header or the page chrome.
Restart after editing source. Requirements: Ruby with the repo's bundle, GNU
Make/Bash, Python 3, and Node 18+ with Chrome for the browser checks. The
Windows wrapper finds the existing Ruby/MSYS and Python installs; WSL is not
needed.

To exercise the signed-in path as well, `make dm-preview` additionally starts a
packaged Spring from `../Spring` (override with `SPRING_DIR`) on ports 8585 and
8589, with preview accounts `dm-alice`, `dm-bob`, and `dm-charlie`, password
`DmPreview123!`, in `volumes/dm-preview.db`. Sign in from separate browser
profiles — ordinary tabs share cookies.

## Verify

With `make dm-local` serving, in a second terminal:

```sh
make dm-local-test
```

This drives the page in a real browser with nothing else running and checks:
local-mode fallback and its banner; that the group-chat components and the page
header are present; a conversation sent and replied to from both sides; unread
counts that exclude your own messages; that no delete control exists; history
surviving a reload; a third person seeing none of it; rich text rendering as
text rather than executing; attachments staying hidden without a backend; and no
horizontal overflow on a phone viewport. Screenshots land in
`.dm-preview/local-desktop.png` and `.dm-preview/local-mobile.png`.

For the backend path, with `make dm-preview` running:

```sh
make dm-test     # Spring unit suite, then the live checks
make dm-check    # just the live HTTP, WebSocket, browser, and migration checks
```

Set `DM_BROWSER_PATH` for a Chromium other than installed Chrome.

Manual checks worth repeating in live mode:

1. Search by name or username; yourself is excluded. Reopening a person returns
   the same conversation, including when both people open it at once.
2. Send, reply, refresh, reopen: messages remain. Unread counts rise on incoming
   messages and clear when the conversation is focused and scrolled to the
   bottom.
3. Share a file up to 1 MB and download it as the other participant.
4. A third person cannot read messages or files, subscribe to the private topic,
   add themselves, rename the group, or reach chat storage via the generic file
   API.
5. Interrupt the connection: messages keep refreshing over HTTP and a failed
   send keeps your draft. Reconnect and the history is the same, with no
   duplicate rows.

## Data model (live mode)

Any signed-in user can start a conversation with any other registered user;
there is no invitation or class-membership prerequisite.

Each DM is an existing `Groups` row with exactly two `group_members`. Both
`name` and the nullable, unique `dm_key` hold `dm-{lowerPersonId}-{higherPersonId}`,
so ids stay stable when names change. Ordinary groups have a null `dm_key`;
generic group endpoints reserve the `dm-` prefix and hide DMs, and DM membership
and name are immutable through those routes, including for admins. The unique
index prevents duplicate conversations.

Messages reuse `GroupChatMessage`, `GroupChatService`, the JSONL S3 layout, the
HTTP chat routes, and `/topic/group/{groupId}` on the existing STOMP broker.
Senders and timestamps come from the server, so a sender name cannot be forged.
Storage writes are serialized within a single Spring instance and save failures
are reported before broadcasting; S3 read failures and malformed history are
never treated as empty history and overwritten.

`dm_read_receipt(id, read_at)` stores one row per `groupId:personId`. The browser
acknowledges the last message actually displayed, so newer messages stay unread
and stale acknowledgments cannot move the timestamp backward. Unread counts
exclude your own messages. Notification is the inbox badge and the browser
title; there is no email, push, or "seen by" indicator.

| Route | Purpose |
| --- | --- |
| `GET /api/dm/me` | Minimal signed-in user: id, uid, name |
| `GET /api/dm/users?q=...` | Name/username search, 2+ characters, up to 20 results |
| `GET /api/dm` | Current user's inbox only |
| `POST /api/dm` with `{recipientId}` | Create or reopen a conversation |
| `POST /api/dm/{groupId}/read` with `{messageId}` | Advance the read position |
| `/api/groups/chat/{groupId}/messages` | History and send, with membership and sender checks |
| `/api/groups/chat/{groupId}/files` | Attachment list/upload, with membership checks |
| `/api/ws-chat` | JWT-authenticated SockJS/STOMP handshake |

Local mode mirrors this shape in `js/local.js`: the same create-or-reopen rule
on a sorted pair key, the same membership check before reading or sending, the
same unread rule, and the same refusal to move a read position backward.

## Files

```
index.md            the page: group-chat markup plus the page header
sass/main.scss      page header, layout, sidebar; imports the shared chat partial
js/messages.js      rendering and state, one path for both modes
js/live.js          backend adapter (Spring)
js/local.js         localStorage adapter (no backend)
js/api.js           low-level HTTP helper for live mode
js/realtime.js      SockJS/STOMP connection for live mode
```

## Deployment

Local mode needs nothing deployed. For the backend path, deploy the Spring
changes and the database migration before publishing the frontend. `ddl-auto`
stays `none`. Stop Spring, back up the database, and run
`python scripts/migrate_dm.py volumes/sqlite.db` from the Spring checkout for
SQLite; the script backs up including WAL data, adds the nullable key/index and
the receipt table, and is repeatable — it does not reset or reseed. For MySQL,
run `scripts/migrations/dm_mysql.sql` once against a backed-up database. Keep
both repositories' changes together in review.

Production continues to use S3 with its existing credentials. Private chat
objects must live in a non-public bucket; HTTP access goes through the
authenticated chat endpoints, and the generic file API rejects DM storage
prefixes. Do not deploy the `dm-preview` Spring profile, and do not build
production with `_config.dev.yml`.

JWT cookies are scoped to `/api`, so DMs connect to the `/api/ws-chat` alias.
Local traffic uses port 8589; production uses the existing HTTPS API origin on
443, with `nginx_spring_8585_8589.conf` forwarding both `/ws-chat` and
`/api/ws-chat` to Spring's 8589 connector and preserving upgrade headers and
cookies. Run `nginx -t` before reloading. The legacy group endpoint stays
available. CORS permits the existing Open Coding Society origins and
`https://ugrc-csa.github.io`.

The JSONL read/modify/write storage and the in-memory STOMP broker assume **one
Spring instance**, which matches the current deployment. Horizontal scaling
would need shared message storage with atomic writes and a shared broker. Live
mode is transport-encrypted and access-controlled; it is not end-to-end
encrypted.

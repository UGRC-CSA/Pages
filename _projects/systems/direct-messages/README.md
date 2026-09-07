# Direct messages — issue #17

Private one-to-one conversations, implemented for [UGRC-CSA/Pages #17](https://github.com/UGRC-CSA/Pages/issues/17).

**Signing in is required.** A conversation is between two accounts and is stored
on the server, so there is no offline or signed-out mode: without an account
there is nobody to be, and nowhere to deliver to. A signed-out visitor gets a
sign-in prompt and an inert panel; if the API is unreachable the page says so and
stays inert. Neither state offers a composer, a search box, or a sandbox.

This is deliberately unlike the class announcement chat, which does fall back to
a local browser-only mode. Announcements are one public room, so a local stand-in
is harmless. A DM implies a specific other person and a private history, and a
browser-only imitation of that would be misleading.

## UI

The conversation panel is the site's group-chat component, not a bespoke one.
It uses the same markup and classes as the announcement chat and the per-week
chats (`chat-header`, `chat-status-pill`, `chat-messages`, `chat-msg`,
`chat-avatar`, `chat-day`, `chat-form`) and the same rich-text composer, all
styled from `_sass/open-coding/chat-ui.scss`. That partial is shared: the
courses stylesheet imports it too, so a change to the chat look lands on every
chat surface at once. The composer hides its list buttons here, via the `lists`
option on `createRichComposer`; the class chats keep them.

Around it, this project adds only what a conversation list needs — a page
header, the two-column layout, the inbox, and the person search — in
`sass/main.scss`, using the same tokens.

Messages cannot be deleted.

Entry points: the site header ("Messages"), the account menu, and the Student
Toolkit.

## Run it locally

`make dm-preview` starts the page and a packaged Spring from `../Spring`
(override with `SPRING_DIR`) on ports 4500, 8585, and 8589:

```sh
make dm-preview
```

On Windows, use the tool-discovery wrapper from PowerShell:

```powershell
.\scripts\make.ps1 dm-preview
```

Open **http://localhost:4500/student/messages**. The preview profile seeds
`dm-alice`, `dm-bob`, and `dm-charlie`, password `DmPreview123!`, in
`volumes/dm-preview.db` with chat storage in `volumes/dm-preview-chat/`, separate
from your normal database and S3. Sign in from separate browser profiles —
ordinary tabs share cookies. Send as Alice, reply as Bob, and confirm Charlie
sees none of it. Ctrl+C stops both servers.

`make dm-frontend` serves the page alone, for chrome and layout work. With no
backend it can only render its signed-out state.

Both build **one page** and the JavaScript, SCSS, and layout it needs. They do
not convert notebooks or build other projects, and they leave the normal `_site`
build alone; generated files live in `.dm-preview/`. Restart after editing
source.

The preview layout is a stand-in, not the real one, so it will not reproduce
every site-wide CSS rule — the global `h1 { display: none }` and
`.post-content h2` sizing both only show up in a real build. Check page-chrome
changes under a real `jekyll serve` too.

Requirements: Ruby with the repo's bundle, GNU Make/Bash, Java 21, Python 3, and
Node 18+ with Chrome for the browser checks. The Windows wrapper finds the
existing Ruby/MSYS, Adoptium Java 21, and Python installs; WSL is not needed.
Ports 4500, 8585, and 8589 must be free; the launcher reports a conflict rather
than stopping unrelated servers.

## Verify

With `make dm-preview` running, in a second terminal:

```sh
make dm-test     # Spring unit suite, then the live checks
make dm-check    # just the live migration, HTTP, WebSocket, and browser checks
```

The browser pass covers two users searching, opening, replying, and reloading;
literal rendering of text that looks like markup; attachment upload and download;
a failed send keeping its draft; no horizontal overflow on a phone viewport; and
a signed-out visitor getting the sign-in prompt with no composer, no search, and
no roster. Screenshots land in `.dm-preview/`.

Set `DM_BROWSER_PATH` for a Chromium other than installed Chrome.

Manual checks worth repeating:

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

## Data model

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

## Files

```
index.md            the page: group-chat markup plus the page header
sass/main.scss      page header, layout, sidebar; imports the shared chat partial
js/messages.js      rendering, state, and the signed-out/unavailable states
js/live.js          the backend calls, behind one object
js/api.js           low-level HTTP helper
js/realtime.js      SockJS/STOMP connection
```

## Deployment

Deploy the Spring
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

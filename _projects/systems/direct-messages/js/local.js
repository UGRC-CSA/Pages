/* Local, backend-free direct messages.
 *
 * Mirrors _includes/announcement_chat.html: when Spring is unreachable or
 * nobody is signed in, the page keeps its full UI and stores everything in
 * localStorage instead. Messages never leave this browser, which the page
 * states plainly.
 *
 * Announcements only ever need one identity, because everyone posts into the
 * same room. A conversation needs two, so local mode ships a small roster and
 * lets you switch which member you are. Sending as Alice and then switching to
 * Bob exercises both sides of a thread -- and signed in as Charlie, the
 * Alice/Bob thread simply is not in the inbox, which is the access rule the
 * live backend enforces server-side.
 *
 * Exposes the same shape as js/api.js consumers expect, so messages.js renders
 * local and live conversations through one code path.
 */

const STORE_KEY = 'ocs-dm-local';
const MESSAGE_LIMIT = 200;

// Seeded roster. Names match the accounts the Spring preview profile creates,
// so the manual test script in README.md reads the same in either mode.
const SEED_PEOPLE = [
  { id: 1, uid: 'you', name: 'You' },
  { id: 2, uid: 'alice', name: 'Alice Alvarez' },
  { id: 3, uid: 'bob', name: 'Bob Brooks' },
  { id: 4, uid: 'charlie', name: 'Charlie Chen' },
];

function emptyStore() {
  return { identity: 'you', people: SEED_PEOPLE.map((p) => ({ ...p })), threads: {} };
}

function read() {
  let raw = null;
  try {
    raw = window.localStorage.getItem(STORE_KEY);
  } catch (err) {
    // Private browsing and blocked site data both throw here. Fall back to a
    // fresh in-memory store so the page still works, just without persistence.
    console.warn('Messages: local storage unavailable', err);
    return emptyStore();
  }
  if (!raw) return emptyStore();
  try {
    const parsed = JSON.parse(raw);
    const store = emptyStore();
    if (typeof parsed?.identity === 'string') store.identity = parsed.identity;
    if (Array.isArray(parsed?.people) && parsed.people.length) store.people = parsed.people;
    if (parsed?.threads && typeof parsed.threads === 'object') store.threads = parsed.threads;
    return store;
  } catch (err) {
    console.warn('Messages: local history could not be read', err);
    return emptyStore();
  }
}

function write(store) {
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Messages: local history could not be saved', err);
  }
}

const threadKey = (a, b) => `dm-${[a, b].sort().join('-')}`;

function findPerson(store, uid) {
  return store.people.find((person) => person.uid === uid) || null;
}

function currentUser(store) {
  return findPerson(store, store.identity) || store.people[0];
}

function peerOf(store, thread, meUid) {
  const uid = thread.members.find((member) => member !== meUid) || meUid;
  return findPerson(store, uid) || { id: 0, uid, name: uid };
}

// Unread mirrors the live rule: count what arrived after the reader's last
// acknowledged message, never counting the reader's own messages.
function unreadCount(thread, meUid) {
  const readId = thread.reads?.[meUid] || null;
  const index = readId ? thread.messages.findIndex((m) => m.id === readId) : -1;
  return thread.messages.slice(index + 1).filter((m) => m.uid !== meUid).length;
}

export function createLocalBackend() {
  return {
    mode: 'local',
    supportsFiles: false,

    async me() {
      const store = read();
      return { ...currentUser(store) };
    },

    // The roster stands in for the backend's user search. Two characters
    // minimum and self-exclusion match the live endpoint's contract.
    async search(query) {
      const store = read();
      const term = query.trim().toLowerCase();
      if (term.length < 2) return [];
      const meUid = currentUser(store).uid;
      return store.people
        .filter((person) => person.uid !== meUid)
        .filter((person) => person.name.toLowerCase().includes(term) || person.uid.toLowerCase().includes(term))
        .map((person) => ({ ...person }));
    },

    async inbox() {
      const store = read();
      const meUid = currentUser(store).uid;
      return Object.values(store.threads)
        .filter((thread) => thread.members.includes(meUid))
        .map((thread) => ({
          id: thread.id,
          peer: peerOf(store, thread, meUid),
          lastMessage: thread.messages.at(-1) || null,
          unreadCount: unreadCount(thread, meUid),
        }))
        .sort((a, b) => String(b.lastMessage?.date || '').localeCompare(String(a.lastMessage?.date || '')));
    },

    // Create-or-reopen, keyed on the sorted pair, so reopening a person always
    // lands on the same thread -- the same guarantee the unique dm_key index
    // gives the live backend.
    async open(personId) {
      const store = read();
      const meUid = currentUser(store).uid;
      const peer = store.people.find((person) => person.id === personId);
      if (!peer) throw new Error('That person is no longer available.');
      const id = threadKey(meUid, peer.uid);
      if (!store.threads[id]) {
        store.threads[id] = { id, members: [meUid, peer.uid], messages: [], reads: {} };
        write(store);
      }
      return { id, peer: { ...peer } };
    },

    async history(conversationId) {
      const store = read();
      const thread = store.threads[conversationId];
      if (!thread) return [];
      if (!thread.members.includes(currentUser(store).uid)) {
        throw new Error('You do not have access to this conversation.');
      }
      return thread.messages.map((message) => ({ ...message }));
    },

    async send(conversationId, html) {
      const store = read();
      const me = currentUser(store);
      const thread = store.threads[conversationId];
      if (!thread || !thread.members.includes(me.uid)) {
        throw new Error('You do not have access to this conversation.');
      }
      const message = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        uid: me.uid,
        name: me.name,
        message: html,
        date: new Date().toISOString(),
      };
      thread.messages = [...thread.messages, message].slice(-MESSAGE_LIMIT);
      write(store);
      return message;
    },

    async read(conversationId, messageId) {
      const store = read();
      const me = currentUser(store);
      const thread = store.threads[conversationId];
      if (!thread || !thread.members.includes(me.uid)) return;
      const messages = thread.messages;
      const next = messages.findIndex((m) => m.id === messageId);
      const previous = messages.findIndex((m) => m.id === thread.reads?.[me.uid]);
      // Never move the read position backward: a stale acknowledgment from a
      // slow render must not un-read newer messages.
      if (next < 0 || next <= previous) return;
      thread.reads = { ...thread.reads, [me.uid]: messageId };
      write(store);
    },

    /* -- local-mode only ------------------------------------------------- */

    people() {
      return read().people.map((person) => ({ ...person }));
    },

    identity() {
      return { ...currentUser(read()) };
    },

    setIdentity(uid) {
      const store = read();
      if (!findPerson(store, uid)) return;
      store.identity = uid;
      write(store);
    },

    clear() {
      try {
        window.localStorage.removeItem(STORE_KEY);
      } catch (err) {
        console.warn('Messages: local history could not be cleared', err);
      }
    },
  };
}

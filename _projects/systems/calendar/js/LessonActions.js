// ============================================
// LessonActions.js
// Teacher and admin actions inside the lesson panel: find the homework
// record the lesson page created, see who grades it, and make the
// teaching team the graders.
//
// Reads OCSTeaching.state.api ({ javaURI, fetchOptions }), which index.md
// passes into TeachingSlots.install. Nothing here shows for students.
//
// Load order: after LessonPanel.js.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching;
  if (!T || !T.openLesson) { console.warn('LessonActions: LessonPanel.js must load first'); return; }

  // --- Rules, testable without a page ---------------------------------

  // The homework record for a slot. The lesson page creates the record with
  // "[CONTENT_URL: <page url>]" at the start of the description, and the
  // deploy script writes the same marker. One writer keeps the leading
  // slash and one drops it, so both spellings match. Falls back to the
  // page title.
  T.findHomework = function (assignments, slot) {
    const list = Array.isArray(assignments) ? assignments : [];
    if (!slot || !slot.lesson) return null;
    const url = String(slot.lesson).replace(/\/+$/, '');
    const bare = url.replace(/^\/+/, '');
    const markers = [`[CONTENT_URL: /${bare}]`, `[CONTENT_URL: ${bare}]`];
    const byMarker = list.find(a => markers.some(m => String(a.description || '').includes(m)));
    if (byMarker) return byMarker;
    const title = String(slot.lessonTitle || '').trim().toLowerCase();
    if (!title) return null;
    return list.find(a => String(a.name || '').trim().toLowerCase() === title) || null;
  };

  // Who becomes a grader: the presenters named in the plan when their login
  // ids are filled in, otherwise everyone in the team's group.
  //   { group, people: [{ id, uid, name }], via: 'presenters' | 'team' | 'none' }
  T.graderCandidates = function (slot, groups) {
    const team = slot && slot.team ? String(slot.team) : '';
    const group = (Array.isArray(groups) ? groups : []).find(g => g && String(g.name || '') === team) || null;
    const members = group && Array.isArray(group.members) ? group.members : [];
    const uids = ((slot && slot.presenters) || []).map(p => (p && p.uid ? String(p.uid) : '')).filter(Boolean);
    const named = members.filter(m => uids.includes(String(m.uid)));
    if (named.length) return { group: group, people: named, via: 'presenters' };
    if (members.length) return { group: group, people: members, via: 'team' };
    return { group: group, people: [], via: 'none' };
  };

  // Writes only from the main site or a local backend. A fork's preview
  // talks to the production backend, so it reads but does not write.
  T.canWriteHere = function (hostname) {
    const h = String(hostname || '').toLowerCase();
    return h === 'pages.opencodingsociety.com' || h === 'localhost' || h === '127.0.0.1';
  };

  T.peopleNames = function (people) {
    return (Array.isArray(people) ? people : [])
      .map(p => (p && (p.name || p.uid)) || (p && p.id != null ? '#' + p.id : ''))
      .filter(Boolean);
  };

  // The rows of the Teacher section. [label, html]. Also says whether the
  // assign button may show.
  T.renderActionRows = function (slot, data, hostname) {
    const e = T.escape;
    const hw = data.homework;
    const cand = T.graderCandidates(slot, data.groups);
    const writes = T.canWriteHere(hostname);
    const rows = [];
    if (data.error) {
      rows.push(['Backend', `<span class="lesson-panel__dim">${e(data.error)}</span>`]);
    } else if (!slot.lesson) {
      rows.push(['Homework record', '<span class="lesson-panel__dim">Waits for the lesson page. The page creates the record the first time it is opened.</span>']);
    } else if (!hw) {
      rows.push(['Homework record', '<span class="lesson-panel__dim">Not created yet. Open the lesson page once; it creates the record.</span>']);
    } else {
      const n = Number(hw.points);
      const points = isFinite(n) && n > 0 ? `${n % 1 ? n : n.toFixed(0)} point${n === 1 ? '' : 's'}` : '';
      rows.push(['Homework record', `#${e(hw.id)} <span class="lesson-panel__dim">${e(hw.name)}${points ? ' \u00B7 ' + points : ''}${hw.dueDate ? ' \u00B7 due ' + e(hw.dueDate) : ''}</span>`]);
      const names = T.peopleNames(data.graders);
      rows.push(['Graders', data.gradersError
        ? '<span class="lesson-panel__dim">Could not read the grader list.</span>'
        : (names.length ? e(names.join(', ')) : '<span class="lesson-panel__dim">None yet</span>')]);
    }
    if (!data.error && slot.kind === 'lesson') {
      const who = T.peopleNames(cand.people);
      let text;
      if (cand.via === 'none') {
        text = cand.group
          ? `<span class="lesson-panel__dim">The ${e(slot.team)} group has no members yet.</span>`
          : `<span class="lesson-panel__dim">No group named ${e(slot.team || '(none)')} on the backend.</span>`;
      } else {
        text = `${e(who.join(', '))} <span class="lesson-panel__dim">(${cand.via === 'presenters' ? 'the presenters' : 'everyone in ' + e(slot.team)})</span>`;
      }
      rows.push(['Would grade', text]);
    }
    return { rows: rows, cand: cand, writes: writes, hw: hw, canAssign: !!(hw && cand.people.length && !data.error) };
  };

  // --- Backend ------------------------------------------------------------

  function api() { return (T.state && T.state.api) || null; }

  async function getJson(path) {
    const a = api();
    const r = await fetch(a.javaURI + path, Object.assign({}, a.fetchOptions, { method: 'GET' }));
    if (!r.ok) throw new Error(`${r.status} on ${path}`);
    return r.json();
  }

  async function postJson(path, body) {
    const a = api();
    const headers = Object.assign({}, (a.fetchOptions && a.fetchOptions.headers) || {}, { 'Content-Type': 'application/json' });
    const r = await fetch(a.javaURI + path, Object.assign({}, a.fetchOptions, { method: 'POST', headers: headers, body: JSON.stringify(body) }));
    if (!r.ok) throw new Error(`${r.status} on ${path}`);
    return r;
  }

  // The reads the section needs. Errors become a row, not a crash.
  T.loadActionData = async function (slot) {
    const out = { assignments: [], groups: [], graders: [], gradersError: false, homework: null, error: '' };
    try {
      const both = await Promise.all([getJson('/api/assignments/'), getJson('/api/groups')]);
      out.assignments = Array.isArray(both[0]) ? both[0] : [];
      out.groups = Array.isArray(both[1]) ? both[1] : [];
      out.homework = T.findHomework(out.assignments, slot);
      if (out.homework) {
        try { out.graders = await getJson(`/api/assignments/assignedGraders/${out.homework.id}`); } catch (err) { out.graders = []; out.gradersError = true; }
      }
    } catch (err) {
      out.error = 'Could not reach the backend (' + err.message + ').';
    }
    return out;
  };

  T.assignGraders = function (assignmentId, people) {
    return postJson(`/api/assignments/assignGraders/${assignmentId}`, people.map(p => Number(p.id)));
  };

  // --- The section ----------------------------------------------------------

  function el(id) { return document.getElementById(id); }

  T.renderActions = async function (slot, statusText) {
    const box = el('lessonModalActions');
    if (!box) return;
    const viewer = T.state && T.state.viewer;
    if (!slot || !viewer || !T.isStaff(viewer.roles) || !api()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<p class="lesson-panel__section">Teacher</p><p class="lesson-panel__note">Loading the homework record\u2026</p>';
    const data = await T.loadActionData(slot);
    if (T.currentSlot !== slot) return; // the panel moved on to another slot
    const r = T.renderActionRows(slot, data, root.location && root.location.hostname);
    const e = T.escape;
    let html = '<p class="lesson-panel__section">Teacher</p><dl class="ocs-kv ocs-kv--compact">' +
      r.rows.map(([k, v]) => `<div class="ocs-kv__row"><dt class="ocs-kv__key">${e(k)}</dt><dd class="ocs-kv__value">${v}</dd></div>`).join('') +
      '</dl><div class="lesson-panel__links">';
    if (slot.kind === 'lesson') {
      const label = `Make ${r.cand.via === 'presenters' ? 'the presenters' : 'the team'} the graders`;
      html += r.canAssign && r.writes
        ? `<button type="button" class="ocs-btn ocs-btn--secondary ocs-btn--sm" id="lessonModalAssign">${label}</button>`
        : `<span class="ocs-btn ocs-btn--secondary ocs-btn--sm" aria-disabled="true">${label}</span>`;
    }
    if (r.hw) html += `<a class="ocs-btn ocs-btn--secondary ocs-btn--sm" href="${e(T.withBase('/submissions'))}">Open submissions</a>`;
    html += '</div>';
    if (!r.writes) html += '<p class="lesson-panel__note">This copy of the site only reads. Setting graders works on the main site or with a local backend.</p>';
    html += `<p class="lesson-panel__note" id="lessonModalActionStatus" role="status" aria-live="polite">${e(statusText || '')}</p>`;
    box.innerHTML = html;

    const btn = el('lessonModalAssign');
    if (btn) {
      btn.onclick = async function () {
        const status = el('lessonModalActionStatus');
        btn.disabled = true;
        status.textContent = 'Saving\u2026';
        try {
          await T.assignGraders(r.hw.id, r.cand.people);
          T.renderActions(slot, `Graders set: ${T.peopleNames(r.cand.people).join(', ')}.`);
        } catch (err) {
          status.textContent = 'Could not set the graders (' + err.message + ').';
          btn.disabled = false;
        }
      };
    }
  };

  // Every open of the panel draws the section for staff and hides it for
  // everyone else.
  const openLesson = T.openLesson;
  T.openLesson = function (slotOrId) {
    const ok = openLesson(slotOrId);
    if (ok) T.renderActions(T.currentSlot);
    return ok;
  };
})(typeof window !== 'undefined' ? window : globalThis);

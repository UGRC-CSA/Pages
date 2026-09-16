// ============================================
// LessonPanel.js
// The panel that opens when a teaching chip is clicked.
//
// Fills _includes/lesson-modal.html from the slot the chip carries and opens
// it with showModal(). Replaces OCSTeaching.onEventClick, so index.md does
// not change for this file beyond the script tag.
//
// Load order: after TeachingSlots.js.
// Everything here is build-time data from the plan. No backend calls.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching;
  if (!T) { console.warn('LessonPanel: TeachingSlots.js must load first'); return; }

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // "yyyy-MM-dd" -> "Tue 22 Sep". Built from parts, not new Date(string), so
  // the day never shifts with the time zone.
  T.formatDay = function (iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  };

  // The school week a date falls in, from the weeks the page embeds.
  T.weekOf = function (iso) {
    const weeks = (T.state && T.state.plan && T.state.plan.weeks) || [];
    const w = weeks.find(w => w.monday && w.friday && iso >= w.monday && iso <= w.friday);
    return w ? w.n : null;
  };

  T.courseUrl = function (course) {
    const base = (T.state && T.state.plan && T.state.plan.coursePageBase) || (root.SITE_BASEURL || '') + '/navigation/courses/';
    return base + String(course || '').toLowerCase() + '/';
  };

  T.editUrl = function (course) {
    const base = (T.state && T.state.plan && T.state.plan.editBase) || '';
    return base ? base + String(course || '').toLowerCase() + '.yml' : '';
  };

  // --- Text the panel shows ---------------------------------------

  // The five lines the old Slack post carried, in one paste.
  T.announcementText = function (slot) {
    const lesson = slot.lesson ? T.absoluteUrl(slot.lesson) : '';
    const who = T.presenterNames(slot);
    const lines = [
      `${slot.topic || 'Lesson'} \u2014 ${slot.course} period ${slot.period} \u2014 ${T.formatDay(slot.date)}`,
      `Teaching: ${slot.team || 'TBA'}${who.length ? ': ' + who.join(', ') : ''}`,
      `Lesson: ${lesson || '(not published yet)'}`,
      `Homework: ${lesson ? lesson + '#homework-hack' : '(on the lesson page)'}${slot.dueDate ? ' \u2014 due ' + T.formatDay(T.parseDueDate(slot.dueDate)) + ', 8:35 AM' : ''}`,
      `Questions: the Week ${T.weekOf(slot.date) || ''} chat on ${T.absoluteUrl(T.courseUrl(slot.course))}`.replace('Week  chat', 'week chat')
    ];
    return lines.join('\n');
  };

  T.absoluteUrl = function (path) {
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    const origin = (root.location && root.location.origin) || '';
    return origin + T.withBase(path);
  };

  // The rows for the facts list. Each is [label, html].
  T.factRows = function (slot) {
    const e = T.escape;
    const rows = [];
    rows.push(['Day', e(T.formatDay(slot.date)) + (T.weekOf(slot.date) ? ` <span class="lesson-panel__dim">\u00B7 Week ${e(T.weekOf(slot.date))}</span>` : '')]);
    rows.push(['Period', `<span class="ocs-badge">P${e(slot.period)}</span> <span class="lesson-panel__dim">${e(slot.course)}</span>`]);
    if (slot.kind === 'checkpoint') {
      rows.push(['Who', 'Everyone in the period']);
      return rows;
    }
    rows.push(['Team', e(slot.team || 'Not assigned yet')]);
    const names = T.presenterNames(slot);
    rows.push(['Teachers', names.length ? e(names.join(', ')) : `<span class="lesson-panel__dim">The team decides who presents</span>`]);
    if (slot.builds) {
      rows.push(['They build', e(slot.builds) + (slot.project_url ? ` <a href="${e(T.withBase(slot.project_url))}">See the project</a>` : '')]);
    }
    if (slot.frq) rows.push(['FRQ type', e(slot.frq)]);
    const due = T.parseDueDate(slot.dueDate);
    rows.push(['Homework due', due ? e(T.formatDay(due)) + ', 8:35 AM' : `<span class="lesson-panel__dim">Not set yet. It comes from the lesson page.</span>`]);
    if (slot.status) {
      const proposed = slot.status === 'proposed';
      rows.push(['Status', `<span class="ocs-badge ${proposed ? 'ocs-badge--warning' : 'ocs-badge--success'}">${e(slot.status)}</span>${proposed ? ' <span class="lesson-panel__dim">The teacher and the table confirm by pull request</span>' : ''}`]);
    }
    return rows;
  };

  // The buttons. [label, href, enabled]
  T.linkList = function (slot) {
    const lesson = slot.lesson ? T.withBase(slot.lesson) : '';
    const has = !!lesson;
    const week = T.weekOf(slot.date);
    const list = [];
    if (slot.kind !== 'checkpoint') {
      list.push(['Lesson page', lesson, has]);
      list.push(['Tech Talk', lesson + '#tech-talk', has]);
      list.push(['Popcorn hack', lesson + '#popcorn-hack', has]);
      list.push(['Homework hack', lesson + '#homework-hack', has]);
      list.push(['Grading plan', lesson + '#grading-plan', has]);
      list.push(['Submit homework', lesson + '#link-form', has]);
      list.push(['Lesson chat', lesson + '#lessonChat', has]);
    }
    list.push([week ? `Week ${week} chat` : 'Week chat', T.courseUrl(slot.course) + (week ? `#week-${week}` : ''), true]);
    const edit = T.editUrl(slot.course);
    if (edit) list.push(['Edit the plan on GitHub', edit, true]);
    return list;
  };

  // --- Filling and opening ----------------------------------------

  function el(id) { return document.getElementById(id); }

  T.openLesson = function (slotOrId) {
    const slot = typeof slotOrId === 'string'
      ? ((T.state && T.state.slots) || []).find(s => s.id === slotOrId)
      : slotOrId;
    const dlg = el('lessonModal');
    if (!slot || !dlg) return false;
    const e = T.escape;

    el('lessonModalKicker').textContent = slot.kind === 'checkpoint' ? 'Checkpoint' : 'Lesson';
    el('lessonModalTitle').textContent = slot.topic || (slot.kind === 'checkpoint' ? 'Checkpoint' : 'Lesson');

    // Facts
    el('lessonModalFacts').innerHTML = T.factRows(slot).map(([k, v]) =>
      `<div class="ocs-kv__row"><dt class="ocs-kv__key">${e(k)}</dt><dd class="ocs-kv__value">${v}</dd></div>`).join('');

    // Alert when the page is not there yet
    const alert = el('lessonModalAlert');
    if (slot.kind !== 'checkpoint' && !slot.lesson) {
      el('lessonModalAlertTitle').textContent = 'Lesson page not published yet';
      el('lessonModalAlertText').textContent = 'The teaching team adds the page by pull request and puts its address in the plan file. The links below turn on when it lands.';
      alert.hidden = false;
    } else {
      alert.hidden = true;
    }

    // Links
    const links = T.linkList(slot);
    el('lessonModalLinks').innerHTML = links.map(([label, href, on]) => on
      ? `<a class="ocs-btn ocs-btn--secondary ocs-btn--sm" href="${e(href)}">${e(label)}</a>`
      : `<span class="ocs-btn ocs-btn--secondary ocs-btn--sm" aria-disabled="true" title="Lesson page not published yet">${e(label)}</span>`
    ).join('');
    el('lessonModalLinksLabel').hidden = links.length === 0;

    // Last change
    const upd = el('lessonModalUpdated');
    upd.textContent = (slot.lastUpdated ? `Plan last changed ${slot.lastUpdated}. ` : '') + 'Same-day changes are posted in the week chat.';

    // Copy announcement
    const copyBtn = el('lessonModalCopy');
    copyBtn.hidden = slot.kind === 'checkpoint';
    copyBtn.onclick = function () {
      const text = T.announcementText(slot);
      const done = () => { const s = el('lessonModalCopied'); s.textContent = 'Copied'; setTimeout(() => { s.textContent = ''; }, 2000); };
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(done, () => root.prompt('Copy this announcement:', text));
      } else {
        root.prompt('Copy this announcement:', text);
      }
    };
    el('lessonModalCopied').textContent = '';

    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); }
    else dlg.setAttribute('open', '');
    T.currentSlot = slot;
    return true;
  };

  // Click on the backdrop closes; the close buttons close through
  // <form method="dialog">; Escape closes natively.
  function wireDialog() {
    const dlg = el('lessonModal');
    if (!dlg || dlg.dataset.wired) return;
    dlg.dataset.wired = '1';
    dlg.addEventListener('click', function (ev) {
      if (ev.target === dlg) dlg.close('cancel');
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireDialog);
    else wireDialog();
  }

  // The chip click now opens the panel instead of leaving the calendar.
  T.onEventClick = function (ext) {
    const slot = ext && ext.slot;
    if (!slot) return;
    if (!T.openLesson(slot)) {
      // No dialog on this page: fall back to the lesson page.
      if (slot.lesson) root.location.href = T.withBase(slot.lesson);
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);

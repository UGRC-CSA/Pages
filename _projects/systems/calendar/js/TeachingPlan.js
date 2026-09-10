// ============================================
// TeachingPlan.js
// The Lessons tab on the calendar page: the teaching weeks for one class and
// period. A grid (weekdays down, weeks across) on wide screens and a list
// grouped by day on narrow ones. Both come from one model.
//
// Reads OCSTeaching.state, which TeachingSlots.install sets, and the weeks
// the page embeds. Opens the panel from LessonPanel.js. Build-time data
// only; nothing here talks to the backend.
//
// Load order: after LessonPanel.js.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching;
  if (!T) { console.warn('TeachingPlan: TeachingSlots.js must load first'); return; }

  const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const RANK = { checkpoint: 0, lesson: 1, 'hw-due': 2 };

  function iso(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  T.todayIso = function () { return iso(new Date()); };

  // --- The model ----------------------------------------------------

  // Monday to Friday of a school week, from its Monday.
  T.weekDays = function (week) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String((week && week.monday) || ''));
    if (!m) return [];
    const out = [];
    for (let i = 0; i < 5; i++) out.push(iso(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + i)));
    return out;
  };

  // The weeks with at least one slot in the plan, in date order. The plan's
  // slots, not the viewer's, so the grid has the same shape for everyone.
  T.teachingWeeks = function (weeks, slots) {
    const dates = (Array.isArray(slots) ? slots : []).map(s => s.date);
    return (Array.isArray(weeks) ? weeks : [])
      .filter(w => w.monday && w.friday && dates.some(d => d >= w.monday && d <= w.friday))
      .sort((a, b) => String(a.monday).localeCompare(String(b.monday)));
  };

  // Days with no school inside those weeks, read from each week's notes
  // line, for example "9/29 Non-Student Day". Returns ISO dates.
  T.daysOff = function (weeks) {
    const out = [];
    (Array.isArray(weeks) ? weeks : []).forEach(w => {
      const note = String(w.notes || '');
      if (!/non-?student|no school|holiday/i.test(note)) return;
      const mon = String(w.monday || ''), fri = String(w.friday || '');
      const re = /(\d{1,2})\/(\d{1,2})/g;
      let m;
      while ((m = re.exec(note))) {
        const mm = m[1].padStart(2, '0'), dd = m[2].padStart(2, '0');
        // A week that crosses New Year spans two years; take the one whose
        // month matches the Friday when the note's month is the Friday's.
        const year = mm === fri.slice(5, 7) ? fri.slice(0, 4) : mon.slice(0, 4);
        out.push(`${year}-${mm}-${dd}`);
      }
    });
    return out;
  };

  // The class-and-period pairs the picker offers: every pair in the plan for
  // staff, the pairs in the viewer's own visible slots for everyone else.
  T.pickerChoices = function (state) {
    const src = state.mode === 'staff' ? state.slots : state.visible;
    const seen = new Map();
    (src || []).forEach(s => {
      const key = `${s.course}|${s.period}`;
      if (!seen.has(key)) seen.set(key, { course: s.course, period: s.period, key: key });
    });
    return [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));
  };

  // The viewer's own class when it is one of the choices, otherwise the first.
  T.defaultChoice = function (choices, viewer) {
    const classes = T.viewerClasses(viewer && viewer.groups);
    return choices.find(c => classes.some(k => k.course === c.course && k.period === c.period)) || choices[0] || null;
  };

  // One day: its lessons and checkpoints, plus any homework due that day.
  T.dayModel = function (date, week, slots, viewer, off, today) {
    const items = [];
    slots.forEach(s => { if (s.date === date) items.push({ kind: s.kind, slot: s, mine: T.isPresenter(s, viewer) }); });
    slots.forEach(s => {
      if (s.kind === 'lesson' && s.hasAssignment && T.parseDueDate(s.dueDate) === date) items.push({ kind: 'hw-due', slot: s, mine: false });
    });
    items.sort((a, b) => RANK[a.kind] - RANK[b.kind]);
    return { date: date, week: week.n, off: off.includes(date), today: date === today, items: items };
  };

  // The whole tab for one class and period.
  //   columns: one per week, each with five days
  //   rows:    one per weekday, each with one cell per week
  //   days:    the same days flat, for the list
  T.planModel = function (state, choice, today) {
    const weeks = T.teachingWeeks(state.plan && state.plan.weeks, state.slots);
    const off = T.daysOff(weeks);
    const visible = (state.visible || []).filter(s => !choice || (s.course === choice.course && s.period === choice.period));
    const columns = weeks.map(w => ({ week: w, days: T.weekDays(w).map(d => T.dayModel(d, w, visible, state.viewer, off, today)) }));
    const rows = WEEKDAYS.map((name, i) => ({ weekday: name, cells: columns.map(c => c.days[i]).filter(Boolean) }));
    const lessons = visible.filter(s => s.kind === 'lesson');
    return {
      weeks: weeks, columns: columns, rows: rows, off: off,
      days: columns.flatMap(c => c.days),
      counts: {
        lessons: lessons.length,
        proposed: lessons.filter(s => s.status === 'proposed').length,
        withPage: lessons.filter(s => s.lesson).length,
        checkpoints: visible.filter(s => s.kind === 'checkpoint').length
      }
    };
  };

  // Which empty state to show, or null when there is something to draw.
  T.emptyKind = function (state, model) {
    if (state.mode === 'anonymous') return 'anonymous';
    if (state.mode === 'no-class') return 'no-class';
    if (!model.weeks.length || !model.days.some(d => d.items.length)) return 'nothing-planned';
    return null;
  };

  T.emptyCopy = function (kind, urls) {
    switch (kind) {
      case 'anonymous':
        return { title: 'Log in to see the lessons planned for your class', text: 'Each class and period sees its own teaching weeks here.', action: 'Log in', href: urls.login };
      case 'no-class':
        return { title: 'You are not in a class yet', text: 'Add your class on your profile page to see its lessons.', action: 'Open profile', href: urls.profile };
      default:
        return { title: 'No lessons are planned for your class and period yet', text: 'The plan is a file on GitHub. When a table claims a day, it shows here.', action: '', href: '' };
    }
  };

  // --- Text -----------------------------------------------------------

  // "Teaching weeks 6 and 7: Mon 21 Sep to Fri 2 Oct."
  T.weeksLine = function (weeks) {
    if (!weeks.length) return '';
    const ns = weeks.map(w => w.n);
    const list = ns.length > 1 ? ns.slice(0, -1).join(', ') + ' and ' + ns[ns.length - 1] : String(ns[0]);
    return `Teaching week${ns.length > 1 ? 's' : ''} ${list}: ${T.formatDay(weeks[0].monday)} to ${T.formatDay(weeks[weeks.length - 1].friday)}.`;
  };

  T.countsLine = function (c) {
    if (!c.lessons && !c.checkpoints) return '';
    const parts = [`${c.lessons} lesson${c.lessons === 1 ? '' : 's'} planned`];
    if (c.proposed) parts.push(`${c.proposed} still proposed`);
    if (c.lessons) parts.push(`${c.withPage} with a page yet`);
    if (c.checkpoints) parts.push(`${c.checkpoints} checkpoint${c.checkpoints === 1 ? '' : 's'}`);
    return parts.join(' \u00B7 ');
  };

  // "21-25 Sep" for a column heading.
  T.shortRange = function (week) {
    const a = T.formatDay(week.monday).split(' '), b = T.formatDay(week.friday).split(' ');
    return a[2] === b[2] ? `${a[1]}\u2013${b[1]} ${a[2]}` : `${a[1]} ${a[2]}\u2013${b[1]} ${b[2]}`;
  };

  // --- HTML -----------------------------------------------------------

  function badges(item) {
    const e = T.escape, s = item.slot, out = [];
    if (item.kind === 'lesson' && s.status === 'proposed') out.push('<span class="ocs-badge ocs-badge--warning">proposed</span>');
    if (item.mine) out.push('<span class="ocs-badge ocs-badge--success">You teach</span>');
    return out.length ? `<span class="lessons-tab__badges">${out.join('')}</span>` : '';
  }

  T.renderItem = function (item) {
    const e = T.escape, s = item.slot;
    let topic, meta;
    if (item.kind === 'hw-due') { topic = `HW due \u00B7 ${e(s.topic)}`; meta = '8:35 AM'; }
    else if (item.kind === 'checkpoint') { topic = e(s.topic || 'Checkpoint'); meta = 'Everyone'; }
    else { topic = e(s.topic || 'Lesson'); meta = e(T.whoLine(s) || 'Team not assigned yet'); }
    return `<button type="button" class="lessons-tab__item lessons-tab__item--${item.kind}${item.mine ? ' lessons-tab__item--mine' : ''}" data-slot-id="${e(s.id)}">` +
      `<span class="lessons-tab__topic">${topic}</span><span class="lessons-tab__meta">${meta}</span>${badges(item)}</button>`;
  };

  T.renderCell = function (day) {
    const e = T.escape;
    const date = `<span class="lessons-tab__date">${e(T.formatDay(day.date).slice(4))}${day.today ? ' \u00B7 Today' : ''}</span>`;
    if (day.off) return `<td class="lessons-tab__cell is-off">${date}<p class="lessons-tab__off">Non-student day</p></td>`;
    return `<td class="lessons-tab__cell${day.today ? ' is-today' : ''}">${date}${day.items.map(T.renderItem).join('')}</td>`;
  };

  T.renderGrid = function (model) {
    const e = T.escape;
    const head = model.columns.map(c => `<th scope="col">Week ${e(c.week.n)}<span class="lessons-tab__range">${e(T.shortRange(c.week))}</span></th>`).join('');
    const body = model.rows.map(r => `<tr><th scope="row">${r.weekday}</th>${r.cells.map(T.renderCell).join('')}</tr>`).join('');
    return `<div class="ocs-table-wrap lessons-tab__grid" role="region" aria-label="Lessons by day" tabindex="0">` +
      `<table class="ocs-table ocs-table--compact lessons-tab__table"><thead><tr><th scope="col"><span class="ocs-sr-only">Day</span></th>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
  };

  T.renderAgenda = function (model) {
    const e = T.escape;
    const days = model.days.filter(d => d.items.length || d.off).map(day => {
      const note = day.today ? `Today \u00B7 Week ${e(day.week)}` : `Week ${e(day.week)}`;
      const rows = day.off
        ? `<li><div class="ocs-agenda__item ocs-agenda__item--muted"><span class="ocs-agenda__body"><span class="ocs-agenda__title">Non-student day</span></span></div></li>`
        : day.items.map(item => {
          const s = item.slot;
          const lead = item.kind === 'checkpoint' ? 'All' : `<span class="ocs-badge">P${e(s.period)}</span>`;
          const title = item.kind === 'hw-due' ? `HW due \u00B7 ${e(s.topic)}` : e(s.topic || (item.kind === 'checkpoint' ? 'Checkpoint' : 'Lesson'));
          const meta = item.kind === 'hw-due' ? '8:35 AM' : (item.kind === 'checkpoint' ? '' : e(T.whoLine(s)));
          const cls = ['ocs-agenda__item'].concat(item.kind === 'checkpoint' ? ['ocs-agenda__item--muted'] : [], item.mine ? ['ocs-agenda__item--mine'] : []).join(' ');
          const tail = badges(item) ? `<span class="ocs-agenda__tail">${badges(item)}</span>` : '';
          return `<li><button type="button" class="${cls}" data-slot-id="${e(s.id)}"><span class="ocs-agenda__lead">${lead}</span>` +
            `<span class="ocs-agenda__body"><span class="ocs-agenda__title">${title}</span>${meta ? `<span class="ocs-agenda__meta">${meta}</span>` : ''}</span>${tail}</button></li>`;
        }).join('');
      return `<li class="ocs-agenda__day${day.today ? ' ocs-agenda__day--today' : ''}"><div class="ocs-agenda__heading"><span class="ocs-agenda__date">${e(T.formatDay(day.date))}</span><span class="ocs-agenda__note">${note}</span></div><ul class="ocs-agenda__items">${rows}</ul></li>`;
    });
    return `<ol class="ocs-agenda lessons-tab__agenda">${days.join('')}</ol>`;
  };

  T.renderEmpty = function (copy) {
    const e = T.escape;
    // An inline icon: the calendar page does not load an icon font.
    const icon = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
    return `<div class="ocs-empty" role="status"><div class="ocs-empty__icon" aria-hidden="true">${icon}</div>` +
      `<p class="ocs-empty__title">${e(copy.title)}</p><p class="ocs-empty__text">${e(copy.text)}</p>` +
      (copy.action ? `<a class="ocs-btn ocs-btn--sm ocs-empty__action" href="${e(copy.href)}">${e(copy.action)}</a>` : '') + `</div>`;
  };

  T.renderHeader = function (state, model, choices, choice) {
    const e = T.escape;
    const title = choice ? `${e(choice.course)} period ${e(choice.period)}` : 'Lessons';
    const edit = choice ? T.editUrl(choice.course) : '';
    const picker = choices.length > 1
      ? `<div class="lessons-tab__picker" role="group" aria-label="Class and period">` +
        choices.map(c => `<button type="button" class="calendar-source-chip${choice && c.key === choice.key ? ' active' : ''}" data-choice="${e(c.key)}" aria-pressed="${choice && c.key === choice.key}">${e(c.course)} \u00B7 P${e(c.period)}</button>`).join('') + `</div>`
      : '';
    // The one-line note only when there are rows to explain; the empty
    // states say the rest themselves.
    const note = state.mode === 'course-fallback' ? T.noteFor(state.mode, T.withBase('/profile')) : '';
    const counts = T.countsLine(model.counts);
    return `<div class="lessons-tab__header"><div><h2 class="lessons-tab__title">${title}</h2>` +
      `<p class="lessons-tab__subtitle">${e(T.weeksLine(model.weeks))} Each table teaches the part of OCS it builds.</p></div>` +
      (edit ? `<a class="ocs-btn ocs-btn--secondary ocs-btn--sm" href="${e(edit)}">Edit the plan on GitHub</a>` : '') + `</div>` +
      picker + (note ? `<p class="lessons-tab__note">${note}</p>` : '') + (counts ? `<p class="lessons-tab__counts">${counts}</p>` : '');
  };

  // --- The tab ----------------------------------------------------------

  T.renderLessonsTab = function (rootEl) {
    const el = rootEl || (typeof document !== 'undefined' && document.getElementById('lessons-panel'));
    const state = T.state;
    if (!el || !state) return false;
    const urls = { login: T.withBase('/login'), profile: T.withBase('/profile') };
    const choices = T.pickerChoices(state);
    if (!T.tab || !choices.some(c => c.key === T.tab.key)) T.tab = T.defaultChoice(choices, state.viewer);
    const model = T.planModel(state, T.tab, T.todayIso());
    const empty = T.emptyKind(state, model);
    el.innerHTML = T.renderHeader(state, model, choices, T.tab) +
      (empty ? T.renderEmpty(T.emptyCopy(empty, urls)) : T.renderGrid(model) + T.renderAgenda(model));
    T.tabChoices = choices;
    if (!el.dataset.wired) {
      el.dataset.wired = '1';
      el.addEventListener('click', function (ev) {
        const chip = ev.target.closest('[data-choice]');
        if (chip) {
          T.tab = (T.tabChoices || []).find(c => c.key === chip.dataset.choice) || T.tab;
          T.renderLessonsTab(el);
          return;
        }
        const item = ev.target.closest('[data-slot-id]');
        if (item) T.openLesson(item.dataset.slotId);
      });
    }
    return true;
  };
})(typeof window !== 'undefined' ? window : globalThis);

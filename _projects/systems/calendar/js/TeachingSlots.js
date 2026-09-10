// ============================================
// TeachingSlots.js
// Sprint 2 team teach on the calendar.
//
// Reads the teaching plan that index.md embeds at build time from
// _data/teaching_plan/*.yml, decides which slots the viewer may see, and
// turns them into FullCalendar events. All the rules live here so they can
// be tested without a page. index.md only calls into this file.
//
// Load order: after FullCalendar, before the page's inline module.
// Global: window.OCSTeaching
//
// Later files (LessonPanel.js, TeachingPlan.js, LessonGrading.js) add to
// the same namespace and replace onEventClick, so index.md never changes
// again for them.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching = root.OCSTeaching || {};

  T.version = '1';

  // ─── Reading the plan ───────────────────────────────────────────

  // The JSON block index.md writes. Null when the page has none.
  T.readPlan = function (doc) {
    const d = doc || (typeof document !== 'undefined' ? document : null);
    if (!d) return null;
    const el = d.getElementById('teaching-plan-json');
    if (!el) return null;
    try {
      return JSON.parse(el.textContent);
    } catch (err) {
      console.error('TeachingSlots: the teaching plan JSON did not parse', err);
      return null;
    }
  };

  // One flat list of slots, each carrying its course, period and the period's
  // leaders, so nothing downstream has to walk the nested shape.
  T.flattenSlots = function (plan) {
    const out = [];
    if (!plan || !plan.courses) return out;
    Object.keys(plan.courses).forEach(courseKey => {
      const course = plan.courses[courseKey] || {};
      const courseCode = String(course.course || courseKey).toUpperCase();
      const periods = course.periods || {};
      Object.keys(periods).forEach(periodKey => {
        const period = periods[periodKey] || {};
        const leaders = Array.isArray(period.leaders) ? period.leaders : [];
        (Array.isArray(period.slots) ? period.slots : []).forEach(slot => {
          if (!slot || !slot.id || !slot.date) return;
          out.push(Object.assign({}, slot, {
            course: courseCode,
            period: String(periodKey),
            leaders: leaders,
            kind: slot.kind === 'checkpoint' ? 'checkpoint' : 'lesson',
            presenters: Array.isArray(slot.presenters) ? slot.presenters : [],
            lastUpdated: course.last_updated || null
          }));
        });
      });
    });
    return out;
  };

  // ─── The viewer ─────────────────────────────────────────────────
  // viewer = { uid, personId, roles: ['ROLE_STUDENT', ...] or [{name}], groups: [{name, course, period, ...}], loggedIn }

  T.roleNames = function (roles) {
    return (Array.isArray(roles) ? roles : []).map(r => (typeof r === 'string' ? r : (r && r.name) || '')).filter(Boolean);
  };

  T.isStaff = function (roles) {
    const names = T.roleNames(roles);
    return names.includes('ROLE_TEACHER') || names.includes('ROLE_ADMIN');
  };

  // The viewer's class groups: groups that carry a course. The seeded class
  // groups (CSA, CSP, CSH, CSSE) carry a course and a period; a table's group
  // may carry a course and no period.
  T.viewerClasses = function (groups) {
    return (Array.isArray(groups) ? groups : [])
      .filter(g => g && g.course)
      .map(g => ({ course: String(g.course).toUpperCase(), period: g.period == null ? '' : String(g.period), name: g.name || '' }));
  };

  T.viewerGroupNames = function (groups) {
    return (Array.isArray(groups) ? groups : []).map(g => (g && g.name) || '').filter(Boolean);
  };

  T.isPresenter = function (slot, viewer) {
    const uid = viewer && viewer.uid ? String(viewer.uid) : '';
    if (!uid) return false;
    return (slot.presenters || []).some(p => p && p.uid && String(p.uid) === uid);
  };

  T.isLeader = function (slot, viewer) {
    const uid = viewer && viewer.uid ? String(viewer.uid) : '';
    if (!uid) return false;
    return (slot.leaders || []).some(l => String(l) === uid);
  };

  T.isTeam = function (slot, viewer) {
    if (!slot.team) return false;
    return T.viewerGroupNames(viewer && viewer.groups).includes(slot.team);
  };

  // Why a viewer may see a slot, or null when they may not.
  //   'staff'      teacher or admin
  //   'class'      in the class group with this course and period
  //   'team'       in the table that teaches it
  //   'presenter'  named as a presenter
  //   'leader'     named as a leader for this period
  T.reasonToSee = function (slot, viewer) {
    if (!viewer) return null;
    if (T.isStaff(viewer.roles)) return 'staff';
    const classes = T.viewerClasses(viewer.groups);
    if (classes.some(c => c.course === slot.course && c.period === slot.period)) return 'class';
    if (T.isTeam(slot, viewer)) return 'team';
    if (T.isPresenter(slot, viewer)) return 'presenter';
    if (T.isLeader(slot, viewer)) return 'leader';
    return null;
  };

  T.canSee = function (slot, viewer) {
    return T.reasonToSee(slot, viewer) !== null;
  };

  // The slots a viewer sees, and how the list was chosen.
  //   mode 'anonymous'       not logged in: nothing
  //   mode 'staff'           everything
  //   mode 'scoped'          the class-and-period rule
  //   mode 'course-fallback' the viewer has no class group with a period,
  //                          but a group that names a course: show that
  //                          whole course, and tell them to pick their class
  //   mode 'no-class'        logged in, no group names a course: nothing
  T.visibleSlots = function (slots, viewer) {
    const all = Array.isArray(slots) ? slots : [];
    if (!viewer || !viewer.loggedIn) return { slots: [], mode: 'anonymous' };
    if (T.isStaff(viewer.roles)) return { slots: all.slice(), mode: 'staff' };

    const classes = T.viewerClasses(viewer.groups);
    const hasPeriodClass = classes.some(c => c.period !== '');
    const scoped = all.filter(s => T.canSee(s, viewer));

    // A class group with a period: the rule applies as written.
    if (hasPeriodClass) return { slots: scoped, mode: 'scoped' };

    // No class group with a period, but some group names a course (a table
    // usually does): show that whole course so the page is not blank, and say
    // what to do about it. Team, presenter and leader matches are inside it.
    const courses = new Set(classes.map(c => c.course));
    if (courses.size) {
      const byCourse = all.filter(s => courses.has(s.course) || T.canSee(s, viewer));
      return { slots: byCourse, mode: 'course-fallback' };
    }

    // No course anywhere. A presenter, leader or team member still sees their
    // own slots; anyone else sees nothing and is told to pick a class.
    if (scoped.length) return { slots: scoped, mode: 'scoped' };
    return { slots: [], mode: 'no-class' };
  };

  // The one sentence the Calendar tab shows for a mode, or '' for none.
  T.noteFor = function (mode, profileUrl) {
    const url = profileUrl || '/profile';
    switch (mode) {
      case 'anonymous':       return 'Log in to see the lessons planned for your class.';
      case 'course-fallback': return `You are seeing every period in your course. Pick your class on your <a href="${T.escape(url)}">profile page</a> to see only your period.`;
      case 'no-class':        return `You are not in a class yet. Add your class on your <a href="${T.escape(url)}">profile page</a> to see its lessons.`;
      default:                return '';
    }
  };

  // ─── Dates and text ─────────────────────────────────────────────

  // Assignment.dueDate is "MM/dd/yyyy". FullCalendar wants "yyyy-MM-dd".
  T.parseDueDate = function (s) {
    if (!s) return '';
    const m = String(s).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    const iso = String(s).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : '';
  };

  T.escape = function (s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  T.presenterNames = function (slot) {
    return (slot.presenters || []).map(p => (p && p.name) || '').filter(Boolean);
  };

  // "UGRC \u00B7 Samarth, Akshaj" or just the team, or nothing.
  T.whoLine = function (slot) {
    const names = T.presenterNames(slot);
    if (slot.team && names.length) return `${slot.team} \u00B7 ${names.join(', ')}`;
    if (names.length) return names.join(', ');
    return slot.team || '';
  };

  // ─── Events for FullCalendar ────────────────────────────────────

  T.buildEvents = function (slots, viewer) {
    const events = [];
    (Array.isArray(slots) ? slots : []).forEach(slot => {
      const mine = T.isPresenter(slot, viewer);
      const isLesson = slot.kind === 'lesson';
      const base = {
        isTeaching: true,
        slotId: slot.id,
        slot: slot,
        // The page's own My Groups filter matches synced events by course in
        // `period` and by `groupName`; these values keep lesson chips inside it.
        period: slot.course,
        groupName: slot.team || '',
        mine: mine
      };
      events.push({
        id: `teach-${slot.id}`,
        title: slot.topic || (isLesson ? 'Lesson' : 'Checkpoint'),
        start: slot.date,
        allDay: true,
        editable: false,
        classNames: ['fc-event-teaching', isLesson ? 'fc-event-lesson' : 'fc-event-checkpoint'].concat(mine ? ['fc-event-lesson--mine'] : []),
        extendedProps: Object.assign({ teachingKind: isLesson ? 'lesson' : 'checkpoint' }, base)
      });
      const due = isLesson && slot.hasAssignment ? T.parseDueDate(slot.dueDate) : '';
      if (due) {
        events.push({
          id: `teach-hw-${slot.id}`,
          title: `HW due: ${slot.topic || 'lesson'}`,
          start: due,
          allDay: true,
          editable: false,
          classNames: ['fc-event-teaching', 'fc-event-hw-due'],
          extendedProps: Object.assign({ teachingKind: 'hw-due' }, base)
        });
      }
    });
    return events;
  };

  // The chip. Month view is narrow: topic and period only. Week and day views
  // add who teaches it. Text goes through escape() because it comes from YAML.
  T.renderChip = function (arg) {
    const ext = (arg && arg.event && arg.event.extendedProps) || {};
    const slot = ext.slot || {};
    const viewType = (arg && arg.view && arg.view.type) || 'dayGridMonth';
    const wide = viewType !== 'dayGridMonth';
    const period = slot.period ? `<span class="fc-teaching__period">P${T.escape(slot.period)}</span>` : '';
    const topic = T.escape(slot.topic || arg.event.title || '');
    let html = '<div class="fc-teaching">';
    if (ext.teachingKind === 'hw-due') {
      html += `<div class="fc-teaching__topic">HW due \u00B7 ${topic}</div>`;
      if (wide) html += `<div class="fc-teaching__meta">${T.escape(T.whoLine(slot))}</div>`;
    } else if (ext.teachingKind === 'checkpoint') {
      html += `<div class="fc-teaching__topic">${topic}</div>`;
      if (wide) html += `<div class="fc-teaching__meta">Everyone ${period}</div>`;
    } else {
      html += `<div class="fc-teaching__topic">${topic} ${period}</div>`;
      if (wide) {
        const who = T.escape(T.whoLine(slot));
        html += `<div class="fc-teaching__meta">${who}${ext.mine ? ' \u00B7 <strong>You teach</strong>' : ''}</div>`;
      }
    }
    html += '</div>';
    return { html: html };
  };

  // What a click does. LessonPanel.js replaces this with the modal. Until
  // then: go to the lesson page, or say it is not there yet.
  T.onEventClick = function (ext) {
    const slot = (ext && ext.slot) || {};
    if (slot.lesson) {
      root.location.href = T.withBase(slot.lesson);
      return;
    }
    T.notify(slot.kind === 'checkpoint'
      ? `${slot.topic || 'Checkpoint'} — for everyone in the period.`
      : 'The lesson page for this slot is not published yet.');
  };

  T.notify = function (message) {
    if (typeof root.alert === 'function') root.alert(message);
  };

  T.withBase = function (path) {
    const base = root.SITE_BASEURL || '';
    if (!path) return base || '/';
    if (/^https?:\/\//.test(path)) return path;
    return base + (path.startsWith('/') ? path : '/' + path);
  };

  T.handles = function (ext) {
    return !!(ext && ext.isTeaching);
  };

  // Whether the viewer may use Edit / Delete on an ordinary calendar event:
  // staff, or the person who made it. Not a server rule; the server rule
  // is a separate change. This only removes the accidental case.
  T.canEditEvent = function (ext, viewer) {
    if (!viewer) return false;
    if (T.isStaff(viewer.roles)) return true;
    const owner = ext && ext.individual ? String(ext.individual) : '';
    return !!owner && !!viewer.uid && owner === String(viewer.uid);
  };

  // ─── One call from index.md ─────────────────────────────────────
  // Returns { events, mode, note, slots } for the viewer.
  T.install = function (ctx) {
    const plan = (ctx && ctx.plan) || T.readPlan(ctx && ctx.document);
    const slots = T.flattenSlots(plan);
    const viewer = (ctx && ctx.viewer) || null;
    const vis = T.visibleSlots(slots, viewer);
    T.state = { plan: plan, slots: slots, visible: vis.slots, mode: vis.mode, viewer: viewer };
    return {
      events: T.buildEvents(vis.slots, viewer),
      mode: vis.mode,
      note: T.noteFor(vis.mode, ctx && ctx.profileUrl),
      slots: vis.slots
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

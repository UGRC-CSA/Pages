// ============================================
// LessonGrading.js
// Grade a lesson's homework from the calendar: one table of submissions,
// the class score scale, a reason for every score, missing students
// recorded at the missing score, and a summary to paste into the
// teacher's sheet.
//
// Reads OCSTeaching.state.api like LessonActions.js. Opens a second
// dialog (_includes/lesson-grading-modal.html) from the lesson panel.
//
// Load order: after LessonActions.js.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching;
  if (!T || !T.findHomework) { console.warn('LessonGrading: LessonActions.js must load first'); return; }

  // The class scale from last year's team teach. Late takes 0.1 off.
  T.SCALE = [
    { value: 0.9, hint: 'Complete and on time' },
    { value: 0.91, hint: 'Extra credit' },
    { value: 0.8, hint: 'Small gaps' },
    { value: 0.7, hint: 'Large gaps' },
    { value: 0.55, hint: 'Missing' }
  ];
  T.LATE_PENALTY = 0.1;
  T.MISSING_SCORE = 0.55;
  T.MISSING_REASON = 'No submission by the deadline.';

  // --- Rules, testable without a page -----------------------------------

  // Who may open the grading view: staff, the presenters, their table, the
  // period's leaders. The backend decides what they may actually see.
  T.mayGrade = function (slot, viewer) {
    if (!slot || !viewer || !viewer.loggedIn) return false;
    return T.isStaff(viewer.roles) || T.isPresenter(slot, viewer) || T.isTeam(slot, viewer) || T.isLeader(slot, viewer);
  };

  // The class roster: members of the group with the slot's course and period.
  T.classRoster = function (slot, groups) {
    const g = (Array.isArray(groups) ? groups : []).find(x => x && String(x.course || '').toUpperCase() === String(slot.course || '').toUpperCase() && String(x.period == null ? '' : x.period) === String(slot.period));
    return g && Array.isArray(g.members) ? g.members : [];
  };

  T.submissionLink = function (content) {
    if (!content) return '';
    if (typeof content === 'string') return /^https?:\/\//.test(content) ? content : '';
    return content.url || content.link || content.href || '';
  };

  T.submitterName = function (s) {
    const p = s && s.submitter;
    return p ? (p.name || p.uid || ('#' + p.id)) : 'Unknown';
  };

  // One row per submission, then one per class member without one.
  T.gradingRows = function (submissions, roster) {
    const rows = (Array.isArray(submissions) ? submissions : []).map(s => ({
      kind: 'submitted', id: s.id, personId: s.submitter ? s.submitter.id : null, name: T.submitterName(s),
      link: T.submissionLink(s.content), late: !!s.isLate, grade: s.grade == null ? null : Number(s.grade), feedback: s.feedback || ''
    }));
    const have = new Set(rows.map(r => String(r.personId)));
    (Array.isArray(roster) ? roster : []).forEach(m => {
      if (m && !have.has(String(m.id))) rows.push({ kind: 'missing', id: null, personId: m.id, name: m.name || m.uid || ('#' + m.id), link: '', late: false, grade: null, feedback: '' });
    });
    rows.sort((a, b) => a.name.localeCompare(b.name));
    return rows;
  };

  // A preset for a late submission loses the penalty, never below missing.
  T.applyLate = function (value, late) {
    if (!late) return value;
    return Math.max(T.MISSING_SCORE, Math.round((value - T.LATE_PENALTY) * 100) / 100);
  };

  // Scores are 0 to 1 on this scale.
  T.validGrade = function (v) {
    if (v === '' || v == null) return null;
    const n = Number(v);
    return isFinite(n) && n >= 0 && n <= 1 ? n : null;
  };

  T.summaryText = function (slot, hw, rows) {
    const graded = rows.filter(r => r.grade != null);
    const submitted = rows.filter(r => r.kind === 'submitted');
    const missing = rows.filter(r => r.kind === 'missing');
    const avg = graded.length ? graded.reduce((s, r) => s + Number(r.grade), 0) / graded.length : null;
    const lines = [
      `${slot.topic || 'Lesson'} \u2014 ${slot.course} period ${slot.period} \u2014 homework #${hw.id}`,
      `${submitted.length} submitted \u00B7 ${missing.length} missing \u00B7 ${graded.length} graded${avg != null ? ' \u00B7 average ' + avg.toFixed(2) : ''}`,
      ''
    ];
    rows.forEach(r => {
      const score = r.grade != null ? Number(r.grade).toFixed(2) : (r.kind === 'missing' ? 'missing, not recorded' : 'not graded');
      lines.push(`${r.name}: ${score}${r.late ? ' (late)' : ''}${r.feedback ? ' \u2014 ' + r.feedback : ''}`);
    });
    return lines.join('\n');
  };

  // --- Backend --------------------------------------------------------------

  function api() { return (T.state && T.state.api) || null; }

  async function call(method, path, body) {
    const a = api();
    const opts = Object.assign({}, a.fetchOptions, { method: method });
    if (body !== undefined) {
      opts.headers = Object.assign({}, (a.fetchOptions && a.fetchOptions.headers) || {}, { 'Content-Type': 'application/json' });
      opts.body = JSON.stringify(body);
    }
    const r = await fetch(a.javaURI + path, opts);
    if (!r.ok) { const err = new Error(`${r.status} on ${path}`); err.status = r.status; throw err; }
    const text = await r.text();
    try { return text ? JSON.parse(text) : null; } catch (e) { return null; }
  }

  // The homework record for a slot, for anyone allowed to grade. Staff
  // already have it from the Teacher section; others load the list.
  T.homeworkFor = async function (slot) {
    const list = await call('GET', '/api/assignments/');
    return T.findHomework(list, slot);
  };

  T.loadGrading = async function (hw, slot) {
    const out = { submissions: [], roster: [], error: '', forbidden: false };
    try {
      out.roster = T.classRoster(slot, await call('GET', '/api/groups'));
    } catch (e) { out.roster = []; }
    try {
      const subs = await call('GET', `/api/assignments/${hw.id}/submissions`);
      out.submissions = Array.isArray(subs) ? subs : [];
    } catch (e) {
      if (e.status === 401 || e.status === 403) out.forbidden = true;
      else out.error = 'Could not load the submissions (' + e.message + ').';
    }
    return out;
  };

  T.saveGrade = function (submissionId, grade, feedback) {
    return call('POST', `/api/submissions/grade/${encodeURIComponent(submissionId)}?grade=${encodeURIComponent(grade)}&feedback=${encodeURIComponent(feedback)}`);
  };

  // A student with no submission gets a placeholder record and the missing
  // score, so the grade lands where every other grade lives.
  T.recordMissing = async function (hw, personId, viewer) {
    const created = await call('POST', `/api/submissions/${hw.id}`, {
      assignmentId: Number(hw.id), submitterId: Number(personId), isGroupSubmission: false,
      content: { type: 'link', url: '' }, comment: `Recorded as missing from the calendar by ${viewer && viewer.uid ? viewer.uid : 'a grader'}`, isLate: true
    });
    if (!created || created.id == null) throw new Error('the backend did not return the new record');
    await T.saveGrade(created.id, T.MISSING_SCORE, T.MISSING_REASON);
    return created;
  };

  // --- HTML -------------------------------------------------------------------

  const el = id => document.getElementById(id);

  T.renderGradingRows = function (rows) {
    const e = T.escape;
    const presets = T.SCALE.map(p => `<button type="button" class="lesson-grading__preset" data-preset="${p.value}" title="${e(p.hint)}">${p.value}</button>`).join('');
    const body = rows.map((r, i) => {
      if (r.kind === 'missing') {
        return `<tr data-row="${i}"><td>${e(r.name)}</td><td><span class="lesson-panel__dim">No submission</span></td><td>\u2014</td>` +
          `<td><span class="lesson-panel__dim">${e(T.MISSING_REASON)}</span></td>` +
          `<td><button type="button" class="ocs-btn ocs-btn--secondary ocs-btn--sm" data-missing="${e(r.personId)}">Record as missing (${T.MISSING_SCORE})</button><span class="lesson-grading__state"></span></td></tr>`;
      }
      const link = r.link ? `<a href="${e(r.link)}" target="_blank" rel="noopener">Open</a>` : '<span class="lesson-panel__dim">No link</span>';
      return `<tr data-row="${i}"><td>${e(r.name)}${r.late ? ' <span class="ocs-badge ocs-badge--warning">late</span>' : ''}</td><td>${link}</td>` +
        `<td><div class="lesson-grading__presets">${presets}</div><input class="ocs-input lesson-grading__score" type="number" step="0.01" min="0" max="1" value="${r.grade != null ? e(r.grade) : ''}" aria-label="Score for ${e(r.name)}"></td>` +
        `<td><input class="ocs-input lesson-grading__reason" value="${e(r.feedback)}" placeholder="Why this score" aria-label="Reason for ${e(r.name)}"></td>` +
        `<td><button type="button" class="ocs-btn ocs-btn--secondary ocs-btn--sm" data-save="${e(r.id)}">Save</button><span class="lesson-grading__state">${r.grade != null ? 'Saved ' + e(Number(r.grade).toFixed(2)) : ''}</span></td></tr>`;
    }).join('');
    return `<div class="ocs-table-wrap" role="region" aria-label="Submissions" tabindex="0"><table class="ocs-table ocs-table--compact lesson-grading__table">` +
      `<thead><tr><th scope="col">Student</th><th scope="col">Submission</th><th scope="col">Score</th><th scope="col">Reason</th><th scope="col"><span class="ocs-sr-only">Save</span></th></tr></thead>` +
      `<tbody>${body}</tbody></table></div>`;
  };

  T.scaleLine = function () {
    return T.SCALE.map(p => `<strong>${p.value}</strong> ${T.escape(p.hint)}`).join(' \u00B7 ') + ` \u00B7 late takes ${T.LATE_PENALTY} off`;
  };

  // --- The dialog -----------------------------------------------------------------

  T.grading = { slot: null, hw: null, rows: [] };

  T.openGrading = async function (slot) {
    const dlg = el('gradingModal');
    if (!dlg || !slot) return false;
    const e = T.escape;
    const viewer = T.state && T.state.viewer;
    T.grading = { slot: slot, hw: null, rows: [] };
    el('gradingModalTitle').textContent = slot.topic || 'Lesson';
    el('gradingModalFacts').textContent = 'Loading\u2026';
    el('gradingModalScale').innerHTML = T.scaleLine();
    el('gradingModalBody').innerHTML = '';
    el('gradingModalCopied').textContent = '';
    const lesson = el('lessonModal');
    if (lesson && lesson.open) lesson.close('grading');
    if (typeof dlg.showModal === 'function') { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute('open', '');

    let hw = null;
    try { hw = await T.homeworkFor(slot); } catch (err) { el('gradingModalFacts').textContent = 'Could not reach the backend (' + err.message + ').'; return true; }
    if (!hw) {
      el('gradingModalFacts').textContent = 'No homework record yet. Open the lesson page once; it creates the record.';
      return true;
    }
    T.grading.hw = hw;
    const data = await T.loadGrading(hw, slot);
    if (T.grading.hw !== hw) return true;
    if (data.forbidden) {
      el('gradingModalFacts').textContent = `Homework #${hw.id}. The backend did not let your account read its submissions. Ask the teacher to make the team the graders; the backend change that lets graders read submissions must also be live.`;
      return true;
    }
    if (data.error) { el('gradingModalFacts').textContent = data.error; return true; }
    const rows = T.gradingRows(data.submissions, data.roster);
    T.grading.rows = rows;
    const missing = rows.filter(r => r.kind === 'missing').length;
    el('gradingModalFacts').textContent = `Homework #${hw.id}${hw.dueDate ? ' \u00B7 due ' + hw.dueDate : ''} \u00B7 ${rows.length - missing} submitted \u00B7 ${missing} without a submission${data.roster.length ? '' : ' (no class roster on the backend yet)'}`;
    el('gradingModalBody').innerHTML = rows.length ? T.renderGradingRows(rows) : '<p class="lesson-panel__note">No submissions yet.</p>';
    return true;
  };

  function rowState(tr, text, isError) {
    const s = tr.querySelector('.lesson-grading__state');
    if (s) { s.textContent = text; s.classList.toggle('is-error', !!isError); }
  }

  function wire() {
    const dlg = el('gradingModal');
    if (!dlg || dlg.dataset.wired) return;
    dlg.dataset.wired = '1';
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close('cancel'); });

    el('gradingModalBack').addEventListener('click', function () {
      dlg.close('back');
      if (T.grading.slot) T.openLesson(T.grading.slot);
    });

    el('gradingModalCopy').addEventListener('click', function () {
      if (!T.grading.hw) return;
      const text = T.summaryText(T.grading.slot, T.grading.hw, T.grading.rows);
      const done = () => { const s = el('gradingModalCopied'); s.textContent = 'Copied'; setTimeout(() => { s.textContent = ''; }, 2000); };
      if (root.navigator && root.navigator.clipboard && root.navigator.clipboard.writeText) {
        root.navigator.clipboard.writeText(text).then(done, () => root.prompt('Copy this summary:', text));
      } else {
        root.prompt('Copy this summary:', text);
      }
    });

    el('gradingModalBody').addEventListener('click', async function (ev) {
      const tr = ev.target.closest('tr[data-row]');
      if (!tr) return;
      const row = T.grading.rows[Number(tr.dataset.row)];
      const preset = ev.target.closest('[data-preset]');
      if (preset) {
        const input = tr.querySelector('.lesson-grading__score');
        input.value = T.applyLate(Number(preset.dataset.preset), row.late);
        tr.querySelector('.lesson-grading__reason').focus();
        return;
      }
      const save = ev.target.closest('[data-save]');
      if (save) {
        const grade = T.validGrade(tr.querySelector('.lesson-grading__score').value);
        const reason = tr.querySelector('.lesson-grading__reason').value.trim();
        if (grade == null) { rowState(tr, 'Score must be between 0 and 1.', true); return; }
        if (!reason) { rowState(tr, 'Add a reason.', true); tr.querySelector('.lesson-grading__reason').focus(); return; }
        save.disabled = true; rowState(tr, 'Saving\u2026');
        try {
          await T.saveGrade(row.id, grade, reason);
          row.grade = grade; row.feedback = reason;
          rowState(tr, 'Saved ' + grade.toFixed(2));
        } catch (err) { rowState(tr, 'Not saved (' + err.message + ').', true); }
        save.disabled = false;
        return;
      }
      const missing = ev.target.closest('[data-missing]');
      if (missing) {
        missing.disabled = true; rowState(tr, 'Recording\u2026');
        try {
          const created = await T.recordMissing(T.grading.hw, row.personId, T.state && T.state.viewer);
          row.kind = 'submitted'; row.id = created.id; row.grade = T.MISSING_SCORE; row.feedback = T.MISSING_REASON; row.late = true;
          el('gradingModalBody').innerHTML = T.renderGradingRows(T.grading.rows);
        } catch (err) { rowState(tr, 'Not recorded (' + err.message + ').', true); missing.disabled = false; }
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
  }

  // The button in the lesson panel, for anyone who may grade this slot.
  T.renderGradingEntry = function (slot) {
    const box = el('lessonModalGrading');
    if (!box) return;
    const viewer = T.state && T.state.viewer;
    if (!slot || slot.kind !== 'lesson' || !T.mayGrade(slot, viewer) || !api()) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = '<p class="lesson-panel__section">Grading</p><div class="lesson-panel__links">' +
      (slot.lesson
        ? '<button type="button" class="ocs-btn ocs-btn--secondary ocs-btn--sm" id="lessonModalGradeBtn">Grade homework</button>'
        : '<span class="ocs-btn ocs-btn--secondary ocs-btn--sm" aria-disabled="true" title="Waits for the lesson page">Grade homework</span>') +
      '</div>';
    const btn = el('lessonModalGradeBtn');
    if (btn) btn.onclick = function () { T.openGrading(slot); };
  };

  const openLesson = T.openLesson;
  T.openLesson = function (slotOrId) {
    const ok = openLesson(slotOrId);
    if (ok) T.renderGradingEntry(T.currentSlot);
    return ok;
  };
})(typeof window !== 'undefined' ? window : globalThis);

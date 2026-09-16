// ============================================
// LessonAi.js
// One-click draft for a gist submission in the grading view: read the
// gist through GitHub's public API, read the Homework Hack section of the
// lesson page, ask the backend's Gemini grader, and put its score and
// reason in the row's boxes. The grader reviews and clicks Save; nothing
// is saved here.
//
// Load order: after LessonGrading.js.
// ============================================
(function (root) {
  'use strict';

  const T = root.OCSTeaching;
  if (!T || !T.gradingRows) { console.warn('LessonAi: LessonGrading.js must load first'); return; }

  T.AI_PREFIX = '[AI-assisted] ';
  T.AI_ANSWER_CAP = 12000;   // characters of gist text sent to the grader
  T.AI_QUESTION_CAP = 3000;  // characters of the homework section
  T.AI_REASON_CAP = 300;     // characters put in the reason box

  // --- Rules, testable without a page ---------------------------------------

  // "https://gist.github.com/user/0123abcd" -> "0123abcd". Also without the
  // user, and with a fragment or ".git" behind it.
  T.gistIdFrom = function (url) {
    const m = /gist\.github\.com\/(?:[^\/\s#?]+\/)?([0-9a-f]{6,64})(?:[\/.#?]|$)/i.exec(String(url || ''));
    return m ? m[1] : '';
  };

  // The gist's files as one text, in name order, with a header per file.
  // Long text is cut and says so.
  T.gistText = function (gist, cap) {
    const limit = cap || T.AI_ANSWER_CAP;
    const files = gist && gist.files ? Object.keys(gist.files).sort() : [];
    const parts = files.map(name => {
      const f = gist.files[name] || {};
      const body = typeof f.content === 'string' ? f.content : '';
      return `--- ${name} ---\n${body}${f.truncated ? '\n[file cut by GitHub]' : ''}`;
    });
    let text = parts.join('\n\n');
    if (text.length > limit) text = text.slice(0, limit) + `\n[cut: ${text.length - limit} more characters]`;
    return text;
  };

  // The text under a heading, up to the next heading of the same or a
  // higher level. `doc` is a Document; `id` the heading's id.
  T.sectionText = function (doc, id, cap) {
    const limit = cap || T.AI_QUESTION_CAP;
    const h = doc && doc.getElementById ? doc.getElementById(id) : null;
    if (!h) return '';
    const level = /^H([1-6])$/.test(h.tagName) ? Number(RegExp.$1) : 2;
    const out = [h.textContent || ''];
    let el = h.nextElementSibling;
    while (el) {
      const m = /^H([1-6])$/.exec(el.tagName);
      if (m && Number(m[1]) <= level) break;
      out.push(el.textContent || '');
      el = el.nextElementSibling;
    }
    const text = out.join('\n').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
    return text.length > limit ? text.slice(0, limit) + ' [cut]' : text;
  };

  // "Grade: 0.85/1.0" and the rest of the text as feedback. The score stays
  // inside the class scale.
  T.parseSuggestion = function (text) {
    const s = String(text || '');
    const m = /grade\s*:\s*\(?\s*([0-9]*\.?[0-9]+)\s*\)?\s*(?:\/\s*1(?:\.0)?)?/i.exec(s);
    let grade = m ? Number(m[1]) : null;
    if (grade != null && !isFinite(grade)) grade = null;
    if (grade != null) grade = Math.min(1, Math.max(T.MISSING_SCORE, Math.round(grade * 100) / 100));
    const feedback = s.replace(m ? m[0] : '', '').replace(/^\s*(feedback|reasoning)\s*:?\s*/i, '').trim();
    return { grade: grade, feedback: feedback };
  };

  // The reason box gets the prefix and the first part of the feedback.
  T.suggestionReason = function (feedback, cap) {
    const limit = cap || T.AI_REASON_CAP;
    const one = String(feedback || '').replace(/\s+/g, ' ').trim();
    const body = one.length > limit ? one.slice(0, limit).replace(/\s+\S*$/, '') + '\u2026' : one;
    return T.AI_PREFIX + (body || 'Draft from the grader; see the text under the row.');
  };

  // --- Calls --------------------------------------------------------------------

  T.readGist = async function (id) {
    const r = await fetch(`https://api.github.com/gists/${encodeURIComponent(id)}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (r.status === 403 || r.status === 429) throw new Error('GitHub limits anonymous reads; try again in a while');
    if (r.status === 404) throw new Error('gist not found (private or deleted)');
    if (!r.ok) throw new Error(`GitHub answered ${r.status}`);
    return r.json();
  };

  T.homeworkQuestion = async function (slot) {
    const fallback = `${slot.topic || 'The lesson'}: the homework hack on the lesson page.`;
    if (!slot.lesson || typeof DOMParser === 'undefined') return fallback;
    try {
      const r = await fetch(T.withBase(slot.lesson), { credentials: 'same-origin' });
      if (!r.ok) return fallback;
      const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
      return T.sectionText(doc, 'homework-hack') || fallback;
    } catch (e) { return fallback; }
  };

  T.askGrader = async function (question, answer) {
    let data;
    try {
      data = await T.apiCall('POST', '/api/gemini-frq/grade', { question: question, answer: answer });
    } catch (err) {
      // The backend puts its reason in {"error": "..."}; show that when it is there.
      let msg = err.message;
      try { const j = JSON.parse(err.body || ''); if (j && j.error) msg = j.error; } catch (e) { /* keep the status text */ }
      throw new Error(msg);
    }
    if (!data) throw new Error('empty reply from the grader');
    if (data.error) throw new Error(data.error);
    let text = data.feedback || data.gradingResult || '';
    if (!text && data.candidates && data.candidates[0]) {
      try { text = data.candidates[0].content.parts[0].text; } catch (e) { text = ''; }
    }
    if (!text) throw new Error('the grader sent no text');
    return String(text);
  };

  // --- The button in a row ---------------------------------------------------------

  T.rowExtras.push(function (row) {
    if (row.kind !== 'submitted' || !T.gistIdFrom(row.link)) return '';
    return `<button type="button" class="lesson-grading__preset lesson-grading__ai" data-ai="${T.escape(row.id)}" title="Read the gist and ask the grader for a draft score and reason. You still decide.">AI suggest</button>`;
  });

  T.rowHandlers.push(async function (ev, tr, row) {
    const btn = ev.target.closest('[data-ai]');
    if (!btn) return false;
    const e = T.escape;
    btn.disabled = true;
    const old = tr.querySelector('.lesson-grading__ai-text');
    if (old) old.remove();
    try {
      T.setRowState(tr, 'Reading the gist\u2026');
      const gist = await T.readGist(T.gistIdFrom(row.link));
      const answer = T.gistText(gist);
      if (!answer.trim()) throw new Error('the gist has no text');
      T.setRowState(tr, 'Asking the grader\u2026');
      const question = await T.homeworkQuestion(T.grading.slot);
      const text = await T.askGrader(question, answer);
      const s = T.parseSuggestion(text);
      if (s.grade != null) tr.querySelector('.lesson-grading__score').value = T.applyLate(s.grade, row.late);
      tr.querySelector('.lesson-grading__reason').value = T.suggestionReason(s.feedback);
      const details = document.createElement('details');
      details.className = 'lesson-grading__ai-text';
      details.innerHTML = `<summary>What the grader said</summary><pre>${e(text)}</pre>`;
      tr.querySelector('.lesson-grading__reason').insertAdjacentElement('afterend', details);
      T.setRowState(tr, s.grade != null
        ? `Suggested ${T.applyLate(s.grade, row.late).toFixed(2)}${row.late ? ' after the late rule' : ''} \u2014 review, then Save`
        : 'The grader gave no score; its text is under the row');
    } catch (err) {
      T.setRowState(tr, 'No draft: ' + err.message + '.', true);
    }
    btn.disabled = false;
    return true;
  });
})(typeof window !== 'undefined' ? window : globalThis);

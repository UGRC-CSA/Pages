---
toc: true
layout: post
title: "Team teach: the two weeks, step by step"
description: What a teaching team does before, on, and after its lesson day, and where each step lives on the site. For Education Leaders, teaching teams, and anyone who wants to know what happens when.
permalink: /sprint2/leader-guide
---

## Who this is for

A teaching team is the table that teaches one lesson. An Education Leader is a student the teacher names to keep a period's two weeks on track. This page is for both. Students who only take the lessons need the last section.

Every step below points at one place on the site. Nothing here needs Slack or a spreadsheet.

## The two weeks at a glance

Week 6 is Mon 21 Sep to Fri 25 Sep. Week 7 is Mon 28 Sep to Fri 2 Oct. Tue 29 Sep is a non-student day.

| Day | For everyone in the period |
|---|---|
| Mon 21 Sep | Checkpoint on lesson pull requests |
| Wed 23 Sep | Create homework and grading stats |
| Mon 28 Sep | Checkpoint and lesson grades · update homework and grading stats |
| Wed 30 Sep | Update homework and grading stats |
| Fri 2 Oct | Complete and submit homework and grading stats |

The lessons sit between those days. The Lessons tab on the calendar shows them for your class and period: [/student/calendar#lessons](/student/calendar#lessons).

## Before your lesson day

1. **Claim the day.** Open the plan file, `_data/teaching_plan/csa.yml`, on GitHub and click the pencil. Add or fix your row: date, topic, team, presenters, the FRQ type. Propose the change. That is a pull request; Akhil merges it for UGRC, then the teacher merges it for the school site. The [delegation page](/sprint2/csa-delegation) explains every field, and so does the README next to the file.
2. **Write the lesson page.** Copy the [lesson template](/sprint2/teaching-lesson-template). Keep every heading with the same words: Learning objective, Success criteria, LxD notes, Tech Talk, Popcorn Hack, Homework Hack, Grading Plan, Revision log. The calendar links to those headings by name.
3. **Fill the frontmatter.** `assignment: true`, `points: 1`, `dueDate` as `MM/DD/YYYY`, and `courses: {'csa': {'week': 6}}` (or 7). The due date is 48 hours after your lesson, at 8:35 AM. A Tuesday lesson is due Thursday.
4. **Put the page's `permalink` into your plan row's `lesson` field.** Same pull request. Once merged, the panel's buttons turn on, the lesson page shows a strip with your day and names, and the week card on the course page links to your page.
5. **Do this by 4:00 PM the day before you teach.** After that, changes go in the week chat, not the plan file.

## On your lesson day

1. **Announce it.** On the calendar, click your lesson. In the panel, click "Copy announcement". Paste the five lines into the week's chat on the [CSA course page](/navigation/courses/csa/). Do it before class.
2. **Teach.** Tech Talk, popcorn hack, then the homework hack. The lesson page's own chat is under the page for questions during and after class.
3. **Open the lesson page once.** The first visit creates the homework record on the backend. The teacher's section of the panel shows it as "Homework record #…".
4. **Ask the teacher to make your team the graders.** The teacher opens your lesson on the calendar and clicks "Make the team the graders" in the Teacher section. Until UGRC-CSA/Spring#5 is live on the school backend, only the teacher can see the submissions; after it, your team can.

## After the homework is due

1. **Open "Grade homework"** from your lesson's panel. One row per submission, plus one row per classmate who submitted nothing.
2. **Score on the class scale.** 0.9 complete and on time · 0.91 extra credit · 0.8 small gaps · 0.7 large gaps · 0.55 missing. Late takes 0.1 off; the buttons do that for you on a late row.
3. **Write a reason for every score.** Save refuses an empty reason. One sentence is enough: what was there, what was missing.
4. **Record the missing ones.** "Record as missing" on a classmate with no submission saves 0.55 with the reason "No submission by the deadline."
5. **For a gist, try "AI suggest".** It reads the gist and your Homework Hack section and drafts a score and a reason. You still decide, and you still click Save. (The backend's model needs the fix in UGRC-CSA/Pages#46 before this works live.)
6. **Send the teacher the summary.** "Copy summary" gives the class, the counts, the average, and one line per student. Paste it where the teacher asks for grading stats. Do this within three days of the due date.

## If something changes on the day

Post it in the week chat. The panel's last line says when the plan was last changed, so a stale plan is visible. A change to the plan file itself is still a pull request.

## If you review another team's lesson

Use that lesson's own chat, under its page. Say one thing that worked and one thing to change. When you change your own lesson because of feedback, add a line to your page's Revision log.

## For students who take the lessons

- **What is taught when:** the Lessons tab on the calendar, [/student/calendar#lessons](/student/calendar#lessons). Click a lesson for the page, the homework, and the due date.
- **Where to submit:** the "Submit homework" form at the bottom of the lesson page. Submit a link, usually a gist.
- **When it is due:** 48 hours after the lesson, at 8:35 AM. Late loses 0.1. Missing is 0.55.
- **Where to ask:** the week's chat on the course page, or the lesson's own chat.

---
toc: true
layout: post
title: "CSA Sprint 2: who teaches what"
description: Each table teaches the part of OCS it builds. This page lists the proposed topics and days, why each topic belongs to its table, and how to change the plan.
permalink: /sprint2/csa-delegation
---

## The rule

Teach what you build. The teacher's CSA topic list on [/sprint2/objectives](/sprint2/objectives) names the systems the CSA tables are building right now: the chat, the login, the submission and grading pipeline, the AI grader, the design system. A table that teaches its own system can show real code, answer hard questions, and point at a running page.

The plan lives in `_data/teaching_plan/csa.yml`. This page explains it. The calendar draws it.

## Proposed lessons

Every row below is a proposal. The teacher and the tables confirm or change them by pull request. Dates are school days in weeks 6 and 7; 2026-09-29 is a non-student day.

| Day | Topic | Table | Why this table |
|---|---|---|---|
| Tue 09-22 | Chat and WebSockets | UGRC — Samarth, Akshaj, Tarun | They built the course chat: announcements, week threads, direct messages. |
| Wed 09-23 | API, MVC, and security systems | UGRC — Sathwik, Akhil, Skandan | They host the backend on AWS and own the Groups management page. |
| Thu 09-24 | Roles in submitting, teaching, and grading | AAA — Aneesh Deevi, Aditya Srivastava, Aaryav Lal | They build who may create an assignment and who may grade it. |
| Fri 09-25 | AI pipeline in grading | Compute-Cuties | They built the AI autograder: a rubric per assignment and a Gemini call that scores against it. |
| Wed 09-30 | JWT login and cookies | Admin table | They own login: password reset, password rules, rate limits. |
| Thu 10-01 | Designing SASS utilities and runners similar to Tailwind class definitions | UGRC — Samarth | The OCS design system: tokens, fifteen components, a docs page. |

## Checkpoints for everyone

From the teacher's sample weeks:

| Day | Checkpoint |
|---|---|
| Mon 09-21 | Checkpoint on Lesson PRs |
| Wed 09-23 | Create HW and Grading Stats |
| Mon 09-28 | Checkpoint and Lesson Grades · Update HW and Grading Stats |
| Wed 09-30 | Update HW and Grading Stats |
| Fri 10-02 | Complete and Submit HW and Grading Stats |

## Not placed yet

Topics from the teacher's list with no table: AWS S3 uploads · Custom JPA queries · Game state tracking: quick and persistent · AI pipeline in gaming and state persistence.

Teams with no slot yet: UGRC's direct-messages team (Perry, Syowns, Leon) · AAA's Analytics and Self Assessment team (Katherine, Jacob, Bridget) · AAA's AI Grading team (Nicolas Diaz, William Windle, Rishabh Jha).

Two of those fit together. The direct-messages team wrote custom JPA queries for conversations, so "Custom JPA queries" could be theirs. AAA's AI Grading team and Compute-Cuties both work on AI grading, so they could teach "AI pipeline in grading" together or split it: the pipeline on one day, the rubric on another. Both are suggestions, not decisions.

## How to claim or change a slot

1. Open `_data/teaching_plan/csa.yml` on GitHub and click the pencil.
2. Add or edit your row. The README next to the file explains every key.
3. Propose the change. That opens a pull request.

Before 4:00 PM the day before a lesson, this is the way. On the day itself, post the change in that week's chat on the course page.

## Step by step

The [leader guide](/sprint2/leader-guide) walks a teaching team through the two weeks, one step at a time, with a link for every step.

## What a lesson needs

Copy the [lesson template](/sprint2/teaching-lesson-template). It has the frontmatter the site needs and every required section: learning objective, success criteria, LxD notes, Tech Talk, popcorn hack, homework hack, grading plan, revision log.

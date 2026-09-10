---
toc: true
layout: post
title: "Sprint 2 lesson template"
description: Copy this page to write your team-teach lesson. It has the frontmatter the site needs and the sections every lesson must have.
permalink: /sprint2/teaching-lesson-template
---

## How to use this page

1. Copy this file into `_posts/CSA/sprint2-teamteach/`. Name the copy with your teaching day and your topic, like `2026-09-22-chat-websockets.md`.
2. In your copy, replace the frontmatter at the top with the block below and fill in the values.
3. Keep every `##` heading on this page, with the same words. The calendar links to them by name.
4. Open a pull request by 4:00 PM the day before you teach. Put your page's `permalink` into `_data/teaching_plan/csa.yml`, in your row's `lesson` field, in the same pull request.

The frontmatter for your copy:

```yaml
---
layout: post
title: "Chat and WebSockets"
description: One sentence on what the lesson teaches.
author: Samarth, Akshaj, Tarun
courses: {'csa': {'week': 6}}
permalink: /csa/sprint2/chat-websockets
assignment: true
points: 1
dueDate: "09/24/2026"
chat: true
toc: true
---
```

| Line | What it does |
|---|---|
| `title` | The lesson's name. Use the topic wording from the plan file. |
| `author` | The presenters, first names, comma separated. |
| `courses` | Puts the lesson on the CSA course page in that week. Week 6 or 7. |
| `permalink` | The page's address. Write it once and never change it. The same string goes in the plan file. |
| `assignment: true` | When the page is merged, the site creates the homework record for it. |
| `points: 1` | The homework is worth one point. |
| `dueDate` | When the homework is due, as `MM/dd/yyyy`. The rule is 48 hours after your lesson, at 8:35 AM. A Tuesday lesson is due Thursday. |
| `chat: true` | Adds a chat box for questions at the bottom of the page. |

Everything below the frontmatter is the lesson. Replace the guidance under each heading with your content. Keep the headings.

## Learning objective

One sentence. Start with "By the end of this lesson you can". Name one thing, not three.

## Success criteria

Three checks a student can run on themselves at the end. Each one starts with "I can".

## LxD notes

The teacher scores how you designed the lesson, not only how you taught it. Keep these short and honest.

**Empathize.** One thing students get wrong about this topic, and how you know.

**Define.** Your point of view in one sentence: "Students who ___ need ___ because ___." Then the learning goal.

**Ideate.** Your "How might we" question, and the activity you chose because of it.

**Prototype.** What you built for the lesson: the code example, the practice task.

**Test.** What you will watch for while teaching, and what would make you change the lesson.

## Tech Talk

The teaching part. Rules from the sprint page:

- Teach one concept.
- Show a collection of related code from OCS, not one definition. Use the code your table actually built.
- Go from simple to complex.
- Get the class doing something within five minutes.

Put the code here in fenced blocks. Say what each piece does in one line before you show it.

## Popcorn Hack

A five-minute task the class does during the lesson. Say exactly what to do and what "done" looks like. Walk around while they do it.

## Homework Hack

What to build, in plain steps. Then how to hand it in:

1. Make a gist of your work at [/gist](/gist), or push it to GitHub.
2. Paste the link into the submit form at the bottom of this page.

Due: repeat the date and time here.

## Grading Plan

The homework is worth one point. Say how you will score it. This table is the default from earlier team-teach rounds; change the rows to fit your homework, but keep the total at one point.

| Work | Score |
|---|---|
| On time and correct | 0.9 |
| Something extra or unusual | 0.91 |
| Late, up to two days | take 0.1 off |
| Missing | 0.55 |

Every score gets a one-line reason. Say how the popcorn hack counts, if it does.

## Revision log

One line per change you made after feedback: the date, what changed, and whose feedback caused it. The teacher looks for at least one.

# Teaching plan files

One file per course. `csa.yml` is CSA. Each file says who teaches what, on which day, for which period. It is the teacher's `Group | Activity | Day` table as data, so the calendar can draw it.

You change it by pull request. The site reads it when it builds. Nothing on the backend stores it.

## How to change it

1. Open the file on GitHub and click the pencil icon.
2. Make the change.
3. Click **Propose changes**. That opens a pull request.
4. Akhil merges it into UGRC-CSA/Pages. The teacher merges it into the main site.

A change made before 4:00 PM the day before a lesson can go this way. A same-day change (a presenter is out) cannot wait for two merges. Post it in that week's chat on the course page. The lesson panel on the calendar links that chat first.

## The keys

### Top of the file

| Key | What it is |
|---|---|
| `course` | The course code. `CSA`, `CSP`, `CSSE` or `CSH`. |
| `sprint` | The sprint number. |
| `last_updated` | The date of the last change, `YYYY-MM-DD`. Bump it every time. The calendar shows it, so a stale plan is visible. |
| `changes` | A list of `{date, note}`. One line per change, newest last. |
| `frq_types` | CSA only: the four College Board FRQ types. A CSA lesson's `frq` must be one of these. Do not edit. The other courses leave the list empty and skip `frq`. |
| `unclaimed_topics` | The teacher's Sprint 2 topic menu for the course, minus the topics a table has claimed. Claim one by adding a lesson row and taking the topic off this list in the same pull request. |
| `periods` | One entry per bell period. The key is the period as text, in quotes: `"2"`. |

### Inside a period

| Key | What it is |
|---|---|
| `leaders` | OCS login ids of the Education Leaders for this period. Empty until the teacher names them. |
| `slots` | The list of rows. One row is one lesson or one checkpoint. |

### A checkpoint row

A checkpoint is for everyone in the period. It is the `all` row in the teacher's table.

```yaml
- id: csa-p2-w6-mon-checkpoint
  date: "2026-09-21"
  kind: checkpoint
  topic: "Checkpoint on Lesson PRs"
```

### A lesson row

A lesson is taught by one table on one day.

```yaml
- id: csa-p2-w6-tue-chat
  date: "2026-09-22"
  kind: lesson
  status: proposed
  topic: "Chat and WebSockets"
  team: "UGRC"
  presenters:
    - { name: "Samarth", uid: "" }
    - { name: "Akshaj", uid: "" }
  builds: "UGRC builds the course chat: class announcements, week threads, and direct messages."
  project_url: /capstone/ocs-communications/
  lesson: /csa/sprint2/chat-websockets
  frq: "Classes"
```

| Key | What it is | Rules |
|---|---|---|
| `id` | A short name for the row. | Unique in the file. Never change it once it exists; the calendar uses it to tell rows apart. Pattern: course, period, week, day, topic. |
| `date` | The day it is taught. | `YYYY-MM-DD`, in quotes. Must be a school day in `_data/school_calendar.yml`. |
| `kind` | `lesson` or `checkpoint`. | |
| `status` | `proposed` or `confirmed`. | Lessons only. The teacher or the table changes it to `confirmed` by PR. |
| `topic` | What is taught. | Use the wording from the teacher's CSA topic list on `/sprint2/objectives` when it fits. |
| `team` | The table that teaches it. | Must match the table's group name on the Groups page exactly, letter for letter. Akhil confirms the names. |
| `presenters` | Who stands up and teaches. | A list of `{name, uid}`. `name` is shown on the calendar. `uid` is the person's OCS login id; it is what makes them a grader for the homework. Leave `uid` empty if you do not know it. |
| `builds` | One sentence on what the table is building in OCS. | This is why the topic is theirs. Plain words. |
| `project_url` | The table's project or capstone page. | Site-relative, like `/capstone/ocs-communications/`. Empty if there is none yet. |
| `lesson` | The lesson page. | The `permalink` from the lesson's frontmatter, written exactly the same way, slash for slash. Empty until the lesson's PR is open. |
| `frq` | CSA only: the College Board FRQ type the lesson connects to. | One of the four in `frq_types`. Other courses leave it out. |

## Things that live somewhere else

- **Homework due date.** In the lesson page's frontmatter, as `dueDate: "MM/dd/yyyy"`. The deploy script sends it to the backend, so the calendar reads it from there. Do not copy it here. The rule from earlier team-teach rounds: 48 hours after the lesson, at 8:35 AM.
- **The grading plan.** In the lesson page, under the heading `## Grading Plan`. The calendar links straight to it.
- **Who is in a class.** The class groups on the backend. A student joins theirs on their profile page.

## Dates for Sprint 2

From `_data/school_calendar.yml`:

| Week | Monday | Friday | Note |
|---|---|---|---|
| 5 | 2026-09-14 | 2026-09-18 | Sprint 2 start. Plan and draft. |
| 6 | 2026-09-21 | 2026-09-25 | Teaching week 1 |
| 7 | 2026-09-28 | 2026-10-02 | Teaching week 2. **09-29 is a non-student day.** |
| 8 | 2026-10-05 | 2026-10-09 | Sprint 2 retrospective |

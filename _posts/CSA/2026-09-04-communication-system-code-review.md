---
layout: post
title: "Code Review: Communication System Capstone Page"
description: >
  A file-by-file review of the Communication System capstone page — what each
  new file does, the code that changed, and how it hooks into the existing
  capstone grid and styling with no new CSS.
comments: true
toc: true
permalink: /csa/communication-system-code-review
author: UGRC-CSA
---

## Summary

- **Goal:** give the Communication System project a real capstone page, reachable from the CSA tab of `/capstone/`.
- **Net change:** 3 new files, 2 modified files, 2 images. ~332 added lines, 1 changed line.
- **No new CSS and no new JavaScript** — the page reuses the shared capstone infograph stylesheet and the grid's existing filter.
- **No changes to any chat code.** The announcement and week chat includes are untouched and still run live over WebSockets.
- **Verified:** Jekyll build exits 0, and 36 content checks confirm every fact from the source writeup made it onto the page.

---

## Files added

### `_data/communication_system_infograph.yml`

- **Does:** holds *all* the page content — no prose lives in the HTML.
- 5 topic cards: Class Announcements, Per-Week Chat, Assignment Threads, Direct Messages, Teacher Moderation.
- Plus 2 supporting sections ("Why Not Stay on Slack", "What Has to Land First") and a "Following Along" link list.
- Each topic carries `status`, `team`, `keyPoints`, `tech`, `description`, and `impact`.
- Topics that have a screenshot use `image`; those that don't use `phase` instead, which renders as a pill badge.

```yaml
  - title: "Class Announcements"
    image: "csa-chat/announcement-chat.png"
    link: "/images/csa-chat/announcement-chat.png"
    linkLabel: "View Full Screenshot"
    status: "Shipped"
    team:
      - "Samarth"
      - "Akshaj"
      - "Tarun"
    keyPoints:
      - "Shipped in PR #24, with the build and verification writeup in issue #25"
      - "Groups create themselves on first use, so a new course works without anyone seeding a Groups row"
    tech:
      - "REST at /api/groups"
      - "STOMP over SockJS at /ws-chat"
      - "Broadcast on /topic/group/{groupId}"
```

### `_includes/communication-system-infograph.html`

- **Does:** renders the YAML above into cards. Same structure as `granolaa-infograph.html` and `big6-infograph.html`.
- Uses the `comms-` class prefix, which is what makes the styling work for free (see below).
- **Two additions over the standard template:**

**1. Links that may be internal *or* external.** Other infographs assume site-relative paths; this page also links to GitHub issues.

{% raw %}
```liquid
{% if topic.link contains '://' %}
  {% assign topicHref = topic.link %}
{% else %}
  {% assign topicHref = topic.link | prepend: site.baseurl %}
{% endif %}
```
{% endraw %}

**2. A fallback when a topic has no screenshot.** Planned features have nothing to show yet, so they get a phase badge instead of a broken image.

{% raw %}
```liquid
{% if topic.image %}
<a href="{{ topicHref }}" class="comms-image-link">
  <img src="{{ site.baseurl }}/images/{{ topic.image }}" alt="{{ topic.alt }}" class="comms-image">
  <div class="comms-overlay"><span>View Screenshot</span></div>
</a>
{% else %}
<div class="comms-badge">{{ topic.phase }}</div>
{% endif %}
```
{% endraw %}

### `_posts/capstone/2026-08-27-communication-system-capstone.md`

- **Does:** the page itself. 11 lines — it only sets front matter and pulls in the include.
- Its `permalink` contains `/capstone/`, which is what triggers the `capstone-page` body class in `_includes/themes/minima/base.html` and gives the page its full-width dark layout.

{% raw %}
```yaml
---
microblog: true
toc: false
layout: post
title: Communication System Capstone
description: A capstone moving class discussion out of Slack and onto the course site — ...
permalink: /capstone/communication-system/
sticky_rank: 1
---

{% include communication-system-infograph.html %}
```
{% endraw %}

### `images/csa-chat/announcement-chat.png` and `week-chat.png`

- **Does:** the two real UI screenshots — the class-wide announcement thread, and a week card with its chat expanded.
- Both are captured signed out, so they show the local preview mode rather than live messages.
- Used twice each: once as the card thumbnail on `/capstone/`, once inside the page itself.

---

## Files modified

### `_posts/capstone/2026-02-09-capstone_home.md` — 13 lines added

- **Does:** adds the clickable card to the capstone grid.
- The `capstone-item CSA` class is the important part — `CSA` is what the tab filter matches on, so the card appears under both **All** and **CSA**.

{% raw %}
```html
<!-- Communication System -->
<div class="flex items-start space-x-4 p-4 border rounded-lg capstone-item CSA">
    <a href="{% post_url capstone/2026-08-27-communication-system-capstone %}">
        <img src="/images/csa-chat/announcement-chat.png" alt="Communication System - Course-Site Chat and Messaging" class="w-28 h-28 object-cover rounded" />
    </a>
    <div>
        <h3 class="text-lg font-semibold"><a href="{% post_url capstone/2026-08-27-communication-system-capstone %}">Communication System</a></h3>
        <p class="text-sm text-gray-700">Class discussion moved out of Slack and onto the course site...</p>
        <p class="text-xs text-gray-500 mt-2">Team: Akhil, Samarth, Akshaj, Tarun, Perry, Syowns, Leon</p>
    </div>
</div>
```
{% endraw %}

- Uses `post_url` rather than a hardcoded path, so Jekyll **fails the build** if the target post is ever renamed or deleted — a dead link becomes impossible.

### `_data/capstone_card_tech.yml` — 9 lines added

- **Does:** supplies the tech-stack tooltip that appears when hovering the card on `/capstone/`.
- Keyed on the card title **exactly** — a typo here means no tooltip, silently.

```yaml
"Communication System":
  - "Spring Boot / Java"
  - "STOMP over SockJS"
  - "REST /api/groups & /api/dm"
  - "JPA + Amazon S3"
  - "JWT Cookie Auth"
  - "Jekyll Includes / Vanilla JS"
  - "localStorage"
```

---

## How it hooks into what already exists

- **Styling — zero new CSS.** `_sass/capstone/infograph.scss` targets *suffixes*, not specific projects. Any class ending in `-infograph`, `-card`, `-badge` and so on is styled automatically, so the `comms-` prefix inherits the full dark capstone theme:

```scss
[class$="-infograph"] [class$="-card"] {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 2.5rem;
}
```

- **Filtering — zero new JavaScript.** The grid's existing handler reads the `CSA` class already on the card:

```js
document.getElementById('show-csa')?.addEventListener('click', ()=> setTypeFilter('CSA'));
```

- **Known minor collision:** `/capstone/` builds a `_capstoneData` lookup keyed by topic title across every `_data/*.yml`. This file and `ocs_communications_infograph.yml` both define a topic named `"Direct Messages"`, so one overwrites the other in that map. It only feeds an admin edit dropdown, nothing user-facing, and it resolves when the two overlapping pages are merged.

---

## Explored and reverted

Two changes were built, tested, and then deliberately backed out. Both are worth recording, because the *reason* they were reverted is the useful part:

- **CSA announcement opt-out** — a `announcements: false` front-matter flag gated the include in `_layouts/sprint.html`. Reverted: the announcement chat already works in production for CSP/CSSE/CSH, so there was no reason to single CSA out.
- **localStorage-only week chat** — `_includes/week_chat.html` was stripped down to browser-only storage while the backend awaited deployment. Reverted: the week chat shares its **exact** backend surface with the announcement chat that already works —

  ```
  /api/groups        /api/groups/chat/{id}/messages    /api/id
  /ws-chat           /app/groups.chat                  /topic/group/{groupId}
  ```

  Since those endpoints are identical, the live version works for the same reason announcements do. Real-time chat between signed-in users is restored, with `localStorage` kept only as the signed-out preview fallback.

- **Net result:** `git diff` on `week_chat.html`, `sprint.html`, and `csa.md` is **empty**. No chat behavior changed.

---

## Verification

- `bundle exec jekyll build` → exit 0, no Liquid errors.
- All 4 course pages confirmed at parity after the revert:

| Course | Announcements | Week chats | SockJS | STOMP send |
|---|---|---|---|---|
| csa | ✓ | 6 | 7 | 7 |
| csp | ✓ | 9 | 10 | 10 |
| csse | ✓ | 7 | 8 | 8 |
| csh | ✓ | 25 | 26 | 26 |

- 36 scripted content checks against the rendered page — endpoints, entity names, issue numbers, team names, image captions — all present.
- Both `/capstone/communication-system/` and the grid card build and resolve correctly.

---

## Note on scope

- The chat engine itself — `announcement_chat.html`, `week_chat.html`, and the Spring backend — shipped in **PR #24** and is **not** part of this diff.
- This change adds the capstone page that documents that system, plus its entry point on the capstone grid.

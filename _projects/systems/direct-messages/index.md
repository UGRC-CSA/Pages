---
layout: opencs
title: Messages
permalink: /student/messages
search_exclude: true
---

<!-- Messages: private one-to-one conversations.

     The conversation panel is the site's group-chat component (.chat-header,
     .chat-messages, .chat-msg, .chat-form) so it looks and behaves like the
     class announcement chat. Styles come from _sass/open-coding/chat-ui.scss,
     shared with _includes/announcement_chat.html and _includes/week_chat.html.

     Signing in is required: a conversation is between two accounts and is
     stored on the server, so a signed-out visitor is shown a sign-in prompt and
     an inert panel rather than a local sandbox.

     Uses `opencs` rather than `page`: the page supplies its own header, and the
     `page` layout would print the front-matter title above it as a second,
     competing heading. -->

<!-- Icons for the chat components. The base layout does not load FontAwesome;
     the sprint and post layouts pull it in the same way. -->
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
<link rel="stylesheet" href="{{ '/assets/css/projects/direct-messages/main.css' | relative_url }}">

<div class="dm-page">
  <header class="dm-page-header">
    <div class="dm-page-heading">
      <span class="dm-page-badge" aria-hidden="true"><i class="fas fa-comments"></i></span>
      <div class="dm-page-heading-text">
        <p class="dm-page-eyebrow">Open Coding Society</p>
        <!-- h2, not h1: the site stylesheet hides h1 globally, which is why the
             page layout renders its own title as an h2 as well. -->
        <h2 class="dm-page-title">Messages</h2>
        <p class="dm-page-subtitle">Private one-to-one conversations. Find someone by name and start talking.</p>
      </div>
    </div>
    <span class="dm-page-account" id="dmAccount"></span>
  </header>

  <div class="dm-layout">
    <aside class="dm-sidebar" aria-label="Conversations">
      <div class="dm-sidebar-section">
        <label class="dm-label" for="dmSearch">New message</label>
        <input class="chat-input" id="dmSearch" type="search" placeholder="Find a name or username"
               autocomplete="off" maxlength="80" disabled>
        <p class="dm-hint" id="dmSearchStatus" role="status">Type at least two characters to find someone.</p>
        <div class="dm-results" id="dmResults"></div>
      </div>

      <div class="dm-sidebar-section dm-sidebar-inbox">
        <h2 class="dm-sidebar-title">
          Inbox <span class="dm-badge" id="dmUnread" aria-label="Unread messages" hidden></span>
        </h2>
        <div class="dm-inbox" id="dmInbox">
          <p class="dm-hint">Your conversations will appear here.</p>
        </div>
      </div>

      <!-- Shown when there is no signed-in account to read messages as. -->
      <div class="dm-signin" id="dmSignIn" hidden>
        <p class="dm-signin-text">
          <i class="fas fa-lock" aria-hidden="true"></i>
          Messages are private between two accounts, so this page needs you signed in.
        </p>
        <a class="dm-signin-link" href="{{ '/login' | relative_url }}">
          <i class="fas fa-right-to-bracket" aria-hidden="true"></i><span>Sign in</span>
        </a>
      </div>
    </aside>

    <section class="dm-chat" id="dmChat" aria-labelledby="dmChatTitle">
      <div class="chat-header">
        <div class="chat-heading">
          <span class="chat-badge" id="dmPeerAvatar" aria-hidden="true"><i class="fas fa-comment-dots"></i></span>
          <div class="chat-heading-text">
            <h2 class="chat-title" id="dmChatTitle">Messages</h2>
            <p class="chat-subtitle" id="dmChatSubtitle">Choose someone from the inbox, or search for a name to start.</p>
          </div>
        </div>
        <span class="chat-status-pill" id="dmStatusPill">
          <span class="chat-status-dot" aria-hidden="true"></span>
          <span class="chat-status" id="dmStatus">loading…</span>
        </span>
      </div>

      <div class="chat-body">
        <p class="chat-preview-note" id="dmNote" hidden>
          <i class="fas fa-flask" aria-hidden="true"></i><span id="dmNoteText"></span>
        </p>
        <p class="dm-error" id="dmError" role="alert" hidden></p>

        <div class="chat-messages" id="dmMessages" role="log" aria-label="Message history" aria-live="polite">
          <div class="chat-empty">
            <i class="fas fa-comments" aria-hidden="true"></i>
            <p class="chat-empty-title">No conversation open</p>
            <span class="chat-empty-hint">Search for a name, or pick a conversation from the inbox.</span>
          </div>
        </div>

        <p class="dm-typing" id="dmTyping" role="status"></p>

        <form class="chat-form chat-form--rich" id="dmForm" autocomplete="off">
          <button class="chat-send" id="dmSend" type="submit" disabled>
            <i class="fas fa-paper-plane" aria-hidden="true"></i><span>Send</span>
          </button>
        </form>

        <details class="dm-attachments" id="dmAttachments" hidden>
          <summary>Shared attachments</summary>
          <label class="dm-label" for="dmFile">Share a file (up to 1 MB)</label>
          <input id="dmFile" type="file">
          <div class="dm-files" id="dmFiles"></div>
        </details>
      </div>
    </section>
  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/sockjs-client/1.5.1/sockjs.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/stomp.js/2.3.3/stomp.min.js"></script>
<script type="module" src="{{ '/assets/js/projects/direct-messages/messages.js' | relative_url }}"></script>

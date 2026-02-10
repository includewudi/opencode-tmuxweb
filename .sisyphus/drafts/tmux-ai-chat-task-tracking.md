# Draft: tmux AI chat → auto task tracking

## Requirements (confirmed)
- User wants: when user inputs content into tmux AI chat (opencode cli / claude cli / gemini cli), it counts as a task start; AI keeps responding; when AI finishes responding, task is completed.
- User can make the CLI perform an interface callback (webhook) to signal events.
- Callback transport: CLI performs HTTP POST to local TmuxWeb backend (localhost, port 8215).
- Event model: B) task_started + assistant_chunk (streaming) + task_completed.
- Profile handling for this feature: callbacks do NOT include profile_key; tasks are shared/global across profiles (profile is mainly for ordering/views).

## Technical Decisions
- Prefer CLI callback/webhook events over tmux pane scraping, to reliably detect start/end.

## Research Findings
- TmuxWeb currently has PaneDetails UI showing tasks and conversation logs (read-only) and existing APIs for creating/completing tasks; not yet tied to tmux AI chat.

## Open Questions
- Which CLI(s) can be instrumented with callbacks? (opencode/claude/gemini) and how.
- Mapping: callback payload will include `pane_key` directly (confirmed). Still need: how to include `profile_key`.
- Auth: how to authenticate callback (token, HMAC)?
- Task naming: use first user message, or explicit title?
- Should task include full conversation transcript, or store only chunks and summarize?
- What is the desired behavior if callbacks arrive out-of-order or are duplicated?

## Scope Boundaries
- INCLUDE: backend endpoint(s) to receive callbacks; state machine to open/close tasks; optional persistence of conversation/commands; minimal UI updates.
- EXCLUDE (tentative): tmux capture-pane polling approach unless callbacks unavailable; deep integration into 3rd party clis beyond easy hooks.

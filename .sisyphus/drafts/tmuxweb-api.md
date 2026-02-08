# TmuxWeb API Reference

## Overview

TmuxWeb provides a REST API for managing tmux sessions, tasks, and logs.

**Base URL:** `http://localhost:8215`

**paneKey Format:** `"{sessionName}:{windowIndex}:{paneIndex}"`  
Example: `"hsk:1:0"` = session "hsk", window 1, pane 0

---

## Authentication

TmuxWeb uses cookie-based session authentication.

### Cookie Settings
- **HttpOnly:** Yes (not accessible via JavaScript)
- **Max-Age:** 30 days (2592000 seconds)
- **SameSite:** Lax
- **Secure:** Yes in production

### Login Flow
1. POST `/api/auth/login` with token
2. Server sets HttpOnly session cookie
3. All subsequent requests include cookie automatically
4. Cookie expires after 30 days or on logout

---

## Auth Endpoints

### POST /api/auth/login

Login with token, receive session cookie.

```bash
curl -X POST http://localhost:8215/api/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"token": "my-secret-token"}'
```

**Response (200):**
```json
{
  "success": true,
  "message": "Login successful"
}
```

**Response (401):**
```json
{
  "error": "unauthorized",
  "message": "Invalid token"
}
```

---

### POST /api/auth/logout

Clear session cookie.

```bash
curl -X POST http://localhost:8215/api/auth/logout \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Profile Endpoints

Profiles are user workspaces. Each profile has its own session ordering and group configuration.

### GET /api/profiles

List all profiles for current token.

```bash
curl http://localhost:8215/api/profiles \
  -b cookies.txt
```

**Response (200):**
```json
{
  "profiles": [
    {
      "id": 1,
      "profile_key": "default",
      "name": "Default",
      "ctime": 1707400000,
      "mtime": 1707400000
    }
  ]
}
```

---

### POST /api/profiles

Create a new profile.

```bash
curl -X POST http://localhost:8215/api/profiles \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Work", "profile_key": "work"}'
```

**Response (201):**
```json
{
  "id": 2,
  "profile_key": "work",
  "name": "Work",
  "ctime": 1707400100,
  "mtime": 1707400100
}
```

---

### PUT /api/profiles/:id

Update a profile.

```bash
curl -X PUT http://localhost:8215/api/profiles/2 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"name": "Work Projects"}'
```

**Response (200):**
```json
{
  "id": 2,
  "profile_key": "work",
  "name": "Work Projects",
  "ctime": 1707400100,
  "mtime": 1707400200
}
```

---

### DELETE /api/profiles/:id

Delete a profile.

```bash
curl -X DELETE http://localhost:8215/api/profiles/2 \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Session Group Endpoints

Groups organize sessions into logical containers (e.g., projects).

### GET /api/groups

List groups with session counts.

```bash
curl "http://localhost:8215/api/groups?profile_key=default" \
  -b cookies.txt
```

**Response (200):**
```json
{
  "groups": [
    {
      "id": 1,
      "group_name": "AI Projects",
      "sort_order": 10,
      "session_count": 3,
      "ctime": 1707400000,
      "mtime": 1707400000
    }
  ]
}
```

---

### POST /api/groups

Create a session group.

```bash
curl -X POST http://localhost:8215/api/groups \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"profile_key": "default", "group_name": "DevOps", "sort_order": 20}'
```

**Response (201):**
```json
{
  "id": 2,
  "group_name": "DevOps",
  "sort_order": 20,
  "ctime": 1707400100,
  "mtime": 1707400100
}
```

---

### PUT /api/groups/:id

Update group name and/or sort_order.

```bash
curl -X PUT http://localhost:8215/api/groups/2 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"group_name": "Infrastructure", "sort_order": 15}'
```

**Response (200):**
```json
{
  "id": 2,
  "group_name": "Infrastructure",
  "sort_order": 15,
  "ctime": 1707400100,
  "mtime": 1707400200
}
```

---

### DELETE /api/groups/:id

Delete group. Sessions become ungrouped.

```bash
curl -X DELETE http://localhost:8215/api/groups/2 \
  -b cookies.txt
```

**Response (200):**
```json
{
  "success": true,
  "affected_sessions": 2
}
```

---

### PUT /api/sessions/:id/group

Assign session to a group (or null for ungrouped).

```bash
curl -X PUT http://localhost:8215/api/sessions/5/group \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"group_id": 1}'
```

**Remove from group:**
```bash
curl -X PUT http://localhost:8215/api/sessions/5/group \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"group_id": null}'
```

**Response (200):**
```json
{
  "id": 5,
  "session_name": "hsk",
  "group_id": 1,
  "sort_order": 10,
  "pane_status": "idle",
  "ctime": 1707400000,
  "mtime": 1707400300
}
```

---

## Ordering Endpoints

Control the display order of sessions and groups.

### GET /api/profiles/:id/order

Get current order for profile.

```bash
curl http://localhost:8215/api/profiles/1/order \
  -b cookies.txt
```

**Response (200):**
```json
{
  "order": [
    {
      "type": "session",
      "session_name": "dify",
      "sort_order": 10
    },
    {
      "type": "group",
      "group_id": 1,
      "group_name": "AI Projects",
      "sort_order": 10,
      "sessions": [
        {"session_name": "hsk", "sort_order": 10},
        {"session_name": "omo", "sort_order": 20}
      ]
    }
  ]
}
```

---

### PUT /api/profiles/:id/order

Save new order.

```bash
curl -X PUT http://localhost:8215/api/profiles/1/order \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "order": [
      {
        "type": "group",
        "group_id": 1,
        "sort_order": 5,
        "sessions": [
          {"session_name": "omo", "sort_order": 10},
          {"session_name": "hsk", "sort_order": 20}
        ]
      },
      {
        "type": "session",
        "session_name": "dify",
        "sort_order": 10
      }
    ]
  }'
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Pane Status Endpoints

Track pane work status: idle, in_progress, or done.

### GET /api/panes/status

Get status for one or more panes.

```bash
curl "http://localhost:8215/api/panes/status?pane_keys=hsk:1:0&pane_keys=hsk:1:1" \
  -b cookies.txt
```

**Response (200):**
```json
{
  "statuses": {
    "hsk:1:0": {"pane_status": "in_progress"},
    "hsk:1:1": {"pane_status": "idle"}
  }
}
```

---

### PUT /api/panes/status

Update pane status.

```bash
curl -X PUT http://localhost:8215/api/panes/status \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"pane_key": "hsk:1:0", "pane_status": "done"}'
```

**Response (200):**
```json
{
  "success": true,
  "pane_key": "hsk:1:0",
  "pane_status": "done"
}
```

---

## Task Endpoints

Tasks represent work units. Each task creates a segment for log isolation.

### GET /api/panes/:paneKey/tasks

List tasks for a pane.

```bash
curl "http://localhost:8215/api/panes/hsk:1:0/tasks?limit=20&offset=0" \
  -b cookies.txt
```

**Response (200):**
```json
{
  "tasks": [
    {
      "id": 123,
      "task_title": "Auth implementation",
      "task_status": "in_progress",
      "started_at": 1707400000,
      "completed_at": 0
    },
    {
      "id": 122,
      "task_title": "Database setup",
      "task_status": "completed",
      "started_at": 1707300000,
      "completed_at": 1707350000
    }
  ],
  "total": 2
}
```

---

### POST /api/panes/:paneKey/tasks

Create a new task.

```bash
curl -X POST http://localhost:8215/api/panes/hsk:1:0/tasks \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"task_title": "Implement login endpoint"}'
```

**Response (201):**
```json
{
  "id": 124,
  "session_name": "hsk",
  "window_index": 1,
  "window_name": "zsh",
  "pane_index": 0,
  "task_title": "Implement login endpoint",
  "task_status": "in_progress",
  "started_at": 1707400300,
  "completed_at": 0,
  "ctime": 1707400300,
  "mtime": 1707400300
}
```

---

### PUT /api/tasks/:id

Update task title and/or status.

```bash
curl -X PUT http://localhost:8215/api/tasks/123 \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"task_title": "Auth with OAuth support", "task_status": "completed"}'
```

**Response (200):**
```json
{
  "id": 123,
  "task_title": "Auth with OAuth support",
  "task_status": "completed",
  "started_at": 1707400000,
  "completed_at": 1707450000
}
```

---

### POST /api/tasks/:id/complete

Mark task as done (sets completed_at timestamp).

```bash
curl -X POST http://localhost:8215/api/tasks/123/complete \
  -b cookies.txt
```

**Response (200):**
```json
{
  "id": 123,
  "task_title": "Auth implementation",
  "task_status": "completed",
  "started_at": 1707400000,
  "completed_at": 1707450000
}
```

---

### GET /api/tasks/:id/detail

Get task with logs and summaries.

```bash
curl http://localhost:8215/api/tasks/123/detail \
  -b cookies.txt
```

**Response (200):**
```json
{
  "task": {
    "id": 123,
    "task_title": "Auth implementation",
    "task_status": "in_progress",
    "started_at": 1707400000,
    "completed_at": 0
  },
  "conversation": [
    {"id": 1, "role": "user", "content": "Please add login endpoint", "msg_time": 1707400100},
    {"id": 2, "role": "assistant", "content": "I'll create POST /api/auth/login...", "msg_time": 1707400150}
  ],
  "commands": [
    {"id": 1, "command": "npm install jsonwebtoken", "cmd_time": 1707400200, "exit_code": 0}
  ],
  "summary": {
    "command_summary": "Setup JWT auth with cookie-based...",
    "output_summary": "Successfully implemented login...",
    "summary_status": "done"
  }
}
```

---

## Log Endpoints

Record conversation messages and terminal commands.

### POST /api/segments/:id/conversation

Add a conversation message.

```bash
curl -X POST http://localhost:8215/api/segments/123/conversation \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"role": "user", "content": "Please add logout endpoint"}'
```

**Response (201):**
```json
{
  "id": 5,
  "segment_id": 123,
  "role": "user",
  "content": "Please add logout endpoint",
  "msg_time": 1707400500,
  "ctime": 1707400500
}
```

---

### POST /api/segments/:id/commands

Record a terminal command.

```bash
curl -X POST http://localhost:8215/api/segments/123/commands \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"command": "npm run test", "exit_code": 0}'
```

**Response (201):**
```json
{
  "id": 15,
  "segment_id": 123,
  "command": "npm run test",
  "cmd_time": 1707400600,
  "exit_code": 0,
  "ctime": 1707400600
}
```

---

### GET /api/segments/:id/logs

Get all logs for a segment.

```bash
curl http://localhost:8215/api/segments/123/logs \
  -b cookies.txt
```

**Response (200):**
```json
{
  "segment_id": 123,
  "conversation": [
    {"id": 1, "role": "user", "content": "Please add login endpoint", "msg_time": 1707400100},
    {"id": 2, "role": "assistant", "content": "I'll create POST /api/auth/login...", "msg_time": 1707400150}
  ],
  "commands": [
    {"id": 1, "command": "npm install jsonwebtoken", "cmd_time": 1707400200, "exit_code": 0}
  ]
}
```

---

## Summary Endpoints

Generate and load task summaries via external service.

### POST /api/tasks/:id/summarize

Trigger summary generation.

```bash
curl -X POST http://localhost:8215/api/tasks/123/summarize \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"type": "both"}'
```

**type options:** `command`, `output`, `both`

**Response (202):**
```json
{
  "job_id": "job_abc123",
  "status": "pending",
  "message": "Summary generation started"
}
```

**Response (501) - Service not configured:**
```json
{
  "error": "not_implemented",
  "message": "Summary service not configured"
}
```

---

### GET /api/panes/:paneKey/summary-candidates

Find historical summaries to load (for session restoration).

```bash
curl "http://localhost:8215/api/panes/dify:1:0/summary-candidates?limit=10" \
  -b cookies.txt
```

**Response (200):**
```json
{
  "session_name": "dify",
  "candidates": [
    {
      "id": 45,
      "segment_id": 100,
      "window_index": 1,
      "window_name": "zsh",
      "command_summary": "Implemented cookie auth...",
      "output_summary": "Login endpoint working...",
      "generated_at": 1707400000
    }
  ]
}
```

---

### POST /api/tasks/:id/load-summary

Load a previous summary into current task.

```bash
curl -X POST http://localhost:8215/api/tasks/124/load-summary \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{"source_summary_id": 45}'
```

**Response (200):**
```json
{
  "id": 50,
  "segment_id": 124,
  "command_summary": "Implemented cookie auth...",
  "output_summary": "Login endpoint working...",
  "summary_status": "done",
  "generated_at": 1707450000
}
```

---

## Health Endpoint

### GET /healthz

Check service health.

```bash
curl http://localhost:8215/healthz
```

**Response (200):**
```json
{
  "status": "healthy",
  "db": "connected",
  "timestamp": 1707450000
}
```

**Response (503):**
```json
{
  "status": "unhealthy",
  "db": "disconnected",
  "error": "Connection refused",
  "timestamp": 1707450000
}
```

---

## Error Handling

All endpoints return consistent error format:

```json
{
  "error": "error_type",
  "message": "Human-readable message",
  "code": "optional_code"
}
```

### Common HTTP Status Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 201 | Created |
| 202 | Accepted (async operation started) |
| 400 | Bad Request - invalid input |
| 401 | Unauthorized - authentication required |
| 404 | Not Found - resource doesn't exist |
| 501 | Not Implemented - feature not configured |
| 503 | Service Unavailable - health check failed |

### Error Types

| error | Description |
|-------|-------------|
| `unauthorized` | Missing or invalid session cookie |
| `bad_request` | Invalid request body or parameters |
| `not_found` | Resource not found |
| `not_implemented` | Feature not available (e.g., summary service) |

---

## Data Types

### Pane Status
- `idle` - No active work
- `in_progress` - Work in progress  
- `done` - Work completed

### Task Status
- `in_progress` - Task active
- `completed` - Task finished

### Summary Status
- `pending` - Waiting to start
- `running` - Generation in progress
- `done` - Summary ready
- `error` - Generation failed

### Timestamps
All timestamps are Unix epoch seconds (int).

# TmuxWeb E2E Verification Runbook

## Prerequisites

1. MySQL running with `tmuxweb` database created
2. Backend started: `cd TmuxWeb && npm start`
3. Frontend built: `cd TmuxWeb/web && npm run build`
4. tmux sessions available for testing

## Environment Setup

```bash
# Set MySQL credentials if different from defaults
export MYSQL_HOST=localhost
export MYSQL_PORT=3306
export MYSQL_USER=root
export MYSQL_PASSWORD=your_password
export MYSQL_DATABASE=tmuxweb

# Bootstrap database tables
cd TmuxWeb && node server/db/bootstrap.js

# Start backend
npm start
```

## API Verification Scenarios

### 1. Health Check

```bash
# Health endpoint (no auth)
curl -s http://localhost:8215/health | jq
# Expected: { "status": "ok", "timestamp": "..." }

# Healthz with DB check
curl -s http://localhost:8215/healthz | jq
# Expected: { "status": "ok", "db": "ok", "timestamp": "..." }
```

### 2. Authentication

```bash
# Store cookie file path
COOKIE_FILE=".sisyphus/evidence/cookies.txt"

# Login with valid token
curl -s -c $COOKIE_FILE -X POST http://localhost:8215/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "tmuxweb-dev-token"}' | jq
# Expected: { "success": true, "message": "Login successful" }

# Verify cookie is set
cat $COOKIE_FILE | grep tmuxweb_session

# Login with invalid token
curl -s -X POST http://localhost:8215/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"token": "wrong-token"}' | jq
# Expected: { "error": "unauthorized", "message": "Invalid token" }

# Access protected endpoint with cookie
curl -s -b $COOKIE_FILE http://localhost:8215/api/profiles | jq
# Expected: { "profiles": [...] }

# Logout
curl -s -b $COOKIE_FILE -X POST http://localhost:8215/api/auth/logout | jq
# Expected: { "success": true }
```

### 3. Profiles CRUD

```bash
# Create profile
curl -s -b $COOKIE_FILE -X POST http://localhost:8215/api/profiles \
  -H "Content-Type: application/json" \
  -d '{"profile_key": "test-profile", "name": "Test Profile"}' | jq
# Store profile ID for later: PROFILE_ID=<id from response>

# List profiles
curl -s -b $COOKIE_FILE http://localhost:8215/api/profiles | jq

# Update profile
curl -s -b $COOKIE_FILE -X PUT http://localhost:8215/api/profiles/$PROFILE_ID \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Profile"}' | jq

# Delete profile
curl -s -b $COOKIE_FILE -X DELETE http://localhost:8215/api/profiles/$PROFILE_ID | jq
```

### 4. Session Groups

```bash
PROFILE_KEY="test-profile"

# Create group
curl -s -b $COOKIE_FILE -X POST http://localhost:8215/api/groups \
  -H "Content-Type: application/json" \
  -d "{\"profile_key\": \"$PROFILE_KEY\", \"group_name\": \"AI Projects\"}" | jq
# Store: GROUP_ID=<id>

# List groups
curl -s -b $COOKIE_FILE "http://localhost:8215/api/groups?profile_key=$PROFILE_KEY" | jq

# Assign session to group
SESSION_NAME="your-session-name"
curl -s -b $COOKIE_FILE -X PUT "http://localhost:8215/api/sessions/$SESSION_NAME/group" \
  -H "Content-Type: application/json" \
  -d "{\"profile_key\": \"$PROFILE_KEY\", \"group_id\": $GROUP_ID}" | jq

# Delete group (moves sessions to ungrouped)
curl -s -b $COOKIE_FILE -X DELETE http://localhost:8215/api/groups/$GROUP_ID | jq
```

### 5. Ordering

```bash
# Get order
curl -s -b $COOKIE_FILE "http://localhost:8215/api/profiles/$PROFILE_ID/order" | jq

# Save order
curl -s -b $COOKIE_FILE -X PUT "http://localhost:8215/api/profiles/$PROFILE_ID/order" \
  -H "Content-Type: application/json" \
  -d '{
    "groups": [{"id": 1, "sort_order": 10}],
    "sessions": [{"session_name": "test", "group_id": 1, "sort_order": 10}]
  }' | jq
```

### 6. Pane Status

```bash
PANE_KEY="session:0:0"

# Get status
curl -s -b $COOKIE_FILE "http://localhost:8215/api/panes/status?profile_key=$PROFILE_KEY&paneKey=$PANE_KEY" | jq

# Set status
curl -s -b $COOKIE_FILE -X PUT http://localhost:8215/api/panes/status \
  -H "Content-Type: application/json" \
  -d "{\"profile_key\": \"$PROFILE_KEY\", \"paneKey\": \"$PANE_KEY\", \"status\": \"in_progress\"}" | jq

# Invalid status (should fail)
curl -s -b $COOKIE_FILE -X PUT http://localhost:8215/api/panes/status \
  -H "Content-Type: application/json" \
  -d "{\"profile_key\": \"$PROFILE_KEY\", \"paneKey\": \"$PANE_KEY\", \"status\": \"invalid\"}" | jq
# Expected: 400 with error
```

### 7. Tasks

```bash
# Create task
curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/panes/$PANE_KEY/tasks" \
  -H "Content-Type: application/json" \
  -d '{"title": "Implement feature X"}' | jq
# Store: TASK_ID=<id>

# List tasks
curl -s -b $COOKIE_FILE "http://localhost:8215/api/panes/$PANE_KEY/tasks" | jq

# Update task
curl -s -b $COOKIE_FILE -X PUT "http://localhost:8215/api/tasks/$TASK_ID" \
  -H "Content-Type: application/json" \
  -d '{"task_title": "Updated title"}' | jq

# Complete task
curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/tasks/$TASK_ID/complete" | jq

# Get task detail
curl -s -b $COOKIE_FILE "http://localhost:8215/api/tasks/$TASK_ID/detail" | jq
```

### 8. Segments (Logs)

```bash
SEGMENT_ID=$TASK_ID  # segment_id = task_id

# Add conversation message
curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/segments/$SEGMENT_ID/conversation" \
  -H "Content-Type: application/json" \
  -d '{"role": "user", "content": "Please implement login endpoint"}' | jq

curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/segments/$SEGMENT_ID/conversation" \
  -H "Content-Type: application/json" \
  -d '{"role": "assistant", "content": "I will create POST /api/auth/login..."}' | jq

# Add command
curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/segments/$SEGMENT_ID/commands" \
  -H "Content-Type: application/json" \
  -d '{"command": "npm install jsonwebtoken", "exit_code": 0}' | jq

# Get all logs
curl -s -b $COOKIE_FILE "http://localhost:8215/api/segments/$SEGMENT_ID/logs" | jq
```

### 9. Summaries

```bash
# Trigger summary (should return 501 if not configured)
curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/tasks/$TASK_ID/summarize" | jq
# Expected: { "error": "not_configured", ... } with status 501

# Get candidates
curl -s -b $COOKIE_FILE "http://localhost:8215/api/panes/$PANE_KEY/summary-candidates" | jq

# Load previous summary (if candidates exist)
# curl -s -b $COOKIE_FILE -X POST "http://localhost:8215/api/tasks/$TASK_ID/load-summary" \
#   -H "Content-Type: application/json" \
#   -d '{"summary_id": 1}' | jq
```

## UI Verification Checklist

### Login Flow
- [ ] Open http://localhost:8215 → Login modal appears
- [ ] Enter wrong token → Error message displayed
- [ ] Enter correct token → Modal closes, main UI loads
- [ ] Refresh page → Still logged in (cookie persists)

### Profile Management
- [ ] Profile dropdown visible in header
- [ ] Can create new profile
- [ ] Can switch between profiles
- [ ] Can rename profile
- [ ] Can delete profile (with confirmation)

### Session Tree
- [ ] Sessions list loads
- [ ] Can expand session → windows shown
- [ ] Can expand window → panes shown
- [ ] Status badges visible on panes
- [ ] Click pane → opens in terminal tab

### Drag & Drop
- [ ] Drag handle visible on sessions/groups
- [ ] Can reorder sessions at root level
- [ ] Can drag session into group
- [ ] Can drag session out of group
- [ ] Can reorder groups
- [ ] Order persists after page refresh

### Pane Details Drawer
- [ ] Click pane → details drawer opens
- [ ] Pane location displayed correctly
- [ ] Status dropdown works
- [ ] "New Task" creates task
- [ ] Task list updates
- [ ] "Mark Done" completes task
- [ ] Conversation logs displayed
- [ ] Command logs displayed

### Summary (disabled state)
- [ ] Summary section shows "not configured"
- [ ] "Load Previous Summary" button present
- [ ] Candidates modal opens (may be empty)

## Evidence Collection

Save API responses for verification:
```bash
mkdir -p .sisyphus/evidence
curl -s http://localhost:8215/healthz > .sisyphus/evidence/api-healthz.json
# ... save other responses
```

## Troubleshooting

### Database connection failed
```bash
# Check MySQL is running
mysql -u root -p -e "SELECT 1"

# Verify database exists
mysql -u root -p -e "SHOW DATABASES" | grep tmuxweb

# Bootstrap tables
node TmuxWeb/server/db/bootstrap.js
```

### Cookie not set
- Check CORS configuration in config.json
- Ensure frontend is served from allowedOrigins
- Check browser dev tools → Application → Cookies

### WebSocket connection failed
- WebSocket still uses token auth (not cookie)
- Token must be stored in localStorage after login
- Check browser console for WS errors

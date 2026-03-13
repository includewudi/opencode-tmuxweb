#!/usr/bin/env bash
#
# tmux-restart.sh — Kill & recreate all tmux sessions except the current one,
#                   preserving each pane's working directory.
#
# Usage:
#   tmux-restart.sh                        # restart all (auto-skips opencode sessions)
#   tmux-restart.sh --include-opencode     # restart ALL, including opencode sessions
#   tmux-restart.sh --dry-run              # show what would happen
#   tmux-restart.sh --list                 # dump session info
#   tmux-restart.sh session1 session2      # restart only specific sessions
#   tmux-restart.sh --skip cmd1,cmd2       # skip sessions running these commands
#
set -euo pipefail

DRY_RUN=false
LIST_ONLY=false
INCLUDE_OPENCODE=false
SKIP_COMMANDS=()
SPECIFIC_SESSIONS=()

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)           DRY_RUN=true; shift ;;
    --list)              LIST_ONLY=true; shift ;;
    --include-opencode)  INCLUDE_OPENCODE=true; shift ;;
    --skip)
      IFS=',' read -ra SKIP_COMMANDS <<< "$2"
      shift 2
      ;;
    -h|--help)
      cat << 'HELP'
Usage: tmux-restart.sh [OPTIONS] [session1 session2 ...]

Restart all tmux sessions except the current one.
Each session is recreated with its original pane working directories.

By default, sessions running "opencode" are automatically skipped.

Options:
  --dry-run            Show what would happen without doing it
  --list               Just list session info (no changes)
  --include-opencode   Also restart sessions running opencode
  --skip cmd1,cmd2     Skip sessions whose pane is running any of these commands
  -h, --help           Show this help

Examples:
  tmux-restart.sh                          # restart all non-opencode sessions
  tmux-restart.sh --dry-run                # preview only
  tmux-restart.sh --include-opencode       # restart everything
  tmux-restart.sh --skip vim,python3       # also skip vim/python3 sessions
  tmux-restart.sh butler main ssh-4090     # restart only these 3
HELP
      exit 0
      ;;
    *) SPECIFIC_SESSIONS+=("$1"); shift ;;
  esac
done

# Get current session name
CURRENT_SESSION=$(tmux display-message -p '#{session_name}' 2>/dev/null || echo "")
if [[ -z "$CURRENT_SESSION" ]]; then
  echo "ERROR: Not running inside tmux."
  exit 1
fi

echo "Current session: $CURRENT_SESSION (will NOT be touched)"

# Build skip-commands list: always skip opencode unless --include-opencode
if [[ "$INCLUDE_OPENCODE" == "false" ]]; then
  SKIP_COMMANDS+=("opencode")
fi

if [[ ${#SKIP_COMMANDS[@]} -gt 0 ]]; then
  echo "Auto-skipping sessions running: ${SKIP_COMMANDS[*]}"
fi
echo ""

# Build a set of sessions to skip based on running command
declare -A SKIP_SESSIONS
while IFS='|' read -r sess_name pane_cmd; do
  for skip_cmd in "${SKIP_COMMANDS[@]}"; do
    if [[ "$pane_cmd" == "$skip_cmd" ]]; then
      SKIP_SESSIONS["$sess_name"]=1
      break
    fi
  done
done < <(tmux list-panes -a -F '#{session_name}|#{pane_current_command}')

# Collect all session/window/pane info
declare -A SESSION_DATA

while IFS='|' read -r sess_name win_idx win_name pane_idx pane_path win_layout; do
  # Skip current session
  [[ "$sess_name" == "$CURRENT_SESSION" ]] && continue

  # Skip sessions running protected commands
  [[ -n "${SKIP_SESSIONS[$sess_name]:-}" ]] && continue

  # If specific sessions requested, skip non-matching
  if [[ ${#SPECIFIC_SESSIONS[@]} -gt 0 ]]; then
    local_match=false
    for s in "${SPECIFIC_SESSIONS[@]}"; do
      [[ "$sess_name" == "$s" ]] && local_match=true && break
    done
    [[ "$local_match" == "false" ]] && continue
  fi

  key="$sess_name"
  entry="${win_idx}|${win_name}|${pane_idx}|${pane_path}|${win_layout}"
  if [[ -n "${SESSION_DATA[$key]:-}" ]]; then
    SESSION_DATA[$key]+=$'\n'"$entry"
  else
    SESSION_DATA[$key]="$entry"
  fi
done < <(tmux list-panes -a -F '#{session_name}|#{window_index}|#{window_name}|#{pane_index}|#{pane_current_path}|#{window_layout}')

if [[ ${#SESSION_DATA[@]} -eq 0 ]]; then
  echo "No sessions to restart."
  if [[ ${#SKIP_SESSIONS[@]} -gt 0 ]]; then
    echo "Skipped (protected): ${!SKIP_SESSIONS[*]}"
  fi
  exit 0
fi

echo "Sessions to restart (${#SESSION_DATA[@]}):"
for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
  echo "  $sess"
done
if [[ ${#SKIP_SESSIONS[@]} -gt 0 ]]; then
  echo ""
  echo "Skipped (protected, ${#SKIP_SESSIONS[@]}):"
  for sess in $(echo "${!SKIP_SESSIONS[@]}" | tr ' ' '\n' | sort); do
    echo "  $sess"
  done
fi
echo ""

# List mode
if [[ "$LIST_ONLY" == "true" ]]; then
  for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
    echo "=== $sess ==="
    while IFS='|' read -r win_idx win_name pane_idx pane_path win_layout; do
      echo "  Window $win_idx ($win_name) Pane $pane_idx -> $pane_path"
    done <<< "${SESSION_DATA[$sess]}"
    echo ""
  done
  exit 0
fi

# Save state backup
SAVED_FILE="/tmp/tmux-restart-$(date +%s).json"
echo "Saving session state to: $SAVED_FILE"

echo "{" > "$SAVED_FILE"
first_sess=true
for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
  if [[ "$first_sess" == "true" ]]; then
    first_sess=false
  else
    echo "," >> "$SAVED_FILE"
  fi
  echo "  \"$sess\": [" >> "$SAVED_FILE"
  first_pane=true
  while IFS='|' read -r win_idx win_name pane_idx pane_path win_layout; do
    if [[ "$first_pane" == "true" ]]; then
      first_pane=false
    else
      echo "," >> "$SAVED_FILE"
    fi
    echo "    {\"window\": $win_idx, \"window_name\": \"$win_name\", \"pane\": $pane_idx, \"path\": \"$pane_path\", \"layout\": \"$win_layout\"}" >> "$SAVED_FILE"
  done <<< "${SESSION_DATA[$sess]}"
  echo "" >> "$SAVED_FILE"
  echo "  ]" >> "$SAVED_FILE"
done
echo "" >> "$SAVED_FILE"
echo "}" >> "$SAVED_FILE"
echo ""

# Dry run
if [[ "$DRY_RUN" == "true" ]]; then
  echo "[DRY RUN] Would kill and recreate these sessions:"
  for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
    echo "  - $sess"
    while IFS='|' read -r win_idx win_name pane_idx pane_path win_layout; do
      echo "      Window $win_idx Pane $pane_idx -> $pane_path"
    done <<< "${SESSION_DATA[$sess]}"
  done
  echo ""
  echo "State saved to: $SAVED_FILE"
  exit 0
fi

# === EXECUTE: Kill & Recreate ===
echo "Killing sessions..."
killed=0
failed_kill=0
for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
  if tmux kill-session -t "$sess" 2>/dev/null; then
    echo "  ✓ Killed: $sess"
    ((killed++))
  else
    echo "  ✗ Failed to kill: $sess (may already be gone)"
    ((failed_kill++))
  fi
done
echo "Killed: $killed, Failed: $failed_kill"
echo ""

echo "Recreating sessions..."
created=0
failed_create=0
for sess in $(echo "${!SESSION_DATA[@]}" | tr ' ' '\n' | sort); do
  first_path=""
  pane_count=0
  declare -a pane_paths=()
  declare -a pane_win_idxs=()

  while IFS='|' read -r win_idx win_name pane_idx pane_path win_layout; do
    if [[ -z "$first_path" ]]; then
      first_path="$pane_path"
    fi
    pane_paths+=("$pane_path")
    pane_win_idxs+=("$win_idx")
    ((pane_count++))
  done <<< "${SESSION_DATA[$sess]}"

  if [[ ! -d "$first_path" ]]; then
    echo "  ⚠ Directory not found: $first_path (using /tmp)"
    first_path="/tmp"
  fi

  if tmux new-session -d -s "$sess" -c "$first_path" 2>/dev/null; then
    echo "  ✓ Created: $sess -> $first_path"
    ((created++))

    if [[ $pane_count -gt 1 ]]; then
      for ((i=1; i<pane_count; i++)); do
        p="${pane_paths[$i]}"
        [[ ! -d "$p" ]] && p="/tmp"
        tmux split-window -t "$sess" -c "$p" 2>/dev/null || true
      done
    fi
  else
    echo "  ✗ Failed to create: $sess"
    ((failed_create++))
  fi

  unset pane_paths pane_win_idxs
done
echo "Created: $created, Failed: $failed_create"
echo ""
echo "State backup: $SAVED_FILE"
echo "Done! ✓"

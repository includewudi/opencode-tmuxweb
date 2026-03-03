#!/usr/bin/env python3
"""
export-session: Export OpenCode session content to Obsidian vault as Markdown.

Reads directly from OpenCode local storage (~/.local/share/opencode/storage/).

Output: {VAULT}/tmux-session/{tmux-name}/{YYYY}/{MM}/{DD}/{session_id}.md

Usage:
    # 最常用：导出当前对话（自动检测最近活跃的主对话）
    python3 export-session.py

    # 导出指定 session
    python3 export-session.py ses_xxx

    # 导出昨天的所有主对话
    python3 export-session.py --all --date yesterday

    # 导出指定日期
    python3 export-session.py --all --date 2026-03-01

    # 列出当前项目的 session
    python3 export-session.py --list
    python3 export-session.py --list --today
    python3 export-session.py --list --date yesterday

    # 导出今天所有主对话
    python3 export-session.py --all --today

    # 含子 agent 一起导出
    python3 export-session.py --all --today --include-sub
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone, timedelta

# ── Constants ──────────────────────────────────────────────────────────────

STORAGE = Path.home() / ".local/share/opencode/storage"
SESSION_DIR = STORAGE / "session"
MESSAGE_DIR = STORAGE / "message"
PART_DIR = STORAGE / "part"
PROJECT_DIR = STORAGE / "project"

DEFAULT_VAULT = Path("/Users/wudi/obsidian-vault/butler/project/opencode-iterm")
TZ_SHANGHAI = timezone(timedelta(hours=8))

# Tool output truncation (avoid massive MD files)
TOOL_OUTPUT_MAX = 500  # chars


# ── Storage readers ────────────────────────────────────────────────────────

def find_project_by_cwd(cwd: str) -> dict | None:
    """Find project metadata matching current working directory."""
    cwd = os.path.abspath(cwd)
    for pf in PROJECT_DIR.glob("*.json"):
        try:
            data = json.loads(pf.read_text("utf-8"))
            if data.get("worktree") == cwd:
                return data
        except (json.JSONDecodeError, OSError):
            continue
    return None


def find_project_by_id(project_id: str) -> dict | None:
    """Load project metadata by project hash."""
    pf = PROJECT_DIR / f"{project_id}.json"
    if pf.exists():
        try:
            return json.loads(pf.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return None


def tmux_name_from_worktree(worktree: str) -> str:
    """Derive tmux session name from worktree path (last component)."""
    return Path(worktree).name


def list_sessions_for_project(project_id: str) -> list[dict]:
    """List all sessions for a project, sorted by creation time (newest first)."""
    sdir = SESSION_DIR / project_id
    if not sdir.is_dir():
        return []
    sessions = []
    for sf in sdir.glob("*.json"):
        try:
            data = json.loads(sf.read_text("utf-8"))
            sessions.append(data)
        except (json.JSONDecodeError, OSError):
            continue
    sessions.sort(key=lambda s: s.get("time", {}).get("created", 0), reverse=True)
    return sessions


def parse_date_arg(date_str: str) -> str:
    """Parse date argument: 'today', 'yesterday', or 'YYYY-MM-DD'."""
    if date_str == "today":
        return datetime.now(tz=TZ_SHANGHAI).strftime("%Y-%m-%d")
    elif date_str == "yesterday":
        return (datetime.now(tz=TZ_SHANGHAI) - timedelta(days=1)).strftime("%Y-%m-%d")
    else:
        # Validate format
        try:
            datetime.strptime(date_str, "%Y-%m-%d")
            return date_str
        except ValueError:
            print(f"❌ Invalid date format: {date_str} (use YYYY-MM-DD, 'today', or 'yesterday')", file=sys.stderr)
            sys.exit(1)


def filter_sessions_by_date(sessions: list[dict], date_str: str) -> list[dict]:
    """Filter sessions to those created on the given date."""
    return [s for s in sessions if ts_to_date(s.get("time", {}).get("created", 0)) == date_str]


def find_current_session(project_id: str) -> dict | None:
    """Find the most recently updated main (non-sub-agent) session."""
    sessions = list_sessions_for_project(project_id)
    sessions.sort(key=lambda s: s.get("time", {}).get("updated", 0), reverse=True)
    for s in sessions:
        if not s.get("parentID"):
            return s
    return None


def load_session_meta(project_id: str, session_id: str) -> dict | None:
    """Load a specific session's metadata."""
    sf = SESSION_DIR / project_id / f"{session_id}.json"
    if sf.exists():
        try:
            return json.loads(sf.read_text("utf-8"))
        except (json.JSONDecodeError, OSError):
            pass
    return None


def load_messages(session_id: str) -> list[dict]:
    """Load all messages for a session, sorted chronologically."""
    mdir = MESSAGE_DIR / session_id
    if not mdir.is_dir():
        return []
    messages = []
    for mf in sorted(mdir.glob("*.json")):
        try:
            messages.append(json.loads(mf.read_text("utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return messages


def load_parts(msg_id: str) -> list[dict]:
    """Load all parts for a message, sorted by filename."""
    pdir = PART_DIR / msg_id
    if not pdir.is_dir():
        return []
    parts = []
    for pf in sorted(pdir.glob("*.json")):
        try:
            parts.append(json.loads(pf.read_text("utf-8")))
        except (json.JSONDecodeError, OSError):
            continue
    return parts


# ── Markdown rendering ─────────────────────────────────────────────────────

def ts_to_str(ts_ms: int | float) -> str:
    """Convert millisecond timestamp to readable string in Shanghai timezone."""
    if not ts_ms:
        return "?"
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=TZ_SHANGHAI)
    return dt.strftime("%Y-%m-%d %H:%M:%S")


def ts_to_date(ts_ms: int | float) -> str:
    """Convert millisecond timestamp to date string."""
    if not ts_ms:
        return datetime.now(tz=TZ_SHANGHAI).strftime("%Y-%m-%d")
    dt = datetime.fromtimestamp(ts_ms / 1000, tz=TZ_SHANGHAI)
    return dt.strftime("%Y-%m-%d")


def render_text_part(part: dict) -> str:
    """Render a text part as markdown."""
    text = part.get("text", "").strip()
    if not text:
        return ""
    return text


def render_tool_part(part: dict, full_output: bool = False) -> str:
    """Render a tool call part as markdown."""
    tool = part.get("tool", "unknown")
    state = part.get("state", {})
    status = state.get("status", "?")
    inp = state.get("input", {})
    output = state.get("output", "")
    title = state.get("title", "")
    metadata = state.get("metadata", {})

    lines = []

    # Tool header
    status_icon = {"completed": "✅", "error": "❌", "running": "⏳"}.get(status, "❓")
    header = f"**{status_icon} `{tool}`**"
    if title:
        header += f" — {title}"
    lines.append(header)

    # Input summary (tool-specific)
    if tool == "bash":
        cmd = inp.get("command", "")
        desc = inp.get("description", "")
        if desc:
            lines.append(f"> {desc}")
        if cmd:
            # Truncate very long commands
            if len(cmd) > 300:
                cmd = cmd[:300] + "... (truncated)"
            lines.append(f"```bash\n{cmd}\n```")

    elif tool == "read":
        fp = inp.get("filePath", "")
        lines.append(f"> Read: `{fp}`")

    elif tool == "write":
        fp = inp.get("filePath", "")
        content = inp.get("content", "")
        lines.append(f"> Write: `{fp}` ({len(content)} chars)")
        if full_output and content:
            lines.append(f"\n```\n{content}\n```")

    elif tool == "edit":
        fp = inp.get("filePath", "")
        edits = inp.get("edits", [])
        lines.append(f"> Edit: `{fp}` ({len(edits)} edit(s))")

    elif tool == "glob":
        pattern = inp.get("pattern", "")
        lines.append(f"> Glob: `{pattern}`")

    elif tool == "grep":
        pattern = inp.get("pattern", "")
        include = inp.get("include", "")
        lines.append(f"> Grep: `{pattern}`" + (f" in `{include}`" if include else ""))

    elif tool == "task":
        desc = inp.get("description", "")
        subagent = inp.get("subagent_type", "")
        lines.append(f"> Task ({subagent}): {desc}")

    elif tool in ("lsp_diagnostics", "lsp_goto_definition", "lsp_find_references", "lsp_symbols"):
        fp = inp.get("filePath", "")
        lines.append(f"> {tool}: `{fp}`")

    else:
        # Generic: show input keys
        keys = list(inp.keys())[:5]
        if keys:
            lines.append(f"> Input keys: {', '.join(keys)}")

    # Output (truncated unless full_output)
    max_len = 0 if full_output else TOOL_OUTPUT_MAX
    if output and isinstance(output, str):
        out_display = output.strip()
        if max_len and len(out_display) > max_len:
            out_display = out_display[:max_len] + f"\n... ({len(output)} chars total, truncated)"
        if out_display:
            lines.append(f"<details><summary>Output ({len(output)} chars)</summary>\n\n```\n{out_display}\n```\n</details>")
    elif metadata.get("output"):
        raw = str(metadata["output"]).strip()
        if max_len and len(raw) > max_len:
            raw = raw[:max_len] + f"\n... (truncated)"
        if raw:
            lines.append(f"<details><summary>Output</summary>\n\n```\n{raw}\n```\n</details>")

    return "\n".join(lines)


def render_session_md(session_meta: dict, messages: list[dict], no_tools: bool = False, tools_only: bool = False, full_output: bool = False) -> str:
    lines = []

    # Frontmatter
    title = session_meta.get("title", "Untitled Session")
    sid = session_meta.get("id", "?")
    created = ts_to_str(session_meta.get("time", {}).get("created", 0))
    updated = ts_to_str(session_meta.get("time", {}).get("updated", 0))
    directory = session_meta.get("directory", "?")
    summary = session_meta.get("summary", {})

    lines.append("---")
    lines.append(f"session_id: {sid}")
    lines.append(f"title: \"{title}\"")
    lines.append(f"created: {created}")
    lines.append(f"updated: {updated}")
    lines.append(f"directory: {directory}")
    if summary.get("files"):
        lines.append(f"files_changed: {summary.get('files', 0)}")
        lines.append(f"additions: {summary.get('additions', 0)}")
        lines.append(f"deletions: {summary.get('deletions', 0)}")
    lines.append("---")
    lines.append("")
    lines.append(f"# {title}")
    lines.append("")
    lines.append(f"**Session**: `{sid}`  ")
    lines.append(f"**Created**: {created}  ")
    lines.append(f"**Updated**: {updated}  ")
    lines.append(f"**Directory**: `{directory}`")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Messages
    for msg in messages:
        role = msg.get("role", "?")
        msg_id = msg.get("id", "?")
        msg_time = ts_to_str(msg.get("time", {}).get("created", 0))
        model = msg.get("modelID", "")
        agent = msg.get("agent", "")
        tokens = msg.get("tokens", {})

        # Role header
        role_icon = "👤" if role == "user" else "🤖"
        role_label = "User" if role == "user" else "Assistant"
        header = f"## {role_icon} {role_label}"
        if agent:
            header += f" ({agent})"
        header += f" — {msg_time}"
        lines.append(header)
        lines.append("")

        if model:
            token_info = ""
            if tokens.get("input") or tokens.get("output"):
                token_info = f" | tokens: {tokens.get('input', 0)}in/{tokens.get('output', 0)}out"
            lines.append(f"*Model: {model}{token_info}*")
            lines.append("")

        # Parts
        parts = load_parts(msg_id)
        for part in parts:
            ptype = part.get("type", "")

            if ptype == "text":
                if not tools_only:
                    text = render_text_part(part)
                    if text:
                        lines.append(text)
                        lines.append("")

            elif ptype == "tool":
                if not no_tools:
                    rendered = render_tool_part(part, full_output=full_output)
                    if rendered:
                        lines.append(rendered)
                        lines.append("")

            # Skip step-start, step-finish — they're structural markers

        lines.append("---")
        lines.append("")

    return "\n".join(lines)


# ── Output path logic ──────────────────────────────────────────────────────

def build_output_path(vault: Path, tmux_name: str, date_str: str, session_id: str) -> Path:
    """Build: vault/tmux-session/{tmux_name}/{YYYY}/{MM}/{DD}/{session_id}.md"""
    parts = date_str.split("-")  # ["2026", "03", "02"]
    if len(parts) != 3:
        parts = datetime.now(tz=TZ_SHANGHAI).strftime("%Y-%m-%d").split("-")

    return vault / "tmux-session" / tmux_name / parts[0] / parts[1] / parts[2] / f"{session_id}.md"


# ── Main ───────────────────────────────────────────────────────────────────

def cmd_list(args):
    """List sessions for the current project."""
    project = find_project_by_cwd(args.cwd or os.getcwd())
    if not project:
        print(f"❌ No OpenCode project found for: {args.cwd or os.getcwd()}", file=sys.stderr)
        sys.exit(1)

    tmux_name = tmux_name_from_worktree(project["worktree"])
    sessions = list_sessions_for_project(project["id"])

    if not sessions:
        print("No sessions found.")
        return

    print(f"📂 Project: {tmux_name} ({project['id'][:12]}...)")
    print(f"   Sessions: {len(sessions)}")
    print()

    # Filter by date
    target_date = None
    if args.date:
        target_date = parse_date_arg(args.date)
    elif args.today:
        target_date = datetime.now(tz=TZ_SHANGHAI).strftime("%Y-%m-%d")
    if target_date:
        sessions = filter_sessions_by_date(sessions, target_date)
        print(f"   (filtered to {target_date}, {len(sessions)} sessions)")
        print()

    for s in sessions[:50]:
        sid = s["id"]
        title = s.get("title", "?")[:60]
        created = ts_to_str(s.get("time", {}).get("created", 0))
        parent = " [sub]" if s.get("parentID") else ""
        msg_count = len(list((MESSAGE_DIR / sid).glob("*.json"))) if (MESSAGE_DIR / sid).is_dir() else 0
        print(f"  {sid}  {created}  ({msg_count:>3} msgs){parent}  {title}")


def cmd_export(args):
    """Export one or more sessions to Obsidian vault."""
    project = find_project_by_cwd(args.cwd or os.getcwd())
    if not project:
        print(f"❌ No OpenCode project found for: {args.cwd or os.getcwd()}", file=sys.stderr)
        sys.exit(1)

    tmux_name = args.tmux_name or tmux_name_from_worktree(project["worktree"])
    vault = Path(args.vault) if args.vault else DEFAULT_VAULT

    # Resolve date filter
    target_date = None
    if args.date:
        target_date = parse_date_arg(args.date)
    elif args.today:
        target_date = datetime.now(tz=TZ_SHANGHAI).strftime("%Y-%m-%d")

    # Determine which sessions to export
    if args.all:
        sessions = list_sessions_for_project(project["id"])
        if target_date:
            sessions = filter_sessions_by_date(sessions, target_date)
    elif args.session_id:
        meta = load_session_meta(project["id"], args.session_id)
        if not meta:
            # Try to find session across all projects
            for pf in PROJECT_DIR.glob("*.json"):
                try:
                    pd = json.loads(pf.read_text("utf-8"))
                    m = load_session_meta(pd["id"], args.session_id)
                    if m:
                        meta = m
                        break
                except (json.JSONDecodeError, OSError):
                    continue
        if not meta:
            print(f"❌ Session not found: {args.session_id}", file=sys.stderr)
            sys.exit(1)
        sessions = [meta]
    else:
        # No session_id, no --all → auto-detect current session
        current = find_current_session(project["id"])
        if not current:
            print("❌ No active session found for this project.", file=sys.stderr)
            sys.exit(1)
        print(f"🔍 Auto-detected current session: {current['id']}")
        print(f"   Title: {current.get('title', '?')}")
        sessions = [current]

    if not sessions:
        print("No sessions to export.")
        return

    exported = 0
    skipped = 0
    for session_meta in sessions:
        sid = session_meta["id"]
        created_ts = session_meta.get("time", {}).get("created", 0)
        date_str = ts_to_date(created_ts)

        # Skip sub-agent sessions unless --include-sub
        if session_meta.get("parentID") and not args.include_sub:
            skipped += 1
            continue

        messages = load_messages(sid)
        if not messages:
            skipped += 1
            continue

        md = render_session_md(session_meta, messages, no_tools=getattr(args, "no_tools", False), tools_only=getattr(args, "tools_only", False), full_output=getattr(args, "full_output", False))
        out_path = build_output_path(vault, tmux_name, date_str, sid)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(md, encoding="utf-8")

        title = session_meta.get("title", "?")[:50]
        print(f"  ✅ {sid}  →  {out_path.relative_to(vault)}  ({len(messages)} msgs)  {title}")
        exported += 1

    print()
    print(f"📦 Exported: {exported}, Skipped: {skipped} (sub-agents/empty)")


def main():
    parser = argparse.ArgumentParser(
        description="Export OpenCode sessions to Obsidian vault as Markdown"
    )
    parser.add_argument("session_id", nargs="?", help="Session ID to export (ses_xxx)")
    parser.add_argument("--all", action="store_true", help="Export all sessions for the project")
    parser.add_argument("--today", action="store_true", help="Filter to today's sessions only")
    parser.add_argument("--date", help="Filter by date: 'today', 'yesterday', or 'YYYY-MM-DD'")
    parser.add_argument("--list", action="store_true", help="List sessions instead of exporting")
    parser.add_argument("--include-sub", action="store_true", help="Include sub-agent sessions")
    parser.add_argument("--tmux-name", help="Override tmux session name (default: from worktree)")
    parser.add_argument("--vault", help=f"Vault base path (default: {DEFAULT_VAULT})")
    parser.add_argument("--no-tools", action="store_true", help="Skip tool call details, export conversation text only")
    parser.add_argument("--tools-only", action="store_true", help="Export tool calls only, skip conversation text")
    parser.add_argument("--full-output", action="store_true", help="Include full tool output without truncation (for recovering write content)")
    parser.add_argument("--cwd", help="Override working directory for project detection")
    args = parser.parse_args()

    if not STORAGE.exists():
        print(f"❌ OpenCode storage not found at {STORAGE}", file=sys.stderr)
        sys.exit(1)

    if args.list:
        cmd_list(args)
    else:
        cmd_export(args)


if __name__ == "__main__":
    main()

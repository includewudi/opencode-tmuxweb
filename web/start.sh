#!/bin/bash
# web/start.sh

# Resolve absolute path to the project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/.."
TARGET_DIR="$PROJECT_ROOT/VoiceTmuxApp/Sources/XTerminalUI"

echo "Using target directory: $TARGET_DIR"

if [ ! -d "$TARGET_DIR" ]; then
    echo "Error: Directory not found: $TARGET_DIR"
    exit 1
fi

cd "$TARGET_DIR"

# Ensure resources are available for preview
if [ ! -f "xterm.min.js" ]; then
    echo "Copying xterm resources for preview..."
    cp Resources/xterm.min.js .
    cp Resources/xterm-addon-fit.min.js .
fi

# Kill any existing process on port 8000
echo "Checking for existing server on port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null

# Start Python HTTP server
echo "Starting Python HTTP Server..."
python3 -m http.server 8000 &
SERVER_PID=$!

# Give server a moment to start
sleep 1

# Open the preview page
echo "Opening preview..."
open "http://localhost:8000/preview.html"

echo "Server is running (PID: $SERVER_PID)."
echo "Press Ctrl+C to stop the server."

# Wait for interrupt
wait $SERVER_PID

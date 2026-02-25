#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BACKEND_PORT=8215
FRONTEND_PORT=5215

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
    echo -e "\n${YELLOW}Shutting down...${NC}"
    if [ ! -z "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null
    fi
    if [ ! -z "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null
    fi
    exit 0
}

trap cleanup SIGINT SIGTERM

echo -e "${GREEN}=== TmuxWeb Startup ===${NC}"
echo -e "Backend:  https://localhost:${BACKEND_PORT}"
echo -e "Frontend: https://localhost:${FRONTEND_PORT}"
echo ""

if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing backend dependencies...${NC}"
    npm install
fi

if [ ! -d "web/node_modules" ]; then
    echo -e "${YELLOW}Installing frontend dependencies...${NC}"
    cd web && npm install && cd ..
fi

echo -e "${GREEN}Building frontend production assets...${NC}"
cd web
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Frontend build failed${NC}"
    exit 1
fi
cd ..

echo -e "${GREEN}Starting backend on port ${BACKEND_PORT} (production mode)...${NC}"
node server/index.js &
BACKEND_PID=$!

sleep 1

if ! kill -0 $BACKEND_PID 2>/dev/null; then
    echo -e "${RED}Backend failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}Starting frontend on port ${FRONTEND_PORT} (production preview mode)...${NC}"
cd web && npm run preview -- --host &
FRONTEND_PID=$!
cd ..

sleep 2

echo ""
echo -e "${GREEN}=== TmuxWeb Running (PRODUCTION MODE) ===${NC}"
echo -e "Backend:  ${GREEN}production${NC} (Node.js Direct)"
echo -e "Frontend: ${GREEN}production${NC} (Vite Preview Mode)"
echo -e "Open: ${YELLOW}https://localhost:${FRONTEND_PORT}${NC}"
echo -e "Press Ctrl+C to stop"
echo ""

wait

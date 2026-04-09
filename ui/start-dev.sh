#!/bin/bash

# start-dev.sh - Start Fibonacci Dashboard Development Server
# Usage: ./start-dev.sh [options]
# Options: --port PORT | --host HOST | --silent

set -e

# Default configuration
PORT=${PORT:-5173}
HOST=${HOST:-0.0.0.0}
SILENT=${SILENT:-false}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    if [[ "$SILENT" == "true" ]]; then
        return
    fi
    echo -e "${GREEN}✓${NC} $1"
}

warn() {
    if [[ "$SILENT" == "true" ]]; then
        return
    fi
    echo -e "${YELLOW}⚠ $1${NC}"
}

error() {
    if [[ "$SILENT" == "true" ]]; then
        return
    fi
    echo -e "${RED}✗ $1${NC}"
}

# Check if Node.js is installed
check_node() {
    if ! command -v node &> /dev/null; then
        error "Node.js is not installed. Please install Node.js first."
        error "Download from: https://nodejs.org/"
        exit 1
    fi
    log "Node.js version: $(node -v)"
}

# Check if npm is installed
check_npm() {
    if ! command -v npm &> /dev/null; then
        error "npm is not installed. Please install npm first."
        error "Install with: sudo apt install npm"
        exit 1
    fi
    log "npm version: $(npm -v)"
}

# Check if dependencies are installed
check_deps() {
    log "Checking dependencies..."
    if [[ ! -d "node_modules" ]] || [[ -z "$(ls -A node_modules 2>/dev/null)" ]]; then
        warn "Dependencies not found. Installing..."
        npm install
        if [[ $? -ne 0 ]]; then
            error "Failed to install dependencies."
            exit 1
        fi
        log "Dependencies installed successfully."
    else
        log "Dependencies already installed."
    fi
}

# Kill existing processes on the port
kill_existing() {
    local existing_pid=$(lsof -ti:5173)
    if [[ -n "$existing_pid" ]]; then
        warn "Process $existing_pid is using port 5173."
        if [[ "${FORCE}" == "true" ]]; then
            error "Stopping existing process..."
            kill -9 $existing_pid
            log "Process stopped."
        else
            error "Please stop any existing processes using port 5173 manually."
            error "Run: sudo lsof -ti:5173 | xargs kill -9"
            exit 1
        fi
    fi
}

# Clean build (optional)
clean_build() {
    if [[ "${CLEAN}" == "true" ]]; then
        warn "Cleaning up old build artifacts..."
        rm -rf dist
        log "Build cleaned."
    fi
}

# Show help
show_help() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --port PORT      Set port number (default: 5173)"
    echo "  --host HOST      Bind to specific host (default: 0.0.0.0)"
    echo "  --silent          Suppress all output"
    echo "  --force           Force kill existing processes"
    echo "  --clean           Clean build artifacts before starting"
    echo "  --help            Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  PORT             Port number to listen on"
    echo "  HOST             Host to bind to"
    echo "  SILENT           Set to 'true' for silent mode"
    echo "  FORCE            Set to 'true' to force kill existing processes"
    echo "  CLEAN            Set to 'true' to clean build before start"
    echo ""
    echo "Examples:"
    echo "  ./start-dev.sh                    # Start with defaults"
    echo "  PORT=3000 ./start-dev.sh          # Start on port 3000"
    echo "  ./start-dev.sh --force            # Force start"
    echo "  SILENT=true ./start-dev.sh        # Silent mode"
    exit 0
}

# Main function
main() {
    echo ""
    echo "╔════════════════════════════════════════╗"
    echo "║   Fibonacci Dashboard Dev Server      ║"
    echo "╚════════════════════════════════════════╝"
    echo ""

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --port)
                PORT="$2"
                shift 2
                ;;
            --host)
                HOST="$2"
                shift 2
                ;;
            --silent)
                SILENT="true"
                shift
                ;;
            --force)
                FORCE="true"
                shift
                ;;
            --clean)
                CLEAN="true"
                shift
                ;;
            --help|-h)
                show_help
                ;;
            *)
                error "Unknown option: $1"
                show_help
                ;;
        esac
    done

    # Validation
    echo ""
    warn "Starting development server..."
    echo ""

    # Check prerequisites
    check_node
    check_npm

    # Clean build if requested
    clean_build

    # Kill existing processes if force mode
    if [[ "${FORCE}" == "true" ]]; then
        kill_existing
    fi

    # Check and install dependencies
    check_deps

    # Start the server
    echo ""
    warn "Server will start on:"
    echo "  Local:   http://localhost:${PORT}/"
    echo "  Network:  http://${HOST}:${PORT}/"
    echo ""

    log "Starting Vite development server..."
    npm run dev -- --host "${HOST}" --port "${PORT}" --open

    # Clean up on exit
    echo ""
    warn "Development server stopped."
    echo "Hint: Run './start-dev.sh --force' to restart."
}

# Run main function
main "$@"

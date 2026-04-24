#!/bin/bash
# Expose local backend to internet for bunq webhook callbacks
# Usage: ./infra/scripts/ngrok-dev.sh
# Requires: ngrok installed (https://ngrok.com/download)
# After running, copy the https URL into .env as PUBLIC_BACKEND_URL

set -euo pipefail

if ! command -v ngrok &> /dev/null; then
  echo "ngrok not found. Install it:"
  echo "  snap install ngrok"
  echo "  # or: https://ngrok.com/download"
  exit 1
fi

echo "Starting ngrok tunnel on port 8000..."
echo "Copy the https:// URL into .env as PUBLIC_BACKEND_URL"
echo "Then re-register the bunq webhook (backend does this on startup if PUBLIC_BACKEND_URL is set)"
echo ""

ngrok http 8000

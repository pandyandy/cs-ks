#!/bin/bash
set -Eeuo pipefail

cd /app
npm install --include=dev
NODE_OPTIONS="--max-old-space-size=4096" npm run build

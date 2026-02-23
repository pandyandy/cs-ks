#!/bin/bash
set -Eeuo pipefail

cd /app
npm install --include=dev
npm run build

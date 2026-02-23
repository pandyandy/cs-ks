#!/bin/bash
set -Eeuo pipefail

export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
cd /app

npm install --include=dev

NODE_OPTIONS="--max-old-space-size=4096" npm run build

cp -r .next/static .next/standalone/.next/static
cp -r public .next/standalone/public

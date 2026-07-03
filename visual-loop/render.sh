#!/usr/bin/env bash
# Build the Expo web bundle and capture the History screen in one step.
# Usage: render.sh <TAG> <PORT>   (run from a repo/worktree root that has node_modules)
# Emits <TAG>-workouts.png, <TAG>-workouts-full.png, <TAG>-exercises.png in $OUT (default cwd).
set -euo pipefail
TAG="${1:-history}"
PORT="${2:-5599}"
OUT="${OUT:-$(pwd)}"
ROOT="$(pwd)"

# link node_modules if this is a fresh worktree
[ -e node_modules ] || ln -s /Users/connor/repo/morph/node_modules node_modules

CI=1 npx expo export --platform web >/dev/null 2>&1
DIST="$ROOT/dist" PORT="$PORT" OUT="$OUT" TAG="$TAG" node /Users/connor/repo/morph/visual-loop/capture.js

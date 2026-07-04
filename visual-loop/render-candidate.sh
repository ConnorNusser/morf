#!/usr/bin/env bash
# Render a candidate diff in the MAIN repo (where the Metro cache stays warm ~8s,
# vs ~30s cold in an isolated worktree). Reversible: applies the patch, builds +
# screenshots, then reverses the patch to restore the exact prior state.
#
# Usage: render-candidate.sh <diff-file> <TAG> <PORT>
# Emits <TAG>-workouts(-full).png, <TAG>-exercises.png into $OUT.
# Requires a clean working tree at the committed baseline before calling.
set -uo pipefail
DIFF="$1"; TAG="$2"; PORT="${3:-5599}"
ROOT="/Users/connor/repo/morph"
cd "$ROOT"

if ! git apply --check "$DIFF" 2>/dev/null; then
  echo "APPLY_FAILED: patch does not apply cleanly to baseline"
  exit 3
fi
git apply "$DIFF"

# build (warm cache) + capture; keep going even if capture warns
OUT="${OUT:-$ROOT/visual-loop/.shots}" bash "$ROOT/visual-loop/render.sh" "$TAG" "$PORT"
RC=$?

# reverse the patch to restore the baseline exactly (removes added files, reverts edits)
git apply -R "$DIFF" 2>/dev/null || { git checkout -- . 2>/dev/null; git clean -fdq -e node_modules -e dist -e visual-loop/.shots 2>/dev/null; }

if [ $RC -ne 0 ]; then echo "RENDER_FAILED rc=$RC"; exit $RC; fi
echo "RENDERED $TAG"

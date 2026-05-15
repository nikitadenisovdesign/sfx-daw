#!/usr/bin/env bash
# Download Stable Audio Open 1.0 weights (diffusers layout, ~5 GB).
#
# Prerequisites:
#   1. Have a HuggingFace account.
#   2. Visit https://huggingface.co/stabilityai/stable-audio-open-1.0
#      and click "Agree and access repository".
#   3. Create a read token at https://huggingface.co/settings/tokens
#   4. huggingface-cli login   (paste the token; runs once per machine)
#
# Usage:
#   bash scripts/download-models.sh
#
# Resolves to <repo-root>/models/stable-audio-open/.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
DEST="$REPO_ROOT/models/stable-audio-open"

echo "Target directory: $DEST"

if ! command -v huggingface-cli >/dev/null 2>&1; then
  echo "huggingface-cli not found. Installing via pip (user scope)..."
  python3 -m pip install --user --upgrade huggingface_hub
  USER_BIN="$(python3 -c 'import site; print(site.USER_BASE)')/bin"
  if [ -d "$USER_BIN" ]; then
    export PATH="$USER_BIN:$PATH"
  fi
fi

if ! huggingface-cli whoami >/dev/null 2>&1; then
  echo "WARNING: not logged in to HuggingFace."
  echo "If the download fails with 401/403, run: huggingface-cli login"
fi

# Only fetch diffusers files; skip SAT-format duplicates (model.ckpt etc.) the
# server doesn't use.
huggingface-cli download stabilityai/stable-audio-open-1.0 \
  --local-dir "$DEST" \
  --local-dir-use-symlinks False \
  --include "model_index.json" \
  --include "scheduler/*" \
  --include "text_encoder/*" \
  --include "tokenizer/*" \
  --include "transformer/*" \
  --include "vae/*" \
  --include "projection_model/*"

echo
echo "Done. Weights now at: $DEST"
echo "Expected structure:"
echo "  model_index.json"
echo "  scheduler/  text_encoder/  tokenizer/  transformer/  vae/  projection_model/"

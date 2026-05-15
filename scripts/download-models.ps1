# Download Stable Audio Open 1.0 weights (diffusers layout, ~5 GB).
#
# Prerequisites
#   1. Have a HuggingFace account.
#   2. Visit https://huggingface.co/stabilityai/stable-audio-open-1.0
#      and click "Agree and access repository".
#   3. Create a read token at https://huggingface.co/settings/tokens
#   4. huggingface-cli login   (paste the token; runs once per machine)
#
# Usage
#   .\scripts\download-models.ps1
#
# Resolves to <repo-root>/models/stable-audio-open/.

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $repoRoot "models\stable-audio-open"

Write-Host "Target directory: $dest"

# Ensure huggingface-cli is available.
$hf = Get-Command huggingface-cli -ErrorAction SilentlyContinue
if (-not $hf) {
    Write-Host "huggingface-cli not found. Installing via pip (user scope)..."
    python -m pip install --user --upgrade huggingface_hub
    # Update PATH for this session so `huggingface-cli` is reachable.
    $userScripts = (python -c "import sys, sysconfig; print(sysconfig.get_path('scripts', f'{sys.platform}_user'))").Trim()
    if ($userScripts -and (Test-Path $userScripts)) {
        $env:PATH = "$userScripts;$env:PATH"
    }
}

# Authentication check — warn but don't hard-fail; HF will say if it needs a token.
$whoami = (huggingface-cli whoami 2>&1)
if ($whoami -match 'Not logged in' -or $LASTEXITCODE -ne 0) {
    Write-Warning "You don't appear to be logged in to HuggingFace."
    Write-Warning "If the download fails with a 401/403 run:  huggingface-cli login"
}

# Only fetch the diffusers files. Skip the SAT-format duplicates (model.ckpt,
# model.safetensors in root, vae_model.ckpt) — the server uses diffusers.
huggingface-cli download stabilityai/stable-audio-open-1.0 `
  --local-dir $dest `
  --local-dir-use-symlinks False `
  --include "model_index.json" `
  --include "scheduler/*" `
  --include "text_encoder/*" `
  --include "tokenizer/*" `
  --include "transformer/*" `
  --include "vae/*" `
  --include "projection_model/*"

if ($LASTEXITCODE -ne 0) {
    Write-Error "Download failed. Check huggingface-cli login and license acceptance."
    exit 1
}

Write-Host ""
Write-Host "Done. Weights now at: $dest"
Write-Host "Expected structure:"
Write-Host "  model_index.json"
Write-Host "  scheduler/  text_encoder/  tokenizer/  transformer/  vae/  projection_model/"

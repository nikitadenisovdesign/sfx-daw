# SFX DAW supervisor.
#
# Keeps the backend (python server.py on :8000) and the Cloudflare quick tunnel
# alive across crashes and logins, and auto-syncs the tunnel URL to Vercel
# whenever it changes. Designed to run with NO admin rights, launched from the
# user's Startup folder (see install). Safe to also start manually.
#
#   powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File supervise.ps1
#
# Logs to ops/supervisor.log.

$ErrorActionPreference = 'Continue'

$root    = 'Z:\Claude\SFXDAW'
$py      = "$root\server\venv\Scripts\python.exe"
$cf      = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$nodeDir = 'C:\Program Files\nodejs'
$ops     = "$root\ops"
$tunLog  = "$ops\tunnel.err.log"
$urlFile = "$ops\current-url.txt"
$log     = "$ops\supervisor.log"

$env:PATH = "$nodeDir;$env:PATH"

# --- single-instance guard ----------------------------------------------------
$mtx = New-Object System.Threading.Mutex($false, 'Local\SFXDAW_Supervisor')
if (-not $mtx.WaitOne(0)) { exit 0 }   # another supervisor already owns it

function Log($m) {
  $line = ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
  Add-Content -Path $log -Value $line -ErrorAction SilentlyContinue
}

# Last URL we successfully pushed to Vercel (persisted so a supervisor restart
# does not trigger a needless redeploy).
$script:lastSynced = ''
if (Test-Path $urlFile) { $script:lastSynced = (Get-Content $urlFile -Raw -ErrorAction SilentlyContinue).Trim() }
$script:tunProc = $null

function Backend-Alive {
  [bool](Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue)
}

function Ensure-Backend {
  if (Backend-Alive) { return }
  Log 'backend down -> starting'
  Start-Process -FilePath $py -ArgumentList 'server.py' `
    -WorkingDirectory "$root\server" -WindowStyle Hidden | Out-Null
}

function Sync-Vercel($url) {
  Log "tunnel URL changed -> $url ; pushing to Vercel"
  Push-Location $root
  try {
    & vercel env rm VITE_API_URL production --yes  2>$null | Out-Null
    & vercel env rm VITE_API_URL development --yes 2>$null | Out-Null
    $url | & vercel env add VITE_API_URL production  2>$null | Out-Null
    $url | & vercel env add VITE_API_URL development 2>$null | Out-Null
    & vercel deploy --prod --yes 2>$null | Out-Null
    Log 'Vercel redeploy triggered'
  } catch { Log "Sync-Vercel error: $_" }
  Pop-Location
}

function Ensure-Tunnel {
  if ($script:tunProc -and -not $script:tunProc.HasExited) { return }
  Log 'tunnel down -> starting cloudflared'
  Remove-Item $tunLog -ErrorAction SilentlyContinue
  $script:tunProc = Start-Process -FilePath $cf `
    -ArgumentList 'tunnel','--url','http://localhost:8000','--no-autoupdate' `
    -RedirectStandardError $tunLog -WindowStyle Hidden -PassThru

  # Wait up to ~40s for the URL to appear.
  $url = ''
  for ($i = 0; $i -lt 20; $i++) {
    Start-Sleep -Seconds 2
    if (Test-Path $tunLog) {
      $m = Select-String -Path $tunLog -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($m) { $url = $m.Matches.Value; break }
    }
  }
  if (-not $url) { Log 'tunnel: no URL yet (will retry next loop)'; return }

  Set-Content -Path $urlFile -Value $url -ErrorAction SilentlyContinue
  if ($url -ne $script:lastSynced) {
    Sync-Vercel $url
    $script:lastSynced = $url
  } else {
    Log "tunnel URL unchanged ($url) - no redeploy"
  }
}

Log '=== supervisor started ==='

# We are the sole supervisor (mutex enforced). Kill any cloudflared left
# orphaned by a previously-crashed supervisor so we never accumulate tunnels.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

while ($true) {
  try { Ensure-Backend } catch { Log "Ensure-Backend error: $_" }
  try { Ensure-Tunnel }  catch { Log "Ensure-Tunnel error: $_" }
  Start-Sleep -Seconds 20
}

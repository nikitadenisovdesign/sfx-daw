# SFX DAW supervisor.
#
# Keeps the backend (python server.py on :8000) and the NAMED Cloudflare tunnel
# (sfx-daw -> https://sfx.nidestudio.com) alive across crashes and logins.
# The named tunnel has a STABLE hostname, so unlike the old quick tunnel there
# is no URL rotation and nothing to push to Vercel — VITE_API_URL is set once.
#
# Runs with NO admin rights, launched from the user's Startup folder via
# start-supervisor.vbs. Safe to also start manually:
#   powershell -ExecutionPolicy Bypass -WindowStyle Hidden -File supervise.ps1
#
# Logs to ops/supervisor.log.

$ErrorActionPreference = 'Continue'

$root = 'Z:\Claude\SFXDAW'
$py   = "$root\server\venv\Scripts\python.exe"
$cf   = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
$ops  = "$root\ops"
$log  = "$ops\supervisor.log"

# --- single-instance guard ----------------------------------------------------
$mtx = New-Object System.Threading.Mutex($false, 'Local\SFXDAW_Supervisor')
if (-not $mtx.WaitOne(0)) { exit 0 }   # another supervisor already owns it

function Log($m) {
  $line = ('{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $m)
  Add-Content -Path $log -Value $line -ErrorAction SilentlyContinue
}

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

function Ensure-Tunnel {
  if ($script:tunProc -and -not $script:tunProc.HasExited) { return }
  Log 'tunnel down -> starting named tunnel sfx-daw (sfx.nidestudio.com)'
  $script:tunProc = Start-Process -FilePath $cf `
    -ArgumentList 'tunnel','run','sfx-daw' `
    -WindowStyle Hidden -PassThru
}

Log '=== supervisor started (named tunnel) ==='

# We are the sole supervisor (mutex enforced). Kill any cloudflared left
# orphaned by a previously-crashed supervisor so we never run two tunnels.
Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

while ($true) {
  try { Ensure-Backend } catch { Log "Ensure-Backend error: $_" }
  try { Ensure-Tunnel }  catch { Log "Ensure-Tunnel error: $_" }
  Start-Sleep -Seconds 20
}

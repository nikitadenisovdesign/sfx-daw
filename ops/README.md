# Ops — keep the local backend reachable from the Vercel frontend

The frontend is static on Vercel; the backend (FastAPI + RTX 5090) runs on this
PC and is exposed to the internet through a Cloudflare quick tunnel. Both the
backend and the tunnel are long-lived local processes — if either dies, the
deployed site shows "Server offline".

`supervise.ps1` keeps them alive with **no admin rights**:

- ensures `python server.py` is listening on `:8000` (restarts it if it dies),
- ensures a `cloudflared` quick tunnel is up,
- whenever the tunnel URL changes, it rewrites the Vercel `VITE_API_URL`
  env var and triggers a production redeploy — fully automatic.

A single-instance mutex (`Local\SFXDAW_Supervisor`) prevents two supervisors
from running at once.

## Auto-start

`start-supervisor.vbs` launches it hidden. A copy is installed in the user
Startup folder:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SFXDAW-Supervisor.vbs
```

so it runs at every login. Delete that file to stop auto-starting.

## Run / check manually

```powershell
# start (hidden)
wscript.exe "Z:\Claude\SFXDAW\ops\start-supervisor.vbs"

# current public URL
Get-Content Z:\Claude\SFXDAW\ops\current-url.txt

# activity log
Get-Content Z:\Claude\SFXDAW\ops\supervisor.log -Tail 20

# stop everything
Get-Process cloudflared | Stop-Process -Force
# (and end the hidden powershell running supervise.ps1)
```

## Known limitation — quick-tunnel URL churn

A `trycloudflare.com` URL is reassigned every time `cloudflared` restarts
(e.g. after a reboot). The supervisor self-heals by redeploying, but there's a
~1 min window where the site is stale. For a **stable** URL that never changes,
switch to a *named* Cloudflare tunnel (needs a domain on Cloudflare) — then
`VITE_API_URL` is set once and the redeploy-on-change logic is never needed.

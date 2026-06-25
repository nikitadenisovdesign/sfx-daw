# Ops — keep the local backend reachable from the Vercel frontend

The frontend is static on Vercel; the backend (FastAPI + RTX 5090) runs on this
PC and is exposed to the internet through a **named Cloudflare tunnel** at a
stable hostname:

```
https://sfx.nidestudio.com  ->  named tunnel "sfx-daw"  ->  http://localhost:8000
```

Because the hostname never changes, Vercel's `VITE_API_URL` is set **once** and
never needs touching again — no redeploy churn on reboot.

`supervise.ps1` keeps both processes alive with **no admin rights**:

- ensures `python server.py` is listening on `:8000` (restarts it if it dies),
- ensures `cloudflared tunnel run sfx-daw` is up (restarts it if it dies).

A single-instance mutex (`Local\SFXDAW_Supervisor`) prevents two supervisors
from running at once; it also kills any orphaned `cloudflared` on startup.

## Cloudflare tunnel setup (already done — for reference)

```powershell
cloudflared tunnel login                                  # browser: authorize the nidestudio.com zone
cloudflared tunnel create sfx-daw                          # -> UUID d1f5a08a-...; creds in ~/.cloudflared/<UUID>.json
cloudflared tunnel route dns sfx-daw sfx.nidestudio.com    # CNAME on Cloudflare
# config at ~/.cloudflared/config.yml maps sfx.nidestudio.com -> http://localhost:8000
cloudflared tunnel run sfx-daw                             # (the supervisor does this)
```

Credentials (`~/.cloudflared/cert.pem`, `<UUID>.json`, `config.yml`) live outside
the repo and are secret — never commit them.

## Auto-start

`start-supervisor.vbs` launches the supervisor hidden. A copy is installed in the
user Startup folder:

```
%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\SFXDAW-Supervisor.vbs
```

so it runs at every login. Delete that file to stop auto-starting.

## Run / check manually

```powershell
# start (hidden)
wscript.exe "Z:\Claude\SFXDAW\ops\start-supervisor.vbs"

# activity log
Get-Content Z:\Claude\SFXDAW\ops\supervisor.log -Tail 20

# is the public endpoint healthy?
Invoke-RestMethod https://sfx.nidestudio.com/health

# stop everything
Get-Process cloudflared | Stop-Process -Force
# (and end the hidden powershell running supervise.ps1 — find it via
#  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | ? CommandLine -like '*supervise.ps1*')
```

## If "Server offline" ever comes back

1. `Get-Content ops\supervisor.log -Tail 8` and `Invoke-RestMethod http://127.0.0.1:8000/health`.
2. If the supervisor is alive it self-heals within ~20s. If not, relaunch it:
   `Start-Process wscript.exe -ArgumentList '"Z:\Claude\SFXDAW\ops\start-supervisor.vbs"'`.
3. The hostname is fixed, so Vercel never needs changing. If you ever DO need to
   repoint it: `vercel env rm VITE_API_URL production --yes`,
   `"https://sfx.nidestudio.com" | vercel env add VITE_API_URL production`, then
   `vercel deploy --prod --yes` (cwd = repo root, PATH has `C:\Program Files\nodejs`).

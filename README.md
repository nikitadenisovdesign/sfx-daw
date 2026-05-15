# SFX DAW

> AI-first browser DAW for generating and layering sound effects over video.
> Built for motion designers and video production studios.

A free-form text prompt becomes four 0.3–47 s SFX variations in 5–20 seconds on
an RTX 5090. You drop them onto a Canvas timeline, layer them under your video,
shape the volume with keyframes, and export a stereo mix or per-track stems.

## Architecture

```
┌────────────────────────────────┐         ┌──────────────────────────────────────┐
│  client/  (browser)            │         │  server/  (PC + RTX 5090, Windows)   │
│                                │         │                                       │
│  React 18 + Vite + TS          │   LAN   │  FastAPI + Stable Audio Open 1.0      │
│  Zustand + Web Audio API       │ ──────► │  via diffusers.StableAudioPipeline    │
│  Canvas timeline               │ ◄────── │  PyTorch 2.11 + CUDA 12.8             │
│  http://localhost:5173         │         │  http://0.0.0.0:8000                  │
└────────────────────────────────┘         └──────────────────────────────────────┘
```

The whole thing also runs happily on a single Windows box — the LAN split is
just for offloading inference to a beefier GPU.

## Features

**Generation**
- Stable Audio Open 1.0 via `diffusers.StableAudioPipeline` (1.21 B params,
  ~3 GB VRAM, 2–5 s/clip on RTX 5090, 44.1 kHz stereo).
- Free-form prompt or 29 built-in templates (swoosh / impact / transition /
  ui / ambient / pop variants).
- Adjustable duration up to 47 s, guidance scale, batch of 1–8 variations
  per request, deterministic seeds.

**Editor**
- Canvas-rendered timeline with 4 default tracks (SFX / Foley / Ambience /
  Extra) plus an auto-created **Music** track for imported audio.
- Drag clips to move, drag edges to trim, **`S`** to split at the playhead,
  **`Delete`** to remove, **Shift+click** for multi-select.
- Per-clip **volume keyframes**: Alt+click to add or remove a point, drag to
  move. Audio engine applies them as `linearRampToValueAtTime` automation.
- Sample-accurate Web Audio playback (one `AudioContext`, per-clip
  `BufferSource` → `GainNode` → track bus → master).
- Video preview (MP4 / MOV / WebM) follows the audio engine playhead;
  resyncs if drift exceeds 50 ms.

**Workflow**
- Import your own audio (MP3 / WAV / OGG / FLAC / M4A / AAC / OPUS) — lands
  on a **Music** track at the playhead with auto-generated waveform peaks.
- Library auto-refreshes after each generation; search, favorite filter,
  drag-and-drop from library onto any track.
- Save / load project as JSON.
- Export full mix as WAV (via `OfflineAudioContext`) or per-track stems.

**UI niceties**
- One-shot preview button per clip (▶/⏸ toggles globally — clicking another
  preview stops the previous one automatically).
- Server health pill in the transport bar (GPU name, VRAM used / total).
- `Cmd/Ctrl + wheel` to zoom timeline, `Shift + wheel` to scroll, `Alt + drag`
  to pan.

## Quick start

### 0. Get the model weights (~5 GB)

The weights are **not** in the repo (Stability AI Community License + GitHub’s
100 MB/file limit). The included helper script pulls only the `diffusers`
files we actually use:

```powershell
# Windows
.\scripts\download-models.ps1
```

```bash
# Mac / Linux
bash scripts/download-models.sh
```

Both require a HuggingFace account that has accepted the SAO license at
<https://huggingface.co/stabilityai/stable-audio-open-1.0>. Run
`huggingface-cli login` once with a read token before the first download.

### 1. Backend (Windows PC with RTX 5090)

```powershell
cd server
python -m venv venv
.\venv\Scripts\activate
pip install torch==2.11.0 torchaudio --index-url https://download.pytorch.org/whl/cu128
pip install "setuptools<82" wheel "numpy<2"
pip install -r requirements.txt
python server.py
```

The server listens on `http://0.0.0.0:8000`. First start loads SAO into VRAM
(~10–15 s). Find your LAN IP with `ipconfig` (e.g. `192.168.1.42`).

Open port 8000 in Windows Firewall if you want to reach the server from
another machine — see [`server/README.md`](server/README.md).

### 2. Frontend

```bash
cd client
cp .env.example .env
# edit .env: VITE_API_URL=http://192.168.1.42:8000   (or http://127.0.0.1:8000 if local)
npm install
npm run dev
```

Open `http://localhost:5173`.

### 3. Smoke-test

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok","gpu":"NVIDIA GeForce RTX 5090","vram_total_gb":34.19,...}

python server/test_server.py 127.0.0.1 8000
# generates one 0.5 s clip, downloads it, lists the library
```

## Project layout

```
sfx-daw/
├── client/                       # React + Vite frontend
│   ├── src/
│   │   ├── components/           # Transport, VideoPlayer, GeneratePanel, Timeline, SoundBrowser, Mixer
│   │   ├── hooks/                # useAudioEngine, useGenerateSFX, useImportAudio, useExport, ...
│   │   ├── store/                # projectStore, mixerStore, uiStore (Zustand)
│   │   ├── audio/                # AudioGraph, PlaybackEngine, ExportEngine
│   │   ├── canvas/               # TimelineRenderer, WaveformRenderer, ClipRenderer
│   │   ├── lib/                  # api, format, wav encoder
│   │   └── types/                # domain types
│   └── README.md
├── server/                       # FastAPI backend
│   ├── backends/                 # Backend registry + SAO adapter
│   ├── server.py                 # FastAPI app + endpoints
│   ├── inference.py              # Backend manager (load / unload / dispatch)
│   ├── audio_processing.py       # normalize / trim / fade post-processing
│   ├── db.py                     # SQLite library cache
│   ├── prompt_templates.py       # built-in SFX recipe templates
│   └── README.md
└── models/                       # local model weights (gitignored)
    └── stable-audio-open/        # HF snapshot of stabilityai/stable-audio-open-1.0
```

Weights are not committed — download them locally to `models/stable-audio-open/`
in the HuggingFace `diffusers` layout (`model_index.json` + `scheduler/`,
`text_encoder/`, `tokenizer/`, `transformer/`, `vae/`, `projection_model/`).

## Endpoints

| Method | Path                        | What it does                              |
| ------ | --------------------------- | ----------------------------------------- |
| GET    | `/health`                   | Server + GPU + backend status             |
| GET    | `/models`                   | List available SFX backends               |
| GET    | `/templates`                | Built-in prompt templates                 |
| POST   | `/generate`                 | Generate N variations from a free prompt  |
| POST   | `/generate/template`        | Generate from a template (category+variant) |
| GET    | `/audio/{filename}`         | Stream a generated WAV                    |
| GET    | `/library`                  | List saved sounds (search / filter)       |
| POST   | `/library/{id}/favorite`    | Toggle favorite                           |
| POST   | `/library/{id}/tags`        | Update tags                               |
| DELETE | `/library/{id}`             | Delete entry + file                       |

## Tech stack

- **Backend** — Python 3.11, FastAPI, Uvicorn, PyTorch 2.11 + CUDA 12.8,
  diffusers ≥ 0.27 (`StableAudioPipeline`), transformers, torchsde
  (DPMSolver), SQLite, Pydantic v2.
- **Frontend** — React 18, Vite 5, TypeScript 5, Zustand, Web Audio API,
  Canvas 2D (no framework on the timeline — direct draw for performance).
- **No mocked audio** — every clip you hear is a real `AudioBufferSource`
  going through the master gain into `AudioContext.destination`.

## MVP roadmap

- [x] Phase 0: Project scaffold (server + client + backend registry)
- [x] Phase 1: Environment & infra (CUDA, PyTorch, model loading)
- [x] Phase 2: AI generation (templates, variations, library cache)
- [x] Phase 3: Video player + Canvas timeline
- [x] Phase 4: Audio engine + mixer (per-track gain/pan/mute/solo)
- [x] Phase 5: Library, project save/load, audio import, stem & mix export,
              trim handles, split, volume keyframes
- [ ] Phase 6: Polishing, error boundaries, drag-and-drop from desktop,
              automation for track volume/pan, MIDI control

## Deploying the frontend

This app is **two-tier**: a static React bundle (deployable to Vercel / Netlify
/ Cloudflare Pages) plus a Python+GPU backend (**cannot** live on serverless —
it needs CUDA, 5 GB of weights on disk, and ≥5 s per request).

### Vercel + Cloudflare Tunnel (recommended for personal use)

The repo ships a [`vercel.json`](vercel.json) that builds from `client/` and
serves the SPA. To deploy:

1. **Import** this repo at <https://vercel.com/new>. Leave Root Directory as
   the repo root — `vercel.json` already points the build at `client/`.
2. **Expose your backend.** On the PC running `python server.py` install and
   run Cloudflare Tunnel:

   ```powershell
   winget install --id Cloudflare.cloudflared --silent
   cloudflared tunnel --url http://localhost:8000
   ```

   It prints a public `https://*.trycloudflare.com` URL. Free, no account
   required for ephemeral tunnels. For a stable URL, create a named tunnel
   under a free Cloudflare Zero Trust account.

3. **Tell the frontend where the backend is.** In the Vercel project,
   **Settings → Environment Variables → add** `VITE_API_URL` =
   `https://your-tunnel.trycloudflare.com` for all environments. Redeploy.

That’s it — anyone who opens your `*.vercel.app` URL talks to your local
RTX 5090.

### Why not put the backend on Vercel itself?

| Backend needs | Vercel offers |
| --- | --- |
| PyTorch + CUDA (~4 GB of native deps) | 50 MB compressed function bundle |
| GPU inference | CPU only, no GPU |
| 5–20 s per `/generate` | 10 s hobby / 60 s Pro / 300 s Enterprise hard cap |
| 5 GB of model weights on local disk | Ephemeral filesystem |
| SQLite cache + generated WAV directory | No persistent storage |

If you need backend in the cloud, look at **Modal**, **Replicate**, **Runpod
Serverless** or a dedicated GPU VM (Lambda Labs / Vast.ai) — they support
PyTorch + CUDA and long-running requests. Vercel doesn’t.

## Licensing notes

**Stable Audio Open 1.0** is released under the
[Stability AI Community License](https://stability.ai/community-license).
Commercial use is allowed for organisations whose yearly revenue is below
**$1 M**. Above that you need an Enterprise license from Stability AI.

The application code in this repo (everything in `client/` and `server/` you
write yourself) is yours to license as you wish. The model weights are not
included here — you download them under their own license.

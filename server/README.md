# SFX DAW — Server

FastAPI backend that hosts Stable Audio Open 1.0 (via `diffusers.StableAudio
Pipeline`) and serves generation, library and audio-streaming endpoints.

## Install (Windows + RTX 5090)

```powershell
# 1. CUDA 12.8 toolkit — https://developer.nvidia.com/cuda-downloads
# 2. Python 3.11
winget install Python.Python.3.11

# 3. Virtualenv
cd server
python -m venv venv
.\venv\Scripts\activate

# 4. PyTorch with CUDA 12.8 (required for Blackwell / RTX 5090)
pip install torch==2.11.0 torchaudio --index-url https://download.pytorch.org/whl/cu128

# 5. Pin a torch-friendly setuptools and numpy first
pip install "setuptools<82" wheel "numpy<2"

# 6. Everything else
pip install -r requirements.txt
```

The server uses `diffusers.StableAudioPipeline`, not `stable-audio-tools` —
this avoids the strict-pinned dependency tree (`pytorch_lightning==2.1.0`,
`torchmetrics==0.11.4`, `sentencepiece==0.1.99`, …) that would otherwise clash
with the rest of the stack.

## Model weights

Local-only, never auto-downloaded. Drop a HuggingFace `diffusers` snapshot of
`stabilityai/stable-audio-open-1.0` into `../models/stable-audio-open/`. The
folder must contain at minimum:

```
models/stable-audio-open/
├── model_index.json
├── scheduler/
├── text_encoder/
├── tokenizer/
├── transformer/
├── vae/
└── projection_model/
```

Easiest way to grab them — use the bundled script from the repo root:

```powershell
# Windows
..\scripts\download-models.ps1
```

```bash
# Mac / Linux
bash ../scripts/download-models.sh
```

The script only fetches `diffusers`-layout files (~5 GB) and skips the
SAT-format duplicates the server doesn’t use.

The repo on HF requires accepting the Stability AI Community License — log
in first with `huggingface-cli login`.

## Configuration

```powershell
copy .env.example .env
# Edit at least SFX_MODELS_DIR, SFX_OUTPUT_DIR and SFX_DB_PATH.
```

Key env vars (all `SFX_`-prefixed):

| Var                       | Default                       | What it controls                              |
| ------------------------- | ----------------------------- | --------------------------------------------- |
| `SFX_MODELS_DIR`          | `./models`                    | Folder containing `stable-audio-open/`        |
| `SFX_OUTPUT_DIR`          | `C:/sfx-daw/generated`        | Where generated WAVs land                     |
| `SFX_DB_PATH`             | `C:/sfx-daw/sfx_cache.db`     | SQLite library cache                          |
| `SFX_DEFAULT_BACKEND`     | `stable-audio-open`           | Backend used when `/generate` omits `model`   |
| `SFX_AUTOLOAD_BACKENDS`   | `` (=default only) / `*`      | Comma-separated list, or `*` for all          |
| `SFX_HOST`, `SFX_PORT`    | `0.0.0.0`, `8000`             | Bind address                                  |
| `SFX_DEFAULT_STEPS`       | `100`                         | Diffusion steps when `/generate` omits it     |
| `SFX_DEFAULT_GUIDANCE`    | `7.0`                         | CFG scale default                             |
| `SFX_CORS_ORIGINS`        | `*`                           | `*` for dev, or comma-separated origins       |

## Run

```powershell
python server.py
```

First start loads SAO into VRAM (~10–15 s on a 5090). After that the server
listens on `http://0.0.0.0:8000`.

Find your LAN IP:

```powershell
ipconfig | findstr IPv4
```

## Open the port in Windows Firewall

```powershell
# Elevated PowerShell:
New-NetFirewallRule -DisplayName "SFX DAW Server" `
  -Direction Inbound -Port 8000 -Protocol TCP -Action Allow
```

## Smoke-test from another machine

```bash
curl http://192.168.x.x:8000/health
# {"status":"ok","gpu":"NVIDIA GeForce RTX 5090","vram_total_gb":34.19,...}

curl -X POST http://192.168.x.x:8000/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt":"soft cinematic whoosh","duration":1.0,"num_variations":4}'
```

Or use the included smoke script:

```powershell
python test_server.py 127.0.0.1 8000
```

## Endpoints

| Method | Path                          | What it does                              |
| ------ | ----------------------------- | ----------------------------------------- |
| GET    | `/health`                     | Server + GPU + backend status             |
| GET    | `/models`                     | List available SFX backends               |
| GET    | `/templates`                  | Built-in prompt templates                 |
| POST   | `/generate`                   | Generate N variations from a free prompt  |
| POST   | `/generate/template`          | Generate from a `(category, variant)`     |
| GET    | `/audio/{filename}`           | Stream a generated WAV                    |
| GET    | `/library`                    | List saved sounds (search / filter)       |
| POST   | `/library/{id}/favorite`      | Toggle favorite                           |
| POST   | `/library/{id}/tags`          | Update tags                               |
| DELETE | `/library/{id}`               | Delete entry + file                       |

## Layout

```
server/
├── server.py              # FastAPI app — routes + lifespan
├── inference.py           # Backend manager (discover, load, dispatch)
├── audio_processing.py    # normalize / trim silence / fade / save_wav
├── prompt_templates.py    # SFX recipe templates by category
├── models.py              # Pydantic request/response models
├── db.py                  # SQLite library cache (no ORM)
├── config.py              # Pydantic-Settings (.env loader)
├── backends/              # Backend registry + adapters
│   ├── base.py
│   ├── registry.py
│   └── stable_audio.py    # Stable Audio Open via diffusers
├── requirements.txt
├── .env.example
└── generated/             # Auto-created on startup, holds WAVs
```

## Adding a new backend

1. Create `backends/<your_backend>.py` with a class that exposes:
   `load()`, `unload()`, `generate(prompt, duration, *, seed, steps, guidance_scale)`
   plus a `info: BackendInfo` field. Use `stable_audio.py` as a reference.
2. At the bottom of the file: `register("<name>", _factory)`.
3. In `inference.py` add the import (`from backends import your_backend`)
   and an entry in `_BACKEND_TO_DIR` mapping the backend name to the folder
   under `SFX_MODELS_DIR`.
4. Restart. `/models` should list it; clients can pick it via the `model`
   field on `/generate`.

## Gotchas

- **Single GPU is sequential.** `/generate` schedules variations one after
  another — concurrent requests share the same GPU and will serialize.
- **VRAM fragmentation.** SAO uses ~3 GB at rest, ~4–5 GB peak. Long-running
  sessions can fragment VRAM; a server restart resets it.
- **Duration vs steps.** `duration > 10 s` with `steps=100` on an RTX 5090
  takes ~5–8 s per variation. Drop `steps` to 50 if you need it faster
  (small quality cost).
- **License.** Stable Audio Open is released under the Stability AI
  Community License. Commercial use is allowed for orgs whose yearly revenue
  is below **$1 M**; above that you need an Enterprise license.

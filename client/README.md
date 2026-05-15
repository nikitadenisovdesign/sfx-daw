# SFX DAW — Client

React 18 + Vite + TypeScript. Web Audio API + Canvas 2D timeline.

## Run

```bash
cd client
cp .env.example .env            # Windows: copy .env.example .env
# edit .env so VITE_API_URL points at your server, e.g.
#   VITE_API_URL=http://127.0.0.1:8000    (server on the same machine)
#   VITE_API_URL=http://192.168.1.42:8000 (server on a LAN box)
npm install
npm run dev
# open http://localhost:5173
```

If the backend isn’t up the UI still works in **degraded mode**: the server
health pill turns red and `/generate` returns an error, but the video player,
timeline, audio import, save/load and export keep working.

## Scripts

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Vite dev server with HMR              |
| `npm run build`   | Production bundle into `dist/`        |
| `npm run preview` | Preview the production bundle         |
| `npm run lint`    | Type-check the project (`tsc --noEmit`) |
| `npm run format`  | Prettier over `src/`                   |

## Hotkeys

| Key                | Action                                  |
| ------------------ | --------------------------------------- |
| `Space`            | Play / Stop (starts from the playhead)  |
| `Home`             | Jump playhead to 0                      |
| `S`                | Split selected clip(s) at the playhead  |
| `Del` / `Backspace`| Delete selected clip(s)                 |
| `Cmd/Ctrl + G`     | Focus the generate prompt textarea      |
| `Cmd/Ctrl + Wheel` | Zoom timeline (anchored under cursor)   |
| `Shift + Wheel`    | Horizontal scroll                       |
| `Alt + drag`       | Pan timeline                            |
| `Shift + click`    | Multi-select clips                      |

## Clip editing on the timeline

- **Move** — drag the body of a clip horizontally.
- **Trim** — drag the left or right edge (the cursor switches to `↔` within
  a 6 px hot-zone).
- **Split** — select a clip and press `S` to cut it at the playhead. Both
  halves are kept selected so you can keep slicing.
- **Volume keyframes** — when a clip is selected, a yellow polyline appears
  over its body. **Alt+click** inside the clip adds a point (X = time inside
  the clip, Y = volume 0..1). **Alt+click** on an existing point removes it.
  **Drag** a point to move it. The audio engine ramps between points with
  `linearRampToValueAtTime`.

## Architecture notes

**State is split into three Zustand stores** — `project` (tracks/clips),
`mixer` (per-track volume/pan/mute/solo) and `ui` (playhead, selection,
zoom, preview state). This lets the fader and the playhead repaint
without churning the whole project tree.

**Audio engine is a singleton.** One `AudioContext` lives for the whole
session. Every clip plays through the same graph: `AudioBuffer →
BufferSource → GainNode (clip gain + envelope) → TrackBus.gain → master →
destination`.

**Video↔audio sync** — the audio engine is the clock master (sample-accurate
requirement). The `<video>` element listens to the playhead and resyncs if it
drifts more than 50 ms. That’s fine for SFX work; sample-accurate music
production would need a stricter approach (vNext).

**Timeline rendering is plain Canvas 2D**, not React. Otherwise four tracks
× 100 clips trigger ~400 reconciliation passes per frame. A pure
`drawTimeline()` function is called from `useEffect` whenever any of its
arguments change.

**Waveform peaks** are computed once when a clip is first loaded
(`computePeaks()` — 256-sample bins, min/max). The cache lives in
`useAudioEngine` keyed by URL, so the same source isn’t recomputed across
clips that reuse it.

**Export** runs through `OfflineAudioContext`. Very long projects (>5 min ×
8 tracks) can pressure memory; vNext: chunked rendering or server-side
ffmpeg.

## Layout

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/       # Transport, VideoPlayer, Timeline, Mixer,
│                     # GeneratePanel, SoundBrowser
├── hooks/            # useAudioEngine, useGenerateSFX, useImportAudio,
│                     # useExport, useProject, useServerHealth
├── store/            # projectStore, mixerStore, uiStore (Zustand)
├── audio/            # AudioGraph, PlaybackEngine, ExportEngine
├── canvas/           # TimelineRenderer, WaveformRenderer, ClipRenderer
├── lib/              # api, format helpers, wav encoder
└── types/            # shared domain types
```

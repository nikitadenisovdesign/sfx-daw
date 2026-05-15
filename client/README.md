# SFX DAW — Client

React 18 + Vite + TypeScript. Web Audio API + Canvas 2D таймлайн.

## Запуск

```bash
cd client
cp .env.example .env
# отредактируй: VITE_API_URL=http://192.168.x.x:8000
npm install
npm run dev
# open http://localhost:5173
```

Если бэкенд ещё не запущен — UI работает в degraded mode (статус сервера красный,
генерация даст ошибку, но видеоплеер/таймлайн/импорт/экспорт работают).

## Скрипты

| Скрипт          | Что делает                      |
|-----------------|---------------------------------|
| `npm run dev`   | Vite dev-сервер + HMR           |
| `npm run build` | Прод-бандл в `dist/`            |
| `npm run preview` | Превью прод-бандла            |
| `npm run lint`  | Type-check (tsc --noEmit)       |

## Хоткеи

| Клавиша          | Действие                            |
|------------------|-------------------------------------|
| `Space`          | Play / Stop                         |
| `Home`           | Перемотка в начало                  |
| `Del` / `Backspace` | Удалить выбранный клип            |
| `Cmd/Ctrl + G`   | Фокус на поле промпта               |
| `Cmd/Ctrl + Wheel` | Zoom таймлайна (под курсором)     |
| `Shift + Wheel`  | Горизонтальный скролл               |
| `Alt + drag`     | Pan таймлайна                       |
| `Shift + click`  | Множественный выбор клипов          |

## Структура

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── components/        # Transport, VideoPlayer, Timeline, Mixer, GeneratePanel, SoundBrowser
├── hooks/             # useAudioEngine, useGenerateSFX, useExport, useProject, useServerHealth
├── store/             # projectStore, mixerStore, uiStore (Zustand)
├── audio/             # AudioGraph, PlaybackEngine, ExportEngine
├── canvas/            # TimelineRenderer, WaveformRenderer, ClipRenderer
├── lib/               # api, format, wav (encoder)
└── types/             # доменные типы
```

## Архитектурные заметки

**Стейт разделён на три стора** — `project` (треки/клипы), `mixer` (громкости),
`ui` (плейхед/выделение/zoom). Это позволяет фейдерам и плейхеду перерисовываться
без дёрганья всего проекта.

**Audio engine — singleton**. Один `AudioContext` живёт всё приложение.
Все клипы проигрываются через единый граф: `AudioBuffer → BufferSource → GainNode (clip+fade) → TrackBus.gain → master → destination`.

**Синхронизация video↔audio** — мастером является audio engine
(требование sample-accurate). Видео слушает плейхед и подкручивается, если
расходится больше 50ms. Это нормально для SFX; для саунд-дизайна музыкальных
клипов нужен sample-accurate подход (vNext).

**Рендеринг таймлайна — Canvas 2D**. Не React — иначе на 4 трека × 100 клипов
дёргаются ~400 reconcilation-проходов на кадр. Чистая `drawTimeline()` функция
вызывается из `useEffect` при изменении любого аргумента.

**Waveforms** считаются один раз при загрузке клипа (`computePeaks()` —
блоки по 256 сэмплов, min/max). Кэш живёт в `useAudioEngine` (Map по url).

**Экспорт** — `OfflineAudioContext`. Для длинных проектов (>5 мин × 8 треков)
может упереться в RAM. vNext: chunked-rendering или серверный ffmpeg.

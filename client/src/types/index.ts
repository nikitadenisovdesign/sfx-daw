// === Core domain types — shared между store, audio engine, UI ===

export type Id = string;

export interface Project {
  id: Id;
  name: string;
  createdAt: string;
  updatedAt: string;
  framerate: number; // 24 / 25 / 30 / 60
  duration: number;  // секунды (= длительности видео если есть)
  video?: {
    src: string;     // blob URL или путь
    name: string;
    duration: number;
    width: number;
    height: number;
  };
  tracks: Track[];
}

export interface Track {
  id: Id;
  name: string;
  color: string;
  volume: number;   // 0..1
  pan: number;      // -1..1
  mute: boolean;    // персональный mute
  solo: boolean;
  clips: Clip[];
}

export interface ClipEnvelopePoint {
  /** Время от clip.start, в секундах. 0 = старт клипа, clip.duration = конец. */
  time: number;
  /** Множитель к baseGain клипа: 0..1. */
  value: number;
}

export interface Clip {
  id: Id;
  trackId: Id;
  /** Позиция начала на таймлайне в секундах. */
  start: number;
  /** Длительность клипа на таймлайне в секундах. */
  duration: number;
  /** Источник звука. */
  source: ClipSource;
  /** Громкость самого клипа (0..1) — умножается на громкость дорожки. */
  gain: number;
  /** Fade in/out в секундах. */
  fadeIn: number;
  fadeOut: number;
  /** Локальный offset внутри сэмпла, если триммили слева. */
  offset: number;
  /** Имя/подпись клипа в UI. */
  label: string;
  /** Опциональная огибающая громкости (multiplier 0..1). Sorted by time. */
  envelope?: ClipEnvelopePoint[];
}

export interface ClipSource {
  /** URL или blob: откуда грузим аудио. Для клипов из библиотеки — URL сервера. */
  url: string;
  /** Имя файла / стабильный id для дедупа. */
  filename: string;
  /** Полная длительность исходного сэмпла в секундах. */
  sourceDuration: number;
  sampleRate: number;
}

// === Mixer state (отдельный store, чтобы перерисовка фейдеров не дёргала всё) ===

export interface MixerChannel {
  trackId: Id;
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
}

// === Сгенерированные звуки (ответ сервера) ===

export interface GeneratedFile {
  filename: string;
  url: string; // относительный путь /audio/{filename}
  duration: number;
  seed: number;
  sample_rate: number;
  model: string;
}

export interface GenerateResponse {
  files: GeneratedFile[];
  prompt: string;
  duration: number;
  elapsed_ms: number;
  model: string;
}

export interface SoundMetadata {
  id: number;
  filename: string;
  url: string;
  prompt: string;
  duration: number;
  sample_rate: number;
  seed: number;
  category: string | null;
  tags: string[];
  favorite: boolean;
  created_at: string;
  model?: string | null;
}

export interface BackendInfoApi {
  name: string;
  label: string;
  description: string;
  sample_rate: number;
  max_duration_seconds: number;
  default_steps: number;
  default_guidance: number;
  license: string;
  tags: string[];
  loaded: boolean;
  vram_used_gb: number | null;
  error: string | null;
  is_default: boolean;
}

export interface ModelsResponse {
  default: string;
  items: BackendInfoApi[];
}

export interface TemplateInfo {
  category: string;
  variant: string;
  template: string;
  typical_duration: number;
  description: string;
}

export interface HealthStatus {
  status: "ok" | "loading" | "error" | "degraded";
  gpu: string | null;
  vram_total_gb: number | null;
  vram_used_gb: number | null;
  vram_free_gb: number | null;
  backends: BackendInfoApi[];
  default_backend: string;
  error?: string;
}

// === UI / view-state ===

export type Tool = "select" | "razor" | "fade";

export interface SelectionState {
  clipIds: Id[];
}

export interface ViewState {
  /** Пиксели на секунду на таймлайне — управляет zoom-ом. */
  pixelsPerSecond: number;
  /** Скролл таймлайна в секундах. */
  scrollSeconds: number;
  /** Текущая позиция плейхеда в секундах. */
  playheadSeconds: number;
  /** Высота одной дорожки в px. */
  trackHeight: number;
  selectedTool: Tool;
}

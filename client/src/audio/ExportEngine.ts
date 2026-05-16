// Оффлайн-рендер микса проекта через OfflineAudioContext.
// Возвращает один AudioBuffer — кодирование в WAV в lib/wav.ts.

import type { Project, Track } from "@/types";

const TARGET_SR = 44100;

export interface ExportOptions {
  sampleRate?: number;
  channels?: number;
  /** Загрузчик AudioBuffer по URL (например, из общего кэша). */
  loadBuffer: (url: string) => Promise<AudioBuffer>;
  /** Какие треки слышимы (учитывает mute/solo). Если undefined — все. */
  audibleTracks?: Set<string>;
  /** Громкости/панорамы (override): иначе берём из самих треков. */
  trackVolumes?: Record<string, number>;
  trackPans?: Record<string, number>;
  masterVolume?: number;
}

export interface ExportResult {
  buffer: AudioBuffer;
}

export async function exportProject(project: Project, opts: ExportOptions): Promise<ExportResult> {
  const sampleRate = opts.sampleRate ?? TARGET_SR;
  const channels = opts.channels ?? 2;
  const duration = Math.max(0.1, computeDuration(project.tracks));
  const length = Math.ceil(duration * sampleRate);

  const audible = opts.audibleTracks ?? new Set(project.tracks.map((t) => t.id));
  const tracks = project.tracks.filter((t) => audible.has(t.id));
  const buffer = await renderToBuffer(tracks, length, channels, sampleRate, opts);
  return { buffer };
}

function computeDuration(tracks: Track[]): number {
  let max = 0;
  for (const t of tracks) {
    for (const c of t.clips) {
      max = Math.max(max, c.start + c.duration);
    }
  }
  return max;
}

async function renderToBuffer(
  tracks: Track[],
  length: number,
  channels: number,
  sampleRate: number,
  opts: ExportOptions,
): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(channels, length, sampleRate);
  const master = ctx.createGain();
  master.gain.value = opts.masterVolume ?? 1.0;
  master.connect(ctx.destination);

  for (const track of tracks) {
    const tg = ctx.createGain();
    const tp = ctx.createStereoPanner();
    tg.gain.value = opts.trackVolumes?.[track.id] ?? track.volume;
    tp.pan.value = opts.trackPans?.[track.id] ?? track.pan;
    tp.connect(tg).connect(master);

    for (const clip of track.clips) {
      const buf = await opts.loadBuffer(clip.source.url);
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf;
      src.connect(g).connect(tp);

      const remaining = clip.duration;
      g.gain.setValueAtTime(clip.fadeIn > 0 ? 0 : clip.gain, clip.start);
      if (clip.fadeIn > 0) {
        g.gain.linearRampToValueAtTime(clip.gain, clip.start + clip.fadeIn);
      }
      if (clip.fadeOut > 0 && remaining > clip.fadeOut) {
        g.gain.setValueAtTime(clip.gain, clip.start + remaining - clip.fadeOut);
        g.gain.linearRampToValueAtTime(0, clip.start + remaining);
      }

      src.start(clip.start, clip.offset, remaining);
    }
  }

  return await ctx.startRendering();
}

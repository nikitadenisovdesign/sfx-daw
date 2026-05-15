// Плеер: распределяет клипы по сетке Web Audio.
//
// Главная идея: при play() для каждого клипа, который должен звучать в этом
// плейбэке, создаётся собственный AudioBufferSourceNode + GainNode (для fade)
// и шедулится с offset-ом в глобальной шкале AudioContext.currentTime.

import type { Clip, ClipEnvelopePoint, Track } from "@/types";
import { AudioBufferCache, MixerGraph } from "./AudioGraph";

/** Linear interpolation between adjacent envelope points; clamps outside. */
function interpolateEnvelope(points: ClipEnvelopePoint[], t: number): number {
  if (points.length === 0) return 1;
  if (t <= points[0].time) return points[0].value;
  if (t >= points[points.length - 1].time) return points[points.length - 1].value;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    if (t >= a.time && t <= b.time) {
      const span = b.time - a.time;
      if (span <= 0) return a.value;
      const f = (t - a.time) / span;
      return a.value + f * (b.value - a.value);
    }
  }
  return points[points.length - 1].value;
}

export class PlaybackEngine {
  readonly ctx: AudioContext;
  readonly mixer: MixerGraph;
  readonly cache: AudioBufferCache;

  private active: { source: AudioBufferSourceNode; gain: GainNode }[] = [];
  private activePreview: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private currentPreviewUrl: string | null = null;
  private previewListeners: Array<(url: string | null) => void> = [];
  private startTimeCtx = 0;     // ctx.currentTime когда мы стартанули
  private startTimeProject = 0; // позиция в проекте при старте
  private isPlaying = false;
  private rafId: number | null = null;
  private onTick: ((time: number) => void) | null = null;

  constructor() {
    this.ctx = new AudioContext({ latencyHint: "interactive" });
    this.mixer = new MixerGraph(this.ctx);
    this.cache = new AudioBufferCache(this.ctx);
  }

  setOnTick(fn: ((time: number) => void) | null): void {
    this.onTick = fn;
  }

  /** Подготовить (загрузить и декодировать) все звуки в проекте. */
  async preload(tracks: Track[]): Promise<void> {
    const urls = new Set<string>();
    for (const t of tracks) for (const c of t.clips) urls.add(c.source.url);
    await Promise.all(Array.from(urls).map((u) => this.cache.load(u)));
  }

  /** URL клипа, который сейчас играет в preview, или null. */
  get previewUrl(): string | null {
    return this.currentPreviewUrl;
  }

  /** Подписаться на смену preview-источника. Возвращает unsubscribe. */
  onPreviewChange(fn: (url: string | null) => void): () => void {
    this.previewListeners.push(fn);
    return () => {
      this.previewListeners = this.previewListeners.filter((f) => f !== fn);
    };
  }

  private setPreviewUrl(url: string | null): void {
    if (url === this.currentPreviewUrl) return;
    this.currentPreviewUrl = url;
    for (const f of this.previewListeners) f(url);
  }

  /** Остановить текущий preview, если он играет. */
  stopPreview(): void {
    if (!this.activePreview) {
      this.setPreviewUrl(null);
      return;
    }
    const { source, gain } = this.activePreview;
    try { source.stop(); source.disconnect(); gain.disconnect(); } catch { /* */ }
    this.activePreview = null;
    this.setPreviewUrl(null);
  }

  /** Сыграть один клип сразу (для preview из библиотеки). Прерывает текущий preview. */
  async previewOnce(url: string, gain = 0.9): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.stopPreview();
    const buf = await this.cache.load(url);
    // Пока ждали decode, мог стартовать другой preview — не наслаиваемся.
    this.stopPreview();
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g).connect(this.mixer.master);
    src.start();
    const entry = { source: src, gain: g };
    this.activePreview = entry;
    this.setPreviewUrl(url);
    src.onended = () => {
      try { src.disconnect(); g.disconnect(); } catch { /* */ }
      if (this.activePreview === entry) {
        this.activePreview = null;
        this.setPreviewUrl(null);
      }
    };
  }

  /** Запустить воспроизведение проекта с позиции startSeconds. */
  async play(tracks: Track[], startSeconds: number, audibleTracks: Set<string>): Promise<void> {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    this.stop();

    this.isPlaying = true;
    this.startTimeCtx = this.ctx.currentTime + 0.05; // small lookahead
    this.startTimeProject = startSeconds;

    for (const track of tracks) {
      if (!audibleTracks.has(track.id)) continue;
      const dest = this.mixer.destination(track.id);
      for (const clip of track.clips) {
        this.scheduleClip(clip, dest, startSeconds);
      }
    }

    this.tick();
  }

  private scheduleClip(clip: Clip, destination: AudioNode, startSeconds: number): void {
    // Используем peek — если буфер уже в кэше, схватим его без сетевого запроса.
    // Если нет — кладём в очередь загрузки и шедулим как только декодируется.
    const pending = this.cache.peek(clip.source.url) ?? this.cache.load(clip.source.url);

    pending.then((decoded) => {
      // если плейхед уже прошёл за конец клипа — пропускаем
      const clipEnd = clip.start + clip.duration;
      if (clipEnd <= startSeconds) return;

      const src = this.ctx.createBufferSource();
      const g = this.ctx.createGain();
      src.buffer = decoded;
      src.connect(g).connect(destination);

      const now = this.ctx.currentTime;
      // Когда стартует клип в "проектной" шкале → переводим в "ctx" шкалу
      const projectStartOfClip = Math.max(clip.start, startSeconds);
      const offsetInClip = clip.offset + (projectStartOfClip - clip.start);
      const ctxStart = this.startTimeCtx + (projectStartOfClip - startSeconds);
      const remaining = Math.max(0, clipEnd - projectStartOfClip);

      // Громкость клипа. Если есть огибающая (envelope) — используем её,
      // иначе старая логика fadeIn/fadeOut.
      const baseGain = clip.gain;
      const env = clip.envelope ?? [];
      // localStart — секунды от clip.start, с которых мы реально слышим клип.
      const localStart = projectStartOfClip - clip.start;
      if (env.length > 0) {
        // Сортируем + добавляем неявные граничные точки.
        const pts = [...env]
          .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
          .sort((a, b) => a.time - b.time);
        if (pts.length === 0 || pts[0].time > 0) {
          pts.unshift({ time: 0, value: pts[0]?.value ?? 1 });
        }
        if (pts[pts.length - 1].time < clip.duration) {
          pts.push({ time: clip.duration, value: pts[pts.length - 1].value });
        }
        // Начальное значение в момент ctxStart — интерполяция в localStart.
        const startVal = interpolateEnvelope(pts, localStart);
        const t0 = Math.max(now, ctxStart);
        g.gain.cancelScheduledValues(t0);
        g.gain.setValueAtTime(baseGain * startVal, t0);
        for (const pt of pts) {
          if (pt.time <= localStart) continue;
          const tCtx = ctxStart + (pt.time - localStart);
          g.gain.linearRampToValueAtTime(baseGain * pt.value, tCtx);
        }
      } else {
        g.gain.setValueAtTime(clip.fadeIn > 0 ? 0 : baseGain, Math.max(now, ctxStart));
        if (clip.fadeIn > 0) {
          g.gain.linearRampToValueAtTime(baseGain, ctxStart + clip.fadeIn);
        }
        if (clip.fadeOut > 0 && remaining > clip.fadeOut) {
          g.gain.setValueAtTime(baseGain, ctxStart + remaining - clip.fadeOut);
          g.gain.linearRampToValueAtTime(0, ctxStart + remaining);
        }
      }

      src.start(ctxStart, offsetInClip, remaining);

      const entry = { source: src, gain: g };
      this.active.push(entry);
      src.onended = () => {
        try { src.disconnect(); g.disconnect(); } catch { /* */ }
        this.active = this.active.filter((e) => e !== entry);
      };
    }).catch(() => { /* ignore */ });
  }

  private tick = (): void => {
    if (!this.isPlaying) return;
    const projectTime = this.startTimeProject + (this.ctx.currentTime - this.startTimeCtx);
    this.onTick?.(projectTime);
    this.rafId = requestAnimationFrame(this.tick);
  };

  stop(): void {
    this.isPlaying = false;
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    for (const { source, gain } of this.active) {
      try { source.stop(); source.disconnect(); gain.disconnect(); } catch { /* */ }
    }
    this.active = [];
    this.stopPreview();
  }

  isRunning(): boolean {
    return this.isPlaying;
  }

  dispose(): void {
    this.stop();
    this.mixer.dispose();
    void this.ctx.close();
  }
}

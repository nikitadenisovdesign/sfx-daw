// Рисует временную шкалу (ruler), грид-линии и плейхед.
// Чистая функция: всё нужное — в TimelineDrawArgs.

import type { Clip, ClipEnvelopePoint, Track } from "@/types";
import { clipColors } from "./ClipRenderer";

export interface TimelineDrawArgs {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  pixelsPerSecond: number;
  scrollSeconds: number;
  playheadSeconds: number;
  framerate: number;
  tracks: Track[];
  trackHeight: number;
  rulerHeight: number;
  selectedClipIds: Set<string>;
  hoverClipId?: string | null;
  /** Кэш waveform-пиков по url. */
  waveformPeaks?: Map<string, Float32Array>;
}

const COLORS = {
  bg: "#0b0b0d",
  rulerBg: "#131318",
  rulerText: "#8a8a98",
  gridMajor: "rgba(255,255,255,0.06)",
  gridMinor: "rgba(255,255,255,0.03)",
  trackDivider: "#1a1a22",
  trackBgEven: "#0e0e12",
  trackBgOdd: "#0b0b0d",
  playhead: "#ff5050",
};

export function drawTimeline(args: TimelineDrawArgs): void {
  const { ctx, width, height, rulerHeight, tracks, trackHeight } = args;
  ctx.save();
  ctx.imageSmoothingEnabled = false;

  // bg
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  // track lanes background
  tracks.forEach((_, i) => {
    const y = rulerHeight + i * trackHeight;
    ctx.fillStyle = i % 2 === 0 ? COLORS.trackBgEven : COLORS.trackBgOdd;
    ctx.fillRect(0, y, width, trackHeight);
  });

  drawGrid(args);
  drawRuler(args);

  // clips
  tracks.forEach((track, i) => {
    const y = rulerHeight + i * trackHeight + 4;
    const h = trackHeight - 8;
    track.clips.forEach((clip) => drawClip(args, clip, track, y, h));
  });

  // track dividers
  ctx.strokeStyle = COLORS.trackDivider;
  ctx.lineWidth = 1;
  for (let i = 0; i <= tracks.length; i++) {
    const y = rulerHeight + i * trackHeight + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  drawPlayhead(args);
  ctx.restore();
}

function drawGrid(a: TimelineDrawArgs): void {
  const { ctx, width, height, rulerHeight, pixelsPerSecond, scrollSeconds } = a;
  const step = niceStep(pixelsPerSecond);
  const startSec = Math.floor(scrollSeconds / step) * step;
  const endSec = scrollSeconds + width / pixelsPerSecond;

  ctx.lineWidth = 1;
  for (let s = startSec; s <= endSec + step; s += step) {
    const x = Math.round((s - scrollSeconds) * pixelsPerSecond) + 0.5;
    if (x < 0 || x > width) continue;
    ctx.strokeStyle = isMajor(s, step) ? COLORS.gridMajor : COLORS.gridMinor;
    ctx.beginPath();
    ctx.moveTo(x, rulerHeight);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
}

function drawRuler(a: TimelineDrawArgs): void {
  const { ctx, width, rulerHeight, pixelsPerSecond, scrollSeconds, framerate } = a;
  ctx.fillStyle = COLORS.rulerBg;
  ctx.fillRect(0, 0, width, rulerHeight);

  const step = niceStep(pixelsPerSecond);
  const startSec = Math.floor(scrollSeconds / step) * step;
  const endSec = scrollSeconds + width / pixelsPerSecond;

  ctx.fillStyle = COLORS.rulerText;
  ctx.font = "10px ui-monospace, SF Mono, monospace";
  ctx.textBaseline = "middle";
  for (let s = startSec; s <= endSec + step; s += step) {
    const x = Math.round((s - scrollSeconds) * pixelsPerSecond);
    if (x < 0 || x > width) continue;
    ctx.beginPath();
    ctx.moveTo(x + 0.5, rulerHeight - 6);
    ctx.lineTo(x + 0.5, rulerHeight);
    ctx.strokeStyle = COLORS.rulerText;
    ctx.stroke();
    ctx.fillText(formatRulerLabel(s, framerate), x + 4, rulerHeight / 2);
  }

  ctx.strokeStyle = "#222230";
  ctx.beginPath();
  ctx.moveTo(0, rulerHeight + 0.5);
  ctx.lineTo(width, rulerHeight + 0.5);
  ctx.stroke();
}

export const ENVELOPE_POINT_RADIUS = 4;

function drawClip(a: TimelineDrawArgs, clip: Clip, track: Track, y: number, h: number): void {
  const { ctx, pixelsPerSecond, scrollSeconds, selectedClipIds } = a;
  const x = Math.round((clip.start - scrollSeconds) * pixelsPerSecond);
  const w = Math.max(2, Math.round(clip.duration * pixelsPerSecond));
  if (x + w < 0 || x > a.width) return;

  const selected = selectedClipIds.has(clip.id);
  const colors = clipColors(track.color);

  // body
  ctx.fillStyle = colors.fill;
  roundRect(ctx, x, y, w, h, 4);
  ctx.fill();

  // waveform (если есть пики)
  const peaks = a.waveformPeaks?.get(clip.source.url);
  if (peaks && peaks.length > 0) {
    drawWaveformPeaks(ctx, peaks, x, y + 4, w, h - 8, colors.waveform, clip);
  }

  // borders
  ctx.strokeStyle = selected ? "#fff" : colors.border;
  ctx.lineWidth = selected ? 1.5 : 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 4);
  ctx.stroke();

  // label
  if (w > 30) {
    ctx.fillStyle = "#fff";
    ctx.font = "10px -apple-system, Inter, sans-serif";
    ctx.textBaseline = "top";
    const label = ellipsis(clip.label, ctx, w - 8);
    ctx.fillText(label, x + 4, y + 3);
  }

  // volume envelope (только если клип выделен — иначе загромождает UI)
  if (selected && clip.envelope && clip.envelope.length > 0) {
    drawEnvelope(ctx, clip.envelope, x, y, w, h, clip.duration);
  }

  // fade triangles
  if (clip.fadeIn > 0) {
    const fw = Math.min(w, Math.round(clip.fadeIn * pixelsPerSecond));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x + fw, y);
    ctx.lineTo(x + fw, y + h);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
  }
  if (clip.fadeOut > 0) {
    const fw = Math.min(w, Math.round(clip.fadeOut * pixelsPerSecond));
    ctx.beginPath();
    ctx.moveTo(x + w - fw, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w - fw, y + h);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fill();
  }
}

/** Возвращает экранные координаты точки envelope относительно тела клипа. */
export function envelopePointToScreen(
  pt: ClipEnvelopePoint,
  clipX: number,
  clipY: number,
  clipW: number,
  clipH: number,
  clipDuration: number,
): { x: number; y: number } {
  const t = clipDuration > 0 ? Math.max(0, Math.min(1, pt.time / clipDuration)) : 0;
  const v = Math.max(0, Math.min(1, pt.value));
  return {
    x: clipX + t * clipW,
    y: clipY + (1 - v) * clipH,
  };
}

function drawEnvelope(
  ctx: CanvasRenderingContext2D,
  envelope: ClipEnvelopePoint[],
  x: number,
  y: number,
  w: number,
  h: number,
  duration: number,
): void {
  const pts = envelope
    .filter((p) => Number.isFinite(p.time) && Number.isFinite(p.value))
    .slice()
    .sort((a, b) => a.time - b.time);
  if (pts.length === 0) return;

  ctx.save();
  ctx.beginPath();
  // Линия с неявной точкой в 0 и в конце.
  const first = envelopePointToScreen(pts[0], x, y, w, h, duration);
  ctx.moveTo(x, first.y);
  ctx.lineTo(first.x, first.y);
  for (let i = 1; i < pts.length; i++) {
    const p = envelopePointToScreen(pts[i], x, y, w, h, duration);
    ctx.lineTo(p.x, p.y);
  }
  const last = envelopePointToScreen(pts[pts.length - 1], x, y, w, h, duration);
  ctx.lineTo(x + w, last.y);
  ctx.strokeStyle = "rgba(255, 220, 80, 0.85)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Точки
  for (const pt of pts) {
    const p = envelopePointToScreen(pt, x, y, w, h, duration);
    ctx.beginPath();
    ctx.arc(p.x, p.y, ENVELOPE_POINT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 220, 80, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();
}

function drawWaveformPeaks(
  ctx: CanvasRenderingContext2D,
  peaks: Float32Array,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  clip: Clip,
): void {
  const sr = clip.source.sampleRate;
  // peaks: пары (min,max) рассчитанные при загрузке. Здесь предполагаем
  // что пики усреднены по 256-сэмпловым блокам (см. WaveformRenderer.computePeaks).
  const blockSamples = 256;
  const blocksPerSecond = sr / blockSamples;
  const startBlock = Math.floor(clip.offset * blocksPerSecond);
  const endBlock = Math.floor((clip.offset + clip.duration) * blocksPerSecond);
  const totalBlocks = endBlock - startBlock;
  if (totalBlocks <= 0) return;

  ctx.fillStyle = color;
  const mid = y + h / 2;
  for (let px = 0; px < w; px++) {
    const blockIdx = startBlock + Math.floor((px / w) * totalBlocks);
    const i = blockIdx * 2;
    if (i + 1 >= peaks.length) break;
    const minV = peaks[i];
    const maxV = peaks[i + 1];
    const yMin = mid - maxV * (h / 2);
    const yMax = mid - minV * (h / 2);
    ctx.fillRect(x + px, yMin, 1, Math.max(1, yMax - yMin));
  }
}

function drawPlayhead(a: TimelineDrawArgs): void {
  const { ctx, height, pixelsPerSecond, scrollSeconds, playheadSeconds } = a;
  const x = Math.round((playheadSeconds - scrollSeconds) * pixelsPerSecond) + 0.5;
  if (x < 0 || x > a.width) return;
  ctx.strokeStyle = COLORS.playhead;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
  // head
  ctx.fillStyle = COLORS.playhead;
  ctx.beginPath();
  ctx.moveTo(x - 5, 0);
  ctx.lineTo(x + 5, 0);
  ctx.lineTo(x, 8);
  ctx.closePath();
  ctx.fill();
}

// === helpers ===

function niceStep(pxPerSec: number): number {
  // Желаемый минимальный шаг ~80px. Выбираем красивый круглый.
  const target = 80 / pxPerSec; // секунд между линиями
  const candidates = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60];
  for (const c of candidates) if (c >= target) return c;
  return 60;
}

function isMajor(seconds: number, step: number): boolean {
  // Каждые 4 деления — мажорная линия
  return Math.round(seconds / step) % 4 === 0;
}

function formatRulerLabel(s: number, fps: number): string {
  if (s < 1) return `${Math.round(s * 1000)}ms`;
  if (s < 60) {
    const frames = Math.round((s % 1) * fps);
    return frames > 0
      ? `${Math.floor(s)}s${String(frames).padStart(2, "0")}`
      : `${Math.floor(s)}s`;
  }
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function ellipsis(text: string, ctx: CanvasRenderingContext2D, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    const candidate = text.slice(0, mid) + "…";
    if (ctx.measureText(candidate).width <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return text.slice(0, lo) + "…";
}

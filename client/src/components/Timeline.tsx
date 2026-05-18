// Канвас-таймлайн с дорожками. Левая колонка — track-headers (Mixer), справа — клипы.
// Клики по линейке двигают плейхед, drag&drop из библиотеки добавляет клипы,
// drag клипа двигает его по таймлайну.

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { drawTimeline, envelopePointToScreen } from "@/canvas/TimelineRenderer";
import type { ClipEnvelopePoint } from "@/types";

function hitTestEnvelope(
  envelope: ClipEnvelopePoint[],
  clipX: number,
  bodyY: number,
  clipW: number,
  bodyH: number,
  duration: number,
  px: number,
  py: number,
): number {
  for (let i = 0; i < envelope.length; i++) {
    const s = envelopePointToScreen(envelope[i], clipX, bodyY, clipW, bodyH, duration);
    if (Math.hypot(s.x - px, s.y - py) <= 7) return i;
  }
  return -1;
}
import { TrackHeader } from "./Mixer";
import { snapToFrame } from "@/lib/format";

const RULER_HEIGHT = 24;
const HEADER_WIDTH = 160;

interface DragState {
  type: "playhead" | "clip" | "scroll" | "trim-left" | "trim-right" | "envelope-point";
  clipId?: string;
  envelopeIndex?: number;
  startX: number;
  origStart: number;
  origScroll: number;
  origOffset?: number;
  origDuration?: number;
}

const EDGE_PX = 6;

export function Timeline(): JSX.Element {
  const project = useProjectStore((s) => s.project);
  const view = useUIStore();
  const { peaks, ensurePeaks } = useAudioEngine();

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 400 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // 1) Resize observer
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width - HEADER_WIDTH), h: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 2) Лоадим пики для всех клипов в проекте (для волны)
  useEffect(() => {
    const urls = new Set<string>();
    for (const t of project.tracks) for (const c of t.clips) urls.add(c.source.url);
    urls.forEach((u) => { void ensurePeaks(u); });
  }, [project.tracks, ensurePeaks]);

  // Высота, на которой нужно рисовать все дорожки (включая ниже viewport-а
  // pane-а — pane скроллится). Растёт когда добавляется новая дорожка.
  const drawHeight = RULER_HEIGHT + project.tracks.length * view.trackHeight;

  // 3) Перерисовка
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio ?? 1;
    const h = Math.max(size.h, drawHeight);
    canvas.width = size.w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawTimeline({
      ctx,
      width: size.w,
      height: h,
      pixelsPerSecond: view.pixelsPerSecond,
      scrollSeconds: view.scrollSeconds,
      playheadSeconds: view.playheadSeconds,
      framerate: project.framerate,
      tracks: project.tracks,
      trackHeight: view.trackHeight,
      rulerHeight: RULER_HEIGHT,
      selectedClipIds: new Set(view.selectedClipIds),
      waveformPeaks: peaks,
    });
  }, [size, drawHeight, view.pixelsPerSecond, view.scrollSeconds, view.playheadSeconds,
      view.trackHeight, view.selectedClipIds, project.tracks, project.framerate, peaks]);

  // 4) Mouse / wheel handlers
  const xToSeconds = (clientX: number): number => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return view.scrollSeconds + (clientX - rect.left) / view.pixelsPerSecond;
  };

  const yToTrackIndex = (clientY: number): number => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return Math.floor((clientY - rect.top - RULER_HEIGHT) / view.trackHeight);
  };

  const findClipAt = (sec: number, trackIdx: number): { trackId: string; clipId: string } | null => {
    if (trackIdx < 0 || trackIdx >= project.tracks.length) return null;
    const track = project.tracks[trackIdx];
    for (const c of track.clips) {
      if (sec >= c.start && sec <= c.start + c.duration) {
        return { trackId: track.id, clipId: c.id };
      }
    }
    return null;
  };

  const onMouseDown = (e: React.MouseEvent): void => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const yLocal = e.clientY - rect.top;
    const sec = xToSeconds(e.clientX);
    if (yLocal < RULER_HEIGHT) {
      // Клик по линейке — переставляем плейхед
      const newPos = snapToFrame(Math.max(0, sec), project.framerate);
      view.setPlayhead(newPos);
      setDrag({ type: "playhead", startX: e.clientX, origStart: newPos, origScroll: view.scrollSeconds });
      return;
    }
    const trackIdx = yToTrackIndex(e.clientY);
    const hit = findClipAt(sec, trackIdx);
    if (hit) {
      const wasSelected = useUIStore.getState().selectedClipIds.includes(hit.clipId);
      view.selectClip(hit.clipId, e.shiftKey);
      const clip = project.tracks.find((t) => t.id === hit.trackId)!.clips.find((c) => c.id === hit.clipId)!;
      const leftPx = (clip.start - view.scrollSeconds) * view.pixelsPerSecond;
      const rightPx = leftPx + clip.duration * view.pixelsPerSecond;
      const xLocal = e.clientX - rect.left;
      // Тело клипа на экране (для envelope hit-testing).
      const trackTop = RULER_HEIGHT + trackIdx * view.trackHeight;
      const bodyY = trackTop + 4;
      const bodyH = view.trackHeight - 8;
      const envHit = (wasSelected && clip.envelope)
        ? hitTestEnvelope(clip.envelope, leftPx, bodyY, rightPx - leftPx, bodyH, clip.duration, xLocal, yLocal)
        : -1;

      // Alt+click — добавить или удалить точку envelope.
      if (e.altKey) {
        if (envHit >= 0) {
          useProjectStore.getState().removeEnvelopePoint(hit.clipId, envHit);
        } else {
          // Добавить точку — позиция мыши -> (time, value).
          const localTime = Math.max(0, Math.min(clip.duration, sec - clip.start));
          const bodyV = bodyH > 0 ? 1 - (yLocal - bodyY) / bodyH : 1;
          const value = Math.max(0, Math.min(1, bodyV));
          useProjectStore.getState().addEnvelopePoint(hit.clipId, { time: localTime, value });
        }
        return;
      }

      // Drag existing envelope point (только если клип был выделен).
      if (envHit >= 0) {
        setDrag({
          type: "envelope-point",
          clipId: hit.clipId,
          envelopeIndex: envHit,
          startX: e.clientX,
          origStart: 0,
          origScroll: view.scrollSeconds,
        });
        return;
      }

      // Trim handles.
      const nearLeft = Math.abs(xLocal - leftPx) <= EDGE_PX;
      const nearRight = Math.abs(xLocal - rightPx) <= EDGE_PX;
      if (nearLeft || nearRight) {
        setDrag({
          type: nearLeft ? "trim-left" : "trim-right",
          clipId: hit.clipId,
          startX: e.clientX,
          origStart: clip.start,
          origScroll: view.scrollSeconds,
          origOffset: clip.offset,
          origDuration: clip.duration,
        });
        return;
      }
      setDrag({
        type: "clip",
        clipId: hit.clipId,
        startX: e.clientX,
        origStart: clip.start,
        origScroll: view.scrollSeconds,
      });
    } else {
      view.clearSelection();
      // средний клик — пан/скролл (простой LMB-скролл при alt)
      if (e.altKey) {
        setDrag({ type: "scroll", startX: e.clientX, origStart: view.playheadSeconds, origScroll: view.scrollSeconds });
      }
    }
  };

  const onMouseMove = (e: React.MouseEvent): void => {
    if (!drag) {
      // Курсор у края клипа = "ew-resize" чтобы пользователь видел trim-зону.
      const rect = canvasRef.current!.getBoundingClientRect();
      const yLocal = e.clientY - rect.top;
      if (yLocal < RULER_HEIGHT) return;
      const sec = xToSeconds(e.clientX);
      const trackIdx = yToTrackIndex(e.clientY);
      const hit = findClipAt(sec, trackIdx);
      let cursor = "default";
      if (hit) {
        const clip = project.tracks.find((t) => t.id === hit.trackId)!.clips.find((c) => c.id === hit.clipId)!;
        const leftPx = (clip.start - view.scrollSeconds) * view.pixelsPerSecond;
        const rightPx = leftPx + clip.duration * view.pixelsPerSecond;
        const xLocal = e.clientX - rect.left;
        if (Math.abs(xLocal - leftPx) <= EDGE_PX || Math.abs(xLocal - rightPx) <= EDGE_PX) {
          cursor = "ew-resize";
        } else {
          cursor = "grab";
        }
      }
      canvasRef.current!.style.cursor = cursor;
      return;
    }
    const dxSec = (e.clientX - drag.startX) / view.pixelsPerSecond;
    if (drag.type === "playhead") {
      view.setPlayhead(snapToFrame(Math.max(0, drag.origStart + dxSec), project.framerate));
    } else if (drag.type === "clip" && drag.clipId) {
      const newStart = snapToFrame(Math.max(0, drag.origStart + dxSec), project.framerate);
      useProjectStore.getState().moveClip(drag.clipId, newStart);
    } else if (drag.type === "trim-left" && drag.clipId && drag.origOffset !== undefined && drag.origDuration !== undefined) {
      // Двигаем левый край: меняем start + offset, duration уменьшается.
      // Не позволяем offset уйти ниже 0 и duration ниже 0.05.
      const requestedStart = snapToFrame(Math.max(0, drag.origStart + dxSec), project.framerate);
      const consumed = requestedStart - drag.origStart;
      const newOffset = Math.max(0, drag.origOffset + consumed);
      // Корректируем consumed обратно если уперлись в offset=0.
      const actualConsumed = newOffset - drag.origOffset;
      const newStart = drag.origStart + actualConsumed;
      const newDuration = Math.max(0.05, drag.origDuration - actualConsumed);
      useProjectStore.getState().setClipBounds(drag.clipId, {
        start: newStart, offset: newOffset, duration: newDuration,
      });
    } else if (drag.type === "trim-right" && drag.clipId && drag.origDuration !== undefined) {
      const newDuration = Math.max(0.05, drag.origDuration + dxSec);
      useProjectStore.getState().setClipBounds(drag.clipId, { duration: newDuration });
    } else if (drag.type === "envelope-point" && drag.clipId && drag.envelopeIndex !== undefined) {
      const clip = useProjectStore.getState().findClip(drag.clipId);
      if (!clip) return;
      const trackIdx = project.tracks.findIndex((t) => t.id === clip.trackId);
      if (trackIdx < 0) return;
      const bodyY = RULER_HEIGHT + trackIdx * view.trackHeight + 4;
      const bodyH = view.trackHeight - 8;
      const rect = canvasRef.current!.getBoundingClientRect();
      const yLocal = e.clientY - rect.top;
      const sec = xToSeconds(e.clientX);
      const newTime = Math.max(0, Math.min(clip.duration, sec - clip.start));
      const newValue = bodyH > 0 ? Math.max(0, Math.min(1, 1 - (yLocal - bodyY) / bodyH)) : 1;
      const newIdx = useProjectStore.getState().updateEnvelopePoint(drag.clipId, drag.envelopeIndex, {
        time: newTime, value: newValue,
      });
      if (newIdx !== null && newIdx !== drag.envelopeIndex) {
        setDrag({ ...drag, envelopeIndex: newIdx });
      }
    } else if (drag.type === "scroll") {
      view.setScrollSeconds(Math.max(0, drag.origScroll - dxSec));
    }
  };

  const onMouseUp = (): void => setDrag(null);

  const onWheel = (e: React.WheelEvent): void => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const anchor = xToSeconds(e.clientX);
      view.zoomBy(e.deltaY < 0 ? 1.15 : 0.87, anchor);
    } else if (e.shiftKey) {
      view.setScrollSeconds(view.scrollSeconds + e.deltaY / view.pixelsPerSecond);
    } else {
      view.setScrollSeconds(view.scrollSeconds + e.deltaX / view.pixelsPerSecond);
    }
  };

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault();
    setDragOver(false);
    const data = e.dataTransfer.getData("application/sfx-clip");
    if (!data) return;
    const payload = JSON.parse(data) as {
      url: string; filename: string; duration: number; sample_rate: number; label?: string;
    };
    const sec = Math.max(0, xToSeconds(e.clientX));
    const trackIdx = Math.max(0, Math.min(project.tracks.length - 1, yToTrackIndex(e.clientY)));
    const trackId = project.tracks[trackIdx].id;
    await ensurePeaks(payload.url);
    useProjectStore.getState().addClip(
      trackId,
      {
        url: payload.url,
        filename: payload.filename,
        sourceDuration: payload.duration,
        sampleRate: payload.sample_rate,
      },
      snapToFrame(sec, project.framerate),
      payload.label,
    );
  };

  // Удаление выбранных клипов по Del / Backspace
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        const ids = useUIStore.getState().selectedClipIds;
        if (ids.length === 0) return;
        e.preventDefault();
        for (const id of ids) useProjectStore.getState().removeClip(id);
        useUIStore.getState().clearSelection();
      }
      if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) {
        const ids = useUIStore.getState().selectedClipIds;
        const at = useUIStore.getState().playheadSeconds;
        if (ids.length === 0) return;
        e.preventDefault();
        const newIds: string[] = [];
        for (const id of ids) {
          const right = useProjectStore.getState().splitClip(id, at);
          if (right) newIds.push(id, right);
          else newIds.push(id);
        }
        useUIStore.getState().selectClips(newIds);
      }
      if (e.key === "g" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        // hotkey для focus в generate textarea — если есть
        const ta = document.querySelector(".generate-pane textarea") as HTMLTextAreaElement | null;
        ta?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="timeline-pane"
      style={{ display: "grid", gridTemplateColumns: `${HEADER_WIDTH}px 1fr` }}
    >
      <div style={{ borderRight: "1px solid var(--border)", overflow: "hidden" }}>
        <div style={{ height: RULER_HEIGHT, background: "var(--bg-1)", borderBottom: "1px solid var(--border)" }} />
        {project.tracks.map((t) => (
          <TrackHeader key={t.id} track={t} height={view.trackHeight} />
        ))}
        <div style={{ padding: "6px 8px" }}>
          <button className="ghost" style={{ width: "100%", fontSize: 11 }}
            onClick={() => useProjectStore.getState().addTrack()}>+ Add Track</button>
        </div>
      </div>

      <div
        style={{ position: "relative", overflow: "hidden", minHeight: drawHeight }}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            cursor: drag ? (drag.type === "clip" ? "grabbing" : "ew-resize") : "default",
            outline: dragOver ? "2px dashed var(--accent)" : "none",
            outlineOffset: -2,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onWheel={onWheel}
        />
      </div>
    </div>
  );
}

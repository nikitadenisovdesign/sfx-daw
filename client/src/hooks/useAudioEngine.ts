// Singleton-хук audio engine. Один PlaybackEngine на всё приложение.

import { useCallback, useEffect } from "react";
import { create } from "zustand";
import { PlaybackEngine } from "@/audio/PlaybackEngine";
import { useUIStore } from "@/store/uiStore";
import { useMixerStore } from "@/store/mixerStore";
import { useProjectStore } from "@/store/projectStore";
import { computePeaks } from "@/canvas/WaveformRenderer";

let _engine: PlaybackEngine | null = null;

function getEngine(): PlaybackEngine {
  if (!_engine) _engine = new PlaybackEngine();
  return _engine;
}

// Глобальный store для пиков — иммутабельный, чтобы React видел изменения.
interface PeakStore {
  peaks: Map<string, Float32Array>;
  setPeak: (url: string, peak: Float32Array) => void;
}
const usePeakStore = create<PeakStore>((set) => ({
  peaks: new Map(),
  setPeak: (url, peak) =>
    set((s) => {
      if (s.peaks.has(url)) return s;
      const next = new Map(s.peaks);
      next.set(url, peak);
      return { peaks: next };
    }),
}));

export function useAudioEngine(): {
  engine: PlaybackEngine;
  peaks: Map<string, Float32Array>;
  ensurePeaks: (url: string) => Promise<Float32Array | null>;
} {
  const engine = getEngine();
  const peaks = usePeakStore((s) => s.peaks);
  const setPeak = usePeakStore((s) => s.setPeak);

  // 1) Прокидываем тик плейбэка в стор
  useEffect(() => {
    engine.setOnTick((t) => useUIStore.getState().setPlayhead(t));
    return () => engine.setOnTick(null);
  }, [engine]);

  // 1b) Зеркалим текущий preview-источник в UI store, чтобы карточки
  //     знали, играют ли они сейчас (▶ → ⏸).
  useEffect(() => {
    const unsub = engine.onPreviewChange((url) => {
      useUIStore.getState().setPreviewPlayingUrl(url);
    });
    return unsub;
  }, [engine]);

  // 2) Подписываемся на изменения микшера и зеркалим в граф
  useEffect(() => {
    const unsubMixer = useMixerStore.subscribe((state) => {
      engine.mixer.setMasterVolume(state.masterVolume);
      const project = useProjectStore.getState().project;
      const anySolo = state.hasAnySolo();
      for (const t of project.tracks) {
        const muted = state.trackMutes[t.id] ?? t.mute;
        const solo = state.trackSolos[t.id] ?? t.solo;
        const audible = !muted && (!anySolo || solo);
        const baseVol = state.trackVolumes[t.id] ?? t.volume;
        const pan = state.trackPans[t.id] ?? t.pan;
        engine.mixer.setTrackVolume(t.id, audible ? baseVol : 0);
        engine.mixer.setTrackPan(t.id, pan);
      }
    });
    return () => unsubMixer();
  }, [engine]);

  // 3) Helper для расчёта пиков. Идемпотентный.
  const ensurePeaks = useCallback(
    async (url: string): Promise<Float32Array | null> => {
      const existing = usePeakStore.getState().peaks.get(url);
      if (existing) return existing;
      try {
        const buf = await engine.cache.load(url);
        const p = computePeaks(buf);
        setPeak(url, p);
        return p;
      } catch {
        return null;
      }
    },
    [engine, setPeak],
  );

  return { engine, peaks, ensurePeaks };
}

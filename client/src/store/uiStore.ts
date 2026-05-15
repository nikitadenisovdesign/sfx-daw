import { create } from "zustand";
import type { Id, Tool, ViewState } from "@/types";

interface UIState extends ViewState {
  selectedClipIds: Id[];
  isPlaying: boolean;
  hoverPreviewUrl: string | null;
  /** URL клипа, проигрывающегося сейчас в preview-режиме (▶ на карточке). */
  previewPlayingUrl: string | null;
  serverHealthy: boolean | null;
  serverModelLoading: boolean;
  libraryRevision: number;

  // actions
  setPlayhead: (s: number) => void;
  setIsPlaying: (p: boolean) => void;
  setPixelsPerSecond: (px: number) => void;
  zoomBy: (factor: number, anchorSeconds?: number) => void;
  setScrollSeconds: (s: number) => void;
  setTool: (t: Tool) => void;
  setTrackHeight: (h: number) => void;

  selectClip: (id: Id, additive?: boolean) => void;
  selectClips: (ids: Id[]) => void;
  clearSelection: () => void;

  setHoverPreviewUrl: (url: string | null) => void;
  setPreviewPlayingUrl: (url: string | null) => void;
  setServerHealthy: (h: boolean | null, loading?: boolean) => void;
  bumpLibrary: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  pixelsPerSecond: 80,
  scrollSeconds: 0,
  playheadSeconds: 0,
  trackHeight: 60,
  selectedTool: "select",

  selectedClipIds: [],
  isPlaying: false,
  hoverPreviewUrl: null,
  previewPlayingUrl: null,
  serverHealthy: null,
  serverModelLoading: false,
  libraryRevision: 0,

  setPlayhead: (s) => set({ playheadSeconds: Math.max(0, s) }),
  setIsPlaying: (p) => set({ isPlaying: p }),

  setPixelsPerSecond: (px) => set({ pixelsPerSecond: Math.max(10, Math.min(800, px)) }),

  zoomBy: (factor, anchorSeconds) =>
    set((s) => {
      const newPx = Math.max(10, Math.min(800, s.pixelsPerSecond * factor));
      // Сохраняем якорь под курсором при зуме
      if (anchorSeconds !== undefined) {
        const anchorPxBefore = (anchorSeconds - s.scrollSeconds) * s.pixelsPerSecond;
        const newScroll = anchorSeconds - anchorPxBefore / newPx;
        return { pixelsPerSecond: newPx, scrollSeconds: Math.max(0, newScroll) };
      }
      return { pixelsPerSecond: newPx };
    }),

  setScrollSeconds: (s) => set({ scrollSeconds: Math.max(0, s) }),

  setTool: (selectedTool) => set({ selectedTool }),
  setTrackHeight: (trackHeight) => set({ trackHeight: Math.max(40, Math.min(160, trackHeight)) }),

  selectClip: (id, additive) =>
    set((s) => ({
      selectedClipIds: additive
        ? s.selectedClipIds.includes(id)
          ? s.selectedClipIds.filter((x) => x !== id)
          : [...s.selectedClipIds, id]
        : [id],
    })),
  selectClips: (selectedClipIds) => set({ selectedClipIds }),
  clearSelection: () => set({ selectedClipIds: [] }),

  setHoverPreviewUrl: (hoverPreviewUrl) => set({ hoverPreviewUrl }),
  setPreviewPlayingUrl: (previewPlayingUrl) => set({ previewPlayingUrl }),
  setServerHealthy: (h, loading) =>
    set({ serverHealthy: h, serverModelLoading: loading ?? false }),
  bumpLibrary: () => set((s) => ({ libraryRevision: s.libraryRevision + 1 })),
}));

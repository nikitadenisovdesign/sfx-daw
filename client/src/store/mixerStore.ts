import { create } from "zustand";
import type { Id } from "@/types";

interface MixerState {
  // master
  masterVolume: number;
  setMasterVolume: (v: number) => void;

  // per-track
  trackVolumes: Record<Id, number>;
  trackPans: Record<Id, number>;
  trackMutes: Record<Id, boolean>;
  trackSolos: Record<Id, boolean>;

  setTrackVolume: (trackId: Id, v: number) => void;
  setTrackPan: (trackId: Id, p: number) => void;
  toggleMute: (trackId: Id) => void;
  toggleSolo: (trackId: Id) => void;

  // Логика «есть ли активные solo» — нужна audio engine
  hasAnySolo: () => boolean;
  isAudibleTrack: (trackId: Id) => boolean;
}

export const useMixerStore = create<MixerState>((set, get) => ({
  masterVolume: 0.9,
  setMasterVolume: (v) => set({ masterVolume: Math.max(0, Math.min(1, v)) }),

  trackVolumes: {},
  trackPans: {},
  trackMutes: {},
  trackSolos: {},

  setTrackVolume: (trackId, v) =>
    set((s) => ({ trackVolumes: { ...s.trackVolumes, [trackId]: Math.max(0, Math.min(1, v)) } })),

  setTrackPan: (trackId, p) =>
    set((s) => ({ trackPans: { ...s.trackPans, [trackId]: Math.max(-1, Math.min(1, p)) } })),

  toggleMute: (trackId) =>
    set((s) => ({ trackMutes: { ...s.trackMutes, [trackId]: !s.trackMutes[trackId] } })),

  toggleSolo: (trackId) =>
    set((s) => ({ trackSolos: { ...s.trackSolos, [trackId]: !s.trackSolos[trackId] } })),

  hasAnySolo: () => Object.values(get().trackSolos).some(Boolean),

  isAudibleTrack: (trackId) => {
    const { trackMutes, trackSolos } = get();
    if (trackMutes[trackId]) return false;
    const anySolo = Object.values(trackSolos).some(Boolean);
    if (anySolo && !trackSolos[trackId]) return false;
    return true;
  },
}));

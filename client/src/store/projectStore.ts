import { create } from "zustand";
import { nanoid } from "nanoid";
import type { Clip, ClipEnvelopePoint, ClipSource, Id, Project, Track } from "@/types";

const TRACK_COLORS = [
  "var(--track-1)", "var(--track-2)", "var(--track-3)", "var(--track-4)",
  "var(--track-5)", "var(--track-6)", "var(--track-7)", "var(--track-8)",
];

const DEFAULT_TRACK_NAMES = ["SFX", "Foley", "Ambience", "Extra"];

function makeEmptyProject(): Project {
  const now = new Date().toISOString();
  const tracks: Track[] = DEFAULT_TRACK_NAMES.map((name, i) => ({
    id: nanoid(8),
    name,
    color: TRACK_COLORS[i % TRACK_COLORS.length],
    volume: 0.85,
    pan: 0,
    mute: false,
    solo: false,
    clips: [],
  }));
  return {
    id: nanoid(8),
    name: "Untitled",
    createdAt: now,
    updatedAt: now,
    framerate: 30,
    duration: 30,
    tracks,
  };
}

interface ProjectState {
  project: Project;

  // Project-level
  loadProject: (p: Project) => void;
  resetProject: () => void;
  setName: (name: string) => void;
  setFramerate: (fps: number) => void;
  setDuration: (seconds: number) => void;
  setVideo: (video: Project["video"]) => void;
  serialize: () => string;

  // Tracks
  addTrack: (name?: string) => Id;
  removeTrack: (trackId: Id) => void;
  renameTrack: (trackId: Id, name: string) => void;

  // Clips
  addClip: (trackId: Id, source: ClipSource, start: number, label?: string) => Id;
  moveClip: (clipId: Id, newStart: number, newTrackId?: Id) => void;
  trimClip: (clipId: Id, side: "left" | "right", deltaSeconds: number) => void;
  setClipBounds: (clipId: Id, bounds: { start?: number; offset?: number; duration?: number }) => void;
  setClipGain: (clipId: Id, gain: number) => void;
  setClipFade: (clipId: Id, fadeIn?: number, fadeOut?: number) => void;
  removeClip: (clipId: Id) => void;
  duplicateClip: (clipId: Id) => Id | null;
  splitClip: (clipId: Id, atSeconds: number) => Id | null;
  addEnvelopePoint: (clipId: Id, point: ClipEnvelopePoint) => number | null;
  updateEnvelopePoint: (clipId: Id, index: number, point: ClipEnvelopePoint) => number | null;
  removeEnvelopePoint: (clipId: Id, index: number) => void;
  clearEnvelope: (clipId: Id) => void;

  // Lookup helpers
  findClip: (clipId: Id) => Clip | undefined;
  findTrackOfClip: (clipId: Id) => Track | undefined;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: makeEmptyProject(),

  loadProject: (p) => set({ project: p }),
  resetProject: () => set({ project: makeEmptyProject() }),

  setName: (name) =>
    set((s) => ({ project: { ...s.project, name, updatedAt: new Date().toISOString() } })),

  setFramerate: (framerate) =>
    set((s) => ({ project: { ...s.project, framerate, updatedAt: new Date().toISOString() } })),

  setDuration: (seconds) =>
    set((s) => ({
      project: {
        ...s.project,
        duration: Math.max(1, seconds),
        updatedAt: new Date().toISOString(),
      },
    })),

  setVideo: (video) =>
    set((s) => ({
      project: {
        ...s.project,
        video,
        duration: video?.duration ?? s.project.duration,
        updatedAt: new Date().toISOString(),
      },
    })),

  serialize: () => JSON.stringify(get().project, null, 2),

  addTrack: (name) => {
    const id = nanoid(8);
    set((s) => {
      const i = s.project.tracks.length;
      const track: Track = {
        id,
        name: name ?? `Track ${i + 1}`,
        color: TRACK_COLORS[i % TRACK_COLORS.length],
        volume: 0.85,
        pan: 0,
        mute: false,
        solo: false,
        clips: [],
      };
      return { project: { ...s.project, tracks: [...s.project.tracks, track] } };
    });
    return id;
  },

  removeTrack: (trackId) =>
    set((s) => ({
      project: { ...s.project, tracks: s.project.tracks.filter((t) => t.id !== trackId) },
    })),

  renameTrack: (trackId, name) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
      },
    })),

  addClip: (trackId, source, start, label) => {
    const id = nanoid(8);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id !== trackId
            ? t
            : {
                ...t,
                clips: [
                  ...t.clips,
                  {
                    id,
                    trackId,
                    start,
                    duration: source.sourceDuration,
                    source,
                    gain: 1,
                    fadeIn: 0,
                    fadeOut: 0,
                    offset: 0,
                    label: label ?? source.filename,
                  },
                ],
              },
        ),
      },
    }));
    return id;
  },

  moveClip: (clipId, newStart, newTrackId) =>
    set((s) => {
      const start = Math.max(0, newStart);
      let movingClip: Clip | undefined;
      const tracks = s.project.tracks.map((t) => {
        const clip = t.clips.find((c) => c.id === clipId);
        if (clip) {
          movingClip = { ...clip, start, trackId: newTrackId ?? clip.trackId };
          return { ...t, clips: t.clips.filter((c) => c.id !== clipId) };
        }
        return t;
      });
      if (!movingClip) return s;
      const targetId = newTrackId ?? movingClip.trackId;
      return {
        project: {
          ...s.project,
          tracks: tracks.map((t) =>
            t.id === targetId ? { ...t, clips: [...t.clips, movingClip!] } : t,
          ),
        },
      };
    }),

  trimClip: (clipId, side, deltaSeconds) =>
    set((s) => updateClip(s, clipId, (c) => {
      if (side === "left") {
        const newStart = Math.max(0, c.start + deltaSeconds);
        const consumed = newStart - c.start;
        const newOffset = Math.max(0, c.offset + consumed);
        const newDuration = Math.max(0.05, c.duration - consumed);
        return { ...c, start: newStart, offset: newOffset, duration: newDuration };
      }
      const maxRight = c.source.sourceDuration - c.offset;
      const newDuration = Math.max(0.05, Math.min(maxRight, c.duration + deltaSeconds));
      return { ...c, duration: newDuration };
    })),

  setClipBounds: (clipId, bounds) =>
    set((s) => updateClip(s, clipId, (c) => {
      const maxRight = c.source.sourceDuration - (bounds.offset ?? c.offset);
      return {
        ...c,
        start: bounds.start !== undefined ? Math.max(0, bounds.start) : c.start,
        offset: bounds.offset !== undefined ? Math.max(0, bounds.offset) : c.offset,
        duration: bounds.duration !== undefined
          ? Math.max(0.05, Math.min(maxRight, bounds.duration))
          : c.duration,
      };
    })),

  setClipGain: (clipId, gain) =>
    set((s) => updateClip(s, clipId, (c) => ({ ...c, gain: Math.max(0, Math.min(2, gain)) }))),

  setClipFade: (clipId, fadeIn, fadeOut) =>
    set((s) => updateClip(s, clipId, (c) => ({
      ...c,
      fadeIn: fadeIn ?? c.fadeIn,
      fadeOut: fadeOut ?? c.fadeOut,
    }))),

  removeClip: (clipId) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.filter((c) => c.id !== clipId),
        })),
      },
    })),

  duplicateClip: (clipId) => {
    const clip = get().findClip(clipId);
    if (!clip) return null;
    const id = nanoid(8);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id !== clip.trackId
            ? t
            : { ...t, clips: [...t.clips, { ...clip, id, start: clip.start + clip.duration }] },
        ),
      },
    }));
    return id;
  },

  splitClip: (clipId, atSeconds) => {
    const clip = get().findClip(clipId);
    if (!clip) return null;
    // Точка реза должна быть внутри клипа.
    if (atSeconds <= clip.start || atSeconds >= clip.start + clip.duration) return null;
    const localOffset = atSeconds - clip.start;
    const rightId = nanoid(8);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) =>
          t.id !== clip.trackId
            ? t
            : {
                ...t,
                clips: t.clips.flatMap((c) =>
                  c.id !== clipId
                    ? [c]
                    : [
                        // левая часть: сокращаем duration и обнуляем fadeOut
                        { ...c, duration: localOffset, fadeOut: 0 },
                        // правая часть: новый id, сдвинут start, прибавлен offset, обнулён fadeIn
                        {
                          ...c,
                          id: rightId,
                          start: atSeconds,
                          offset: c.offset + localOffset,
                          duration: c.duration - localOffset,
                          fadeIn: 0,
                        },
                      ],
                ),
              },
        ),
      },
    }));
    return rightId;
  },

  addEnvelopePoint: (clipId, point) => {
    const clip = get().findClip(clipId);
    if (!clip) return null;
    const clamped: ClipEnvelopePoint = {
      time: Math.max(0, Math.min(clip.duration, point.time)),
      value: Math.max(0, Math.min(1, point.value)),
    };
    const next = [...(clip.envelope ?? []), clamped].sort((a, b) => a.time - b.time);
    const newIndex = next.indexOf(clamped);
    set((s) => updateClip(s, clipId, (c) => ({ ...c, envelope: next })));
    return newIndex;
  },

  updateEnvelopePoint: (clipId, index, point) => {
    const clip = get().findClip(clipId);
    if (!clip || !clip.envelope || index < 0 || index >= clip.envelope.length) return null;
    const clamped: ClipEnvelopePoint = {
      time: Math.max(0, Math.min(clip.duration, point.time)),
      value: Math.max(0, Math.min(1, point.value)),
    };
    const next = clip.envelope.map((p, i) => (i === index ? clamped : p)).sort((a, b) => a.time - b.time);
    const newIndex = next.indexOf(clamped);
    set((s) => updateClip(s, clipId, (c) => ({ ...c, envelope: next })));
    return newIndex;
  },

  removeEnvelopePoint: (clipId, index) =>
    set((s) => updateClip(s, clipId, (c) => {
      if (!c.envelope) return c;
      const next = c.envelope.filter((_, i) => i !== index);
      return { ...c, envelope: next.length > 0 ? next : undefined };
    })),

  clearEnvelope: (clipId) =>
    set((s) => updateClip(s, clipId, (c) => ({ ...c, envelope: undefined }))),

  findClip: (clipId) => {
    for (const t of get().project.tracks) {
      const c = t.clips.find((x) => x.id === clipId);
      if (c) return c;
    }
    return undefined;
  },

  findTrackOfClip: (clipId) => {
    return get().project.tracks.find((t) => t.clips.some((c) => c.id === clipId));
  },
}));

function updateClip(
  state: { project: Project },
  clipId: Id,
  fn: (c: Clip) => Clip,
): { project: Project } {
  return {
    project: {
      ...state.project,
      tracks: state.project.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
      })),
    },
  };
}

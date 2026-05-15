// Маленькая боковая панель микшера у каждой дорожки.
// (Вертикальные фейдеры — vNext; в MVP горизонтальные.)

import { useMixerStore } from "@/store/mixerStore";
import { useProjectStore } from "@/store/projectStore";
import type { Track } from "@/types";

export function TrackHeader({ track, height }: { track: Track; height: number }): JSX.Element {
  const volume = useMixerStore((s) => s.trackVolumes[track.id] ?? track.volume);
  const pan = useMixerStore((s) => s.trackPans[track.id] ?? track.pan);
  const muted = useMixerStore((s) => s.trackMutes[track.id] ?? track.mute);
  const solo = useMixerStore((s) => s.trackSolos[track.id] ?? track.solo);
  const setVol = useMixerStore((s) => s.setTrackVolume);
  const setPan = useMixerStore((s) => s.setTrackPan);
  const toggleMute = useMixerStore((s) => s.toggleMute);
  const toggleSolo = useMixerStore((s) => s.toggleSolo);
  const renameTrack = useProjectStore((s) => s.renameTrack);

  return (
    <div
      style={{
        height,
        padding: "6px 8px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        background: "var(--bg-1)",
      }}
    >
      <div className="row" style={{ gap: 6 }}>
        <span style={{ width: 6, height: 14, background: track.color, borderRadius: 2 }} />
        <input
          value={track.name}
          onChange={(e) => renameTrack(track.id, e.target.value)}
          style={{ padding: "1px 4px", fontSize: 11, height: 18, background: "transparent", border: "none" }}
        />
      </div>
      <div className="row" style={{ gap: 4 }}>
        <button
          className={solo ? "primary" : "ghost"}
          style={{ width: 22, height: 18, padding: 0, fontSize: 9 }}
          onClick={() => toggleSolo(track.id)}
        >S</button>
        <button
          className={muted ? "primary" : "ghost"}
          style={{ width: 22, height: 18, padding: 0, fontSize: 9 }}
          onClick={() => toggleMute(track.id)}
        >M</button>
        <input
          type="range" min={0} max={1} step={0.01}
          value={volume}
          onChange={(e) => setVol(track.id, Number(e.target.value))}
          style={{ flex: 1 }}
          title={`vol ${(volume * 100).toFixed(0)}%`}
        />
      </div>
      <div className="row" style={{ gap: 4 }}>
        <span className="label" style={{ fontSize: 9, width: 16 }}>L</span>
        <input
          type="range" min={-1} max={1} step={0.05}
          value={pan}
          onChange={(e) => setPan(track.id, Number(e.target.value))}
          style={{ flex: 1 }}
          title={`pan ${pan.toFixed(2)}`}
        />
        <span className="label" style={{ fontSize: 9, width: 16, textAlign: "right" }}>R</span>
      </div>
    </div>
  );
}

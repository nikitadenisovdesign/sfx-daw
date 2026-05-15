import { useEffect } from "react";
import { useUIStore } from "@/store/uiStore";
import { useProjectStore } from "@/store/projectStore";
import { useMixerStore } from "@/store/mixerStore";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useExport } from "@/hooks/useExport";
import { useProjectIO } from "@/hooks/useProject";
import { useServerHealth } from "@/hooks/useServerHealth";
import { useImportAudio } from "@/hooks/useImportAudio";
import { formatTime } from "@/lib/format";

export function Transport(): JSX.Element {
  const project = useProjectStore((s) => s.project);
  const isPlaying = useUIStore((s) => s.isPlaying);
  const playhead = useUIStore((s) => s.playheadSeconds);
  const { engine } = useAudioEngine();
  const { exporting, exportMix, exportStems } = useExport();
  const { save, load } = useProjectIO();
  const { importing: importingAudio, importAudio } = useImportAudio();
  const health = useServerHealth();

  // Reads fresh state via `.getState()` so it works even when called from a
  // long-lived `keydown` listener whose closure would otherwise hold stale
  // values for playhead / project.tracks.
  const togglePlay = async (): Promise<void> => {
    if (engine.isRunning()) {
      engine.stop();
      useUIStore.getState().setIsPlaying(false);
      return;
    }
    const currentProject = useProjectStore.getState().project;
    const currentPlayhead = useUIStore.getState().playheadSeconds;
    const mixer = useMixerStore.getState();
    const audible = new Set<string>();
    for (const t of currentProject.tracks) if (mixer.isAudibleTrack(t.id)) audible.add(t.id);
    await engine.preload(currentProject.tracks);
    await engine.play(currentProject.tracks, currentPlayhead, audible);
    useUIStore.getState().setIsPlaying(true);
  };

  const stop = (): void => {
    engine.stop();
    useUIStore.getState().setIsPlaying(false);
    useUIStore.getState().setPlayhead(0);
  };

  // Keyboard — handler installed once and reads fresh state via `.getState()`.
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      const target = e.target as HTMLElement;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); void togglePlay(); }
      if (e.key === "Home") { e.preventDefault(); useUIStore.getState().setPlayhead(0); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="transport-bar">
      <button className={isPlaying ? "primary" : ""} onClick={togglePlay} title="Space">
        {isPlaying ? "■ Stop" : "▶ Play"}
      </button>
      <button onClick={stop} title="Reset to start">⏮</button>

      <div className="mono" style={{ color: "var(--fg-1)", fontSize: 13, minWidth: 110 }}>
        {formatTime(playhead, project.framerate)} / {formatTime(project.duration, project.framerate)}
      </div>

      <div style={{ width: 1, height: 20, background: "var(--border)" }} />

      <div className="row" style={{ gap: 6 }}>
        <span className="label">Project:</span>
        <input
          value={project.name}
          onChange={(e) => useProjectStore.getState().setName(e.target.value)}
          style={{ width: 180 }}
        />
        <span className="label">FPS:</span>
        <select
          value={project.framerate}
          onChange={(e) => useProjectStore.getState().setFramerate(Number(e.target.value))}
          style={{ width: 70 }}
        >
          <option value={24}>24</option>
          <option value={25}>25</option>
          <option value={30}>30</option>
          <option value={50}>50</option>
          <option value={60}>60</option>
        </select>
        <span className="label">Length:</span>
        <input
          type="number"
          min={1}
          max={3600}
          step={1}
          value={Math.round(project.duration)}
          title="Total project length in seconds"
          onChange={(e) => {
            const n = Number(e.target.value);
            if (Number.isFinite(n) && n > 0) {
              useProjectStore.getState().setDuration(n);
            }
          }}
          style={{ width: 64 }}
        />
        <span className="label" style={{ color: "var(--fg-3)" }}>s</span>
      </div>

      <div className="spacer" />

      <label
        title="Import an mp3/wav onto the Music track at the playhead"
        style={{
          display: "inline-block",
          padding: "6px 10px",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          cursor: importingAudio ? "wait" : "pointer",
          background: "var(--bg-2)",
          opacity: importingAudio ? 0.6 : 1,
          fontSize: 12,
        }}
      >
        {importingAudio ? "Importing…" : "📥 Audio"}
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.flac,.m4a,.aac,.opus"
          style={{ display: "none" }}
          disabled={importingAudio}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importAudio(f);
            e.target.value = "";
          }}
        />
      </label>
      <button onClick={save} title="Save project as JSON">💾 Save</button>
      <label className="ghost" style={{ display: "inline-block" }}>
        <span className="" style={{
          display: "inline-block", padding: "6px 10px", border: "1px solid var(--border)",
          borderRadius: "var(--radius)", cursor: "pointer", background: "var(--bg-2)",
        }}>📂 Load</span>
        <input
          type="file" accept=".json" style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void load(f);
            e.target.value = "";
          }}
        />
      </label>
      <button onClick={exportMix} disabled={exporting}>⬇ Mix</button>
      <button onClick={exportStems} disabled={exporting}>⬇ Stems</button>

      <div style={{ width: 1, height: 20, background: "var(--border)" }} />

      <div
        className="row"
        title={
          health
            ? `${health.gpu ?? "no GPU"}\n` +
              health.backends.map((b) => `${b.label}: ${b.loaded ? "loaded" : b.error ? "error" : "loading"}`).join("\n")
            : "server unreachable"
        }
        style={{ gap: 6 }}
      >
        <span className={`health-dot ${health?.status === "ok" ? "ok" : health?.status === "loading" ? "loading" : "error"}`} />
        <span className="label" style={{ minWidth: 84 }}>
          {health?.status === "ok"
            ? `${health.gpu?.replace("NVIDIA GeForce ", "")} · ${health.vram_used_gb?.toFixed(1)}/${health.vram_total_gb?.toFixed(0)}GB`
            : health?.status === "loading"
            ? "Loading model…"
            : "Server offline"}
        </span>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";
import { useImportAudio } from "@/hooks/useImportAudio";

export function VideoPlayer(): JSX.Element {
  const video = useProjectStore((s) => s.project.video);
  const setVideo = useProjectStore((s) => s.setVideo);
  const playhead = useUIStore((s) => s.playheadSeconds);
  const isPlaying = useUIStore((s) => s.isPlaying);

  const ref = useRef<HTMLVideoElement | null>(null);
  const [over, setOver] = useState(false);
  const { importAudio } = useImportAudio();

  // Синхронизация: видео следует за плейхедом аудио-движка
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (Math.abs(v.currentTime - playhead) > 0.05) {
      v.currentTime = playhead;
    }
  }, [playhead]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isPlaying) void v.play().catch(() => { /* silenced */ });
    else v.pause();
  }, [isPlaying]);

  const isAudioFile = (file: File): boolean => {
    if (file.type.startsWith("audio/")) return true;
    return /\.(mp3|wav|ogg|flac|m4a|aac|opus)$/i.test(file.name);
  };

  const handleFile = async (file: File): Promise<void> => {
    if (isAudioFile(file)) {
      await importAudio(file);
      return;
    }
    const url = URL.createObjectURL(file);
    const probe = document.createElement("video");
    probe.preload = "metadata";
    probe.src = url;
    await new Promise<void>((resolve) => {
      probe.onloadedmetadata = () => resolve();
    });
    setVideo({
      src: url,
      name: file.name,
      duration: probe.duration,
      width: probe.videoWidth,
      height: probe.videoHeight,
    });
  };

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault();
    setOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  };

  if (!video) {
    return (
      <div className="video-pane">
        <div
          className={`dropzone ${over ? "over" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          onClick={() => document.getElementById("video-file-input")?.click()}
        >
          <div style={{ fontSize: 24, marginBottom: 8 }}>🎬</div>
          <div>Drop video (MP4, MOV, WebM) or audio (MP3, WAV…)</div>
          <div style={{ fontSize: 11, marginTop: 4, color: "var(--fg-3)" }}>
            audio lands on the “Music” track at the playhead
          </div>
          <input
            id="video-file-input"
            type="file"
            accept="video/*,audio/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="video-pane">
      <video
        ref={ref}
        src={video.src}
        muted
        playsInline
        controls={false}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    </div>
  );
}

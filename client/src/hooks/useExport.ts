// Экспорт микса и стемов через ExportEngine.

import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useMixerStore } from "@/store/mixerStore";
import { useAudioEngine } from "./useAudioEngine";
import { exportProject } from "@/audio/ExportEngine";
import { audioBufferToWav, downloadBlob } from "@/lib/wav";

export function useExport(): {
  exporting: boolean;
  exportMix: () => Promise<void>;
  exportStems: () => Promise<void>;
} {
  const [exporting, setExporting] = useState(false);
  const { engine } = useAudioEngine();

  const run = async (mode: "mix" | "stems") => {
    const project = useProjectStore.getState().project;
    const mixer = useMixerStore.getState();
    const audible = new Set<string>();
    for (const t of project.tracks) if (mixer.isAudibleTrack(t.id)) audible.add(t.id);

    setExporting(true);
    try {
      const { buffers } = await exportProject(project, {
        mode,
        loadBuffer: (url) => engine.cache.load(url),
        audibleTracks: audible,
        trackVolumes: mixer.trackVolumes,
        trackPans: mixer.trackPans,
        masterVolume: mixer.masterVolume,
      });
      const safe = (project.name || "project").replace(/\s+/g, "-");
      for (const [name, buf] of Object.entries(buffers)) {
        const blob = audioBufferToWav(buf);
        downloadBlob(blob, mode === "mix" ? `${safe}_mix.wav` : `${safe}_${name}.wav`);
      }
    } finally {
      setExporting(false);
    }
  };

  return {
    exporting,
    exportMix: () => run("mix"),
    exportStems: () => run("stems"),
  };
}

// Экспорт микса через ExportEngine.

import { useState } from "react";
import { useProjectStore } from "@/store/projectStore";
import { useMixerStore } from "@/store/mixerStore";
import { useAudioEngine } from "./useAudioEngine";
import { exportProject } from "@/audio/ExportEngine";
import { audioBufferToWav, downloadBlob } from "@/lib/wav";

export function useExport(): {
  exporting: boolean;
  exportMix: () => Promise<void>;
} {
  const [exporting, setExporting] = useState(false);
  const { engine } = useAudioEngine();

  const exportMix = async (): Promise<void> => {
    const project = useProjectStore.getState().project;
    const mixer = useMixerStore.getState();
    const audible = new Set<string>();
    for (const t of project.tracks) if (mixer.isAudibleTrack(t.id)) audible.add(t.id);

    setExporting(true);
    try {
      const { buffer } = await exportProject(project, {
        loadBuffer: (url) => engine.cache.load(url),
        audibleTracks: audible,
        trackVolumes: mixer.trackVolumes,
        trackPans: mixer.trackPans,
        masterVolume: mixer.masterVolume,
      });
      const safe = (project.name || "project").replace(/\s+/g, "-");
      const blob = audioBufferToWav(buffer);
      downloadBlob(blob, `${safe}_mix.wav`);
    } finally {
      setExporting(false);
    }
  };

  return { exporting, exportMix };
}

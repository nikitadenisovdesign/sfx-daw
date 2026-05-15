// Импорт пользовательских mp3/wav/ogg/m4a в проект как клип на дорожке "Music".

import { useCallback, useState } from "react";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";

export function useImportAudio(): {
  importing: boolean;
  error: string | null;
  importAudio: (file: File) => Promise<void>;
} {
  const { engine, ensurePeaks } = useAudioEngine();
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importAudio = useCallback(
    async (file: File): Promise<void> => {
      setImporting(true);
      setError(null);
      const url = URL.createObjectURL(file);
      try {
        // Декодируем — это и кэширует буфер в engine.cache, и даёт нам duration/sr.
        const buf = await engine.cache.load(url);
        const sourceDuration = buf.duration;
        const sampleRate = buf.sampleRate;

        // Найти или создать дорожку "Music".
        const store = useProjectStore.getState();
        let musicTrack = store.project.tracks.find((t) => t.name === "Music");
        if (!musicTrack) {
          const id = store.addTrack("Music");
          musicTrack = useProjectStore.getState().project.tracks.find((t) => t.id === id);
        }
        if (!musicTrack) {
          throw new Error("Failed to create Music track");
        }

        const startSec = useUIStore.getState().playheadSeconds;
        store.addClip(
          musicTrack.id,
          { url, filename: file.name, sourceDuration, sampleRate },
          startSec,
          file.name.replace(/\.[^.]+$/, ""),
        );

        // Пиковая дорожка для рендера в Canvas timeline.
        void ensurePeaks(url);

        // Если клип выходит за пределы проекта — расширяем длительность.
        const endSec = startSec + sourceDuration;
        const project = useProjectStore.getState().project;
        if (endSec > project.duration) {
          useProjectStore.getState().setDuration(Math.ceil(endSec));
        }
      } catch (e) {
        URL.revokeObjectURL(url);
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
        throw e;
      } finally {
        setImporting(false);
      }
    },
    [engine, ensurePeaks],
  );

  return { importing, error, importAudio };
}

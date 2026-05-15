// Сохранение / загрузка проекта в JSON.

import { useCallback } from "react";
import { useProjectStore } from "@/store/projectStore";
import { downloadBlob } from "@/lib/wav";
import type { Project } from "@/types";

export function useProjectIO(): {
  save: () => void;
  load: (file: File) => Promise<void>;
} {
  const project = useProjectStore((s) => s.project);
  const loadProject = useProjectStore((s) => s.loadProject);

  const save = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json" });
    downloadBlob(blob, `${(project.name || "project").replace(/\s+/g, "-")}.sfxdaw.json`);
  }, [project]);

  const load = useCallback(
    async (file: File) => {
      const text = await file.text();
      const parsed = JSON.parse(text) as Project;
      loadProject(parsed);
    },
    [loadProject],
  );

  return { save, load };
}

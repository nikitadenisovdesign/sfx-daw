// Хук-обёртка над POST /generate с состоянием loading/error.

import { useCallback, useState } from "react";
import { api, type GenerateParams } from "@/lib/api";
import { useUIStore } from "@/store/uiStore";
import type { GenerateResponse } from "@/types";

interface State {
  loading: boolean;
  error: string | null;
  result: GenerateResponse | null;
}

export function useGenerateSFX(): {
  loading: boolean;
  error: string | null;
  result: GenerateResponse | null;
  generate: (params: GenerateParams) => Promise<GenerateResponse | null>;
  reset: () => void;
} {
  const [state, setState] = useState<State>({ loading: false, error: null, result: null });

  const generate = useCallback(async (params: GenerateParams) => {
    setState({ loading: true, error: null, result: null });
    try {
      const result = await api.generate(params);
      setState({ loading: false, error: null, result });
      useUIStore.getState().bumpLibrary();
      return result;
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      setState({ loading: false, error, result: null });
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ loading: false, error: null, result: null }), []);

  return { ...state, generate, reset };
}

// === API client для AI-сервера ===

import type {
  GenerateResponse,
  HealthStatus,
  ModelsResponse,
  SoundMetadata,
  TemplateInfo,
} from "@/types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface GenerateParams {
  prompt: string;
  duration?: number;
  numVariations?: number;
  guidanceScale?: number;
  steps?: number;
  seed?: number;
  category?: string;
  tags?: string[];
  model?: string; // backend name: "stable-audio-open" | "tangoflux"
  normalize?: boolean;
  autoFadeMs?: number;
  trimSilence?: boolean;
}

export interface GenerateFromTemplateParams {
  category: string;
  variant: string;
  duration?: number;
  numVariations?: number;
  guidanceScale?: number;
  seed?: number;
  model?: string;
}

export interface LibraryParams {
  q?: string;
  category?: string;
  favorite?: boolean;
  limit?: number;
  offset?: number;
}

export interface LibraryResponse {
  items: SoundMetadata[];
  total: number;
}

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }
  return res.json();
}

export function audioUrl(filenameOrUrl: string): string {
  if (filenameOrUrl.startsWith("http") || filenameOrUrl.startsWith("blob:")) {
    return filenameOrUrl;
  }
  if (filenameOrUrl.startsWith("/")) return `${API_URL}${filenameOrUrl}`;
  return `${API_URL}/audio/${filenameOrUrl}`;
}

export const api = {
  baseUrl: API_URL,

  health(): Promise<HealthStatus> {
    return request<HealthStatus>("/health");
  },

  templates(): Promise<{ templates: TemplateInfo[] }> {
    return request("/templates");
  },

  models(): Promise<ModelsResponse> {
    return request<ModelsResponse>("/models");
  },

  generate(params: GenerateParams): Promise<GenerateResponse> {
    return request<GenerateResponse>("/generate", {
      method: "POST",
      body: JSON.stringify({
        prompt: params.prompt,
        duration: params.duration ?? 1.0,
        num_variations: params.numVariations ?? 4,
        guidance_scale: params.guidanceScale,
        steps: params.steps,
        seed: params.seed,
        category: params.category,
        tags: params.tags ?? [],
        model: params.model,
        normalize: params.normalize ?? true,
        auto_fade_ms: params.autoFadeMs ?? 10,
        trim_silence: params.trimSilence ?? true,
      }),
    });
  },

  generateFromTemplate(p: GenerateFromTemplateParams): Promise<GenerateResponse> {
    return request<GenerateResponse>("/generate/template", {
      method: "POST",
      body: JSON.stringify({
        category: p.category,
        variant: p.variant,
        duration: p.duration ?? 1.0,
        num_variations: p.numVariations ?? 4,
        guidance_scale: p.guidanceScale,
        seed: p.seed,
        model: p.model,
      }),
    });
  },

  library(params: LibraryParams = {}): Promise<LibraryResponse> {
    const search = new URLSearchParams();
    if (params.q) search.set("q", params.q);
    if (params.category) search.set("category", params.category);
    if (params.favorite) search.set("favorite", "true");
    if (params.limit !== undefined) search.set("limit", String(params.limit));
    if (params.offset !== undefined) search.set("offset", String(params.offset));
    const qs = search.toString();
    return request<LibraryResponse>(`/library${qs ? `?${qs}` : ""}`);
  },

  setFavorite(id: number, favorite: boolean): Promise<unknown> {
    return request(`/library/${id}/favorite?favorite=${favorite}`, { method: "POST" });
  },

  deleteSound(id: number): Promise<unknown> {
    return request(`/library/${id}`, { method: "DELETE" });
  },
};

export { ApiError };

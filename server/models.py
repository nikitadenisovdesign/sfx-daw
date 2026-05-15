"""Pydantic models for API requests and responses."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

# === SFX categories — keep in sync with prompt_templates.py ===
SFXCategory = Literal["swoosh", "impact", "transition", "ui", "ambient", "pop", "custom"]


# === Requests ===

class GenerateRequest(BaseModel):
    """Generate one or more SFX from a free-form prompt."""

    prompt: str = Field(..., min_length=1, max_length=500)
    duration: float = Field(default=3.0, gt=0.05, le=47.0)
    num_variations: int = Field(default=4, ge=1, le=8)
    guidance_scale: Optional[float] = Field(default=None, ge=1.0, le=15.0)
    steps: Optional[int] = Field(default=None, ge=10, le=200)
    seed: Optional[int] = None
    category: Optional[SFXCategory] = None
    tags: list[str] = Field(default_factory=list)

    # Backend selection. None = use server default.
    model: Optional[str] = None  # "stable-audio-open" | "tangoflux" | None

    # Post-processing
    normalize: bool = True
    auto_fade_ms: int = Field(default=10, ge=0, le=500)
    trim_silence: bool = True


class TemplateGenerateRequest(BaseModel):
    """Generate from a built-in template (category + variant)."""

    category: SFXCategory
    variant: str
    duration: float = Field(default=1.0, gt=0.05, le=47.0)
    num_variations: int = Field(default=4, ge=1, le=8)
    guidance_scale: Optional[float] = Field(default=None, ge=1.0, le=15.0)
    seed: Optional[int] = None
    model: Optional[str] = None


# === Responses ===

class GeneratedFile(BaseModel):
    filename: str
    url: str
    duration: float
    seed: int
    sample_rate: int
    model: str  # which backend produced it


class GenerateResponse(BaseModel):
    files: list[GeneratedFile]
    prompt: str
    duration: float
    elapsed_ms: int
    model: str


class SoundMetadata(BaseModel):
    id: int
    filename: str
    url: str
    prompt: str
    duration: float
    sample_rate: int
    seed: int
    category: Optional[str] = None
    tags: list[str] = Field(default_factory=list)
    favorite: bool = False
    created_at: datetime
    model: Optional[str] = None


class SoundLibraryResponse(BaseModel):
    items: list[SoundMetadata]
    total: int


class BackendInfoModel(BaseModel):
    """Public info about a backend, exposed via /models."""

    name: str
    label: str
    description: str
    sample_rate: int
    max_duration_seconds: float
    default_steps: int
    default_guidance: float
    license: str
    tags: list[str] = Field(default_factory=list)
    loaded: bool
    vram_used_gb: Optional[float] = None
    error: Optional[str] = None
    is_default: bool = False


class ModelsResponse(BaseModel):
    """List of available backends."""

    default: str
    items: list[BackendInfoModel]


class HealthResponse(BaseModel):
    status: Literal["ok", "loading", "error", "degraded"]
    gpu: Optional[str] = None
    vram_total_gb: Optional[float] = None
    vram_used_gb: Optional[float] = None
    vram_free_gb: Optional[float] = None
    backends: list[BackendInfoModel] = Field(default_factory=list)
    default_backend: str
    error: Optional[str] = None


class TemplateInfo(BaseModel):
    category: SFXCategory
    variant: str
    template: str
    typical_duration: float
    description: str


class TemplatesResponse(BaseModel):
    templates: list[TemplateInfo]


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[str] = None

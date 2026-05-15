"""Common types and interface for SFX generation backends."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Protocol

import torch


class BackendError(RuntimeError):
    """Raised when a backend cannot load or generate."""


@dataclass
class GeneratedClip:
    """One generated audio clip — raw tensor + metadata."""
    audio: torch.Tensor          # [C, T] float32, in [-1, 1]
    sample_rate: int
    seed: int
    elapsed_ms: int


@dataclass
class BackendInfo:
    """Static metadata about a backend — exposed via /models endpoint."""
    name: str                              # short id, e.g. "stable-audio-open"
    label: str                             # human label, e.g. "Stable Audio Open 1.0"
    description: str
    sample_rate: int
    max_duration_seconds: float
    default_steps: int
    default_guidance: float
    license: str
    local_path: Optional[Path] = None
    loaded: bool = False
    vram_used_gb: Optional[float] = None
    error: Optional[str] = None
    tags: list[str] = field(default_factory=list)


class Backend(Protocol):
    """Interface every backend implements."""

    info: BackendInfo

    def load(self) -> None:
        """Load model weights into VRAM. Idempotent. Raises BackendError on failure."""
        ...

    def unload(self) -> None:
        """Release VRAM. Optional."""
        ...

    @property
    def loaded(self) -> bool:
        ...

    def generate(
        self,
        prompt: str,
        duration: float,
        *,
        seed: Optional[int] = None,
        steps: Optional[int] = None,
        guidance_scale: Optional[float] = None,
    ) -> GeneratedClip:
        """Generate one audio clip."""
        ...

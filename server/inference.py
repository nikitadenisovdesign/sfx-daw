"""
Backend manager — high-level facade over the backend registry.

Usage:
    from inference import manager
    manager.discover_and_load()
    clip = manager.get("stable-audio-open").generate("whoosh", duration=0.5)
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import torch

from config import settings

# Importing these modules registers their factories in BACKENDS via side effect.
from backends import BACKENDS, BackendError, available_backends, get_backend  # noqa: F401
from backends import stable_audio  # noqa: F401  — registers "stable-audio-open"
from backends.base import Backend, BackendInfo

# Map backend name → expected subfolder under models_dir
_BACKEND_TO_DIR = {
    "stable-audio-open": "stable-audio-open",
}


class BackendManager:
    """Owns the lifecycle of one or more backends."""

    def __init__(self):
        self._initialized = False

    def discover_and_load(self) -> None:
        """
        Instantiate backends whose model folders are present, then load
        the ones in `settings.autoload_list`.
        """
        models_dir = settings.models_dir.resolve()
        device = "cuda" if torch.cuda.is_available() else "cpu"

        # Instantiate all available backends whose folder exists.
        for name in available_backends():
            subfolder = _BACKEND_TO_DIR.get(name, name)
            model_dir = models_dir / subfolder
            if not model_dir.exists():
                print(f"[inference] backend '{name}': folder {model_dir} not found — skipping.")
                continue
            try:
                get_backend(name, model_dir=model_dir, device=device)
            except Exception as e:  # noqa: BLE001
                print(f"[inference] failed to instantiate '{name}': {e}")

        # Decide which to actually load into VRAM
        autoload = settings.autoload_list
        if autoload == ["*"]:
            targets = list(BACKENDS.keys())
        else:
            targets = [n for n in autoload if n in BACKENDS]

        for name in targets:
            backend = BACKENDS[name]
            try:
                backend.load()
            except BackendError as e:
                print(f"[inference] failed to load '{name}': {e}")
                backend.info.error = str(e)
            except Exception as e:  # noqa: BLE001
                print(f"[inference] unexpected error loading '{name}': {e!r}")
                backend.info.error = repr(e)

        self._initialized = True

    def get(self, name: Optional[str] = None) -> Backend:
        """Get a backend by name; ensure it is loaded."""
        target = name or settings.default_backend
        if target not in BACKENDS:
            available = sorted(BACKENDS.keys())
            raise BackendError(
                f"Backend '{target}' not available. "
                f"Loaded: {available}. Did you put its folder under {settings.models_dir}?"
            )
        backend = BACKENDS[target]
        if not backend.loaded:
            backend.load()
        return backend

    def list_info(self) -> list[BackendInfo]:
        return [b.info for b in BACKENDS.values()]

    def vram_stats(self) -> dict:
        if not torch.cuda.is_available():
            return {"available": False}
        props = torch.cuda.get_device_properties(0)
        return {
            "available": True,
            "name": torch.cuda.get_device_name(0),
            "total_gb": round(props.total_memory / 1e9, 2),
            "used_gb": round(torch.cuda.memory_allocated() / 1e9, 2),
            "free_gb": round((props.total_memory - torch.cuda.memory_allocated()) / 1e9, 2),
        }

    @property
    def any_loaded(self) -> bool:
        return any(b.loaded for b in BACKENDS.values())


# Global singleton
manager = BackendManager()

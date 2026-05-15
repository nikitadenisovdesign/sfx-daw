"""Global backend registry."""

from __future__ import annotations

from typing import Callable

from .base import Backend, BackendError


# name → factory(config) → Backend
_FACTORIES: dict[str, Callable[..., Backend]] = {}

# name → instantiated Backend (lazy)
BACKENDS: dict[str, Backend] = {}


def register(name: str, factory: Callable[..., Backend]) -> None:
    """Register a backend factory. Called at module-import time by each backend."""
    _FACTORIES[name] = factory


def get_backend(name: str, **kwargs) -> Backend:
    """Get (or create) the backend instance with this name."""
    if name in BACKENDS:
        return BACKENDS[name]
    if name not in _FACTORIES:
        raise BackendError(
            f"Unknown backend '{name}'. Available: {sorted(_FACTORIES.keys())}"
        )
    backend = _FACTORIES[name](**kwargs)
    BACKENDS[name] = backend
    return backend


def available_backends() -> list[str]:
    return sorted(_FACTORIES.keys())

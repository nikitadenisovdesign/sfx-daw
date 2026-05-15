"""
Bbackend-registry for SFX generation models.

Each backend implements the `Backend` protocol from base.py and is registered
in the global `BACKENDS` registry at import time. Server picks a backend by
name (passed in /generate request or taken from config.default_backend).
"""

from __future__ import annotations

from .base import Backend, BackendInfo, GeneratedClip, BackendError
from .registry import BACKENDS, get_backend, register, available_backends

__all__ = [
    "Backend",
    "BackendInfo",
    "GeneratedClip",
    "BackendError",
    "BACKENDS",
    "get_backend",
    "register",
    "available_backends",
]

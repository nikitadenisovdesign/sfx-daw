"""
Stable Audio Open backend — loads from a local directory via diffusers.

Expects a HuggingFace snapshot of stabilityai/stable-audio-open-1.0 in diffusers
layout:
    model_index.json
    scheduler/
    text_encoder/
    tokenizer/
    transformer/
    vae/
    projection_model/

Uses `diffusers.StableAudioPipeline` so we don't depend on stable-audio-tools
(whose pinned dependency tree clashes with the rest of the server).
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import Optional

import torch

from .base import Backend, BackendError, BackendInfo, GeneratedClip
from .registry import register


class StableAudioBackend:
    NAME = "stable-audio-open"

    def __init__(self, model_dir: Path, device: str = "cuda"):
        self.model_dir = Path(model_dir)
        self.device = device
        self._pipe = None
        self._sample_rate: int = 44100
        self._loaded = False

        self.info = BackendInfo(
            name=self.NAME,
            label="Stable Audio Open 1.0",
            description="Stability AI text-to-audio diffusion model (1.21B params). ~4GB VRAM. 2-5s/gen.",
            sample_rate=44100,
            max_duration_seconds=47.0,
            default_steps=100,
            default_guidance=7.0,
            license="Stability AI Community License",
            local_path=self.model_dir,
            tags=["text-to-sfx", "diffusion", "44.1kHz", "stereo"],
        )

    @property
    def loaded(self) -> bool:
        return self._loaded

    def load(self) -> None:
        if self._loaded:
            return
        try:
            from diffusers import StableAudioPipeline  # type: ignore
        except Exception as e:
            raise BackendError(
                f"diffusers.StableAudioPipeline not available: {e}. "
                "Need diffusers>=0.27."
            ) from e

        index_path = self.model_dir / "model_index.json"
        if not index_path.exists():
            raise BackendError(
                f"model_index.json not found in {self.model_dir}. "
                "Expected a HuggingFace diffusers snapshot of stable-audio-open-1.0."
            )

        print(f"[stable-audio-open] loading from {self.model_dir}...")
        t0 = time.time()

        dtype = torch.float16 if (self.device == "cuda" and torch.cuda.is_available()) else torch.float32
        pipe = StableAudioPipeline.from_pretrained(
            str(self.model_dir),
            torch_dtype=dtype,
            local_files_only=True,
        )
        pipe = pipe.to(self.device)

        self._pipe = pipe
        # VAE sampling rate is the source of truth (44100 for SAO).
        self._sample_rate = int(getattr(pipe.vae.config, "sampling_rate", 44100))
        self.info.sample_rate = self._sample_rate
        self._loaded = True

        if torch.cuda.is_available():
            self.info.vram_used_gb = round(torch.cuda.memory_allocated() / 1e9, 2)

        print(f"[stable-audio-open] loaded in {time.time() - t0:.1f}s (sr={self._sample_rate})")
        self.info.loaded = True

    def unload(self) -> None:
        self._pipe = None
        self._loaded = False
        self.info.loaded = False
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    def generate(
        self,
        prompt: str,
        duration: float,
        *,
        seed: Optional[int] = None,
        steps: Optional[int] = None,
        guidance_scale: Optional[float] = None,
    ) -> GeneratedClip:
        if not self._loaded or self._pipe is None:
            raise BackendError("StableAudioBackend not loaded. Call load() first.")

        steps = steps if steps is not None else self.info.default_steps
        guidance_scale = guidance_scale if guidance_scale is not None else self.info.default_guidance
        seed = int(seed) if seed is not None else int(torch.randint(0, 2**31 - 1, (1,)).item())

        gen_device = "cuda" if (self.device == "cuda" and torch.cuda.is_available()) else "cpu"
        generator = torch.Generator(gen_device).manual_seed(seed)

        t0 = time.time()
        with torch.no_grad():
            result = self._pipe(
                prompt=prompt,
                num_inference_steps=int(steps),
                guidance_scale=float(guidance_scale),
                audio_end_in_s=float(duration),
                num_waveforms_per_prompt=1,
                generator=generator,
            )
        elapsed_ms = int((time.time() - t0) * 1000)

        # `result.audios` shape: (N, channels, samples). N=1 here.
        audio = result.audios[0].to(torch.float32).cpu()
        return GeneratedClip(
            audio=audio,
            sample_rate=self._sample_rate,
            seed=seed,
            elapsed_ms=elapsed_ms,
        )


def _factory(model_dir: Path, device: str = "cuda") -> Backend:
    return StableAudioBackend(model_dir=model_dir, device=device)


register(StableAudioBackend.NAME, _factory)

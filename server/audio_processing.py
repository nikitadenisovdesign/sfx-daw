"""
Пост-обработка сгенерированных SFX:
  - peak normalize (по умолчанию -1 dBFS)
  - trim тишины с краёв
  - короткий fade in/out чтобы убрать клики
  - сохранение WAV (16-bit PCM)
"""

from __future__ import annotations

from pathlib import Path
import numpy as np
import torch
import soundfile as sf


def to_numpy(tensor: torch.Tensor) -> np.ndarray:
    """[C, T] tensor → [T, C] float32 numpy для soundfile."""
    if tensor.dim() == 3:
        tensor = tensor.squeeze(0)
    if tensor.dim() == 1:
        tensor = tensor.unsqueeze(0)
    arr = tensor.detach().cpu().to(torch.float32).numpy()
    # soundfile хочет [frames, channels]
    return arr.T if arr.shape[0] < arr.shape[1] else arr


def peak_normalize(audio: np.ndarray, target_dbfs: float = -1.0) -> np.ndarray:
    """Привести пик к target_dbfs (по умолчанию −1 dBFS)."""
    peak = float(np.max(np.abs(audio)))
    if peak < 1e-9:
        return audio
    target_amp = 10.0 ** (target_dbfs / 20.0)
    return audio * (target_amp / peak)


def trim_silence(audio: np.ndarray, sample_rate: int, threshold_db: float = -50.0) -> np.ndarray:
    """Убрать тишину с краёв ниже threshold_db. Сохраняет 5мс запаса с каждой стороны."""
    if audio.size == 0:
        return audio

    threshold = 10.0 ** (threshold_db / 20.0)
    mono = audio if audio.ndim == 1 else np.mean(np.abs(audio), axis=1)
    above = np.where(np.abs(mono) > threshold)[0]
    if above.size == 0:
        return audio  # всё тихо — лучше отдать как есть

    pad = int(0.005 * sample_rate)
    start = max(0, int(above[0]) - pad)
    end = min(len(mono), int(above[-1]) + pad + 1)
    return audio[start:end]


def apply_fade(audio: np.ndarray, sample_rate: int, fade_ms: int = 10) -> np.ndarray:
    """Линейный fade in/out чтобы убрать щелчки."""
    if fade_ms <= 0 or audio.size == 0:
        return audio
    fade_samples = int(sample_rate * fade_ms / 1000)
    fade_samples = min(fade_samples, len(audio) // 2)
    if fade_samples <= 1:
        return audio

    ramp = np.linspace(0.0, 1.0, fade_samples, dtype=np.float32)
    audio = audio.copy()
    if audio.ndim == 1:
        audio[:fade_samples] *= ramp
        audio[-fade_samples:] *= ramp[::-1]
    else:
        audio[:fade_samples] *= ramp[:, None]
        audio[-fade_samples:] *= ramp[::-1, None]
    return audio


def postprocess(
    tensor: torch.Tensor,
    sample_rate: int,
    *,
    normalize: bool = True,
    trim: bool = True,
    fade_ms: int = 10,
    target_dbfs: float = -1.0,
) -> tuple[np.ndarray, float]:
    """
    Полный пайплайн пост-обработки.
    Возвращает (audio, duration_seconds).
    """
    audio = to_numpy(tensor)
    if trim:
        audio = trim_silence(audio, sample_rate)
    if normalize:
        audio = peak_normalize(audio, target_dbfs)
    if fade_ms > 0:
        audio = apply_fade(audio, sample_rate, fade_ms)
    duration = len(audio) / sample_rate
    return audio, duration


def save_wav(audio: np.ndarray, path: Path, sample_rate: int, subtype: str = "PCM_16") -> None:
    """Записать WAV-файл."""
    path.parent.mkdir(parents=True, exist_ok=True)
    # Клипуем на всякий случай
    audio = np.clip(audio, -1.0, 1.0)
    sf.write(str(path), audio, sample_rate, subtype=subtype)

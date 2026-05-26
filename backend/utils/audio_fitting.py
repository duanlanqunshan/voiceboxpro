"""
Audio time-stretching and fitting utilities for SRT subtitle processing.

Applies time-stretch (atempo) to raw TTS audio so it fits the exact target
duration of each subtitle cue without modifying the subtitle timestamps.
"""

import logging
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)

RiskLevel = Literal["low", "medium", "high"]


def compute_fit_ratio(target_ms: int, raw_ms: int) -> Tuple[float, RiskLevel]:
    """Compute the stretch ratio and its risk level.

    Args:
        target_ms: Target duration in milliseconds.
        raw_ms: Raw TTS audio duration in milliseconds.

    Returns:
        Tuple of (ratio, risk_level). ratio = target_ms / raw_ms.
        High ratio = speed up; Low ratio = slow down.
    """
    if raw_ms <= 0:
        return 1.0, "high"
    ratio = target_ms / raw_ms
    if 0.92 <= ratio <= 1.08:
        risk = "low"
    elif 0.85 <= ratio < 0.92 or 1.08 < ratio <= 1.15:
        risk = "medium"
    else:
        risk = "high"
    return ratio, risk


def _decompose_atempo(ratio: float) -> list[float]:
    """Decompose a desired atempo ratio into valid (0.5–2.0) chain steps.

    atempo filter accepts 0.5–2.0. For extreme ratios we chain multiple passes.
    """
    if 0.5 <= ratio <= 2.0:
        return [ratio]

    steps: list[float] = []
    remaining = ratio

    if ratio > 2.0:
        while remaining > 2.0:
            steps.append(2.0)
            remaining /= 2.0
        if remaining != 1.0:
            steps.append(remaining)
    else:
        while remaining < 0.5:
            steps.append(0.5)
            remaining /= 0.5
        if remaining != 1.0:
            steps.append(remaining)

    return steps if steps else [1.0]


def _build_afilter(steps: list[float]) -> str:
    """Build an ffmpeg atempo chain expression from ratio steps."""
    parts = [f"atempo={s}" for s in steps]
    return ",".join(parts)


@dataclass
class FitResult:
    """Result of fitting raw audio to a target duration."""

    fitted_path: str
    raw_duration_ms: int
    fitted_duration_ms: int
    fit_ratio: float
    risk_level: RiskLevel


def fit_audio_to_duration(
    raw_audio_path: str,
    target_ms: int,
    output_dir: Optional[Path] = None,
) -> FitResult:
    """Trim silence and time-stretch audio to fit exactly into target_ms.

    Steps:
      1. Strip leading/trailing silence (only silence, not content).
      2. Measure trimmed duration.
      3. Compute fit ratio and risk level.
      4. Apply atempo chain via ffmpeg.
      5. Verify output duration; do one final micro-correct if needed.

    Args:
        raw_audio_path: Path to raw WAV from TTS.
        target_ms: Desired duration in milliseconds.
        output_dir: Directory to write fitted WAV. Defaults to system temp.

    Returns:
        FitResult with paths and metrics.
    """
    import os as _os

    raw_path = Path(raw_audio_path)
    if not raw_path.exists():
        raise FileNotFoundError(f"Raw audio not found: {raw_audio_path}")

    if output_dir is None:
        output_dir = Path(tempfile.gettempdir())
    output_dir.mkdir(parents=True, exist_ok=True)

    tmp_silenceremove = output_dir / f"{raw_path.stem}_trimmed{raw_path.suffix}"
    tmp_fitted = output_dir / f"{raw_path.stem}_fitted{raw_path.suffix}"

    raw_duration_ms = _get_audio_duration_ms(raw_audio_path)

    silence_removed_ms = 0
    _run_ffmpeg(
        [
            "-y",
            "-i", str(raw_path),
            "-af", "silenceremove=start_periods=1:start_threshold=-50dB:start_mode=remove:detection=speech,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_mode=remove:detection=speech,areverse",
            "-ac", "1",
            str(tmp_silenceremove),
        ]
    )

    if tmp_silenceremove.exists():
        silence_removed_ms = raw_duration_ms - _get_audio_duration_ms(str(tmp_silenceremove))
        raw_duration_ms -= silence_removed_ms
        raw_input = str(tmp_silenceremove)
    else:
        raw_input = str(raw_path)

    if raw_duration_ms <= 0:
        raw_duration_ms = 1

    ratio, risk = compute_fit_ratio(target_ms, raw_duration_ms)

    if 0.99 <= ratio <= 1.01:
        import shutil
        shutil.copy(raw_input, tmp_fitted)
    else:
        steps = _decompose_atempo(ratio)
        afilter = _build_afilter(steps)
        _run_ffmpeg(
            [
                "-y",
                "-i", raw_input,
                "-af", afilter,
                "-ac", "1",
                str(tmp_fitted),
            ]
        )

    actual_ms = _get_audio_duration_ms(str(tmp_fitted))

    error_ms = actual_ms - target_ms
    if abs(error_ms) > 30 and raw_duration_ms > 0:
        correction_ratio, _ = compute_fit_ratio(target_ms, actual_ms)
        if 0.5 <= correction_ratio <= 2.0:
            _run_ffmpeg(
                [
                    "-y",
                    "-i", str(tmp_fitted),
                    "-af", f"atempo={correction_ratio}",
                    "-ac", "1",
                    str(tmp_fitted),
                ]
            )
            actual_ms = _get_audio_duration_ms(str(tmp_fitted))

    _cleanup(tmp_silenceremove)

    return FitResult(
        fitted_path=str(tmp_fitted),
        raw_duration_ms=raw_duration_ms + silence_removed_ms,
        fitted_duration_ms=actual_ms,
        fit_ratio=ratio,
        risk_level=risk,
    )


class FFmpegNotFoundError(RuntimeError):
    """Raised when ffmpeg/ffprobe is not available on the system."""


def _run_ffmpeg(args: list) -> None:
    """Run ffmpeg with given arguments, raising on missing binary."""
    try:
        result = subprocess.run(
            ["ffmpeg", "-hide_banner", "-loglevel", "warning"] + args,
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            logger.warning("ffmpeg stderr: %s", result.stderr.strip())
    except FileNotFoundError:
        raise FFmpegNotFoundError(
            "ffmpeg is not installed or not on PATH. "
            "Install it from https://ffmpeg.org and ensure it is accessible."
        )


def _get_audio_duration_ms(path: str) -> int:
    """Get audio duration in milliseconds using ffprobe."""
    try:
        result = subprocess.run(
            [
                "ffprobe", "-v", "error",
                "-show_entries", "format=duration",
                "-of", "default=noprint_wrappers=1:nokey=1",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if result.returncode == 0 and result.stdout.strip():
            return int(float(result.stdout.strip()) * 1000)
    except Exception:
        pass

    try:
        from .audio import load_audio
        audio, sr = load_audio(path)
        return int(len(audio) / sr * 1000)
    except Exception:
        return 0


def _cleanup(path: Path) -> None:
    """Remove temp file if it exists."""
    try:
        if path.exists():
            path.unlink()
    except OSError:
        pass
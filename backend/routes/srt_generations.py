"""SRT subtitle to speech generation with fixed timeline."""

import logging
import shutil
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, Form
from sqlalchemy.orm import Session

from .. import config, models
from ..database import get_db
from ..services import history, profiles, stories
from ..utils.srt_parser import parse_srt
from ..utils.audio_fitting import fit_audio_to_duration

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/generate/srt", response_model=models.SRTGenerationResponse)
async def generate_srt_speech(
    srt_file: UploadFile = File(...),
    profile_id: str = Form(...),
    language: str = Form(default="en"),
    engine: str = Form(default="qwen"),
    seed: Optional[int] = Form(default=None),
    model_size: str = Form(default="1.7B"),
    max_retries: int = Form(default=2),
    normalize: bool = Form(default=True),
    risk_mode: str = Form(default="mark_only"),
    export_mix: bool = Form(default=False),
    db: Session = Depends(get_db),
):
    """Convert an SRT subtitle file to speech with time-stretch to fit each cue window.

    Fixed timeline mode: subtitle start/end timestamps are NEVER modified.
    Each cue's audio is independently generated and then time-stretched to fill
    its exact duration window. Text is never truncated or removed.
    """
    if not srt_file.filename or not srt_file.filename.lower().endswith(".srt"):
        raise HTTPException(status_code=400, detail="Only .srt files are supported")

    profile = await profiles.get_profile(profile_id, db)
    if not profile:
        raise HTTPException(status_code=404, detail="Voice profile not found")

    from ..backends import engine_has_model_sizes

    try:
        profiles.validate_profile_engine(profile, engine)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    srt_bytes = await srt_file.read()
    try:
        srt_content = srt_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        try:
            srt_content = srt_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="SRT file must be UTF-8 encoded")

    entries = parse_srt(srt_content)
    if not entries:
        raise HTTPException(status_code=400, detail="No valid subtitle cues found in SRT file")

    story_name = Path(srt_file.filename).stem or "SRT Import"
    story = await stories.create_story(
        models.StoryCreate(name=story_name, description=f"Imported from {srt_file.filename}"),
        db,
    )

    from ..services.generation import generate_audio_sync

    effective_model_size = model_size if engine_has_model_sizes(engine) else None

    items: list[models.SRTCueItem] = []
    success_count = 0
    failed_count = 0

    for entry in entries:
        cue_start_ms = entry.start_ms
        target_ms = entry.duration_ms

        cue_result = models.SRTCueItem(
            cue_index=entry.index,
            cue_start_ms=cue_start_ms,
            cue_end_ms=entry.end_ms,
            text=entry.text,
            raw_duration_ms=0,
            fitted_duration_ms=0,
            fit_ratio=1.0,
            fit_risk="low",
            fit_policy="preserve_text",
            status="pending",
        )

        for attempt in range(max_retries + 1):
            try:
                wav_bytes = await generate_audio_sync(
                    profile_id=profile_id,
                    text=entry.text,
                    language=language,
                    engine=engine,
                    model_size=effective_model_size or "1.7B",
                    seed=seed,
                    normalize=normalize,
                )
                break
            except Exception as gen_err:
                if attempt == max_retries:
                    cue_result.status = "failed"
                    cue_result.error = str(gen_err)
                    failed_count += 1
                    items.append(cue_result)
                    break
                logger.warning(
                    "SRT generation attempt %d failed for cue %d: %s",
                    attempt + 1, entry.index, gen_err
                )
                continue

        if cue_result.status == "failed":
            continue

        gens_dir = config.get_generations_dir()
        temp_raw = gens_dir / f"temp_raw_{uuid.uuid4().hex}.wav"
        temp_raw.write_bytes(wav_bytes)

        try:
            fit_result = fit_audio_to_duration(
                str(temp_raw),
                target_ms=target_ms,
            )
        except Exception as fit_err:
            logger.error("Audio fitting failed for cue %d: %s", entry.index, fit_err)
            cue_result.status = "failed"
            cue_result.error = f"Fitting error: {fit_err}"
            failed_count += 1
            items.append(cue_result)
            if temp_raw.exists():
                temp_raw.unlink()
            continue
        finally:
            if temp_raw.exists():
                try:
                    temp_raw.unlink()
                except OSError:
                    pass

        generation_id = str(uuid.uuid4())
        final_path = gens_dir / f"{generation_id}.wav"
        shutil.copy(fit_result.fitted_path, final_path)
        Path(fit_result.fitted_path).unlink(missing_ok=True)

        fitted_duration_sec = fit_result.fitted_duration_ms / 1000.0

        try:
            await history.create_generation(
                profile_id=profile_id,
                text=entry.text,
                language=language,
                audio_path=config.to_storage_path(final_path),
                duration=fitted_duration_sec,
                seed=seed,
                db=db,
                generation_id=generation_id,
                status="completed",
                engine=engine,
                model_size=effective_model_size,
                source="srt",
            )
        except Exception as db_err:
            logger.error("Failed to save generation for cue %d: %s", entry.index, db_err)
            cue_result.status = "failed"
            cue_result.error = f"DB save error: {db_err}"
            failed_count += 1
            items.append(cue_result)
            continue

        try:
            item = await stories.add_item_to_story(
                story.id,
                models.StoryItemCreate(
                    generation_id=generation_id,
                    start_time_ms=cue_start_ms,
                    track=0,
                ),
                db,
            )
        except Exception as story_err:
            logger.error("Failed to add story item for cue %d: %s", entry.index, story_err)

        cue_result.generation_id = generation_id
        cue_result.raw_duration_ms = fit_result.raw_duration_ms
        cue_result.fitted_duration_ms = fit_result.fitted_duration_ms
        cue_result.fit_ratio = fit_result.fit_ratio
        cue_result.fit_risk = fit_result.risk_level
        cue_result.status = "completed"
        success_count += 1
        items.append(cue_result)

    mix_audio_path = None
    if export_mix and success_count > 0:
        try:
            audio_bytes = await stories.export_story_audio(story.id, db)
            if audio_bytes:
                mix_path = config.get_generations_dir() / f"{story.id}_mix.wav"
                mix_path.write_bytes(audio_bytes)
                mix_audio_path = config.to_storage_path(mix_path)
        except Exception as mix_err:
            logger.error("Failed to export mix audio: %s", mix_err)

    return models.SRTGenerationResponse(
        story_id=story.id,
        story_name=story.name,
        total_cues=len(entries),
        success_count=success_count,
        failed_count=failed_count,
        items=items,
        mix_audio_path=mix_audio_path,
        status="completed" if success_count > 0 else "failed",
    )
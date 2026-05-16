"""
SFX DAW — AI Server.

Run:
    python server.py

Endpoints:
    GET  /health                       — server + GPU + backends status
    GET  /models                       — list of available SFX backends
    GET  /templates                    — built-in prompt templates
    POST /generate                     — generate SFX from a free-form prompt
    POST /generate/template            — generate from a template (category + variant)
    GET  /audio/{filename}             — serve a generated WAV
    GET  /library                      — list saved sounds (with search)
    POST /library/{id}/favorite        — toggle favorite
    POST /library/{id}/tags            — update tags
    DELETE /library/{id}               — delete entry and file
"""

from __future__ import annotations

import asyncio
import time
import uuid

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

import db
import inference
import models
from audio_processing import postprocess, save_wav
from config import settings
from prompt_templates import (
    SFX_TEMPLATES,
    find_template,
    render_template,
)


# === FastAPI ===
app = FastAPI(
    title="SFX DAW AI Server",
    description="AI generation backend for the SFX DAW. Hosts Stable Audio Open + TangoFlux.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# === Lifecycle ===
@app.on_event("startup")
async def on_startup() -> None:
    db.init_db()

    # Если пользователь удалил файлы из output_dir вручную — почистить запись в БД
    # чтобы UI не показывал "призраков".
    removed = db.cleanup_orphans(settings.output_dir)
    if removed:
        print(f"[startup] removed {removed} orphan library row(s)")

    # Discover and load backends in the background — keeps /health responsive
    # while the model is loading (which can take 10-30s for SAO).
    def _safe_init() -> None:
        try:
            inference.manager.discover_and_load()
        except Exception as exc:  # noqa: BLE001
            print(f"[startup] Failed to init backends: {exc!r}")

    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, _safe_init)


def _info_to_pydantic(i, default_name: str) -> models.BackendInfoModel:
    return models.BackendInfoModel(
        name=i.name,
        label=i.label,
        description=i.description,
        sample_rate=i.sample_rate,
        max_duration_seconds=i.max_duration_seconds,
        default_steps=i.default_steps,
        default_guidance=i.default_guidance,
        license=i.license,
        tags=i.tags,
        loaded=i.loaded,
        vram_used_gb=i.vram_used_gb,
        error=i.error,
        is_default=(i.name == default_name),
    )


# === Health ===
@app.get("/health", response_model=models.HealthResponse)
async def health() -> models.HealthResponse:
    vram = inference.manager.vram_stats()
    backends = [_info_to_pydantic(i, settings.default_backend) for i in inference.manager.list_info()]

    if not backends:
        # Backends not yet instantiated (still booting)
        status = "loading"
    elif any(b.loaded for b in backends):
        status = "ok"
    elif all(b.error for b in backends):
        status = "error"
    else:
        # Backends instantiated but none loaded yet → still starting
        status = "loading"

    return models.HealthResponse(
        status=status,  # type: ignore[arg-type]
        gpu=vram.get("name"),
        vram_total_gb=vram.get("total_gb"),
        vram_used_gb=vram.get("used_gb"),
        vram_free_gb=vram.get("free_gb"),
        backends=backends,
        default_backend=settings.default_backend,
    )


# === Models ===
@app.get("/models", response_model=models.ModelsResponse)
async def list_models() -> models.ModelsResponse:
    items = [_info_to_pydantic(i, settings.default_backend) for i in inference.manager.list_info()]
    return models.ModelsResponse(default=settings.default_backend, items=items)


# === Templates ===
@app.get("/templates", response_model=models.TemplatesResponse)
async def templates() -> models.TemplatesResponse:
    items = [
        models.TemplateInfo(
            category=t.category,  # type: ignore[arg-type]
            variant=t.variant,
            template=t.template,
            typical_duration=t.typical_duration,
            description=t.description,
        )
        for t in SFX_TEMPLATES
    ]
    return models.TemplatesResponse(templates=items)


# === Generate ===
def _generate_one(req: models.GenerateRequest, seed: int) -> models.GeneratedFile:
    try:
        backend = inference.manager.get(req.model)
    except inference.BackendError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    clip = backend.generate(
        prompt=req.prompt,
        duration=req.duration,
        seed=seed,
        steps=req.steps,
        guidance_scale=req.guidance_scale,
    )
    audio, real_duration = postprocess(
        clip.audio,
        clip.sample_rate,
        normalize=req.normalize,
        trim=req.trim_silence,
        fade_ms=req.auto_fade_ms,
    )
    filename = f"{uuid.uuid4().hex[:8]}_{seed}.wav"
    save_wav(audio, settings.output_dir / filename, clip.sample_rate)
    db.insert_sound(
        filename=filename,
        prompt=req.prompt,
        duration=real_duration,
        sample_rate=clip.sample_rate,
        seed=seed,
        category=req.category,
        tags=req.tags,
        model=backend.info.name,
    )
    return models.GeneratedFile(
        filename=filename,
        url=f"/audio/{filename}",
        duration=real_duration,
        seed=seed,
        sample_rate=clip.sample_rate,
        model=backend.info.name,
    )


@app.post("/generate", response_model=models.GenerateResponse)
async def generate(req: models.GenerateRequest) -> models.GenerateResponse:
    if not inference.manager.any_loaded:
        raise HTTPException(
            status_code=503,
            detail="No backend is loaded yet. Try /health to check status.",
        )

    t0 = time.time()
    base_seed = req.seed if req.seed is not None else int(time.time() * 1000) % (2**31)
    seeds = [base_seed + i for i in range(req.num_variations)]

    # Sequential per-model: a single GPU runs one diffusion at a time.
    files = [_generate_one(req, s) for s in seeds]
    used_model = files[0].model if files else (req.model or settings.default_backend)

    return models.GenerateResponse(
        files=files,
        prompt=req.prompt,
        duration=req.duration,
        elapsed_ms=int((time.time() - t0) * 1000),
        model=used_model,
    )


@app.post("/generate/template", response_model=models.GenerateResponse)
async def generate_from_template(req: models.TemplateGenerateRequest) -> models.GenerateResponse:
    tpl = find_template(req.category, req.variant)
    if not tpl:
        raise HTTPException(404, detail=f"Template not found: {req.category}/{req.variant}")

    rendered = render_template(tpl, req.duration)
    inner = models.GenerateRequest(
        prompt=rendered,
        duration=req.duration,
        num_variations=req.num_variations,
        guidance_scale=req.guidance_scale,
        seed=req.seed,
        category=req.category,
        tags=[req.category, req.variant],
        model=req.model,
    )
    return await generate(inner)


# === Audio file serving ===
@app.get("/audio/{filename}")
async def get_audio(filename: str) -> FileResponse:
    if "/" in filename or "\\" in filename or ".." in filename:
        raise HTTPException(400, detail="Invalid filename")
    filepath = settings.output_dir / filename
    if not filepath.exists():
        raise HTTPException(404, detail="File not found")
    return FileResponse(filepath, media_type="audio/wav", filename=filename)


# === Library ===
@app.get("/library", response_model=models.SoundLibraryResponse)
async def library(
    q: str | None = Query(default=None, description="search by prompt or tags"),
    category: str | None = Query(default=None),
    favorite: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> models.SoundLibraryResponse:
    items, total = db.list_sounds(
        query=q, category=category, favorite_only=favorite, limit=limit, offset=offset
    )
    return models.SoundLibraryResponse(
        items=[
            models.SoundMetadata(
                id=row["id"],
                filename=row["filename"],
                url=f"/audio/{row['filename']}",
                prompt=row["prompt"],
                duration=row["duration"],
                sample_rate=row["sample_rate"],
                seed=row["seed"],
                category=row["category"],
                tags=row["tags"],
                favorite=row["favorite"],
                created_at=row["created_at"],
                model=row.get("model"),
            )
            for row in items
        ],
        total=total,
    )


@app.post("/library/{sound_id}/favorite")
async def set_favorite(sound_id: int, favorite: bool = Query(...)) -> dict:
    if not db.set_favorite(sound_id, favorite):
        raise HTTPException(404, detail="Sound not found")
    return {"ok": True, "id": sound_id, "favorite": favorite}


@app.post("/library/{sound_id}/tags")
async def update_tags(sound_id: int, tags: list[str]) -> dict:
    if not db.update_tags(sound_id, tags):
        raise HTTPException(404, detail="Sound not found")
    return {"ok": True, "id": sound_id, "tags": tags}


@app.delete("/library/{sound_id}")
async def delete_sound(sound_id: int) -> dict:
    filename = db.delete_sound(sound_id)
    if not filename:
        raise HTTPException(404, detail="Sound not found")
    fp = settings.output_dir / filename
    if fp.exists():
        fp.unlink()
    return {"ok": True, "id": sound_id}


@app.post("/library/cleanup")
async def cleanup_library() -> dict:
    """Drop DB rows whose audio file is missing from disk."""
    removed = db.cleanup_orphans(settings.output_dir)
    return {"ok": True, "removed": removed}


# === Error handlers ===
@app.exception_handler(Exception)
async def global_exception_handler(request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": exc.__class__.__name__, "detail": str(exc)},
    )


# === Entry point ===
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "server:app",
        host=settings.host,
        port=settings.port,
        reload=False,
        log_level="info",
    )

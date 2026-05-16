"""
SQLite cache of generated sounds.

Lightweight sqlite3 layer (no ORM). Sufficient for MVP — switch to SQLAlchemy
if it grows.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Iterator, Optional

from config import settings


SCHEMA = """
CREATE TABLE IF NOT EXISTS sounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT NOT NULL UNIQUE,
    prompt TEXT NOT NULL,
    duration REAL NOT NULL,
    sample_rate INTEGER NOT NULL,
    seed INTEGER NOT NULL,
    category TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    favorite INTEGER NOT NULL DEFAULT 0,
    model TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sounds_prompt ON sounds(prompt);
CREATE INDEX IF NOT EXISTS idx_sounds_category ON sounds(category);
CREATE INDEX IF NOT EXISTS idx_sounds_model ON sounds(model);
CREATE INDEX IF NOT EXISTS idx_sounds_created_at ON sounds(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sounds_favorite ON sounds(favorite);
"""

# Lightweight migration: add `model` column if upgrading from 0.1.0 schema
_MIGRATIONS = [
    "ALTER TABLE sounds ADD COLUMN model TEXT",
]


@contextmanager
def connect(db_path: Path | None = None) -> Iterator[sqlite3.Connection]:
    path = db_path or settings.db_path
    conn = sqlite3.connect(str(path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(SCHEMA)
        # Apply best-effort migrations (silently ignore "duplicate column" errors)
        for sql in _MIGRATIONS:
            try:
                conn.execute(sql)
            except sqlite3.OperationalError:
                pass


def insert_sound(
    *,
    filename: str,
    prompt: str,
    duration: float,
    sample_rate: int,
    seed: int,
    category: Optional[str] = None,
    tags: Optional[list[str]] = None,
    model: Optional[str] = None,
) -> int:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO sounds (filename, prompt, duration, sample_rate, seed,
                                category, tags, favorite, model, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                filename,
                prompt,
                duration,
                sample_rate,
                seed,
                category,
                json.dumps(tags or []),
                model,
                datetime.utcnow().isoformat(timespec="seconds"),
            ),
        )
        return int(cur.lastrowid)


def list_sounds(
    *,
    query: Optional[str] = None,
    category: Optional[str] = None,
    favorite_only: bool = False,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[dict], int]:
    where: list[str] = []
    args: list = []
    if query:
        where.append("(prompt LIKE ? OR tags LIKE ?)")
        args.extend([f"%{query}%", f"%{query}%"])
    if category:
        where.append("category = ?")
        args.append(category)
    if favorite_only:
        where.append("favorite = 1")
    where_sql = ("WHERE " + " AND ".join(where)) if where else ""

    with connect() as conn:
        total = conn.execute(f"SELECT COUNT(*) FROM sounds {where_sql}", args).fetchone()[0]
        rows = conn.execute(
            f"""
            SELECT * FROM sounds {where_sql}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
            """,
            [*args, limit, offset],
        ).fetchall()

    items = [_row_to_dict(r) for r in rows]
    return items, int(total)


def get_sound(sound_id: int) -> Optional[dict]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM sounds WHERE id = ?", (sound_id,)).fetchone()
    return _row_to_dict(row) if row else None


def set_favorite(sound_id: int, favorite: bool) -> bool:
    with connect() as conn:
        cur = conn.execute("UPDATE sounds SET favorite = ? WHERE id = ?", (int(favorite), sound_id))
        return cur.rowcount > 0


def update_tags(sound_id: int, tags: list[str]) -> bool:
    with connect() as conn:
        cur = conn.execute(
            "UPDATE sounds SET tags = ? WHERE id = ?",
            (json.dumps(tags), sound_id),
        )
        return cur.rowcount > 0


def delete_sound(sound_id: int) -> Optional[str]:
    with connect() as conn:
        row = conn.execute("SELECT filename FROM sounds WHERE id = ?", (sound_id,)).fetchone()
        if not row:
            return None
        conn.execute("DELETE FROM sounds WHERE id = ?", (sound_id,))
        return row["filename"]


def cleanup_orphans(output_dir: Path) -> int:
    """Remove DB rows whose underlying WAV file is no longer on disk.

    Useful at startup (and via the /library/cleanup endpoint) when files were
    deleted out-of-band. Returns the number of rows removed.
    """
    with connect() as conn:
        rows = conn.execute("SELECT id, filename FROM sounds").fetchall()
        missing_ids = [r["id"] for r in rows if not (output_dir / r["filename"]).exists()]
        if not missing_ids:
            return 0
        placeholders = ",".join("?" for _ in missing_ids)
        conn.execute(f"DELETE FROM sounds WHERE id IN ({placeholders})", missing_ids)
        return len(missing_ids)


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["tags"] = json.loads(d.get("tags") or "[]")
    d["favorite"] = bool(d.get("favorite", 0))
    return d

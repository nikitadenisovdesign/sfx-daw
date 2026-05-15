"""Server configuration. Loaded from environment / .env."""

from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="SFX_",
        extra="ignore",
    )

    # Paths
    output_dir: Path = Path("C:/sfx-daw/generated")
    db_path: Path = Path("C:/sfx-daw/sfx_cache.db")
    models_dir: Path = Path("./models")  # holds stable-audio-open/ and tangoflux/

    # Default backend (one of "stable-audio-open" / "tangoflux")
    default_backend: str = "stable-audio-open"

    # Comma-separated list of backends to autoload at startup.
    # Empty = autoload only `default_backend`. "*" = load all available.
    autoload_backends: str = ""

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: str = "*"

    # Inference defaults (overridable per-request)
    default_steps: int = 100
    default_guidance: float = 7.0
    default_sampler: str = "dpmpp-3m-sde"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def autoload_list(self) -> list[str]:
        s = self.autoload_backends.strip()
        if s == "*":
            return ["*"]
        if not s:
            return [self.default_backend]
        return [b.strip() for b in s.split(",") if b.strip()]


settings = Settings()
settings.output_dir.mkdir(parents=True, exist_ok=True)
settings.db_path.parent.mkdir(parents=True, exist_ok=True)
settings.models_dir.mkdir(parents=True, exist_ok=True)

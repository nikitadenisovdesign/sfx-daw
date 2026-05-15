// Утилиты форматирования времени / тайм-кодов.

export function formatTime(seconds: number, framerate?: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00.00";
  const totalMs = Math.round(seconds * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  if (framerate) {
    const frames = Math.floor((seconds % 1) * framerate);
    return `${pad(m)}:${pad(s)}.${pad(frames)}`;
  }
  return `${pad(m)}:${pad(s)}.${String(ms).padStart(3, "0").slice(0, 2)}`;
}

function pad(n: number, len = 2): string {
  return String(n).padStart(len, "0");
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function snapToFrame(seconds: number, framerate: number): number {
  if (!framerate) return seconds;
  const frames = Math.round(seconds * framerate);
  return frames / framerate;
}

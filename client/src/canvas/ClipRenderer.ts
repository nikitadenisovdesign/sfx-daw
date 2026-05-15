// Цвета клипов — производные от цвета дорожки.

export interface ClipColors {
  fill: string;
  border: string;
  waveform: string;
}

/**
 * Принимаем строку цвета дорожки (CSS-переменная или hex).
 * Поскольку CSS-переменные нельзя резолвить из canvas, ниже — фоллбэк
 * на конкретные hex-значения, синхронизированные с :root в index.css.
 */
const TRACK_HEX: Record<string, string> = {
  "var(--track-1)": "#7c5cff",
  "var(--track-2)": "#5cdfff",
  "var(--track-3)": "#ff8a4c",
  "var(--track-4)": "#4ade80",
  "var(--track-5)": "#f472b6",
  "var(--track-6)": "#fbbf24",
  "var(--track-7)": "#94a3b8",
  "var(--track-8)": "#a78bfa",
};

export function clipColors(trackColor: string): ClipColors {
  const hex = TRACK_HEX[trackColor] ?? trackColor;
  return {
    fill: hexAlpha(hex, 0.35),
    border: hexAlpha(hex, 0.85),
    waveform: hexAlpha(hex, 0.95),
  };
}

function hexAlpha(hex: string, a: number): string {
  // Поддерживаем #rgb / #rrggbb
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

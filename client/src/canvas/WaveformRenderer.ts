// Считает min/max пики по аудиобуферу для отрисовки волны в клипах.
// Возвращает Float32Array из чередующихся (min, max) на каждый блок.

const BLOCK_SAMPLES = 256;

export function computePeaks(buffer: AudioBuffer): Float32Array {
  const length = buffer.length;
  const blocks = Math.ceil(length / BLOCK_SAMPLES);
  const out = new Float32Array(blocks * 2);

  // микшируем все каналы в один (моно для отображения)
  const ch0 = buffer.getChannelData(0);
  const useStereo = buffer.numberOfChannels > 1;
  const ch1 = useStereo ? buffer.getChannelData(1) : null;

  for (let b = 0; b < blocks; b++) {
    const start = b * BLOCK_SAMPLES;
    const end = Math.min(start + BLOCK_SAMPLES, length);
    let mn = Infinity;
    let mx = -Infinity;
    for (let i = start; i < end; i++) {
      const v = ch1 ? (ch0[i] + ch1[i]) * 0.5 : ch0[i];
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === Infinity) mn = 0;
    if (mx === -Infinity) mx = 0;
    out[b * 2] = mn;
    out[b * 2 + 1] = mx;
  }
  return out;
}

/** Размер блока — экспортируем чтобы синхронизировать с TimelineRenderer. */
export const PEAK_BLOCK_SAMPLES = BLOCK_SAMPLES;

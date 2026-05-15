// Web Audio API граф: загрузка и кэш AudioBuffer-ов, шины треков, мастер.

export class AudioBufferCache {
  private cache = new Map<string, Promise<AudioBuffer>>();

  constructor(private ctx: BaseAudioContext) {}

  async load(url: string): Promise<AudioBuffer> {
    let pending = this.cache.get(url);
    if (!pending) {
      pending = (async () => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
        const arr = await res.arrayBuffer();
        return await this.ctx.decodeAudioData(arr);
      })();
      this.cache.set(url, pending);
    }
    return pending;
  }

  has(url: string): boolean {
    return this.cache.has(url);
  }

  /** Возвращает уже разрешённый AudioBuffer или undefined если не загружен. */
  peek(url: string): Promise<AudioBuffer> | undefined {
    return this.cache.get(url);
  }

  clear(): void {
    this.cache.clear();
  }
}

export interface TrackBus {
  trackId: string;
  gain: GainNode;
  panner: StereoPannerNode;
}

export class MixerGraph {
  readonly master: GainNode;
  private buses = new Map<string, TrackBus>();

  constructor(public readonly ctx: AudioContext, masterVolume = 0.9) {
    this.master = ctx.createGain();
    this.master.gain.value = masterVolume;
    this.master.connect(ctx.destination);
  }

  ensureTrack(trackId: string, volume = 0.85, pan = 0): TrackBus {
    let bus = this.buses.get(trackId);
    if (bus) return bus;
    const gain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();
    gain.gain.value = volume;
    panner.pan.value = pan;
    panner.connect(gain).connect(this.master);
    bus = { trackId, gain, panner };
    this.buses.set(trackId, bus);
    return bus;
  }

  removeTrack(trackId: string): void {
    const bus = this.buses.get(trackId);
    if (!bus) return;
    bus.gain.disconnect();
    bus.panner.disconnect();
    this.buses.delete(trackId);
  }

  setTrackVolume(trackId: string, v: number): void {
    const bus = this.buses.get(trackId);
    if (bus) bus.gain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  setTrackPan(trackId: string, p: number): void {
    const bus = this.buses.get(trackId);
    if (bus) bus.panner.pan.setTargetAtTime(p, this.ctx.currentTime, 0.01);
  }

  setMasterVolume(v: number): void {
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.01);
  }

  destination(trackId: string): AudioNode {
    return this.ensureTrack(trackId).panner;
  }

  dispose(): void {
    for (const bus of this.buses.values()) {
      bus.gain.disconnect();
      bus.panner.disconnect();
    }
    this.master.disconnect();
    this.buses.clear();
  }
}

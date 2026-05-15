import { useEffect, useMemo, useState } from "react";
import { useGenerateSFX } from "@/hooks/useGenerateSFX";
import { useAudioEngine } from "@/hooks/useAudioEngine";
import { useProjectStore } from "@/store/projectStore";
import { useUIStore } from "@/store/uiStore";
import { audioUrl, api } from "@/lib/api";
import type { BackendInfoApi, GeneratedFile, TemplateInfo } from "@/types";

const QUICK_DURATIONS = [0.3, 0.5, 1, 2, 5, 10, 20, 30, 47];

export function GeneratePanel(): JSX.Element {
  const [prompt, setPrompt] = useState("metallic swoosh with sharp attack");
  const [duration, setDuration] = useState(0.5);
  const [guidance, setGuidance] = useState<number | null>(null);
  const [variations, setVariations] = useState(4);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [backends, setBackends] = useState<BackendInfoApi[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const { loading, error, result, generate } = useGenerateSFX();
  const { engine, ensurePeaks } = useAudioEngine();
  const project = useProjectStore((s) => s.project);
  const playhead = useUIStore((s) => s.playheadSeconds);
  const previewPlayingUrl = useUIStore((s) => s.previewPlayingUrl);

  // Загружаем шаблоны
  useEffect(() => {
    api.templates().then((r) => setTemplates(r.templates)).catch(() => { /* */ });
  }, []);

  // Загружаем список бэкендов и периодически обновляем (для отслеживания загрузки)
  useEffect(() => {
    let cancelled = false;
    const fetchModels = (): void => {
      api.models().then((r) => {
        if (cancelled) return;
        setBackends(r.items);
        setSelectedModel((cur) => cur ?? r.default);
      }).catch(() => { /* */ });
    };
    fetchModels();
    const id = setInterval(fetchModels, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const activeBackend = useMemo(
    () => backends.find((b) => b.name === selectedModel) ?? null,
    [backends, selectedModel],
  );

  const maxDuration = activeBackend?.max_duration_seconds ?? 47;

  // При смене бэкенда подставляем дефолтные значения и зажимаем duration в допустимый максимум
  useEffect(() => {
    if (!activeBackend) return;
    setGuidance(activeBackend.default_guidance);
    setDuration((d) => Math.min(d, activeBackend.max_duration_seconds));
  }, [activeBackend?.name]); // eslint-disable-line react-hooks/exhaustive-deps

  const categories = Array.from(new Set(templates.map((t) => t.category)));

  const togglePreview = async (file: GeneratedFile): Promise<void> => {
    const url = audioUrl(file.url);
    if (previewPlayingUrl === url) {
      engine.stopPreview();
      return;
    }
    await engine.previewOnce(url);
  };

  const addToTimeline = async (file: GeneratedFile): Promise<void> => {
    const url = audioUrl(file.url);
    await ensurePeaks(url);
    const trackId = project.tracks[0]?.id;
    if (!trackId) return;
    useProjectStore.getState().addClip(
      trackId,
      {
        url,
        filename: file.filename,
        sourceDuration: file.duration,
        sampleRate: file.sample_rate,
      },
      playhead,
      `${prompt.slice(0, 24)}#${file.seed}`,
    );
  };

  const handleGenerate = async (): Promise<void> => {
    await generate({
      prompt,
      duration,
      guidanceScale: guidance ?? undefined,
      numVariations: variations,
      category: activeCategory ?? undefined,
      model: selectedModel ?? undefined,
    });
  };

  const applyTemplate = (t: TemplateInfo): void => {
    setPrompt(t.template.replace("{duration}", `${t.typical_duration}`));
    setDuration(t.typical_duration);
    setActiveCategory(t.category);
  };

  return (
    <div className="generate-pane">
      <div className="row">
        <div className="label">Generate SFX</div>
        <div className="spacer" />
        <span className="label" style={{ color: "var(--fg-3)" }}>
          @ {playhead.toFixed(2)}s
        </span>
      </div>

      {backends.length > 0 && (
        <div className="col" style={{ gap: 4 }}>
          <div className="label">Model</div>
          <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
            {backends.map((b) => (
              <button
                key={b.name}
                className={`chip ${selectedModel === b.name ? "active" : ""}`}
                onClick={() => setSelectedModel(b.name)}
                title={`${b.description}\n\nLicense: ${b.license}\n${b.loaded ? `Loaded · ${b.vram_used_gb}GB VRAM` : b.error ? `ERROR: ${b.error}` : "Not loaded"}`}
                style={{
                  opacity: b.loaded ? 1 : 0.55,
                  borderStyle: b.error ? "dashed" : "solid",
                }}
              >
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: 3, marginRight: 5,
                  background: b.loaded ? "var(--good)" : b.error ? "var(--bad)" : "var(--fg-3)",
                }} />
                {b.label}
                {b.is_default && <span style={{ color: "var(--fg-3)", marginLeft: 4 }}>·</span>}
              </button>
            ))}
          </div>
          {activeBackend && (
            <div style={{ fontSize: 10, color: "var(--fg-3)", lineHeight: 1.4 }}>
              max {activeBackend.max_duration_seconds}s · {activeBackend.sample_rate / 1000}kHz · {activeBackend.default_steps} steps default
              {!activeBackend.loaded && !activeBackend.error && " · loading…"}
              {activeBackend.error && <span style={{ color: "var(--bad)" }}> · {activeBackend.error}</span>}
            </div>
          )}
        </div>
      )}

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder='e.g. "soft cinematic whoosh with reverb tail"'
        rows={3}
        style={{ resize: "none", fontFamily: "var(--font-mono)" }}
      />

      <div className="col" style={{ gap: 4 }}>
        <div className="row">
          <span className="label">Duration</span>
          <span className="mono" style={{ color: "var(--fg-1)" }}>{duration.toFixed(2)}s</span>
        </div>
        <input
          type="range" min={0.1} max={maxDuration} step={0.05}
          value={Math.min(duration, maxDuration)}
          onChange={(e) => setDuration(Number(e.target.value))}
        />
        <div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
          {QUICK_DURATIONS.filter((d) => d <= maxDuration).map((d) => (
            <button key={d} className="ghost" style={{ padding: "2px 6px", fontSize: 10 }}
              onClick={() => setDuration(d)}>{d}s</button>
          ))}
          <button
            className="ghost"
            style={{ padding: "2px 6px", fontSize: 10 }}
            onClick={() => setDuration(maxDuration)}
            title={`Maximum for ${activeBackend?.label ?? "this model"}`}
          >
            max
          </button>
        </div>
      </div>

      <div className="col" style={{ gap: 4 }}>
        <div className="row">
          <span className="label">Guidance</span>
          <span className="mono" style={{ color: "var(--fg-1)" }}>
            {(guidance ?? activeBackend?.default_guidance ?? 7.0).toFixed(1)}
          </span>
        </div>
        <input
          type="range" min={1} max={15} step={0.5}
          value={guidance ?? activeBackend?.default_guidance ?? 7.0}
          onChange={(e) => setGuidance(Number(e.target.value))}
        />
      </div>

      <div className="row">
        <span className="label">Variations</span>
        <select
          value={variations} onChange={(e) => setVariations(Number(e.target.value))}
          style={{ width: 70 }}
        >
          {[1, 2, 4, 6, 8].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>

      <button className="primary" onClick={handleGenerate} disabled={loading}>
        {loading ? "Generating…" : `⚡ Generate ${variations} variation${variations > 1 ? "s" : ""}`}
      </button>

      {error && <div style={{ color: "var(--bad)", fontSize: 11 }}>⚠ {error}</div>}

      <div className="divider" />
      <div className="label">Templates</div>
      <div className="tag-row">
        <button
          className={`chip ${activeCategory === null ? "active" : ""}`}
          onClick={() => setActiveCategory(null)}
        >all</button>
        {categories.map((c) => (
          <button
            key={c}
            className={`chip ${activeCategory === c ? "active" : ""}`}
            onClick={() => setActiveCategory(c)}
          >{c}</button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 4 }}>
        {templates
          .filter((t) => activeCategory === null || t.category === activeCategory)
          .slice(0, 6)
          .map((t) => (
            <button
              key={`${t.category}-${t.variant}`}
              className="ghost"
              style={{ textAlign: "left", padding: "4px 8px", fontSize: 11 }}
              title={t.description}
              onClick={() => applyTemplate(t)}
            >
              <span style={{ color: "var(--accent-2)" }}>{t.category}/{t.variant}</span>
              <span style={{ color: "var(--fg-3)" }}> · {t.typical_duration}s</span>
            </button>
          ))}
      </div>

      {result && (
        <>
          <div className="divider" />
          <div className="label">Variations · {result.elapsed_ms}ms</div>
          <div className="variation-grid">
            {result.files.map((f, i) => {
              const isPlaying = previewPlayingUrl === audioUrl(f.url);
              return (
              <div key={f.filename} className="variation-card">
                <button className="play-btn" onClick={() => togglePreview(f)}>
                  {isPlaying ? "⏸" : "▶"} #{i + 1} <span className="seed">{f.duration.toFixed(2)}s</span>
                </button>
                <button className="ghost" style={{ fontSize: 11 }}
                  onClick={() => addToTimeline(f)}>+ Add to T1</button>
                <div className="seed">seed: {f.seed}</div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

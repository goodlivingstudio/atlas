"use client";

import { useState } from "react";
import { ModeSelector } from "@/components/mode-selector";
import { KnowledgeStatus } from "@/components/knowledge-status";
import { LAYER_META, type AtlasMode, type KnowledgeLayer, type QueryResponse } from "@/lib/types";
import { Search, Loader2, ChevronRight, Layers, Pin, Sparkles } from "lucide-react";

export default function Home() {
  const [mode, setMode] = useState<AtlasMode>("DIAGNOSIS");
  const [query, setQuery] = useState("");
  const [filterLayer, setFilterLayer] = useState<KnowledgeLayer | "">("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: query.trim(),
          mode,
          layer: filterLayer || undefined,
          top_k: 5,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Query failed");
      }

      setResult(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "104px 24px 64px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 22, fontWeight: 400, color: "var(--text-primary)",
          letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 6px",
        }}>
          Operating Room
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          Set your mode, ask your question.
        </p>
      </div>

      {/* Knowledge base status */}
      <KnowledgeStatus />

      {/* Mode selector */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10,
        }}>
          Mode
        </div>
        <ModeSelector mode={mode} onChange={(m) => { setMode(m); setResult(null); }} />
      </div>

      {/* Query form */}
      <form onSubmit={handleQuery} style={{ marginBottom: 40 }}>
        {/* Layer filter */}
        <div style={{ marginBottom: 8 }}>
          <label
            htmlFor="layer-filter"
            style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
              fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--text-tertiary)",
            }}
          >
            <Layers size={10} />
            Layer filter
          </label>
          <select
            id="layer-filter"
            value={filterLayer}
            onChange={(e) => setFilterLayer(e.target.value as KnowledgeLayer | "")}
            style={{
              width: "100%", height: 52, padding: "0 14px",
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-btn)", color: filterLayer ? "var(--text-primary)" : "var(--text-tertiary)",
              fontSize: 13, cursor: "pointer",
            }}
          >
            <option value="">All layers</option>
            {(Object.entries(LAYER_META) as [KnowledgeLayer, typeof LAYER_META.core][]).map(
              ([key, meta]) => <option key={key} value={key}>{meta.label}</option>
            )}
          </select>
        </div>

        {/* Query input + submit */}
        <div style={{ display: "flex", gap: 8 }}>
          <label htmlFor="query-input" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)" }}>
            Query
          </label>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "0 16px", height: 52,
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-btn)",
          }}>
            <Search size={13} aria-hidden="true" style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              id="query-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "DIAGNOSIS"
                ? "What do you need to understand?"
                : "What position are you building?"
              }
              style={{
                flex: 1, height: "100%", background: "transparent", border: "none",
                outline: "none", color: "var(--text-primary)", fontSize: 14,
                letterSpacing: "-0.01em",
              }}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            aria-label={loading ? "Running query" : "Run query"}
            style={{
              height: 52, padding: "0 24px",
              background: loading ? "var(--bg-elevated)" : "var(--accent-primary)",
              border: `1px solid ${loading ? "var(--border)" : "var(--accent-secondary)"}`,
              borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              cursor: loading || !query.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              opacity: !query.trim() && !loading ? 0.5 : 1,
              transition: "opacity 0.15s, border-color 0.15s, background 0.15s",
            }}
          >
            {loading
              ? <Loader2 size={13} aria-hidden="true" style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
              : <ChevronRight size={13} aria-hidden="true" />
            }
            {loading ? "Running" : "Run"}
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "14px 16px", marginBottom: 24,
            background: "var(--bg-surface)", border: "1px solid var(--error)",
            borderRadius: 4, color: "var(--error)", fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          {/* Mode + query label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--accent-secondary)", fontFamily: "var(--font-mono)",
            }}>
              {mode}
            </span>
            <span style={{ color: "var(--border)", fontSize: 12 }}>—</span>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontStyle: "italic" }}>
              {result.query}
            </span>
          </div>

          {/* Answer */}
          <div style={{
            padding: "24px 28px", marginBottom: 24,
            background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-card)",
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--accent-secondary)",
              marginBottom: 14, display: "flex", alignItems: "center", gap: 6,
            }}>
              <Sparkles size={11} aria-hidden="true" />
              Atlas
            </div>
            <div style={{
              fontSize: 14, color: "var(--text-primary)",
              lineHeight: 1.75, whiteSpace: "pre-wrap",
            }}>
              {result.answer}
            </div>
          </div>

          {/* Sources — grouped */}
          {(() => {
            const pinned = result.sources.filter((s) => s.pinned);
            const retrieved = result.sources.filter((s) => !s.pinned);

            const renderSource = (source: typeof result.sources[0], localIndex: number, globalIndex: number) => (
              <div key={localIndex} style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "9px 14px",
                background: "var(--bg-surface)",
                border: `1px solid ${source.pinned ? "var(--bg-elevated)" : "var(--border)"}`,
                borderRadius: 4, fontSize: 12,
                opacity: source.pinned ? 0.65 : 1,
              }}>
                <span style={{
                  fontSize: 10, color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)", flexShrink: 0, width: 16,
                }}>
                  {globalIndex + 1}
                </span>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0,
                  background: LAYER_META[source.layer]?.color || "var(--text-tertiary)",
                }} />
                <span style={{ color: "var(--text-primary)", fontWeight: 500, flex: 1, minWidth: 0 }}>
                  {source.document_title}
                  {source.section_heading && (
                    <span style={{ color: "var(--text-tertiary)", fontWeight: 400 }}>
                      {" · "}{source.section_heading.replace(/^#+\s*/, "")}
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-mono)", flexShrink: 0,
                  color: source.pinned ? "var(--text-tertiary)" : "var(--accent-secondary)",
                }}>
                  {source.pinned ? "pinned" : `${(source.similarity * 100).toFixed(1)}%`}
                </span>
              </div>
            );

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {pinned.length > 0 && (
                  <div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: "var(--text-tertiary)",
                    }}>
                      <Pin size={9} aria-hidden="true" />
                      Core — always in context
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {pinned.map((s, i) => renderSource(s, i, i))}
                    </div>
                  </div>
                )}
                {retrieved.length > 0 && (
                  <div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6, marginBottom: 6,
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                      textTransform: "uppercase", color: "var(--text-tertiary)",
                    }}>
                      <Search size={9} aria-hidden="true" />
                      Retrieved
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {retrieved.map((s, i) => renderSource(s, i, pinned.length + i))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </main>
  );
}

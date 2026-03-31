"use client";

import { useState } from "react";
import { ModeSelector } from "@/components/mode-selector";
import { KnowledgeStatus } from "@/components/knowledge-status";
import { LAYER_META, type AtlasMode, type KnowledgeLayer, type QueryResponse } from "@/lib/types";
import { Search, Loader2, Database, ChevronRight } from "lucide-react";

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "80px 24px 48px" }}>

      {/* Page header */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 22,
          fontWeight: 400,
          color: "var(--text-primary)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          margin: "0 0 6px",
        }}>
          Operating Room
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
          Set your mode, ask your question.
        </p>
      </div>

      {/* Knowledge base status */}
      <KnowledgeStatus />

      {/* Mode selector — first-class */}
      <div style={{ marginBottom: 8 }}>
        <div style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
          marginBottom: 10,
        }}>
          Mode
        </div>
        <ModeSelector mode={mode} onChange={(m) => { setMode(m); setResult(null); }} />
      </div>

      {/* Query form */}
      <form onSubmit={handleQuery} style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
          <div style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "0 14px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}>
            <Search size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={mode === "DIAGNOSIS"
                ? "What do you need to understand?"
                : "What position are you building?"
              }
              style={{
                flex: 1,
                padding: "13px 0",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 14,
                letterSpacing: "-0.01em",
              }}
            />
          </div>
          <select
            value={filterLayer}
            onChange={(e) => setFilterLayer(e.target.value as KnowledgeLayer | "")}
            style={{
              padding: "0 12px",
              background: "var(--bg-surface)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              color: "var(--text-secondary)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <option value="">All layers</option>
            {(Object.entries(LAYER_META) as [KnowledgeLayer, typeof LAYER_META.core][]).map(
              ([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              )
            )}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            style={{
              padding: "0 20px",
              background: loading ? "var(--bg-elevated)" : "var(--accent-primary)",
              border: `1px solid ${loading ? "var(--border)" : "var(--accent-secondary)"}`,
              borderRadius: 4,
              color: "var(--accent-secondary)",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: loading ? "wait" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: !query.trim() && !loading ? 0.5 : 1,
            }}
          >
            {loading
              ? <Loader2 size={13} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
              : <ChevronRight size={13} />
            }
            Run
          </button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 16px",
          background: "var(--bg-surface)",
          border: "1px solid var(--error)",
          borderRadius: 4,
          color: "var(--error)",
          fontSize: 13,
          marginBottom: 24,
        }}>
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div>
          {/* Mode badge */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 16,
          }}>
            <span style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-secondary)",
              fontFamily: "var(--font-mono)",
            }}>
              {mode}
            </span>
            <span style={{ color: "var(--border)", fontSize: 12 }}>—</span>
            <span style={{
              fontSize: 12,
              color: "var(--text-tertiary)",
              fontStyle: "italic",
            }}>
              {result.query}
            </span>
          </div>

          {/* Answer */}
          <div style={{
            padding: "20px 24px",
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            marginBottom: 20,
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--accent-secondary)",
              marginBottom: 14,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}>
              <Database size={11} />
              Atlas
            </div>
            <div style={{
              fontSize: 14,
              color: "var(--text-primary)",
              lineHeight: 1.75,
              whiteSpace: "pre-wrap",
            }}>
              {result.answer}
            </div>
          </div>

          {/* Sources */}
          <div style={{
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--text-tertiary)",
            marginBottom: 8,
          }}>
            Sources
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {result.sources.map((source, i) => (
              <div key={i} style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 14px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: 4,
                fontSize: 12,
              }}>
                <div style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: LAYER_META[source.layer]?.color || "var(--text-tertiary)",
                  flexShrink: 0,
                }} />
                <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                  {source.document_title}
                </span>
                <span style={{ color: "var(--text-tertiary)" }}>
                  chunk {source.chunk_index}
                </span>
                <span style={{
                  marginLeft: "auto",
                  color: "var(--accent-secondary)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                }}>
                  {(source.similarity * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

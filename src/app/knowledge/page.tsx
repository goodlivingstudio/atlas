"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { LAYER_META, type KnowledgeLayer } from "@/lib/types";

// ─── Data shapes ──────────────────────────────────────────────────────────────

interface LayerStatus {
  documents: number;
  chunks: number;
}

interface DocumentRecord {
  id: string;
  document_title: string;
  layer: KnowledgeLayer;
  chunk_count: number;
  source_path: string;
}

interface StatusData {
  total_documents: number;
  total_chunks: number;
  by_layer: Partial<Record<KnowledgeLayer, LayerStatus>>;
  documents: DocumentRecord[];
}

interface DocDetail {
  id: string;
  title: string;
  layer: KnowledgeLayer;
  source_path: string;
  metadata: Record<string, unknown>;
  content: string;
}

// ─── Score + health system ────────────────────────────────────────────────────

const LAYER_WEIGHTS: Record<KnowledgeLayer, number> = {
  core: 0.30,
  frameworks: 0.25,
  clients: 0.20,
  market: 0.15,
  live: 0.10,
};

function computeLayerScore(chunks: number): number {
  if (chunks === 0) return 0;
  if (chunks < 10) return 25;
  if (chunks < 30) return 45;
  if (chunks < 80) return 65;
  if (chunks < 200) return 82;
  return 95;
}

function computeGlobalScore(status: StatusData): number {
  const layers = ["core", "frameworks", "clients", "market", "live"] as const;
  let weighted = 0;
  for (const layer of layers) {
    const chunks = status.by_layer[layer]?.chunks ?? 0;
    weighted += computeLayerScore(chunks) * LAYER_WEIGHTS[layer];
  }
  return Math.round(weighted);
}

type HealthState = "optimal" | "healthy" | "review" | "gap" | "unmapped";

function getState(score: number, hasData: boolean): HealthState {
  if (!hasData) return "unmapped";
  if (score >= 85) return "optimal";
  if (score >= 65) return "healthy";
  if (score >= 40) return "review";
  return "gap";
}

const STATE_META: Record<HealthState, { label: string; color: string }> = {
  optimal:  { label: "Optimal",  color: "var(--live)" },
  healthy:  { label: "Reliable", color: "var(--accent-secondary)" },
  review:   { label: "Review",   color: "#F59E0B" },
  gap:      { label: "Gap",      color: "#F87171" },
  unmapped: { label: "Unmapped", color: "var(--text-tertiary)" },
};

// ─── Interpretation sentence ──────────────────────────────────────────────────

type LayerEntry = [KnowledgeLayer, typeof LAYER_META[KnowledgeLayer]];

function buildInterpretation(status: StatusData, layers: LayerEntry[]): string {
  const strong = layers.filter(([k]) => computeLayerScore(status.by_layer[k]?.chunks ?? 0) >= 65).map(([, m]) => m.label);
  const gaps   = layers.filter(([k]) => (status.by_layer[k]?.chunks ?? 0) === 0).map(([, m]) => m.label);
  const weak   = layers.filter(([k]) => {
    const s = computeLayerScore(status.by_layer[k]?.chunks ?? 0);
    return s > 0 && s < 65;
  }).map(([, m]) => m.label);

  if (strong.length === 0 && gaps.length === 5) return "Knowledge base is empty. Retrieval has nothing to work with.";
  if (strong.length >= 4) {
    return `Retrieval is well-armed across ${strong.length} layers.${
      gaps.length > 0
        ? ` ${gaps.join(" and ")} ${gaps.length === 1 ? "is" : "are"} unmapped.`
        : ""
    }`;
  }

  const parts: string[] = [];
  if (strong.length > 0) parts.push(`${strong.join(" and ")} ${strong.length === 1 ? "is" : "are"} strong`);
  if (weak.length > 0)   parts.push(`${weak.join(" and ")} ${weak.length === 1 ? "is" : "are"} thin`);
  if (gaps.length > 0)   parts.push(`${gaps.join(" and ")} ${gaps.length === 1 ? "is" : "are"} unmapped`);
  return parts.join(". ") + ".";
}

// ─── Escalation helpers ───────────────────────────────────────────────────────

function buildEscalationHref(query: string): string {
  return "/ask?q=" + encodeURIComponent(query);
}

// ─── Layer guidance ───────────────────────────────────────────────────────────

const LAYER_GUIDANCE: Record<KnowledgeLayer, string> = {
  core:       "Add Atlas doctrine or operating principles",
  frameworks: "Add strategic frameworks like Jobs-to-Be-Done or Challenger Brand",
  clients:    "Start an engagement and ingest a brief",
  market:     "Add industry reports, research, or competitive intel",
  live:       "Configure live data sources",
};

// ─── SVG Arc ─────────────────────────────────────────────────────────────────

function LayerArc({ score, color, size = 48 }: { score: number; color: string; size?: number }) {
  const r    = 18;
  const cx   = 24;
  const cy   = 24;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const displayScore = score > 0 ? String(Math.round(score)) : "—";

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth="3.5" />
      {score > 0 && (
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          style={{ transition: "stroke-dasharray 0.6s cubic-bezier(0.16, 1, 0.3, 1)" }}
        />
      )}
      <text
        x={cx} y={cy + 5}
        textAnchor="middle"
        fontSize="12"
        fontWeight="600"
        fill={score > 0 ? color : "var(--text-tertiary)"}
        fontFamily="var(--font-mono)"
      >
        {displayScore}
      </text>
    </svg>
  );
}

// ─── Preview Modal ────────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose }: { doc: DocDetail; onClose: () => void }) {
  const meta       = LAYER_META[doc.layer];
  const metaEntries = Object.entries(doc.metadata ?? {});

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.6)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          maxWidth: 600, width: "100%",
          maxHeight: "80vh", overflowY: "auto",
          padding: "28px 28px 24px",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute", top: 16, right: 16,
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-tertiary)", fontSize: 18, lineHeight: 1,
            padding: 4, borderRadius: 4,
          }}
          aria-label="Close preview"
        >
          ×
        </button>

        <h2 style={{
          fontSize: 16, fontWeight: 500, color: "var(--text-primary)",
          margin: "0 32px 12px 0", lineHeight: 1.3,
        }}>
          {doc.title}
        </h2>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }} />
          <span style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
          }}>
            {meta.label}
          </span>
        </div>

        {doc.source_path && (
          <div style={{ marginBottom: 14 }}>
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
              textTransform: "uppercase", display: "block", marginBottom: 4,
            }}>
              Source
            </span>
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", wordBreak: "break-all" }}>
              {doc.source_path}
            </span>
          </div>
        )}

        {metaEntries.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
              textTransform: "uppercase", display: "block", marginBottom: 6,
            }}>
              Metadata
            </span>
            <div style={{
              display: "flex", flexDirection: "column", gap: 3,
              background: "var(--bg-elevated)", borderRadius: 6, padding: "10px 12px",
            }}>
              {metaEntries.map(([k, v]) => (
                <div key={k} style={{ display: "flex", gap: 8, fontSize: 11 }}>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", minWidth: 100, flexShrink: 0 }}>{k}</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-secondary)", wordBreak: "break-word" }}>{String(v)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
            textTransform: "uppercase", display: "block", marginBottom: 6,
          }}>
            Content preview
          </span>
          {doc.content ? (
            <pre style={{
              fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
              lineHeight: 1.65, background: "var(--bg-elevated)", borderRadius: 6,
              padding: "10px 12px", margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
              maxHeight: 200, overflowY: "auto",
            }}>
              {doc.content.slice(0, 500)}{doc.content.length > 500 ? "…" : ""}
            </pre>
          ) : (
            <p style={{ fontSize: 12, color: "var(--text-tertiary)", margin: 0, fontStyle: "italic" }}>
              No content preview available.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Zone 1: Verdict panel ────────────────────────────────────────────────────

const LAYER_ORDER: KnowledgeLayer[] = ["core", "frameworks", "clients", "market", "live"];

const LAYER_SHORT_LABEL: Record<KnowledgeLayer, string> = {
  core:       "Core",
  frameworks: "Frmwks",
  clients:    "Clients",
  market:     "Market",
  live:       "Live",
};

function VerdictPanel({ status, layers }: { status: StatusData; layers: LayerEntry[] }) {
  const globalScore    = computeGlobalScore(status);
  const hasAnyData     = status.total_chunks > 0;
  const globalState    = getState(globalScore, hasAnyData);
  const stateMeta      = STATE_META[globalState];
  const interpretation = buildInterpretation(status, layers);

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-card)",
      padding: "24px 28px",
      marginBottom: 20,
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 32,
    }}>
      {/* Left: score + labels */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", marginBottom: 10,
        }}>
          Retrieval Readiness
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 4, marginBottom: 10 }}>
          <span style={{
            fontSize: 64, fontWeight: 500, lineHeight: 1,
            color: stateMeta.color,
          }}>
            {globalScore}
          </span>
          <span style={{
            fontSize: 24, fontWeight: 400, color: stateMeta.color,
            lineHeight: 1, paddingBottom: 6,
          }}>
            %
          </span>
        </div>

        <p style={{
          fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.55,
          margin: "0 0 8px", maxWidth: 380,
        }}>
          {interpretation}
        </p>

        <span style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: stateMeta.color,
        }}>
          {stateMeta.label}
        </span>
      </div>

      {/* Right: five-segment bar */}
      <div style={{ flexShrink: 0, width: 200 }}>
        <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
          {LAYER_ORDER.map((layerKey) => {
            const chunks     = status.by_layer[layerKey]?.chunks ?? 0;
            const layerScore = computeLayerScore(chunks);
            const lState     = getState(layerScore, chunks > 0);
            const lColor     = STATE_META[lState].color;
            return (
              <div
                key={layerKey}
                style={{
                  flex: 1, height: 6,
                  borderRadius: 3,
                  background: lColor,
                  opacity: chunks === 0 ? 0.25 : 1,
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {LAYER_ORDER.map((layerKey) => (
            <div
              key={layerKey}
              style={{
                flex: 1,
                fontSize: 10, fontFamily: "var(--font-mono)",
                color: "var(--text-tertiary)",
                textAlign: "center",
                
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {LAYER_SHORT_LABEL[layerKey]}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Contributor chips ────────────────────────────────────────────────────────

function ContributorChips({ chunks, docCount }: { chunks: number; docCount: number }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
      {chunks >= 80 && (
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)",
          color: "var(--live)",
          background: "rgba(74, 222, 128, 0.15)",
          border: "1px solid rgba(74, 222, 128, 0.4)",
          borderRadius: 4, padding: "2px 7px",
        }}>
          Deep coverage
        </span>
      )}
      {chunks > 0 && chunks < 15 && (
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)",
          color: "#F59E0B",
          background: "rgba(245, 158, 11, 0.12)",
          border: "1px solid rgba(245, 158, 11, 0.35)",
          borderRadius: 4, padding: "2px 7px",
        }}>
          Sparse
        </span>
      )}
      {chunks === 0 && (
        <span style={{
          fontSize: 11, fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)",
          background: "rgba(138, 132, 128, 0.10)",
          border: "1px solid rgba(138, 132, 128, 0.3)",
          borderRadius: 4, padding: "2px 7px",
        }}>
          Unmapped
        </span>
      )}
      <span style={{
        fontSize: 11, fontFamily: "var(--font-mono)",
        color: "var(--text-tertiary)",
        background: "var(--bg-elevated)",
        border: "1px solid var(--border)",
        borderRadius: 4, padding: "2px 7px",
      }}>
        {docCount} doc{docCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

// ─── Diagnostic Drawer ────────────────────────────────────────────────────────

function DiagnosticDrawer({
  layerKey,
  meta,
  chunks,
  docs,
  docDetails,
  detailsLoading,
  onPreview,
}: {
  layerKey: KnowledgeLayer;
  meta: typeof LAYER_META[KnowledgeLayer];
  chunks: number;
  docs: DocumentRecord[];
  docDetails: Record<string, DocDetail>;
  detailsLoading: boolean;
  onPreview: (id: string) => void;
}) {
  const layerScore = computeLayerScore(chunks);
  const maxChunks  = docs.length > 0 ? Math.max(...docs.map((d) => d.chunk_count ?? 0)) : 1;

  // Sort docs by chunk count descending
  const sortedDocs = [...docs].sort((a, b) => (b.chunk_count ?? 0) - (a.chunk_count ?? 0));

  // Diagnostic read
  let diagText = "";
  if (chunks === 0) {
    diagText = `Nothing indexed. ${LAYER_GUIDANCE[layerKey]}.`;
  } else if (layerScore >= 65) {
    diagText = "This layer is retrieval-ready. Coverage is sufficient for quality responses.";
  } else {
    diagText = `Coverage is thin. Responses drawing on ${meta.label} may lack depth or miss key signals.`;
  }
  const hasShortDocs = docs.some((d) => (d.chunk_count ?? 0) < 5 && (d.chunk_count ?? 0) > 0);
  if (hasShortDocs) {
    diagText += " Some documents are very short — check for ingestion issues.";
  }

  const layerEscalationQuery = `My ${meta.label} knowledge layer has ${docs.length} documents. What strategic patterns or gaps do you see? What should I add?`;

  return (
    <div style={{ borderTop: "1px solid var(--border)", padding: "16px 22px 20px" }}>
      {/* Section A: Document Roll */}
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", marginBottom: 12,
        }}>
          Documents
        </div>

        {detailsLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-tertiary)" }}>
            <Loader2 size={12} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
            <span style={{ fontSize: 12, fontFamily: "var(--font-mono)" }}>Loading…</span>
          </div>
        )}

        {!detailsLoading && sortedDocs.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, fontStyle: "italic" }}>
            No documents in this layer.
          </p>
        )}

        {!detailsLoading && sortedDocs.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {sortedDocs.map((doc, idx) => {
              const docChunks = doc.chunk_count ?? 0;
              const barWidth  = maxChunks > 0 ? (docChunks / maxChunks) * 100 : 0;
              const docTitle  = docDetails[doc.id]?.title ?? doc.document_title ?? "Untitled";
              const docQuery  = `What are the key strategic insights in "${docTitle}"? How does it apply to my current work?`;

              return (
                <div
                  key={doc.id}
                  style={{
                    padding: "10px 0",
                    borderBottom: idx < sortedDocs.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {/* Title row */}
                  <div style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 12, marginBottom: 6,
                  }}>
                    <span style={{
                      fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                      flex: 1, minWidth: 0,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {docTitle}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); onPreview(doc.id); }}
                        style={{
                          fontSize: 11, fontFamily: "var(--font-mono)",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          color: "var(--accent-secondary)",
                          background: "var(--accent-primary)",
                          border: "1px solid var(--accent-secondary)",
                          borderRadius: "var(--radius-btn)",
                          padding: "3px 9px", cursor: "pointer",
                        }}
                      >
                        Preview
                      </button>
                      <Link
                        href={buildEscalationHref(docQuery)}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          fontSize: 11, fontFamily: "var(--font-mono)",
                          color: "var(--accent-secondary)",
                          textDecoration: "none",
                          
                        }}
                      >
                        → Atlas
                      </Link>
                    </div>
                  </div>

                  {/* Chunk bar */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{
                      flex: 1, height: 3, borderRadius: 2,
                      background: "var(--border)", overflow: "hidden",
                    }}>
                      <div style={{
                        height: "100%", borderRadius: 2,
                        background: meta.color,
                        width: `${Math.max(barWidth, docChunks > 0 ? 1.5 : 0)}%`,
                        transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
                      }} />
                    </div>
                    <span style={{
                      fontSize: 11, fontFamily: "var(--font-mono)",
                      color: "var(--text-tertiary)", flexShrink: 0,
                    }}>
                      {docChunks} chunks
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section B: Diagnostic Read */}
      <div>
        <div style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", marginBottom: 8,
        }}>
          Diagnostic
        </div>
        <p style={{
          fontSize: 13, color: "var(--text-secondary)",
          lineHeight: 1.55, margin: "0 0 10px",
        }}>
          {diagText}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link
            href="/loading-dock"
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: "var(--accent-secondary)",
              textDecoration: "none",
            }}
          >
            + Ingest more
          </Link>
          <Link
            href={buildEscalationHref(layerEscalationQuery)}
            onClick={(e) => e.stopPropagation()}
            style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
              textDecoration: "none",
            }}
          >
            → Ask Atlas about this layer
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── Zone 2: Layer Cards ──────────────────────────────────────────────────────

function LayerCard({
  layerKey,
  meta,
  layerStatus,
  docs,
  isExpanded,
  onToggle,
  docDetails,
  detailsLoading,
  onPreview,
}: {
  layerKey: KnowledgeLayer;
  meta: typeof LAYER_META[KnowledgeLayer];
  layerStatus: LayerStatus | undefined;
  docs: DocumentRecord[];
  isExpanded: boolean;
  onToggle: () => void;
  docDetails: Record<string, DocDetail>;
  detailsLoading: boolean;
  onPreview: (id: string) => void;
}) {
  const docCount   = layerStatus?.documents ?? 0;
  const chunkCount = layerStatus?.chunks ?? 0;
  const hasContent = chunkCount > 0;
  const layerScore = computeLayerScore(chunkCount);
  const state      = getState(layerScore, hasContent);
  const stateMeta  = STATE_META[state];

  return (
    <div style={{
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderLeft: `3px solid ${stateMeta.color}`,
      borderRadius: "var(--radius-card)",
      overflow: "hidden",
    }}>
      {/* Card header row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "18px 22px",
          cursor: hasContent ? "pointer" : "default",
        }}
        onClick={() => hasContent && onToggle()}
      >
        {/* Arc */}
        <LayerArc score={layerScore} color={stateMeta.color} size={48} />

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontSize: 12, fontWeight: 600,
              textTransform: "uppercase", fontFamily: "var(--font-mono)",
              color: hasContent ? "var(--text-primary)" : "var(--text-tertiary)",
            }}>
              {meta.label}
            </span>
          </div>
          <p style={{
            fontSize: 13, color: "var(--text-secondary)",
            lineHeight: 1.55, margin: "0 0 2px",
          }}>
            {meta.description}
          </p>
          <div style={{
            fontSize: 12, fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)", marginBottom: 0,
          }}>
            {hasContent ? `${docCount} doc${docCount !== 1 ? "s" : ""} · ${chunkCount.toLocaleString()} chunks` : "—"}
          </div>
          <ContributorChips chunks={chunkCount} docCount={docCount} />
        </div>

        {/* Far right: state label + chevron */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8, flexShrink: 0,
        }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
            color: stateMeta.color,
          }}>
            {stateMeta.label}
          </span>
          {hasContent ? (
            <span style={{
              fontSize: 14, color: "var(--text-tertiary)",
              display: "inline-block",
              transform: isExpanded ? "rotate(90deg)" : "none",
              transition: "transform 0.2s",
              fontFamily: "var(--font-mono)",
              lineHeight: 1,
            }}>
              ›
            </span>
          ) : (
            <Link
              href="/loading-dock"
              onClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 11, fontFamily: "var(--font-mono)",
                color: "var(--accent-secondary)",
                textDecoration: "none",
              }}
            >
              + Add content
            </Link>
          )}
        </div>
      </div>

      {/* Drawer */}
      {hasContent && isExpanded && (
        <DiagnosticDrawer
          layerKey={layerKey}
          meta={meta}
          chunks={chunkCount}
          docs={docs}
          docDetails={docDetails}
          detailsLoading={detailsLoading}
          onPreview={onPreview}
        />
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KnowledgePage() {
  const [status, setStatus]               = useState<StatusData | null>(null);
  const [loading, setLoading]             = useState(true);
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [docDetails, setDocDetails]       = useState<Record<string, DocDetail>>({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [previewDoc, setPreviewDoc]       = useState<DocDetail | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { setStatus(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const ensureDetails = useCallback(() => {
    if (detailsLoaded || detailsLoading) return;
    setDetailsLoading(true);
    fetch("/api/documents")
      .then((r) => r.ok ? r.json() : { documents: [] })
      .then((data: { documents: DocDetail[] }) => {
        const map: Record<string, DocDetail> = {};
        for (const d of data.documents) map[d.id] = d;
        setDocDetails(map);
        setDetailsLoaded(true);
        setDetailsLoading(false);
      })
      .catch(() => setDetailsLoading(false));
  }, [detailsLoaded, detailsLoading]);

  function toggleLayer(layer: string) {
    setExpandedLayers((prev) => {
      const next = new Set(prev);
      if (next.has(layer)) {
        next.delete(layer);
      } else {
        next.add(layer);
        ensureDetails();
      }
      return next;
    });
  }

  function openPreview(docId: string) {
    const detail = docDetails[docId];
    if (detail) { setPreviewDoc(detail); return; }
    fetch(`/api/documents?id=${docId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data?.documents?.[0]) setPreviewDoc(data.documents[0]); });
  }

  const layers = Object.entries(LAYER_META) as LayerEntry[];
  const totalChunks = status?.total_chunks ?? 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "flex-start",
        justifyContent: "space-between", marginBottom: 28,
      }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 400, color: "var(--text-primary)",
            lineHeight: 1.2, margin: "0 0 6px",
          }}>
            Knowledge Base
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, fontFamily: "var(--font-mono)" }}>
            {loading
              ? "Loading…"
              : `${status?.total_documents ?? 0} documents · ${totalChunks.toLocaleString()} chunks`}
          </p>
        </div>
        <Link
          href="/loading-dock"
          style={{
            display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px",
            background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
            borderRadius: "var(--radius-btn)", textDecoration: "none",
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--accent-secondary)", flexShrink: 0,
          }}
        >
          + Ingest
        </Link>
      </div>

      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}>
          <Loader2 size={14} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
          <span style={{ fontSize: 13 }}>Loading knowledge base…</span>
        </div>
      )}

      {!loading && status && (
        <>
          {/* ── Zone 1: Verdict ─────────────────────────────────────────── */}
          <VerdictPanel status={status} layers={layers} />

          {/* ── Zone 2: Layer Cards ──────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {LAYER_ORDER.map((layerKey) => {
              const meta        = LAYER_META[layerKey];
              const layerStatus = status.by_layer[layerKey];
              const docs        = (status.documents ?? []).filter((d) => d.layer === layerKey);
              const isExpanded  = expandedLayers.has(layerKey);

              return (
                <LayerCard
                  key={layerKey}
                  layerKey={layerKey}
                  meta={meta}
                  layerStatus={layerStatus}
                  docs={docs}
                  isExpanded={isExpanded}
                  onToggle={() => toggleLayer(layerKey)}
                  docDetails={docDetails}
                  detailsLoading={detailsLoading}
                  onPreview={openPreview}
                />
              );
            })}
          </div>
        </>
      )}

      {previewDoc && <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />}
    </main>
  );
}

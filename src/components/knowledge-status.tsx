"use client";

import { useEffect, useState } from "react";
import { LAYER_META, type KnowledgeLayer } from "@/lib/types";

interface LayerStatus {
  documents: number;
  chunks: number;
}

interface StatusData {
  total_documents: number;
  total_chunks: number;
  by_layer: Partial<Record<KnowledgeLayer, LayerStatus>>;
  documents: Array<{
    id: string;
    title: string;
    layer: KnowledgeLayer;
    chunks: number;
    ingested_at: string;
  }>;
}

export function KnowledgeStatus() {
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => null);
  }, []);

  if (!status) return null;

  return (
    <div style={{ marginBottom: 48 }}>
      <div style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        marginBottom: 10,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          
          textTransform: "uppercase",
          color: "var(--text-tertiary)",
        }}>
          Knowledge Base
        </span>
        <span style={{
          fontSize: 11,
          color: "var(--text-tertiary)",
          fontFamily: "var(--font-mono)",
        }}>
          {status.total_documents} docs · {status.total_chunks} chunks
        </span>
      </div>

      <div style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
      }}>
        {(Object.entries(LAYER_META) as [KnowledgeLayer, typeof LAYER_META.core][]).map(([key, meta], i) => {
          const layerData = status.by_layer[key];
          const layerDocs = status.documents.filter((d) => d.layer === key);
          const isEmpty = !layerData;

          return (
            <div
              key={key}
              style={{
                borderTop: i === 0 ? "none" : "1px solid var(--border)",
              }}
            >
              {/* Layer row */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                background: "var(--bg-surface)",
              }}>
                <div style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: isEmpty ? "var(--text-tertiary)" : meta.color,
                  opacity: isEmpty ? 0.4 : 1,
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: isEmpty ? "var(--text-tertiary)" : "var(--text-primary)",
                  textTransform: "uppercase",
                  
                }}>
                  {meta.label}
                </span>
                <span style={{
                  marginLeft: "auto",
                  fontSize: 11,
                  color: "var(--text-tertiary)",
                  fontFamily: "var(--font-mono)",
                }}>
                  {isEmpty ? "empty" : `${layerData.documents} doc${layerData.documents !== 1 ? "s" : ""} · ${layerData.chunks} chunks`}
                </span>
              </div>

              {/* Document list */}
              {layerDocs.map((doc) => (
                <div key={doc.id} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 14px 7px 29px",
                  borderTop: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}>
                  <span style={{
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    flex: 1,
                  }}>
                    {doc.title}
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {doc.chunks} chunks
                  </span>
                  <span style={{
                    fontSize: 11,
                    color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {new Date(doc.ingested_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

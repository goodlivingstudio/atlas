"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, ArrowRight, Plus } from "lucide-react";

interface Engagement {
  id: string;
  name: string;
  company: string | null;
  status: "intake" | "diagnosing" | "active" | "archived";
  created_at: string;
  metadata: Record<string, unknown> | null;
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:     { label: "Active",     color: "var(--live)" },
  diagnosing: { label: "Diagnosing", color: "var(--layer-frameworks)" },
  intake:     { label: "Intake",     color: "var(--text-tertiary)" },
  archived:   { label: "Archived",   color: "var(--border)" },
};

const GROUP_ORDER = ["active", "diagnosing", "intake", "archived"] as const;

function escalate(query: string): string {
  return `/ask?q=${encodeURIComponent(query)}`;
}

export default function EngagementsPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    fetch("/api/engagements")
      .then((r) => r.ok ? r.json() : Promise.reject("Failed"))
      .then((data) => { setEngagements(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => { setError("Could not load engagements."); setLoading(false); });
  }, []);

  const grouped = GROUP_ORDER.reduce((acc, status) => {
    acc[status] = engagements.filter((e) => e.status === status);
    return acc;
  }, {} as Record<string, Engagement[]>);

  const isEmpty = !loading && engagements.length === 0;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        marginBottom: 40,
      }}>
        <div>
          <h1 style={{
            fontSize: 24, fontWeight: 400, color: "var(--text-primary)",
            lineHeight: 1.2, margin: "0 0 6px",
          }}>
            Engagements
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
            All client work, organized by pipeline stage.
          </p>
        </div>
        <Link
          href="/loading-dock"
          style={{
            display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px",
            background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
            borderRadius: "var(--radius-md)", textDecoration: "none",
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--accent-secondary)",
            flexShrink: 0,
          }}
        >
          <Plus size={11} />
          New
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}>
          <Loader2 size={14} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
          <span style={{ fontSize: 13 }}>Loading engagements…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: "14px 16px", background: "var(--bg-surface)",
          border: "1px solid var(--error)", borderRadius: "var(--radius-lg)",
          color: "var(--error)", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div style={{
          padding: "40px 28px", textAlign: "center",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)", marginBottom: 12,
          }}>
            No engagements yet
          </div>
          <p style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.65, margin: "0 0 20px" }}>
            Drop a file in the Loading Dock to create your first engagement.
          </p>
          <Link
            href="/loading-dock"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 20px",
              background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
              borderRadius: "var(--radius-md)", textDecoration: "none",
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", color: "var(--accent-secondary)",
            }}
          >
            Open Loading Dock
          </Link>
        </div>
      )}

      {/* Groups */}
      {!loading && !error && !isEmpty && (
        <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
          {GROUP_ORDER.filter((status) => {
            if (status === "archived" && !showArchived) return false;
            return grouped[status].length > 0;
          }).map((status) => {
            const meta = STATUS_META[status];
            const group = grouped[status];
            return (
              <div key={status}>
                {/* Group label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: meta.color, flexShrink: 0,
                  }} />
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", color: "var(--text-tertiary)",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {meta.label}
                  </span>
                  <span style={{
                    fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)",
                    opacity: 0.5,
                  }}>
                    {group.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {group.map((eng) => (
                    <div
                      key={eng.id}
                      style={{
                        display: "flex", alignItems: "center",
                        background: "var(--bg-surface)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-lg)",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
                    >
                      {/* Main engagement link */}
                      <Link
                        href={`/engagements/${eng.id}`}
                        style={{
                          flex: 1, minWidth: 0,
                          display: "flex", alignItems: "center", gap: 14,
                          padding: "14px 18px",
                          textDecoration: "none",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
                            
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            {eng.name}
                          </div>
                          {eng.company && (
                            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
                              {eng.company}
                            </div>
                          )}
                        </div>
                        {!!eng.metadata?.doc_type && (
                          <div style={{
                            fontSize: 11, fontFamily: "var(--font-mono)",
                            fontWeight: 600, padding: "3px 8px", border: "1px solid var(--border)", borderRadius: 3,
                            color: "var(--text-tertiary)", flexShrink: 0, textTransform: "uppercase",
                          }}>
                            {String(eng.metadata.doc_type)}
                          </div>
                        )}
                        <div style={{
                          fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
                          flexShrink: 0,
                        }}>
                          {new Date(eng.created_at).toLocaleDateString("en-US", {
                            month: "short", day: "numeric",
                          })}
                        </div>
                        <ArrowRight size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                      </Link>

                      {/* Ask Atlas → escalation */}
                      <Link
                        href={escalate(`Strategic situation brief on ${eng.name}${eng.company ? ` at ${eng.company}` : ''}. What should I be thinking about and doing right now?`)}
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          
                          color: "var(--accent-secondary)",
                          textDecoration: "none",
                          flexShrink: 0,
                          padding: "14px 18px 14px 0",
                        }}
                      >
                        Ask Atlas →
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Show archived toggle */}
          {grouped.archived.length > 0 && (
            <button
              onClick={() => setShowArchived((v) => !v)}
              style={{
                background: "none", border: "none", padding: 0, cursor: "pointer",
                fontSize: 11, color: "var(--text-tertiary)",
                textAlign: "left",
              }}
            >
              {showArchived ? "Hide archived" : `Show ${grouped.archived.length} archived`}
            </button>
          )}
        </div>
      )}
    </main>
  );
}

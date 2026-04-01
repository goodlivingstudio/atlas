"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft, Loader2, ChevronRight, Search, FileText,
  ChevronDown, ChevronUp, Sparkles,
} from "lucide-react";
import type { AtlasMode } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Engagement {
  id: string;
  name: string;
  company: string | null;
  url: string | null;
  brief: string | null;
  notes: string | null;
  competitive_set: string[];
  status: "intake" | "diagnosing" | "active" | "archived";
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface QueryRecord {
  id: string;
  engagement_id: string | null;
  query: string;
  mode: string;
  answer: string;
  sources: unknown[];
  created_at: string;
}

interface DocRecord {
  id: string;
  title: string;
  layer: string;
  chunks: number;
  ingested_at: string;
}

interface Signal {
  label: string;
  body: string;
}

function escalate(query: string): string {
  return `/ask?q=${encodeURIComponent(query)}`;
}

const STATUS_META: Record<Engagement["status"], { label: string; color: string }> = {
  intake:     { label: "Intake",     color: "var(--text-tertiary)" },
  diagnosing: { label: "Diagnosing", color: "var(--layer-frameworks)" },
  active:     { label: "Active",     color: "var(--live)" },
  archived:   { label: "Archived",   color: "var(--border)" },
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EngagementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [queries, setQueries] = useState<QueryRecord[]>([]);
  const [documents, setDocuments] = useState<DocRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Query bar state
  const [queryInput, setQueryInput] = useState("");
  const [queryMode, setQueryMode] = useState<AtlasMode>("DIAGNOSIS");
  const [queryLoading, setQueryLoading] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Inline edit state
  const [isEditing, setIsEditing]     = useState(false);
  const [editName, setEditName]       = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editBrief, setEditBrief]     = useState("");
  const [editNotes, setEditNotes]     = useState("");
  const [saving, setSaving]           = useState(false);

  useEffect(() => {
    async function fetchAll() {
      try {
        const [engRes, queriesRes, statusRes] = await Promise.all([
          fetch(`/api/engagements/${id}`),
          fetch(`/api/queries?engagement_id=${id}`),
          fetch("/api/status"),
        ]);

        if (!engRes.ok) {
          setError("Engagement not found");
          return;
        }

        const engData: Engagement = await engRes.json();
        const queriesData: QueryRecord[] = queriesRes.ok ? await queriesRes.json() : [];
        const statusData = statusRes.ok ? await statusRes.json() : { documents: [] };

        setEngagement(engData);
        setQueries(queriesData);

        // Filter documents for this engagement (layer === 'clients')
        const clientDocs: DocRecord[] = (statusData.documents || []).filter(
          (d: DocRecord) => d.layer === "clients"
        );
        setDocuments(clientDocs);
      } catch {
        setError("Failed to load engagement");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, [id]);

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    if (!queryInput.trim()) return;

    setQueryLoading(true);
    setQueryError(null);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: queryInput.trim(),
          mode: queryMode,
          engagement_id: id,
          top_k: 5,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Query failed");
      }

      const result = await res.json();

      // Add to query history
      const newQuery: QueryRecord = {
        id: crypto.randomUUID(),
        engagement_id: id,
        query: queryInput.trim(),
        mode: queryMode,
        answer: result.answer,
        sources: result.sources || [],
        created_at: new Date().toISOString(),
      };
      setQueries((prev) => [newQuery, ...prev]);
      setQueryInput("");
    } catch (err) {
      setQueryError(err instanceof Error ? err.message : "Query failed");
    } finally {
      setQueryLoading(false);
    }
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--text-tertiary)" }}>
          <Loader2 size={16} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
          <span style={{ fontSize: 13 }}>Loading engagement…</span>
        </div>
      </main>
    );
  }

  if (error || !engagement) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>
        <div style={{ fontSize: 13, color: "var(--error)" }}>{error || "Not found"}</div>
        <Link href="/engagements" style={{ fontSize: 13, color: "var(--accent-secondary)", marginTop: 12, display: "block" }}>
          ← Back to Engagements
        </Link>
      </main>
    );
  }

  const statusMeta = STATUS_META[engagement.status];
  const signals = (engagement.metadata?.signals as Signal[] | undefined) || [];
  const nextSteps = (engagement.metadata?.next_steps as string[] | undefined) || [];

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 64px" }}>

      {/* Inline edit overlay */}
      {isEditing && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 24,
        }}
        onClick={(e) => { if (e.target === e.currentTarget) setIsEditing(false); }}
        >
          <div style={{
            width: "100%", maxWidth: 560,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            {/* Modal header */}
            <div style={{
              padding: "16px 24px", borderBottom: "1px solid var(--border)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", fontFamily: "var(--font-mono)",
                color: "var(--accent-secondary)",
              }}>
                Edit Engagement
              </div>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--text-tertiary)", fontSize: 18, lineHeight: 1,
                  padding: "0 2px",
                }}
              >
                ×
              </button>
            </div>

            {/* Form */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {[
                { label: "Name", value: editName, set: setEditName, multiline: false },
                { label: "Company", value: editCompany, set: setEditCompany, multiline: false },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{
                    display: "block", fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)", marginBottom: 6,
                  }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    style={{
                      width: "100%", height: 40, padding: "0 12px",
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)", color: "var(--text-primary)",
                      fontSize: 14, outline: "none", boxSizing: "border-box",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              ))}

              {[
                { label: "Brief", value: editBrief, set: setEditBrief },
                { label: "Notes", value: editNotes, set: setEditNotes },
              ].map(({ label, value, set }) => (
                <div key={label}>
                  <label style={{
                    display: "block", fontSize: 11, fontWeight: 600,
                    textTransform: "uppercase", fontFamily: "var(--font-mono)",
                    color: "var(--text-tertiary)", marginBottom: 6,
                  }}>
                    {label}
                  </label>
                  <textarea
                    value={value}
                    onChange={(e) => set(e.target.value)}
                    rows={3}
                    style={{
                      width: "100%", padding: "10px 12px",
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)", color: "var(--text-primary)",
                      fontSize: 14, outline: "none", resize: "vertical",
                      boxSizing: "border-box", lineHeight: 1.75, fontFamily: "inherit",
                    }}
                  />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div style={{
              padding: "14px 24px", borderTop: "1px solid var(--border)",
              display: "flex", justifyContent: "flex-end", gap: 8,
            }}>
              <button
                onClick={() => setIsEditing(false)}
                style={{
                  height: 36, padding: "0 16px", background: "transparent",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                  color: "var(--text-tertiary)", fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                disabled={saving || !editName.trim()}
                onClick={async () => {
                  setSaving(true);
                  try {
                    const res = await fetch(`/api/engagements/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name:    editName.trim(),
                        company: editCompany.trim() || null,
                        brief:   editBrief.trim() || null,
                        notes:   editNotes.trim() || null,
                      }),
                    });
                    if (res.ok) {
                      const updated = await res.json();
                      setEngagement(updated);
                      setIsEditing(false);
                    }
                  } finally {
                    setSaving(false);
                  }
                }}
                style={{
                  height: 36, padding: "0 20px",
                  background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
                  borderRadius: "var(--radius-md)", color: "var(--accent-secondary)",
                  fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving || !editName.trim() ? 0.5 : 1,
                  transition: "opacity 0.15s",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back link */}
      <Link
        href="/engagements"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          fontSize: 12, color: "var(--text-tertiary)", textDecoration: "none",
          marginBottom: 20,
        }}
      >
        <ArrowLeft size={11} aria-hidden="true" />
        Engagements
      </Link>

      {/* Breadcrumb */}
      <div style={{
        fontSize: 11, fontWeight: 600,
        textTransform: "uppercase", color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)", marginBottom: 12,
      }}>
        Atlas · Engagements · {engagement.name}
      </div>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 32, fontWeight: 500, color: "var(--text-primary)",
          lineHeight: 1.15, margin: "0 0 6px",
        }}>
          {engagement.name}
        </h1>
        {engagement.company && (
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginBottom: 10 }}>
            {engagement.company}
          </div>
        )}
        {/* Status selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 18 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: statusMeta.color,
            boxShadow: engagement.status === "active" ? "0 0 5px var(--live)" : undefined,
          }} />
          <div style={{ position: "relative" }}>
            <select
              value={engagement.status}
              disabled={updatingStatus}
              onChange={async (e) => {
                const newStatus = e.target.value as Engagement["status"];
                setUpdatingStatus(true);
                try {
                  const res = await fetch(`/api/engagements/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: newStatus }),
                  });
                  if (res.ok) {
                    setEngagement((prev) => prev ? { ...prev, status: newStatus } : prev);
                  }
                } finally {
                  setUpdatingStatus(false);
                }
              }}
              style={{
                padding: "4px 8px", height: 28,
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 4, cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", fontFamily: "var(--font-mono)",
                color: statusMeta.color,
                opacity: updatingStatus ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {(["intake", "diagnosing", "active", "archived"] as const).map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link
            href={`/ask?engagement=${id}`}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 44, padding: "0 20px",
              background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
              borderRadius: "var(--radius-md)", color: "var(--accent-secondary)",
              textDecoration: "none", fontSize: 11, fontWeight: 600,
              textTransform: "uppercase",
            }}
          >
            <ChevronRight size={12} aria-hidden="true" />
            Ask Atlas
          </Link>
          <button
            onClick={() => {
              setEditName(engagement.name);
              setEditCompany(engagement.company ?? "");
              setEditBrief(engagement.brief ?? "");
              setEditNotes(engagement.notes ?? "");
              setIsEditing(true);
            }}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              height: 44, padding: "0 20px",
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", color: "var(--text-tertiary)",
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", cursor: "pointer",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-secondary)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
              (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)";
            }}
          >
            Edit
          </button>
        </div>
      </div>

      {/* Brief + Notes */}
      {(engagement.brief || engagement.notes) && (
        <div style={{
          padding: "20px 24px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)", marginBottom: 24,
        }}>
          {engagement.brief && (
            <div style={{ marginBottom: engagement.notes ? 16 : 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", color: "var(--text-tertiary)",
                marginBottom: 8,
              }}>
                Brief
              </div>
              <p style={{
                fontSize: 14, color: "var(--text-primary)",
                lineHeight: 1.75, margin: 0,
              }}>
                {engagement.brief}
              </p>
              <Link
                href={escalate(`Based on this brief for ${engagement.name}: "${engagement.brief.slice(0, 200)}..." — what are the key strategic implications and what should I focus on?`)}
                style={{
                  display: "inline-block",
                  marginTop: 10,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  
                  color: "var(--accent-secondary)",
                  textDecoration: "none",
                }}
              >
                Ask Atlas →
              </Link>
            </div>
          )}
          {engagement.notes && (
            <div>
              <div style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", color: "var(--text-tertiary)",
                marginBottom: 8,
              }}>
                Notes
              </div>
              <div style={{
                fontSize: 13, color: "var(--text-secondary)",
                lineHeight: 1.75, whiteSpace: "pre-line",
              }}>
                {engagement.notes}
              </div>
            </div>
          )}
          {/* Competitive set */}
          {engagement.competitive_set.length > 0 && (
            <div style={{ marginTop: 16, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", color: "var(--text-tertiary)",
                marginRight: 4,
              }}>
                vs.
              </span>
              {engagement.competitive_set.map((c) => (
                <span key={c} style={{
                  padding: "3px 10px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 4, fontSize: 11, color: "var(--text-tertiary)",
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Signals — 3 column */}
      {signals.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--text-tertiary)",
            marginBottom: 10,
          }}>
            Signals
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", overflow: "hidden",
          }}>
            {signals.map((sig, i) => (
              <div key={i} style={{
                padding: "16px 20px",
                borderRight: i < signals.length - 1 ? "1px solid var(--border)" : "none",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", color: "var(--accent-muted)",
                  fontFamily: "var(--font-mono)", marginBottom: 6,
                }}>
                  {sig.label}
                </div>
                <p style={{
                  fontSize: 13, color: "var(--text-primary)",
                  lineHeight: 1.55, margin: 0,
                }}>
                  {sig.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Next Steps */}
      {nextSteps.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--text-tertiary)",
            marginBottom: 10,
          }}>
            Next Steps
          </div>
          <div style={{
            padding: "16px 20px",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
          }}>
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
              {nextSteps.map((step, i) => (
                <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    fontSize: 11, fontFamily: "var(--font-mono)",
                    color: "var(--accent-secondary)", flexShrink: 0,
                    marginTop: 2, minWidth: 16,
                  }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.6 }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {/* Knowledge Base */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--text-tertiary)",
          }}>
            Knowledge Base
          </div>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 3, padding: "1px 6px",
          }}>
            {documents.length}
          </span>
        </div>
        {documents.length === 0 ? (
          <div style={{
            padding: "24px 20px",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", textAlign: "center",
          }}>
            <FileText size={20} style={{ color: "var(--text-tertiary)", marginBottom: 8 }} />
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
              No documents ingested
            </div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, opacity: 0.65 }}>
              Drop a file in Loading Dock to ingest for this engagement
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {documents.map((doc) => (
              <div key={doc.id} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 16px",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
              }}>
                <FileText size={13} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {doc.title}
                  </div>
                  <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", marginTop: 2 }}>
                    {new Date(doc.ingested_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontFamily: "var(--font-mono)",
                  color: "var(--text-tertiary)",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 3, padding: "2px 7px", flexShrink: 0,
                }}>
                  {doc.chunks} chunks
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline Query Bar */}
      <div style={{
        padding: "20px 24px",
        background: "var(--bg-surface)", border: "1px solid var(--accent-secondary)",
        borderRadius: "var(--radius-lg)", marginBottom: 32,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", color: "var(--accent-secondary)",
          marginBottom: 14,
        }}>
          Query this Engagement
        </div>
        {/* Mode selector */}
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          {(["DIAGNOSIS", "PRESCRIPTION"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setQueryMode(m)}
              style={{
                height: 34, padding: "0 14px",
                background: queryMode === m ? "var(--accent-primary)" : "transparent",
                border: `1px solid ${queryMode === m ? "var(--accent-secondary)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                color: queryMode === m ? "var(--accent-secondary)" : "var(--text-tertiary)",
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {m}
            </button>
          ))}
        </div>
        <form onSubmit={handleQuery} style={{ display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 10,
            padding: "0 14px", height: 48,
            background: "var(--bg-primary)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}>
            <Search size={12} style={{ color: "var(--text-tertiary)", flexShrink: 0 }} />
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder={queryMode === "DIAGNOSIS" ? "What do you need to understand?" : "What position are you building?"}
              style={{
                flex: 1, height: "100%", background: "transparent",
                border: "none", outline: "none",
                color: "var(--text-primary)", fontSize: 14,
              }}
            />
          </div>
          <button
            type="submit"
            disabled={queryLoading || !queryInput.trim()}
            style={{
              height: 48, padding: "0 20px",
              background: queryLoading ? "var(--bg-elevated)" : "var(--accent-primary)",
              border: `1px solid ${queryLoading ? "var(--border)" : "var(--accent-secondary)"}`,
              borderRadius: "var(--radius-md)", color: "var(--accent-secondary)",
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase", cursor: queryLoading || !queryInput.trim() ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              opacity: !queryInput.trim() && !queryLoading ? 0.5 : 1,
            }}
          >
            {queryLoading
              ? <Loader2 size={12} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
              : <ChevronRight size={12} />
            }
            {queryLoading ? "Running" : "Run"}
          </button>
        </form>
        {queryError && (
          <div role="alert" style={{
            padding: "10px 12px", marginTop: 10,
            background: "var(--bg-primary)", border: "1px solid var(--error)",
            borderRadius: "var(--radius-md)", color: "var(--error)", fontSize: 12,
          }}>
            {queryError}
          </div>
        )}
      </div>

      {/* Query History */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--text-tertiary)",
          }}>
            Query History
          </div>
          <span style={{
            fontSize: 11, fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 3, padding: "1px 6px",
          }}>
            {queries.length}
          </span>
        </div>
        {queries.length === 0 ? (
          <div style={{
            padding: "24px 20px",
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", textAlign: "center",
          }}>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)" }}>No queries yet</div>
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4, opacity: 0.65 }}>
              Use the query bar above to start a conversation scoped to this engagement
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {queries.map((q) => (
              <QueryHistoryItem key={q.id} query={q} />
            ))}
          </div>
        )}
      </div>

      {/* Next steps card — active engagements only */}
      {engagement.status === "active" && (
        <div style={{
          padding: "20px 24px",
          background: "var(--bg-surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)", marginBottom: 14,
          }}>
            Next Steps
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <Link
              href={`/ask?engagement=${id}`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", textDecoration: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-secondary)";
                (e.currentTarget as HTMLElement).style.background = "var(--accent-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                Ask Atlas
              </span>
              <span style={{ fontSize: 11, color: "var(--accent-secondary)", fontFamily: "var(--font-mono)" }}>→</span>
            </Link>
            <Link
              href={`/ask?engagement=${id}&mode=GENERATE`}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", textDecoration: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-secondary)";
                (e.currentTarget as HTMLElement).style.background = "var(--accent-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                Generate a brief
              </span>
              <span style={{ fontSize: 11, color: "var(--accent-secondary)", fontFamily: "var(--font-mono)" }}>→</span>
            </Link>
            <Link
              href="/loading-dock"
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 16px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", textDecoration: "none",
                transition: "border-color 0.15s, background 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-secondary)";
                (e.currentTarget as HTMLElement).style.background = "var(--accent-primary)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
                (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-primary)" }}>
                Ingest more documents
              </span>
              <span style={{ fontSize: 11, color: "var(--accent-secondary)", fontFamily: "var(--font-mono)" }}>→</span>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Query History Item ────────────────────────────────────────────────────────

function QueryHistoryItem({ query: q }: { query: QueryRecord }) {
  const [expanded, setExpanded] = useState(false);
  const PREVIEW_LEN = 200;
  const needsExpand = q.answer.length > PREVIEW_LEN;

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-lg)", overflow: "hidden",
    }}>
      {/* Query + meta */}
      <div style={{ padding: "16px 20px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{
            fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", color: "var(--accent-secondary)",
            fontFamily: "var(--font-mono)",
          }}>
            {q.mode}
          </span>
          <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
            {new Date(q.created_at).toLocaleString()}
          </span>
          {Array.isArray(q.sources) && q.sources.length > 0 && (
            <span style={{
              fontSize: 11, fontFamily: "var(--font-mono)",
              color: "var(--text-tertiary)",
              background: "var(--bg-elevated)", border: "1px solid var(--border)",
              borderRadius: 3, padding: "1px 6px", marginLeft: "auto",
            }}>
              {q.sources.length} sources
            </span>
          )}
        </div>
        <div style={{
          fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
          lineHeight: 1.4,
        }}>
          {q.query}
        </div>
      </div>

      {/* Answer */}
      <div style={{
        padding: "0 20px 16px",
        borderTop: "1px solid var(--border)", paddingTop: 14,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", color: "var(--accent-secondary)",
          marginBottom: 8, display: "flex", alignItems: "center", gap: 5,
        }}>
          <Sparkles size={10} aria-hidden="true" />
          Atlas
        </div>
        <div style={{
          fontSize: 14, color: "var(--text-primary)",
          lineHeight: 1.65, whiteSpace: "pre-wrap",
        }}>
          {needsExpand && !expanded
            ? q.answer.slice(0, PREVIEW_LEN) + "…"
            : q.answer
          }
        </div>
        {needsExpand && (
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              marginTop: 8, background: "none", border: "none",
              color: "var(--accent-secondary)", fontSize: 11,
              fontWeight: 600,
              textTransform: "uppercase", cursor: "pointer", padding: 0,
            }}
          >
            {expanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            {expanded ? "Collapse" : "Expand"}
          </button>
        )}
        <div style={{ marginTop: needsExpand ? 6 : 8 }}>
          <Link
            href={escalate(`Go deeper on this analysis: "${q.query.slice(0, 150)}..."`)}
            style={{
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              
              color: "var(--accent-secondary)",
              textDecoration: "none",
            }}
          >
            Ask Atlas →
          </Link>
        </div>
      </div>
    </div>
  );
}

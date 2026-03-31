"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, X, Archive, ArrowRight, FileText, UploadCloud } from "lucide-react";
import Link from "next/link";

interface Engagement {
  id: string;
  name: string;
  company: string | null;
  url: string | null;
  brief: string | null;
  notes: string | null;
  competitive_set: string[];
  status: "intake" | "diagnosing" | "active" | "archived";
  created_at: string;
}

const STATUS_META: Record<Engagement["status"], { label: string; color: string }> = {
  intake:     { label: "Intake",     color: "var(--text-tertiary)" },
  diagnosing: { label: "Diagnosing", color: "var(--layer-frameworks)" },
  active:     { label: "Active",     color: "var(--live)" },
  archived:   { label: "Archived",   color: "var(--border)" },
};

const EMPTY_FORM = {
  name: "",
  company: "",
  url: "",
  brief: "",
  notes: "",
  competitive_set_raw: "",
};

export default function LoadingDock() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  useEffect(() => {
    fetch("/api/engagements")
      .then((r) => r.json())
      .then(setEngagements)
      .catch(() => null);
  }, []);

  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current++;
    setDragOver(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) setDragOver(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const isText = file.type.startsWith("text/") || /\.(md|txt|markdown)$/i.test(file.name);
      const nameBase = file.name.replace(/\.(md|txt|markdown)$/i, "").replace(/[-_]/g, " ");
      if (isText) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = ev.target?.result as string;
          setForm((f) => ({
            ...f,
            name: f.name || nameBase,
            brief: f.brief || content.slice(0, 600),
          }));
          setShowForm(true);
        };
        reader.readAsText(file);
      } else {
        setForm((f) => ({ ...f, name: f.name || nameBase }));
        setShowForm(true);
      }
      return;
    }

    // Handle URL or text drops
    const text = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (text) {
      try {
        new URL(text);
        setForm((f) => ({ ...f, url: text }));
      } catch {
        setForm((f) => ({ ...f, brief: f.brief ? `${f.brief}\n\n${text}` : text }));
      }
      setShowForm(true);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const competitive_set = form.competitive_set_raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          company: form.company || null,
          url: form.url || null,
          brief: form.brief || null,
          notes: form.notes || null,
          competitive_set,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save");
      }

      const created = await res.json();
      setEngagements((prev) => [created, ...prev]);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleArchive(id: string) {
    await fetch(`/api/engagements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archived" }),
    });
    setEngagements((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: "archived" } : e))
    );
  }

  const active = engagements.filter((e) => e.status !== "archived");
  const archived = engagements.filter((e) => e.status === "archived");

  return (
    <main
      style={{ maxWidth: 880, margin: "0 auto", padding: "72px 24px 64px" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >

      {/* Header */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--live)", boxShadow: "0 0 6px var(--live)",
          }} />
          <span style={{
            fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
            color: "var(--text-tertiary)", fontFamily: "var(--font-mono)",
          }}>
            Atlas · Loading Dock
          </span>
        </div>
        <h1 style={{
          fontSize: 32, fontWeight: 500, color: "var(--text-primary)",
          letterSpacing: "-0.03em", lineHeight: 1.15, margin: "0 0 8px",
        }}>
          Loading Dock
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.6, maxWidth: 500 }}>
          Where raw material enters. Drop a file, paste a URL, or add what you have —
          Atlas builds from incomplete inputs.
        </p>
      </div>

      {/* Intake zone — visible when form is not showing */}
      {!showForm && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop a file or click to start a new engagement"
          onClick={() => setShowForm(true)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setShowForm(true); }}
          style={{
            padding: "36px 32px",
            border: `2px dashed ${dragOver ? "var(--accent-secondary)" : "var(--border)"}`,
            borderRadius: "var(--radius-card)",
            background: dragOver ? "var(--accent-primary)" : "transparent",
            marginBottom: 40,
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            transition: "border-color 0.15s, background 0.15s",
            textAlign: "center",
          }}
        >
          <div style={{
            width: 48, height: 48,
            background: "var(--bg-surface)",
            border: "1px solid var(--border)",
            borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragOver
              ? <UploadCloud size={20} style={{ color: "var(--accent-secondary)" }} aria-hidden="true" />
              : <FileText size={20} style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            }
          </div>
          <div>
            <div style={{
              fontSize: 15, fontWeight: 500, color: dragOver ? "var(--accent-secondary)" : "var(--text-primary)",
              letterSpacing: "-0.02em", marginBottom: 4, transition: "color 0.15s",
            }}>
              {dragOver ? "Drop to start" : "Drop a file or URL to begin"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
              .md, .txt, or any text file · or click to fill out manually
            </div>
          </div>
          {!dragOver && (
            <div style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 18px", marginTop: 4,
              background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
              borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              transition: "background 0.15s",
            }}>
              <Plus size={12} aria-hidden="true" />
              New Engagement
            </div>
          )}
        </div>
      )}

      {/* Intake form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          padding: "28px 28px 24px",
          background: "var(--bg-surface)", border: "1px solid var(--accent-secondary)",
          borderRadius: "var(--radius-card)", marginBottom: 40,
        }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
              textTransform: "uppercase", color: "var(--accent-secondary)",
            }}>
              New Engagement
            </div>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
              aria-label="Cancel and close form"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, padding: 0,
                background: "transparent", border: "none",
                borderRadius: 4, color: "var(--text-tertiary)", cursor: "pointer",
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {[
            { key: "name", label: "Name", required: true, placeholder: "What are you calling this engagement?" },
            { key: "company", label: "Company", required: false, placeholder: "Client or company name" },
            { key: "url", label: "URL", required: false, placeholder: "https://" },
          ].map(({ key, label, required, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label
                htmlFor={`field-${key}`}
                style={{
                  display: "block", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--text-tertiary)", marginBottom: 6,
                }}
              >
                {label}{required && <span aria-hidden="true" style={{ color: "var(--accent-secondary)", marginLeft: 3 }}>*</span>}
              </label>
              <input
                id={`field-${key}`}
                type={key === "url" ? "url" : "text"}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                required={required}
                aria-required={required}
                style={{
                  width: "100%", height: 48, padding: "0 14px", boxSizing: "border-box",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-btn)", color: "var(--text-primary)",
                  fontSize: 13, outline: "none",
                }}
              />
            </div>
          ))}

          {[
            { key: "brief", label: "Brief", placeholder: "What's the engagement? What problem are you solving? Use whatever you have — a sentence is enough." },
            { key: "notes", label: "Notes", placeholder: "Half-formed tensions, hypotheses, things that feel off. Incomplete is fine." },
          ].map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label
                htmlFor={`field-${key}`}
                style={{
                  display: "block", fontSize: 10, fontWeight: 600,
                  letterSpacing: "0.06em", textTransform: "uppercase",
                  color: "var(--text-tertiary)", marginBottom: 6,
                }}
              >
                {label}
              </label>
              <textarea
                id={`field-${key}`}
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: "100%", padding: "12px 14px", boxSizing: "border-box",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-btn)", color: "var(--text-primary)", fontSize: 13,
                  outline: "none", resize: "vertical", lineHeight: 1.6, fontFamily: "inherit",
                }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 28 }}>
            <label
              htmlFor="field-competitive-set"
              style={{
                display: "block", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 6,
              }}
            >
              Competitive Set
            </label>
            <input
              id="field-competitive-set"
              type="text"
              value={form.competitive_set_raw}
              onChange={(e) => setForm((f) => ({ ...f, competitive_set_raw: e.target.value }))}
              placeholder="Competitor A, Competitor B, Competitor C"
              aria-describedby="competitive-set-hint"
              style={{
                width: "100%", height: 48, padding: "0 14px", boxSizing: "border-box",
                background: "var(--bg-primary)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-btn)", color: "var(--text-primary)",
                fontSize: 13, outline: "none",
              }}
            />
            <div id="competitive-set-hint" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
              Comma-separated. Add what you know now.
            </div>
          </div>

          {error && (
            <div
              role="alert"
              style={{
                padding: "12px 14px", marginBottom: 16,
                background: "var(--bg-primary)", border: "1px solid var(--error)",
                borderRadius: "var(--radius-btn)", color: "var(--error)", fontSize: 12,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              aria-disabled={saving || !form.name.trim()}
              style={{
                height: 48, padding: "0 24px",
                background: saving ? "var(--bg-elevated)" : "var(--accent-primary)",
                border: `1px solid ${saving ? "var(--border)" : "var(--accent-secondary)"}`,
                borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
                cursor: saving || !form.name.trim() ? "not-allowed" : "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                opacity: !form.name.trim() && !saving ? 0.5 : 1,
                transition: "opacity 0.15s",
              }}
            >
              {saving ? "Saving..." : "Save Engagement"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
              style={{
                height: 48, padding: "0 20px",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: "var(--radius-btn)", color: "var(--text-tertiary)", cursor: "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Active engagements */}
      {active.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12,
          }}>
            Engagements — {active.length}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 10,
          }}>
            {active.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <div style={{ height: 8 }} />
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12,
          }}>
            Archived — {archived.length}
          </div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 8,
          }}>
            {archived.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

function EngagementCard({
  engagement: eng,
  onArchive,
}: {
  engagement: Engagement;
  onArchive: (id: string) => void;
}) {
  const statusMeta = STATUS_META[eng.status];
  const displayLabel = eng.company || eng.name;
  const isArchived = eng.status === "archived";

  // Generate initials for visual header
  const initials = displayLabel
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-card)",
      overflow: "hidden",
      opacity: isArchived ? 0.6 : 1,
      transition: "border-color 0.15s",
      display: "flex", flexDirection: "column",
    }}>
      {/* Visual header */}
      <div style={{
        height: 100,
        background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        padding: "16px 20px",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}>
        {/* Large watermark initials */}
        <div aria-hidden="true" style={{
          position: "absolute",
          right: 16, bottom: -8,
          fontSize: 72, fontWeight: 700,
          letterSpacing: "-0.05em",
          color: "var(--bg-primary)",
          lineHeight: 1,
          userSelect: "none",
          pointerEvents: "none",
        }}>
          {initials}
        </div>
        {/* Status dot */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            background: statusMeta.color,
            boxShadow: eng.status === "active" ? "0 0 5px var(--live)" : undefined,
          }} />
          <span style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: statusMeta.color,
            fontFamily: "var(--font-mono)",
          }}>
            {statusMeta.label}
          </span>
        </div>
        {/* Company name */}
        <div style={{
          fontSize: 20, fontWeight: 600, color: "var(--text-primary)",
          letterSpacing: "-0.03em", lineHeight: 1.1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {displayLabel}
        </div>
      </div>

      {/* Card body */}
      <div style={{ padding: "16px 20px 12px", flex: 1 }}>
        {eng.company && (
          <div style={{
            fontSize: 12, color: "var(--text-tertiary)",
            marginBottom: 6, fontWeight: 500,
          }}>
            {eng.name}
          </div>
        )}

        {eng.brief && (
          <p style={{
            fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px",
            lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {eng.brief}
          </p>
        )}

        {eng.competitive_set.length > 0 && (
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {eng.competitive_set.map((c) => (
              <span key={c} style={{
                padding: "3px 8px",
                background: "var(--bg-primary)", border: "1px solid var(--border)",
                borderRadius: 4, fontSize: 11, color: "var(--text-tertiary)",
              }}>
                {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card footer */}
      <div style={{
        padding: "12px 20px",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <Link
          href={`/?engagement=${eng.id}`}
          aria-label={`Query engagement: ${eng.name}`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 36, padding: "0 14px",
            background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
            borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)", textDecoration: "none",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            flex: 1, justifyContent: "center",
          }}
        >
          <ArrowRight size={11} aria-hidden="true" />
          Query
        </Link>
        {!isArchived && (
          <button
            onClick={() => onArchive(eng.id)}
            aria-label="Archive engagement"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 36, height: 36, padding: 0, flexShrink: 0,
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: "var(--radius-btn)", color: "var(--text-tertiary)", cursor: "pointer",
            }}
          >
            <Archive size={13} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

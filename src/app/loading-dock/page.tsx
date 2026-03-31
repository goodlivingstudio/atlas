"use client";

import { useState, useEffect } from "react";
import { Plus, X, Archive, ArrowRight } from "lucide-react";
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

  useEffect(() => {
    fetch("/api/engagements")
      .then((r) => r.json())
      .then(setEngagements)
      .catch(() => null);
  }, []);

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
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "72px 24px 48px" }}>

      {/* Header */}
      <div style={{ marginBottom: 48 }}>
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
          fontSize: 28, fontWeight: 400, color: "var(--text-primary)",
          letterSpacing: "-0.02em", lineHeight: 1.2, margin: "0 0 6px",
        }}>
          Loading Dock
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0, lineHeight: 1.6 }}>
          Where raw material enters. Drop what you have — a name, a URL, a half-formed tension.
          Atlas builds from incomplete inputs.
        </p>
      </div>

      {/* New engagement button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 16px", marginBottom: 32,
            background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
            borderRadius: 4, color: "var(--accent-secondary)", cursor: "pointer",
            fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
          }}
        >
          <Plus size={13} />
          New Engagement
        </button>
      )}

      {/* Intake form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          padding: "20px 24px",
          background: "var(--bg-surface)", border: "1px solid var(--accent-secondary)",
          borderRadius: 4, marginBottom: 32,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--accent-secondary)", marginBottom: 20,
          }}>
            New Engagement
          </div>

          {[
            { key: "name", label: "Name *", placeholder: "What are you calling this engagement?" },
            { key: "company", label: "Company", placeholder: "Client or company name" },
            { key: "url", label: "URL", placeholder: "https://" },
          ].map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 6,
              }}>
                {label}
              </label>
              <input
                type="text"
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                required={key === "name"}
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: 4, color: "var(--text-primary)", fontSize: 13,
                  outline: "none",
                }}
              />
            </div>
          ))}

          {[
            { key: "brief", label: "Brief", placeholder: "What's the engagement? What problem are you solving? Use whatever you have — a sentence is enough." },
            { key: "notes", label: "Notes", placeholder: "Half-formed tensions, hypotheses, things that feel off. Incomplete is fine." },
          ].map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 6,
              }}>
                {label}
              </label>
              <textarea
                value={form[key as keyof typeof form]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                placeholder={placeholder}
                rows={3}
                style={{
                  width: "100%", padding: "10px 12px", boxSizing: "border-box",
                  background: "var(--bg-primary)", border: "1px solid var(--border)",
                  borderRadius: 4, color: "var(--text-primary)", fontSize: 13,
                  outline: "none", resize: "vertical", lineHeight: 1.6,
                  fontFamily: "inherit",
                }}
              />
            </div>
          ))}

          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: "block", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--text-tertiary)", marginBottom: 6,
            }}>
              Competitive Set
            </label>
            <input
              type="text"
              value={form.competitive_set_raw}
              onChange={(e) => setForm((f) => ({ ...f, competitive_set_raw: e.target.value }))}
              placeholder="Competitor A, Competitor B, Competitor C"
              style={{
                width: "100%", padding: "10px 12px", boxSizing: "border-box",
                background: "var(--bg-primary)", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--text-primary)", fontSize: 13, outline: "none",
              }}
            />
            <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
              Comma-separated. Add what you know now.
            </div>
          </div>

          {error && (
            <div style={{
              padding: "10px 12px", marginBottom: 16,
              background: "var(--bg-primary)", border: "1px solid var(--error)",
              borderRadius: 4, color: "var(--error)", fontSize: 12,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="submit"
              disabled={saving || !form.name.trim()}
              style={{
                padding: "10px 20px",
                background: saving ? "var(--bg-elevated)" : "var(--accent-primary)",
                border: `1px solid ${saving ? "var(--border)" : "var(--accent-secondary)"}`,
                borderRadius: 4, color: "var(--accent-secondary)", cursor: saving ? "wait" : "pointer",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                opacity: !form.name.trim() && !saving ? 0.5 : 1,
              }}
            >
              {saving ? "Saving..." : "Save Engagement"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null); }}
              style={{
                padding: "10px 16px",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--text-tertiary)", cursor: "pointer",
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
        <div style={{ marginBottom: 40 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10,
          }}>
            Engagements — {active.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}

      {active.length === 0 && !showForm && (
        <div style={{
          padding: "32px 24px", textAlign: "center",
          border: "1px dashed var(--border)", borderRadius: 4,
          color: "var(--text-tertiary)", fontSize: 13,
        }}>
          No active engagements. Start one above.
        </div>
      )}

      {/* Archived */}
      {archived.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10,
          }}>
            Archived — {archived.length}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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

  return (
    <div style={{
      padding: "14px 16px",
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: 4,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: statusMeta.color, flexShrink: 0,
            }} />
            <span style={{
              fontSize: 13, fontWeight: 500, color: "var(--text-primary)",
            }}>
              {eng.name}
            </span>
            {eng.company && (
              <span style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
                · {eng.company}
              </span>
            )}
            <span style={{
              marginLeft: "auto", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: statusMeta.color, fontFamily: "var(--font-mono)",
            }}>
              {statusMeta.label}
            </span>
          </div>

          {eng.brief && (
            <p style={{
              fontSize: 12, color: "var(--text-secondary)", margin: "6px 0 0",
              lineHeight: 1.6,
              display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}>
              {eng.brief}
            </p>
          )}

          {eng.competitive_set.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {eng.competitive_set.map((c) => (
                <span key={c} style={{
                  padding: "2px 8px",
                  background: "var(--bg-elevated)", border: "1px solid var(--border)",
                  borderRadius: 2, fontSize: 11, color: "var(--text-tertiary)",
                }}>
                  {c}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <Link
            href={`/?engagement=${eng.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              padding: "6px 10px",
              background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
              borderRadius: 4, color: "var(--accent-secondary)", textDecoration: "none",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            <ArrowRight size={11} />
            Query
          </Link>
          {eng.status !== "archived" && (
            <button
              onClick={() => onArchive(eng.id)}
              title="Archive"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32, padding: 0,
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: 4, color: "var(--text-tertiary)", cursor: "pointer",
              }}
            >
              <Archive size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import {
  Plus, X, Archive, ArrowRight, FileText, UploadCloud,
  Loader2, ChevronRight, CheckCheck, Pencil,
} from "lucide-react";
import Link from "next/link";
import { IntakePipeline } from "@/components/intake-pipeline";
import type { IntakeAnalysis } from "@/app/api/analyze-intake/route";

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
  created_at: string;
}

const STATUS_META: Record<Engagement["status"], { label: string; color: string }> = {
  intake:     { label: "Intake",     color: "var(--text-tertiary)" },
  diagnosing: { label: "Diagnosing", color: "var(--layer-frameworks)" },
  active:     { label: "Active",     color: "var(--live)" },
  archived:   { label: "Archived",   color: "var(--border)" },
};

const EMPTY_FORM = {
  name: "", company: "", url: "", brief: "", notes: "", competitive_set_raw: "",
};

// ─── Intake states ────────────────────────────────────────────────────────────
type IntakeState =
  | { phase: "idle" }
  | { phase: "extracting"; label: string }
  | { phase: "analyzing"; label: string }
  | { phase: "review"; analysis: IntakeAnalysis }
  | { phase: "form" }
  | { phase: "error"; message: string };

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LoadingDock() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [intake, setIntake] = useState<IntakeState>({ phase: "idle" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ".pdf,.doc,.docx,.xls,.xlsx,.csv,.ppt,.pptx,.txt,.md,.markdown";

  useEffect(() => {
    fetch("/api/engagements")
      .then((r) => r.json())
      .then(setEngagements)
      .catch(() => null);
  }, []);

  // ── Drag handlers ──────────────────────────────────────────────────────────
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
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setDragOver(false);

    const file = e.dataTransfer.files?.[0];
    if (file) { processFile(file); return; }

    const text = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
    if (text?.trim()) {
      try {
        const u = new URL(text.trim());
        if (u.hostname.includes("docs.google.com") || u.hostname.includes("drive.google.com")) {
          processGoogleUrl(text.trim());
        } else {
          openFormWithUrl(text.trim());
        }
      } catch {
        openFormWithText(text.trim());
      }
    }
  }

  // ── File pipeline: extract → analyze ──────────────────────────────────────
  async function processFile(file: File) {
    const label = file.name;
    setIntake({ phase: "extracting", label });

    // 1. Extract text
    let extracted: { title: string; text: string; type: string } | null = null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/extract-file", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setIntake({ phase: "error", message: data.error || "Could not read that file." });
        return;
      }
      extracted = data;
    } catch {
      setIntake({ phase: "error", message: "File extraction failed. Try again or fill in manually." });
      return;
    }

    if (!extracted?.text) {
      setIntake({ phase: "error", message: "No text could be extracted from this file." });
      return;
    }

    // 2. Analyze
    setIntake({ phase: "analyzing", label });
    try {
      const res = await fetch("/api/analyze-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: extracted.text, filename: label, type: extracted.type }),
      });
      const analysis = await res.json();
      if (!res.ok) {
        // Fall back to form with raw text if analysis fails
        openFormWithExtracted(extracted.title, extracted.text);
        return;
      }
      setIntake({ phase: "review", analysis });
    } catch {
      openFormWithExtracted(extracted.title, extracted.text);
    }
  }

  async function processGoogleUrl(url: string) {
    setIntake({ phase: "extracting", label: url });
    try {
      const res = await fetch("/api/extract-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        setIntake({ phase: "error", message: data.error });
        return;
      }
      setIntake({ phase: "analyzing", label: data.title || url });
      const analysisRes = await fetch("/api/analyze-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: data.text, filename: data.title, type: data.type }),
      });
      const analysis = await analysisRes.json();
      if (!analysisRes.ok) { openFormWithExtracted(data.title, data.text); return; }
      setIntake({ phase: "review", analysis });
    } catch {
      setIntake({ phase: "error", message: "Could not reach that URL." });
    }
  }

  function openFormWithUrl(url: string) {
    setForm((f) => ({ ...f, url }));
    setIntake({ phase: "form" });
  }
  function openFormWithText(text: string) {
    setForm((f) => ({ ...f, brief: text.slice(0, 1200) }));
    setIntake({ phase: "form" });
  }
  function openFormWithExtracted(title: string, text: string) {
    setForm((f) => ({
      ...f,
      name: f.name || title,
      brief: text.slice(0, 1200),
      notes: text.length > 1200 ? text.slice(1200, 3000) : f.notes,
    }));
    setIntake({ phase: "form" });
  }

  // Accept analysis → save immediately
  async function acceptAnalysis(analysis: IntakeAnalysis) {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/engagements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: analysis.name,
          company: analysis.company || null,
          url: analysis.url || null,
          brief: analysis.brief || null,
          notes: analysis.notes || null,
          competitive_set: analysis.competitive_set || [],
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        setSaveError(err.error || "Failed to save");
        return;
      }
      const created = await res.json();
      setEngagements((prev) => [created, ...prev]);
      setIntake({ phase: "idle" });
      setForm(EMPTY_FORM);
    } catch {
      setSaveError("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  // Edit analysis → open form with pre-filled values
  function editAnalysis(analysis: IntakeAnalysis) {
    setForm({
      name: analysis.name || "",
      company: analysis.company || "",
      url: analysis.url || "",
      brief: analysis.brief || "",
      notes: analysis.notes || "",
      competitive_set_raw: (analysis.competitive_set || []).join(", "),
    });
    setIntake({ phase: "form" });
  }

  // Form submit
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);

    const competitive_set = form.competitive_set_raw
      .split(",").map((s) => s.trim()).filter(Boolean);

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
      setIntake({ phase: "idle" });
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong");
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

  function reset() {
    setIntake({ phase: "idle" });
    setForm(EMPTY_FORM);
    setSaveError(null);
  }

  const active   = engagements.filter((e) => e.status !== "archived");
  const archived = engagements.filter((e) => e.status === "archived");
  const isIdle   = intake.phase === "idle";

  return (
    <main
      style={{ maxWidth: 880, margin: "0 auto", padding: "104px 24px 64px" }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        aria-hidden="true"
        tabIndex={-1}
        style={{ position: "absolute", width: 0, height: 0, opacity: 0, pointerEvents: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processFile(file);
          e.target.value = "";
        }}
      />

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
          Atlas analyzes and structures the engagement.
        </p>
      </div>

      {/* ── Drop zone (idle) ──────────────────────────────────────────────────── */}
      {isIdle && (
        <div style={{
          padding: "40px 32px",
          border: `2px dashed ${dragOver ? "var(--accent-secondary)" : "var(--border)"}`,
          borderRadius: "var(--radius-card)",
          background: dragOver ? "var(--accent-primary)" : "transparent",
          marginBottom: 40,
          display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
          transition: "border-color 0.15s, background 0.15s",
          textAlign: "center",
        }}>
          <div style={{
            width: 52, height: 52,
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {dragOver
              ? <UploadCloud size={22} style={{ color: "var(--accent-secondary)" }} aria-hidden="true" />
              : <FileText size={22} style={{ color: "var(--text-tertiary)" }} aria-hidden="true" />
            }
          </div>
          <div>
            <div style={{
              fontSize: 16, fontWeight: 500, letterSpacing: "-0.02em", marginBottom: 6,
              color: dragOver ? "var(--accent-secondary)" : "var(--text-primary)",
              transition: "color 0.15s",
            }}>
              {dragOver ? "Drop to analyze" : "Drop a file — Atlas takes it from there"}
            </div>
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
              PDF · Word · Excel · PowerPoint · Markdown · CSV
            </div>
            <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 2, opacity: 0.65 }}>
              Google Docs / Sheets / Slides · public links
            </div>
          </div>
          {!dragOver && (
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 40, padding: "0 18px",
                  background: "var(--bg-surface)", border: "1px solid var(--border)",
                  borderRadius: "var(--radius-btn)", color: "var(--text-secondary)",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                <UploadCloud size={12} aria-hidden="true" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setIntake({ phase: "form" })}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  height: 40, padding: "0 18px",
                  background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
                  borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                  textTransform: "uppercase", cursor: "pointer",
                }}
              >
                <Plus size={12} aria-hidden="true" />
                Fill Manually
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Extracting / Analyzing — pipeline animation ───────────────────────── */}
      {(intake.phase === "extracting" || intake.phase === "analyzing") && (
        <IntakePipeline phase={intake.phase} label={intake.label} />
      )}

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {intake.phase === "error" && (
        <div style={{
          padding: "24px 28px", marginBottom: 40,
          background: "var(--bg-surface)", border: "1px solid var(--error)",
          borderRadius: "var(--radius-card)",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--error)",
            fontFamily: "var(--font-mono)", marginBottom: 8,
          }}>
            Intake Error
          </div>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", margin: "0 0 16px", lineHeight: 1.6 }}>
            {intake.message}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setIntake({ phase: "form" })}
              style={{
                height: 36, padding: "0 16px",
                background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
                borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Fill Manually
            </button>
            <button
              onClick={reset}
              style={{
                height: 36, padding: "0 16px",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: "var(--radius-btn)", color: "var(--text-tertiary)",
                fontSize: 11, fontWeight: 600, letterSpacing: "0.06em",
                textTransform: "uppercase", cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── Analysis Review ───────────────────────────────────────────────────── */}
      {intake.phase === "review" && (
        <AnalysisReview
          analysis={intake.analysis}
          saving={saving}
          saveError={saveError}
          onAccept={acceptAnalysis}
          onEdit={editAnalysis}
          onDismiss={reset}
        />
      )}

      {/* ── Manual Form ───────────────────────────────────────────────────────── */}
      {intake.phase === "form" && (
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
              onClick={reset}
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
            { key: "name",    label: "Name",    required: true,  placeholder: "What are you calling this engagement?" },
            { key: "company", label: "Company", required: false, placeholder: "Client or company name" },
            { key: "url",     label: "URL",     required: false, placeholder: "https://" },
          ].map(({ key, label, required, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label htmlFor={`field-${key}`} style={{
                display: "block", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 6,
              }}>
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
            { key: "brief", label: "Brief", placeholder: "What's the engagement? What problem are you solving?" },
            { key: "notes", label: "Notes", placeholder: "Tensions, hypotheses, things that feel off." },
          ].map(({ key, label, placeholder }) => (
            <div key={key} style={{ marginBottom: 16 }}>
              <label htmlFor={`field-${key}`} style={{
                display: "block", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
                color: "var(--text-tertiary)", marginBottom: 6,
              }}>
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
            <label htmlFor="field-competitive-set" style={{
              display: "block", fontSize: 10, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
              color: "var(--text-tertiary)", marginBottom: 6,
            }}>
              Competitive Set
            </label>
            <input
              id="field-competitive-set"
              type="text"
              value={form.competitive_set_raw}
              onChange={(e) => setForm((f) => ({ ...f, competitive_set_raw: e.target.value }))}
              placeholder="Competitor A, Competitor B"
              aria-describedby="competitive-set-hint"
              style={{
                width: "100%", height: 48, padding: "0 14px", boxSizing: "border-box",
                background: "var(--bg-primary)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-btn)", color: "var(--text-primary)",
                fontSize: 13, outline: "none",
              }}
            />
            <div id="competitive-set-hint" style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 5 }}>
              Comma-separated.
            </div>
          </div>

          {saveError && (
            <div role="alert" style={{
              padding: "12px 14px", marginBottom: 16,
              background: "var(--bg-primary)", border: "1px solid var(--error)",
              borderRadius: "var(--radius-btn)", color: "var(--error)", fontSize: 12,
            }}>
              {saveError}
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
              {saving ? "Saving…" : "Save Engagement"}
            </button>
            <button
              type="button"
              onClick={reset}
              style={{
                height: 48, padding: "0 20px",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: "var(--radius-btn)", color: "var(--text-tertiary)",
                cursor: "pointer", fontSize: 11, fontWeight: 600,
                letterSpacing: "0.06em", textTransform: "uppercase",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Active engagements ────────────────────────────────────────────────── */}
      {active.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12,
          }}>
            Engagements — {active.length}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 10 }}>
            {active.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}

      {/* ── Archived ─────────────────────────────────────────────────────────── */}
      {archived.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 12,
          }}>
            Archived — {archived.length}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 8 }}>
            {archived.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} onArchive={handleArchive} />
            ))}
          </div>
        </div>
      )}
    </main>
  );
}

// ─── Analysis Review component ────────────────────────────────────────────────

function AnalysisReview({
  analysis,
  saving,
  saveError,
  onAccept,
  onEdit,
  onDismiss,
}: {
  analysis: IntakeAnalysis;
  saving: boolean;
  saveError: string | null;
  onAccept: (a: IntakeAnalysis) => void;
  onEdit: (a: IntakeAnalysis) => void;
  onDismiss: () => void;
}) {
  return (
    <div style={{
      marginBottom: 40,
      background: "var(--bg-surface)", border: "1px solid var(--accent-secondary)",
      borderRadius: "var(--radius-card)", overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        padding: "20px 24px",
        background: "var(--accent-primary)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.1em",
            textTransform: "uppercase", color: "var(--accent-secondary)",
            fontFamily: "var(--font-mono)", marginBottom: 4,
          }}>
            Atlas · {analysis.doc_type}
          </div>
          <div style={{
            fontSize: 20, fontWeight: 600, color: "var(--text-primary)",
            letterSpacing: "-0.03em", lineHeight: 1.2,
          }}>
            {analysis.name}
          </div>
          {analysis.company && (
            <div style={{ fontSize: 13, color: "var(--text-tertiary)", marginTop: 2 }}>
              {analysis.company}
            </div>
          )}
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss analysis"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, padding: 0, flexShrink: 0,
            background: "transparent", border: "none",
            borderRadius: 4, color: "var(--text-tertiary)", cursor: "pointer",
          }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {/* Brief */}
      {analysis.brief && (
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)",
            marginBottom: 8,
          }}>
            Brief
          </div>
          <p style={{ fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7, margin: 0 }}>
            {analysis.brief}
          </p>
        </div>
      )}

      {/* Signals — 3-column */}
      {analysis.signals?.length > 0 && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
          borderBottom: "1px solid var(--border)",
        }}>
          {analysis.signals.map((sig, i) => (
            <div key={i} style={{
              padding: "16px 20px",
              borderRight: i < 2 ? "1px solid var(--border)" : "none",
            }}>
              <div style={{
                fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                textTransform: "uppercase", color: "var(--accent-muted)",
                fontFamily: "var(--font-mono)", marginBottom: 6,
              }}>
                {sig.label}
              </div>
              <p style={{ fontSize: 12.5, color: "var(--text-primary)", lineHeight: 1.6, margin: 0 }}>
                {sig.body}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Notes / tensions */}
      {analysis.notes && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 8,
          }}>
            Tensions & Observations
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.75, whiteSpace: "pre-line" }}>
            {analysis.notes}
          </div>
        </div>
      )}

      {/* Next steps */}
      {analysis.next_steps?.length > 0 && (
        <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
            textTransform: "uppercase", color: "var(--text-tertiary)", marginBottom: 10,
          }}>
            Next Steps
          </div>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
            {analysis.next_steps.map((step, i) => (
              <li key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span style={{
                  fontSize: 10, fontFamily: "var(--font-mono)",
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
      )}

      {/* Competitive set */}
      {analysis.competitive_set?.length > 0 && (
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
              textTransform: "uppercase", color: "var(--text-tertiary)",
              marginRight: 4,
            }}>
              vs.
            </span>
            {analysis.competitive_set.map((c) => (
              <span key={c} style={{
                padding: "3px 10px",
                background: "var(--bg-elevated)", border: "1px solid var(--border)",
                borderRadius: 4, fontSize: 11, color: "var(--text-tertiary)",
              }}>
                {c}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: "16px 24px" }}>
        {saveError && (
          <div role="alert" style={{
            padding: "10px 14px", marginBottom: 12,
            background: "var(--bg-primary)", border: "1px solid var(--error)",
            borderRadius: "var(--radius-btn)", color: "var(--error)", fontSize: 12,
          }}>
            {saveError}
          </div>
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => onAccept(analysis)}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 44, padding: "0 20px",
              background: saving ? "var(--bg-elevated)" : "var(--accent-primary)",
              border: `1px solid ${saving ? "var(--border)" : "var(--accent-secondary)"}`,
              borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            {saving
              ? <Loader2 size={12} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} aria-hidden="true" />
              : <CheckCheck size={12} aria-hidden="true" />
            }
            {saving ? "Saving…" : "Save Engagement"}
          </button>
          <button
            onClick={() => onEdit(analysis)}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              height: 44, padding: "0 18px",
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: "var(--radius-btn)", color: "var(--text-secondary)",
              cursor: "pointer", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            <Pencil size={11} aria-hidden="true" />
            Edit Before Saving
          </button>
          <button
            onClick={onDismiss}
            style={{
              height: 44, padding: "0 16px",
              background: "transparent", border: "none",
              borderRadius: "var(--radius-btn)", color: "var(--text-tertiary)",
              cursor: "pointer", fontSize: 11, fontWeight: 600,
              letterSpacing: "0.06em", textTransform: "uppercase",
            }}
          >
            Discard
          </button>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 10 }}>
          <ChevronRight size={10} style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }} aria-hidden="true" />
          After saving, query this engagement from the Operating Room.
        </div>
      </div>
    </div>
  );
}

// ─── Engagement Card ──────────────────────────────────────────────────────────

function EngagementCard({
  engagement: eng,
  onArchive,
}: {
  engagement: Engagement;
  onArchive: (id: string) => void;
}) {
  const statusMeta   = STATUS_META[eng.status];
  const displayLabel = eng.company || eng.name;
  const isArchived   = eng.status === "archived";
  const initials     = displayLabel
    .split(/\s+/).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <div style={{
      background: "var(--bg-surface)", border: "1px solid var(--border)",
      borderRadius: "var(--radius-card)", overflow: "hidden",
      opacity: isArchived ? 0.6 : 1,
      display: "flex", flexDirection: "column",
    }}>
      {/* Visual header */}
      <div style={{
        height: 100, background: "var(--bg-elevated)",
        borderBottom: "1px solid var(--border)",
        padding: "16px 20px", display: "flex", flexDirection: "column",
        justifyContent: "space-between", position: "relative", overflow: "hidden",
      }}>
        <div aria-hidden="true" style={{
          position: "absolute", right: 16, bottom: -8,
          fontSize: 72, fontWeight: 700, letterSpacing: "-0.05em",
          color: "var(--bg-primary)", lineHeight: 1,
          userSelect: "none", pointerEvents: "none",
        }}>
          {initials}
        </div>
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
        <div style={{
          fontSize: 20, fontWeight: 600, color: "var(--text-primary)",
          letterSpacing: "-0.03em", lineHeight: 1.1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {displayLabel}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "16px 20px 12px", flex: 1 }}>
        {eng.company && (
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginBottom: 6, fontWeight: 500 }}>
            {eng.name}
          </div>
        )}
        {eng.brief && (
          <p style={{
            fontSize: 12, color: "var(--text-secondary)", margin: "0 0 10px", lineHeight: 1.6,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
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

      {/* Footer */}
      <div style={{
        padding: "12px 20px", borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <Link
          href={`/?engagement=${eng.id}`}
          aria-label={`Query engagement: ${eng.name}`}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            height: 36, padding: "0 14px",
            background: "var(--accent-primary)", border: "1px solid var(--accent-secondary)",
            borderRadius: "var(--radius-btn)", color: "var(--accent-secondary)",
            textDecoration: "none", fontSize: 11, fontWeight: 600,
            letterSpacing: "0.06em", textTransform: "uppercase",
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

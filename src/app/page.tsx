"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Send } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StatusData {
  total_documents: number;
  total_chunks: number;
  by_layer: Record<string, { documents: number; chunks: number }>;
}

interface Engagement {
  id: string;
  name: string;
  company: string | null;
  status: "intake" | "diagnosing" | "active" | "archived";
  created_at: string;
  metadata: Record<string, unknown> | null;
}

interface SignalItem {
  tag: string;
  text: string;
  href: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  active:     "var(--live)",
  diagnosing: "var(--layer-frameworks)",
  intake:     "var(--text-tertiary)",
  archived:   "var(--border)",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escalate(query: string): string {
  return `/ask?q=${encodeURIComponent(query)}`;
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning.";
  if (h < 17) return "Good afternoon.";
  return "Good evening.";
}

function buildSituationSentence(
  status: StatusData | null,
  engagements: Engagement[]
): string {
  const docCount = status?.total_documents ?? 0;
  const activeEngagements = engagements.filter((e) => e.status === "active");
  const intakeEngagements = engagements.filter(
    (e) => e.status === "intake" || e.status === "diagnosing"
  );

  if (engagements.length === 0 && docCount === 0) {
    return "Nothing active yet. Start by ingesting your first document.";
  }

  if (activeEngagements.length > 0 && intakeEngagements.length > 0) {
    return `You have ${activeEngagements.length} active engagement${activeEngagements.length !== 1 ? "s" : ""} and ${intakeEngagements.length} document${intakeEngagements.length !== 1 ? "s" : ""} waiting for review.`;
  }

  if (activeEngagements.length > 0) {
    const overdueLabel =
      activeEngagements.length === 1
        ? "One engagement is overdue for a brief."
        : `${activeEngagements.length} active engagements in progress.`;
    if (docCount > 0) {
      return `Knowledge base is healthy. ${overdueLabel}`;
    }
    return overdueLabel;
  }

  if (intakeEngagements.length > 0) {
    return `${intakeEngagements.length} engagement${intakeEngagements.length !== 1 ? "s" : ""} in intake — move them forward to begin analysis.`;
  }

  if (docCount === 0) {
    return "Nothing active yet. Start by ingesting your first document.";
  }

  return `${docCount} document${docCount !== 1 ? "s" : ""} in the knowledge base. No active engagements.`;
}

function buildSignalItems(
  status: StatusData | null,
  engagements: Engagement[]
): SignalItem[] {
  const items: SignalItem[] = [];
  const docCount = status?.total_documents ?? 0;
  const byLayer = status?.by_layer ?? {};

  // Check for sparse market layer
  const marketEmpty = !byLayer["market"] || byLayer["market"].documents === 0;
  if (marketEmpty && docCount > 0) {
    items.push({
      tag: "KNOWLEDGE",
      text: "Market layer is empty — add research to improve retrieval",
      href: "/loading-dock",
    });
  }

  // Pending intake engagements
  const intakePending = engagements.filter(
    (e) => e.status === "intake" || e.status === "diagnosing"
  );
  if (intakePending.length > 0) {
    items.push({
      tag: "ACTION",
      text: `${intakePending.length} engagement${intakePending.length !== 1 ? "s" : ""} in intake — move them forward`,
      href: "/engagements",
    });
  }

  // Atlas query suggestion based on state
  if (docCount > 0) {
    items.push({
      tag: "ATLAS",
      text: "Ask Atlas about your active engagements",
      href: "/ask",
    });
  } else {
    items.push({
      tag: "ATLAS",
      text: "Ingest your first document to activate retrieval",
      href: "/loading-dock",
    });
  }

  // If KB has sparse total coverage
  if (docCount > 0 && docCount < 5) {
    items.push({
      tag: "KNOWLEDGE",
      text: `${docCount} doc${docCount !== 1 ? "s" : ""} ingested — add more to improve responses`,
      href: "/loading-dock",
    });
  }

  return items.slice(0, 4);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 600,
      
      textTransform: "uppercase" as const,
      fontFamily: "var(--font-mono)",
      color: "var(--text-tertiary)",
      marginBottom: 12,
    }}>
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Home() {
  const router = useRouter();

  const [status, setStatus]       = useState<StatusData | null>(null);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading]     = useState(true);
  const [query, setQuery]         = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/status").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/engagements").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([s, e]) => {
      setStatus(s);
      setEngagements(Array.isArray(e) ? e : []);
      setLoading(false);
    });
  }, []);

  function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/ask?q=${encodeURIComponent(query.trim())}`);
  }

  function handleTextareaKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (query.trim()) {
        router.push(`/ask?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  const activeEngagements = engagements.filter((e) => e.status === "active");
  const displayEngagements = engagements
    .filter((e) => e.status !== "archived")
    .slice(0, 3);

  const signalItems = buildSignalItems(status, engagements);
  const situationSentence = loading
    ? "Loading…"
    : buildSituationSentence(status, engagements);

  return (
    <main style={{
      maxWidth: 680,
      margin: "0 auto",
      padding: "40px 24px 0",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>

      {/* ── Zone 1: SITUATION ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <h1 style={{
          fontSize: 32,
          fontWeight: 400,
          
          lineHeight: 1.15,
          color: "var(--text-primary)",
          margin: "0 0 12px",
        }}>
          {getGreeting()}
        </h1>
      </div>

      {/* ── Zone 2: ACTIVE WORK ───────────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <SectionLabel>Active</SectionLabel>

        {loading ? (
          <div style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            
          }}>
            Loading…
          </div>
        ) : displayEngagements.length === 0 ? (
          <div style={{
            fontSize: 13,
            color: "var(--text-tertiary)",
            
          }}>
            No active engagements.{" "}
            <Link
              href="/loading-dock"
              style={{
                color: "var(--accent-secondary)",
                textDecoration: "none",
              }}
            >
              Start one →
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {displayEngagements.map((eng) => (
              <div
                key={eng.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "var(--bg-surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-card)",
                  borderLeft: `2px solid ${STATUS_COLOR[eng.status] ?? "var(--border)"}`,
                  gap: 0,
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
              >
                {/* Main link — name + company + status */}
                <Link
                  href={`/engagements/${eng.id}`}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    padding: "14px 16px",
                    gap: 12,
                    textDecoration: "none",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      fontSize: 14,
                      fontWeight: 500,
                      color: "var(--text-primary)",
                      
                    }}>
                      {eng.name}
                    </span>
                    {eng.company && (
                      <span style={{
                        fontSize: 12,
                        color: "var(--text-tertiary)",
                        marginLeft: 6,
                      }}>
                        · {eng.company}
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    textTransform: "uppercase" as const,
                    
                    color: STATUS_COLOR[eng.status] ?? "var(--text-tertiary)",
                    flexShrink: 0,
                  }}>
                    {eng.status}
                  </span>
                </Link>

                {/* Ask Atlas → escalation */}
                <Link
                  href={escalate(`Give me a full strategic brief on ${eng.name}${eng.company ? ` (${eng.company})` : ''}. What are the key dynamics, risks, and opportunities right now?`)}
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    
                    color: "var(--accent-secondary)",
                    textDecoration: "none",
                    flexShrink: 0,
                    padding: "14px 16px 14px 0",
                  }}
                >
                  Ask Atlas →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Zone 3: SIGNAL ────────────────────────────────────────────────── */}
      {!loading && signalItems.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <SectionLabel>Signal</SectionLabel>

          <div style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-card)",
            overflow: "hidden",
          }}>
            {signalItems.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 44,
                  padding: "0 14px",
                  gap: 0,
                  borderBottom: i < signalItems.length - 1 ? "1px solid var(--border)" : "none",
                  transition: "background 0.12s",
                  background: "transparent",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-surface)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                {/* Tag */}
                <span style={{
                  width: 72,
                  flexShrink: 0,
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  textTransform: "uppercase" as const,
                  
                  color: "var(--text-tertiary)",
                  fontWeight: 600,
                }}>
                  {item.tag}
                </span>

                {/* Text — links to item href */}
                <Link
                  href={item.href}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 400,
                    color: "var(--text-primary)",
                    
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap" as const,
                    textDecoration: "none",
                  }}
                >
                  {item.text}
                </Link>

                {/* Ask Atlas → escalation */}
                <Link
                  href={escalate(`${item.text} — what are the strategic implications and what should I do next?`)}
                  style={{
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    
                    color: "var(--accent-secondary)",
                    textDecoration: "none",
                    flexShrink: 0,
                    marginLeft: 12,
                  }}
                >
                  Ask Atlas →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      </div>
      {/* end scrollable content */}

      {/* ── Zone 4: ASK ATLAS ─────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, paddingTop: 16, paddingBottom: 32 }}>
        <form onSubmit={handleAsk}>
          <div style={{
            border: `1px solid ${inputFocused ? "var(--accent-secondary)" : "var(--border)"}`,
            borderRadius: 14,
            background: "var(--bg-surface)",
            overflow: "hidden",
            transition: "border-color 0.15s",
          }}>
            <textarea
              ref={textareaRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="What do you need to think through?"
              rows={1}
              style={{
                display: "block",
                width: "100%",
                padding: "14px 16px 0",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: 14,
                
                fontFamily: "inherit",
                lineHeight: 1.55,
                resize: "none" as const,
                minHeight: 48,
                maxHeight: 160,
                boxSizing: "border-box" as const,
              }}
            />
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 4,
              padding: "8px 10px",
            }}>
              <button
                type="submit"
                disabled={!query.trim()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  background: query.trim() ? "var(--accent-primary)" : "var(--bg-elevated)",
                  border: `1px solid ${query.trim() ? "var(--accent-secondary)" : "var(--border)"}`,
                  borderRadius: 8,
                  color: "var(--accent-secondary)",
                  cursor: query.trim() ? "pointer" : "not-allowed",
                  opacity: query.trim() ? 1 : 0.35,
                  transition: "opacity 0.15s, background 0.15s, border-color 0.15s",
                }}
              >
                <Send size={13} />
              </button>
            </div>
          </div>
        </form>
      </div>

    </main>
  );
}

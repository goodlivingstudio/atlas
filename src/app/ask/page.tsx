"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Send, RotateCcw, Sparkles, ChevronDown, ChevronUp, ArrowUpRight, Mic, Paperclip } from "lucide-react";
import { LAYER_META, type KnowledgeLayer } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Engagement {
  id: string;
  name: string;
  company: string | null;
  status?: string;
}

interface Source {
  document_title: string;
  layer: KnowledgeLayer;
  chunk_index: number;
  section_heading?: string;
  similarity: number;
  pinned: boolean;
  source_path?: string;
}

interface Exchange {
  id: number;
  query: string;
  answer: string | null;
  sources: Source[];
  error?: string;
}

interface Suggestion {
  tag: string;
  label: string;
  prompt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function escalate(query: string): string {
  return `/ask?q=${encodeURIComponent(query)}`;
}

function resolveSourceUrl(source: Source): string | null {
  if (!source.source_path) return null;
  if (source.source_path.startsWith("http")) return source.source_path;
  const engMatch = source.source_path.match(/^engagement\/([a-f0-9-]{36})/i);
  if (engMatch) return `/engagements/${engMatch[1]}`;
  return null;
}

// ─── Suggestions ──────────────────────────────────────────────────────────────

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { tag: "DIAGNOSIS",  label: "Situation assessment",  prompt: "What's the current state of our most active engagement?" },
  { tag: "STRATEGY",   label: "Competitive position",  prompt: "What are the key competitive dynamics at play across our engagements?" },
  { tag: "SYNTHESIS",  label: "Knowledge synthesis",   prompt: "What are the most important strategic frameworks in the knowledge base?" },
  { tag: "PRESSURE",   label: "Stress test",           prompt: "What assumptions in our current strategy are most likely to be wrong?" },
  { tag: "GAPS",       label: "What we don't know",    prompt: "What are the biggest unknowns or knowledge gaps affecting our current work?" },
  { tag: "SIGNAL",     label: "Pattern recognition",   prompt: "What patterns are emerging across our active engagements?" },
];

function buildSuggestions({
  engagements,
}: {
  totalDocs: number;
  totalChunks: number;
  engagements: Engagement[];
}): Suggestion[] {
  const active = engagements.filter((e) => e.status === "active");
  const engSuggestions: Suggestion[] = active.slice(0, 2).map((eng) => ({
    tag: "ACTIVE",
    label: eng.name,
    prompt: `Give me a full situation brief on ${eng.name}`,
  }));

  // Merge: engagement suggestions first, then defaults, trimmed to 6
  const merged = [...engSuggestions, ...DEFAULT_SUGGESTIONS];
  return merged.slice(0, 6);
}

// ─── Source citation row ──────────────────────────────────────────────────────

function SourceRow({ source, index }: { source: Source; index: number }) {
  const meta    = LAYER_META[source.layer];
  const url     = resolveSourceUrl(source);
  const heading = source.section_heading?.replace(/^#+\s*/, "");

  const inner = (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "9px 14px",
      borderBottom: "1px solid var(--border)",
      transition: "background 0.12s",
    }}
    onMouseEnter={(e) => { if (url) (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
    >
      <span style={{
        fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
        flexShrink: 0, width: 16, paddingTop: 1,
      }}>
        {index + 1}
      </span>
      <div style={{
        width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
        background: meta?.color ?? "var(--text-tertiary)",
        marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, color: "var(--text-primary)", fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {source.document_title}
        </div>
        {heading && (
          <div style={{
            fontSize: 11, color: "var(--text-tertiary)", marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            § {heading}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
          <span style={{
            fontSize: 10, fontFamily: "var(--font-mono)",
            textTransform: "uppercase", color: meta?.color ?? "var(--text-tertiary)", opacity: 0.8,
          }}>
            {meta?.label ?? source.layer}
          </span>
          {!source.pinned && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
            }}>
              {(source.similarity * 100).toFixed(0)}% match
            </span>
          )}
          {source.pinned && (
            <span style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)",
              
            }}>
              always in context
            </span>
          )}
        </div>
        <a
          href={escalate(`Go deeper on "${source.document_title}"${source.section_heading ? `, specifically the section on "${source.section_heading.replace(/^#+\s*/, '')}"` : ''}. What are the key insights and strategic implications?`)}
          style={{
            display: "inline-block",
            marginTop: 5,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            
            color: "var(--accent-secondary)",
            textDecoration: "none",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Ask Atlas →
        </a>
      </div>
      {url && (
        <ArrowUpRight size={11} style={{ color: "var(--accent-secondary)", flexShrink: 0, marginTop: 2 }} />
      )}
    </div>
  );

  if (url) {
    const isExternal = url.startsWith("http");
    return (
      <a
        href={url}
        target={isExternal ? "_blank" : undefined}
        rel={isExternal ? "noopener noreferrer" : undefined}
        style={{ textDecoration: "none", display: "block" }}
      >
        {inner}
      </a>
    );
  }
  return <div>{inner}</div>;
}

// ─── Sources panel ────────────────────────────────────────────────────────────

function SourcesPanel({ sources }: { sources: Source[] }) {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <div style={{
      marginTop: 14,
      border: "1px solid var(--border)",
      borderRadius: "var(--radius-md)",
      overflow: "hidden",
    }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 14px",
          background: "var(--bg-elevated)", border: "none", cursor: "pointer",
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: "var(--accent-secondary)",
          transition: "background 0.12s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)"; }}
      >
        <span>Sources · {sources.length}</span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div>
          {sources.map((src, i) => (
            <SourceRow key={i} source={src} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "14px 16px" }}>
      <span style={{
        fontSize: 11, fontWeight: 600,
        textTransform: "uppercase", fontFamily: "var(--font-mono)",
        color: "var(--accent-secondary)", marginRight: 6,
      }}>
        Atlas
      </span>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{
          width: 5, height: 5, borderRadius: "50%",
          background: "var(--accent-secondary)",
          animation: `dot-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
          opacity: 0.6,
        }} />
      ))}
      <style>{`
        @keyframes dot-pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50%       { opacity: 1;   transform: scale(1.1); }
        }
        @keyframes msg-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Inner component ──────────────────────────────────────────────────────────

function AskAtlas() {
  const searchParams    = useSearchParams();
  const engagementParam = searchParams.get("engagement");
  const qParam          = searchParams.get("q");

  const [query, setQuery]               = useState("");
  const [exchanges, setExchanges]       = useState<Exchange[]>([]);
  const [loading, setLoading]           = useState(false);
  const [engagements, setEngagements]   = useState<Engagement[]>([]);
  const [scopeId, setScopeId]           = useState("");
  const [focused, setFocused]           = useState(false);
  const [suggestions, setSuggestions]   = useState<Suggestion[]>(DEFAULT_SUGGESTIONS);
  const [listening, setListening]       = useState(false);
  const [hasVoice, setHasVoice]         = useState(false);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [extracting, setExtracting]     = useState(false);

  const threadRef   = useRef<HTMLDivElement>(null);
  const inputRef    = useRef<HTMLTextAreaElement>(null);
  const fileRef     = useRef<HTMLInputElement>(null);
  const counter     = useRef(0);
  const firedQParam = useRef(false);

  // Check for voice support
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = typeof window !== "undefined" ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;
    setHasVoice(!!SR);
  }, []);

  // Load status + engagements, then auto-fire ?q= if present
  useEffect(() => {
    Promise.all([
      fetch("/api/status").then((r) => r.ok ? r.json() : null).catch(() => null),
      fetch("/api/engagements").then((r) => r.ok ? r.json() : []).catch(() => []),
    ]).then(([status, data]) => {
      const list: Engagement[] = Array.isArray(data) ? data : [];
      setEngagements(list);
      if (engagementParam && list.find((e) => e.id === engagementParam)) {
        setScopeId(engagementParam);
      }
      setSuggestions(buildSuggestions({
        totalDocs: status?.total_documents ?? 0,
        totalChunks: status?.total_chunks ?? 0,
        engagements: list,
      }));
      if (qParam && !firedQParam.current) {
        firedQParam.current = true;
        submit(qParam);
      }
    }).catch(() => {
      if (qParam && !firedQParam.current) {
        firedQParam.current = true;
        submit(qParam);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engagementParam, qParam]);

  // Auto-scroll
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [exchanges, loading]);

  const autoResize = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, []);

  async function submit(text: string) {
    if (!text.trim() || loading) return;

    let finalQuery = text.trim();

    // If there's an attached file, extract it first
    if (attachedFile) {
      setExtracting(true);
      try {
        const formData = new FormData();
        formData.append("file", attachedFile);
        const res = await fetch("/api/extract-file", { method: "POST", body: formData });
        if (res.ok) {
          const { text: extracted } = await res.json() as { text: string };
          finalQuery = `[Attached: ${attachedFile.name}]\n\n${extracted}\n\n---\n\n${finalQuery}`;
        }
      } catch {
        // proceed without extraction
      } finally {
        setExtracting(false);
        setAttachedFile(null);
      }
    }

    setQuery("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    const id = ++counter.current;

    setExchanges((prev) => [...prev, { id, query: text.trim(), answer: null, sources: [] }]);

    const history = exchanges
      .filter((e) => e.answer)
      .slice(-3)
      .flatMap((e) => [
        { role: "user" as const,      content: e.query },
        { role: "assistant" as const, content: e.answer! },
      ]);

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: finalQuery,
          mode: "DIAGNOSIS",
          top_k: 5,
          engagement_id: scopeId || undefined,
          conversation_history: history.length > 0 ? history : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(err.error || "Query failed");
      }

      const data = await res.json() as { answer: string; sources: Source[] };

      setExchanges((prev) =>
        prev.map((ex) =>
          ex.id === id
            ? { ...ex, answer: data.answer, sources: data.sources ?? [] }
            : ex
        )
      );
    } catch (err) {
      setExchanges((prev) =>
        prev.map((ex) =>
          ex.id === id
            ? { ...ex, error: err instanceof Error ? err.message : "Something went wrong" }
            : ex
        )
      );
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit(query);
    }
  }

  function clear() {
    setExchanges([]);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function startListening() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognition: any = new SR();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript: string = event.results[0]?.[0]?.transcript ?? "";
      setQuery((prev) => prev ? prev + " " + transcript : transcript);
      if (inputRef.current) autoResize(inputRef.current);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    setListening(true);
    recognition.start();
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setAttachedFile(file);
    // Reset input so same file can be re-selected
    if (fileRef.current) fileRef.current.value = "";
  }

  const scopedEng         = engagements.find((e) => e.id === scopeId);
  const isEmpty           = exchanges.length === 0 && !loading;
  const suggestionsHidden = focused || query.length > 0;

  return (
    <main style={{
      maxWidth: 720, margin: "0 auto",
      padding: "40px 24px 0",
      display: "flex", flexDirection: "column",
      height: "100%",
    }}>

      {/* Header */}
      <div style={{ marginBottom: 24, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{
              fontSize: 24, fontWeight: 400, color: "var(--text-primary)",
              lineHeight: 1.2, margin: "0 0 5px",
            }}>
              Ask Atlas
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-tertiary)", margin: 0 }}>
              {scopedEng
                ? `Scoped — ${scopedEng.name}${scopedEng.company ? ` · ${scopedEng.company}` : ""}`
                : "Searches across all knowledge layers."
              }
            </p>
          </div>
          {exchanges.length > 0 && (
            <button
              onClick={clear}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                height: 28, padding: "0 10px",
                background: "transparent", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)", color: "var(--text-tertiary)",
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", fontFamily: "var(--font-mono)",
                cursor: "pointer",
              }}
            >
              <RotateCcw size={8} />
              New
            </button>
          )}
        </div>

        {/* Scope selector */}
        {engagements.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <select
              value={scopeId}
              onChange={(e) => setScopeId(e.target.value)}
              style={{
                height: 36, padding: "0 10px",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: scopeId ? "var(--text-primary)" : "var(--text-tertiary)",
                fontSize: 12, cursor: "pointer", width: "100%",
              }}
            >
              <option value="">All knowledge — no scope</option>
              {engagements.map((eng) => (
                <option key={eng.id} value={eng.id}>
                  {eng.name}{eng.company ? ` · ${eng.company}` : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Thread */}
      <div
        ref={threadRef}
        style={{
          flex: 1, overflowY: "auto",
          display: "flex", flexDirection: "column",
          gap: 28, paddingBottom: 20,
        }}
      >
        {/* Empty state */}
        {isEmpty && (
          <div style={{ paddingTop: 12 }}>
            {/* Confidence legend */}
            <details style={{ marginBottom: 20 }}>
              <summary style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", fontFamily: "var(--font-mono)",
                color: "var(--text-tertiary)", cursor: "pointer", userSelect: "none",
                listStyle: "none", display: "flex", alignItems: "center", gap: 6,
              }}>
                How Atlas labels claims
              </summary>
              <div style={{
                marginTop: 10, padding: "14px 16px",
                background: "var(--bg-surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                display: "flex", flexDirection: "column", gap: 8,
              }}>
                {[
                  { label: "Established fact",   desc: "Verified, sourced, materially reliable" },
                  { label: "Informed inference",  desc: "Reasonable conclusion from partial but credible data" },
                  { label: "Working assumption",  desc: "Useful framing not yet tested" },
                  { label: "Speculation",         desc: "Hypothesis without supporting evidence, offered for exploration" },
                ].map(({ label, desc }) => (
                  <div key={label} style={{ display: "flex", gap: 10 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, color: "var(--accent-secondary)",
                      fontFamily: "var(--font-mono)", flexShrink: 0, width: 130,
                    }}>
                      {label}
                    </span>
                    <span style={{ fontSize: 11, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
                      {desc}
                    </span>
                  </div>
                ))}
              </div>
            </details>

            {/* Suggestion cards */}
            <div style={{
              opacity: suggestionsHidden ? 0 : 1,
              pointerEvents: suggestionsHidden ? "none" : "auto",
              transition: "opacity 0.2s",
            }}>
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              }}>
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => submit(s.prompt)}
                    style={{
                      padding: 16, textAlign: "left",
                      background: "var(--bg-surface)", border: "1px solid var(--border)",
                      borderRadius: "var(--radius-lg)", cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-elevated)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--bg-surface)";
                    }}
                  >
                    <div style={{
                      fontSize: 11, fontFamily: "var(--font-mono)", textTransform: "uppercase",
                      color: "var(--text-tertiary)", marginBottom: 6,
                    }}>
                      {s.tag}
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
                      lineHeight: 1.35,
                    }}>
                      {s.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Exchanges */}
        {exchanges.map((ex) => (
          <div
            key={ex.id}
            style={{
              display: "flex", flexDirection: "column", gap: 10,
              animation: "msg-in 0.3s cubic-bezier(0.16,1,0.3,1) both",
            }}
          >
            {/* User bubble — right aligned */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{
                maxWidth: "78%",
                padding: "12px 16px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "14px 14px 3px 14px",
                fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
                lineHeight: 1.55,
              }}>
                {ex.query}
              </div>
            </div>

            {/* Atlas response */}
            {ex.answer && (
              <div style={{
                padding: "18px 20px",
                background: "var(--bg-surface)",
                border: "1px solid var(--border)",
                borderRadius: "3px 14px 14px 14px",
                animation: "msg-in 0.35s cubic-bezier(0.16,1,0.3,1) 0.05s both",
              }}>
                {/* Atlas label */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  fontSize: 11, fontWeight: 600,
                  textTransform: "uppercase", fontFamily: "var(--font-mono)",
                  color: "var(--accent-secondary)", marginBottom: 12,
                }}>
                  <Sparkles size={9} />
                  Atlas
                </div>

                {/* Answer */}
                <div style={{
                  fontSize: 14, color: "var(--text-primary)",
                  lineHeight: 1.65, whiteSpace: "pre-wrap",
                }}>
                  {ex.answer}
                </div>

                {/* Sources */}
                <SourcesPanel sources={ex.sources} />
              </div>
            )}

            {/* Follow-up chips */}
            {ex.answer && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                {["Go deeper →", "What are the risks? →"].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion.replace(" →", ""))}
                    style={{
                      padding: "6px 12px",
                      background: "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: 20, cursor: "pointer",
                      fontSize: 11, color: "var(--text-tertiary)",
                      transition: "border-color 0.15s, color 0.15s, background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = "var(--accent-secondary)";
                      el.style.color = "var(--text-primary)";
                      el.style.background = "var(--accent-primary)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.borderColor = "var(--border)";
                      el.style.color = "var(--text-tertiary)";
                      el.style.background = "transparent";
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Error */}
            {ex.error && (
              <div style={{
                padding: "12px 16px",
                background: "var(--bg-surface)", border: "1px solid var(--error)",
                borderRadius: "3px 14px 14px 14px",
                color: "var(--error)", fontSize: 13,
              }}>
                {ex.error}
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div style={{
            background: "var(--bg-surface)", border: "1px solid var(--border)",
            borderRadius: "3px 14px 14px 14px",
            animation: "msg-in 0.3s cubic-bezier(0.16,1,0.3,1) both",
            alignSelf: "flex-start",
          }}>
            <TypingDots />
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        flexShrink: 0, paddingTop: 16, paddingBottom: 32,
      }}>
        {/* Attachment pill */}
        {attachedFile && (
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            marginBottom: 8,
            padding: "4px 10px",
            background: "var(--bg-elevated)", border: "1px solid var(--border)",
            borderRadius: 20,
            fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono)",
          }}>
            {extracting ? "Extracting…" : attachedFile.name}
            {!extracting && (
              <button
                onClick={() => setAttachedFile(null)}
                style={{
                  background: "none", border: "none", padding: 0, cursor: "pointer",
                  color: "var(--text-tertiary)", fontSize: 13, lineHeight: 1,
                  display: "flex", alignItems: "center",
                }}
              >
                ×
              </button>
            )}
          </div>
        )}

        <div style={{
          border: `1px solid ${focused ? "var(--accent-secondary)" : "var(--border)"}`,
          borderRadius: 14,
          background: "var(--bg-surface)",
          transition: "border-color 0.15s",
          overflow: "hidden",
        }}>
          <textarea
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              autoResize(e.target);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Ask anything…"
            rows={1}
            style={{
              display: "block", width: "100%",
              padding: "14px 16px 0",
              background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: 14,
              lineHeight: 1.55,
              resize: "none", fontFamily: "inherit",
              minHeight: 48, maxHeight: 160,
              boxSizing: "border-box",
            }}
          />
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "flex-end",
            gap: 4,
            padding: "8px 10px",
          }}>
            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
              onChange={handleFileSelect}
              style={{ display: "none" }}
            />

            {/* Attachment button */}
            <button
              onClick={() => fileRef.current?.click()}
              title="Attach file"
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32,
                background: "transparent", border: "none", borderRadius: 8,
                color: attachedFile ? "var(--accent-secondary)" : "var(--text-tertiary)",
                cursor: "pointer",
                transition: "color 0.15s",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = attachedFile ? "var(--accent-secondary)" : "var(--text-tertiary)"; }}
            >
              <Paperclip size={16} />
            </button>

            {/* Mic button */}
            {hasVoice && (
              <button
                onClick={startListening}
                title={listening ? "Listening…" : "Voice input"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  width: 32, height: 32,
                  background: "transparent", border: "none", borderRadius: 8,
                  color: listening ? "var(--accent-secondary)" : "var(--text-tertiary)",
                  cursor: "pointer",
                  animation: listening ? "pulse-text 1.8s ease-in-out infinite" : "none",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { if (!listening) (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
                onMouseLeave={(e) => { if (!listening) (e.currentTarget as HTMLElement).style.color = "var(--text-tertiary)"; }}
              >
                <Mic size={16} />
              </button>
            )}

            {/* Send button */}
            <button
              onClick={() => submit(query)}
              disabled={loading || !query.trim()}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 32, height: 32,
                background: loading || !query.trim() ? "var(--bg-elevated)" : "var(--accent-primary)",
                border: `1px solid ${loading || !query.trim() ? "var(--border)" : "var(--accent-secondary)"}`,
                borderRadius: 8,
                color: "var(--accent-secondary)",
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                opacity: !query.trim() && !loading ? 0.35 : 1,
                transition: "opacity 0.15s, background 0.15s, border-color 0.15s",
              }}
            >
              {loading
                ? <Loader2 size={13} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
                : <Send size={13} />
              }
            </button>
          </div>
        </div>
      </div>

    </main>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function AskPage() {
  return (
    <Suspense fallback={
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-tertiary)" }}>
          <Loader2 size={14} style={{ animation: "pulse-text 1.8s ease-in-out infinite" }} />
          <span style={{ fontSize: 13 }}>Loading…</span>
        </div>
      </main>
    }>
      <AskAtlas />
    </Suspense>
  );
}

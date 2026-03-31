"use client";

import { useState, useEffect, useRef } from "react";

export interface Signal {
  label: string;
  body: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCerebro() {
  const [signals, setSignals]         = useState<Signal[]>([]);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState(false);
  const fetched                       = useRef(false);

  useEffect(() => {
    if (fetched.current) return;
    fetched.current = true;
    setLoading(true);
    setError(false);

    fetch("/api/cerebro", { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSignals(data.signals || []);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  const placeholder: Signal[] = [
    { label: "INITIALIZING", body: "" },
    { label: "—", body: "" },
    { label: "—", body: "" },
  ];

  return {
    signals: loading || signals.length === 0 ? placeholder : signals,
    loading,
    error,
  };
}

// ─── Boot sequence ────────────────────────────────────────────────────────────

const BOOT_LINES = [
  "$ atlas --cerebro",
  "▸ scanning knowledge base",
  "▸ reading active engagements",
  "▸ cross-referencing doctrine",
  "▸ surfacing signals",
];

// ─── Cerebro Band ─────────────────────────────────────────────────────────────

export function CerebroBand({
  signals,
  loading,
  error,
  onDeliberate,
}: {
  signals: Signal[];
  loading: boolean;
  error: boolean;
  onDeliberate?: (signal: Signal) => void;
}) {
  const [statusIdx,  setStatusIdx]  = useState(0);
  const [revealed,   setRevealed]   = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const wasLoading                  = useRef(true);

  // Advance boot lines while loading
  useEffect(() => {
    if (!loading) return;
    setStatusIdx(0);
    wasLoading.current = true;
    const t = setInterval(
      () => setStatusIdx((i) => Math.min(i + 1, BOOT_LINES.length - 1)),
      800
    );
    return () => clearInterval(t);
  }, [loading]);

  // Stagger reveal when data arrives
  useEffect(() => {
    const hasData = !loading && signals.some((s) => !!s.body);
    if (hasData && wasLoading.current) {
      wasLoading.current = false;
      const t = setTimeout(() => setRevealed(true), 80);
      return () => clearTimeout(t);
    }
  }, [loading, signals]);

  const isLoading = !revealed;

  return (
    <div
      style={{
        flexShrink: 0,
        background: "var(--accent-primary)",
        backgroundImage:
          "radial-gradient(ellipse at 15% 60%, rgba(184,149,106,0.09) 0%, transparent 55%), " +
          "radial-gradient(ellipse at 85% 40%, rgba(184,149,106,0.05) 0%, transparent 50%)",
        borderBottom: "1px solid var(--border)",
        position: "relative",
        overflow: "hidden",
        minHeight: 88,
      }}
    >
      {error ? (
        <div style={{
          padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 6,
          minHeight: 88, justifyContent: "center",
        }}>
          <div style={{
            fontSize: 10, fontFamily: "var(--font-mono)",
            color: "var(--accent-muted)", letterSpacing: "0.08em",
            textTransform: "uppercase", fontWeight: 600,
          }}>
            Intelligence Unavailable
          </div>
          <div style={{ fontSize: 13, color: "var(--text-tertiary)", lineHeight: 1.6 }}>
            Cerebro will resume when the API connection is restored.
          </div>
        </div>
      ) : isLoading ? (
        <>
          <div style={{
            padding: "20px 24px",
            display: "flex", flexDirection: "column", gap: 3,
            minHeight: 88, justifyContent: "center",
          }}>
            {BOOT_LINES.slice(0, statusIdx + 1).map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 10,
                  fontFamily: "var(--font-mono)",
                  color: i === statusIdx ? "var(--accent-muted)" : "var(--text-tertiary)",
                  letterSpacing: "0.03em",
                  opacity: i === statusIdx ? 1 : 0.45,
                  animation: i === statusIdx ? "status-fade 0.2s ease both" : "none",
                }}
              >
                {line}
                {i === statusIdx && i < BOOT_LINES.length - 1 && (
                  <span style={{
                    marginLeft: 2,
                    animation: "blink 1.1s step-end infinite",
                    color: "var(--accent-secondary)",
                  }}>_</span>
                )}
                {i === statusIdx && i === BOOT_LINES.length - 1 && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, opacity: 0.6,
                    animation: "pulse-text 1.8s ease-in-out infinite",
                  }}>…</span>
                )}
              </div>
            ))}
          </div>
          {/* Scan bar */}
          <div style={{
            position: "absolute", bottom: 0, left: 0,
            width: "25%", height: 1,
            background: "var(--accent-secondary)", opacity: 0.35,
            animation: "band-scan 2.2s cubic-bezier(0.4,0,0.6,1) infinite",
          }} />
        </>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {signals.map((signal, i) => {
            const hovered = hoveredIdx === i;
            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIdx(i)}
                onMouseLeave={() => setHoveredIdx(null)}
                style={{
                  padding: "18px 24px",
                  borderRight: i < 2 ? "1px solid var(--border)" : "none",
                  animation: `signal-reveal 0.7s cubic-bezier(0.16,1,0.3,1) ${i * 140}ms both`,
                  position: "relative",
                  transition: "background 0.15s",
                  background: hovered ? "rgba(255,255,255,0.025)" : "transparent",
                }}
              >
                <div style={{
                  fontSize: 10, fontFamily: "var(--font-mono)",
                  color: "var(--accent-muted)", letterSpacing: "0.08em",
                  textTransform: "uppercase", fontWeight: 600, marginBottom: 8,
                }}>
                  {signal.label}
                </div>
                {signal.body && (
                  <div style={{
                    fontSize: 12.5, color: "var(--text-primary)",
                    lineHeight: 1.65, letterSpacing: "-0.01em",
                  }}>
                    {signal.body}
                  </div>
                )}
                {onDeliberate && signal.body && (
                  <button
                    onClick={() => onDeliberate(signal)}
                    style={{
                      position: "absolute", bottom: 10, right: 16,
                      background: "none", border: "none", padding: "2px 0",
                      cursor: "pointer", fontSize: 11, letterSpacing: "0.02em",
                      fontWeight: 500, color: "var(--accent-secondary)",
                      opacity: hovered ? 1 : 0,
                      transition: "opacity 0.2s",
                      pointerEvents: hovered ? "auto" : "none",
                    }}
                    aria-label={`Deliberate on: ${signal.label}`}
                  >
                    Deliberate →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes band-scan {
          0%   { transform: translateX(-100%); opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translateX(400%); opacity: 0; }
        }
        @keyframes signal-reveal {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes status-fade {
          0%   { opacity: 0; transform: translateY(3px); }
          100% { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

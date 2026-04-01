"use client";

import { useState, useEffect } from "react";

// ─── Pipeline stages ──────────────────────────────────────────────────────────

const EXTRACT_STAGES = [
  { id: "recv",   label: "RECEIVING",   detail: "File received by intake buffer" },
  { id: "parse",  label: "PARSING",     detail: "Detecting format and structure" },
  { id: "read",   label: "EXTRACTING",  detail: "Reading content layer by layer" },
  { id: "clean",  label: "CLEANING",    detail: "Normalising whitespace and encoding" },
];

const ANALYZE_STAGES = [
  { id: "map",    label: "MAPPING",     detail: "Identifying document type and structure" },
  { id: "entity", label: "ENTITIES",    detail: "Extracting companies, names, signals" },
  { id: "frame",  label: "FRAMING",     detail: "Detecting strategic context and tensions" },
  { id: "brief",  label: "SYNTHESISING",detail: "Compressing into engagement brief" },
  { id: "next",   label: "SEQUENCING",  detail: "Determining recommended next steps" },
];

// ─── Glitch characters for scan effect ───────────────────────────────────────
const GLITCH = "█▓▒░╔╗╚╝║═╠╣╦╩╬▲▼◆●○◇□■▪▫";
function randomGlitch(len: number) {
  return Array.from({ length: len }, () =>
    GLITCH[Math.floor(Math.random() * GLITCH.length)]
  ).join("");
}

// ─── Stage row ────────────────────────────────────────────────────────────────
function StageRow({
  stage,
  state, // "pending" | "active" | "done"
  delay,
}: {
  stage: { id: string; label: string; detail: string };
  state: "pending" | "active" | "done";
  delay: number;
}) {
  const [glitch, setGlitch] = useState("");
  const [tick, setTick]     = useState(0);

  useEffect(() => {
    if (state !== "active") return;
    const t = setInterval(() => {
      setGlitch(randomGlitch(8 + Math.floor(Math.random() * 6)));
      setTick((n) => n + 1);
    }, 80);
    return () => clearInterval(t);
  }, [state]);

  const isDone    = state === "done";
  const isActive  = state === "active";
  const isPending = state === "pending";

  return (
    <div
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "8px 0",
        opacity: isPending ? 0.25 : 1,
        transition: "opacity 0.3s",
        animation: isActive ? `stage-enter 0.25s ease both` : isDone ? "none" : "none",
      }}
    >
      {/* Status indicator */}
      <div style={{ width: 20, flexShrink: 0, display: "flex", justifyContent: "center" }}>
        {isDone ? (
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--live)", boxShadow: "0 0 6px var(--live)",
          }} />
        ) : isActive ? (
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: "var(--accent-secondary)",
            animation: "pulse-dot 0.8s ease-in-out infinite",
          }} />
        ) : (
          <div style={{
            width: 6, height: 6, borderRadius: "50%",
            border: "1px solid var(--border)",
          }} />
        )}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 9, fontWeight: 700,
        fontFamily: "var(--font-mono)",
        color: isDone ? "var(--live)" : isActive ? "var(--accent-secondary)" : "var(--text-tertiary)",
        width: 100, flexShrink: 0,
        transition: "color 0.2s",
      }}>
        {stage.label}
      </div>

      {/* Detail / glitch */}
      <div style={{
        fontSize: 11,
        color: isDone ? "var(--text-tertiary)" : isActive ? "var(--text-secondary)" : "transparent",
        flex: 1, overflow: "hidden",
        transition: "color 0.2s",
      }}>
        {isActive ? (
          <>
            {stage.detail}
            <span style={{
              marginLeft: 8, fontSize: 9, opacity: 0.5,
              fontFamily: "var(--font-mono)",
              color: "var(--accent-secondary)",
            }}>
              {glitch}
            </span>
          </>
        ) : isDone ? (
          stage.detail
        ) : "—"}
      </div>

      {/* Done badge */}
      {isDone && (
        <div style={{
          fontSize: 9, fontWeight: 700,
          fontFamily: "var(--font-mono)", color: "var(--live)",
          opacity: 0.7, flexShrink: 0,
        }}>
          OK
        </div>
      )}
    </div>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress }: { progress: number }) {
  return (
    <div style={{
      height: 2, background: "var(--border)",
      borderRadius: 1, overflow: "hidden", margin: "4px 0",
    }}>
      <div style={{
        height: "100%",
        width: `${progress}%`,
        background: "linear-gradient(to right, var(--accent-secondary), var(--live))",
        transition: "width 0.4s ease",
        boxShadow: "0 0 8px var(--accent-secondary)",
      }} />
    </div>
  );
}

// ─── Scan overlay ─────────────────────────────────────────────────────────────
function ScanOverlay() {
  return (
    <>
      <div style={{
        position: "absolute", left: 0, right: 0,
        height: 1, background: "var(--accent-secondary)", opacity: 0.2,
        animation: "scan-line 2s linear infinite",
        pointerEvents: "none",
      }} />
      <style>{`
        @keyframes scan-line {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.7); }
        }
        @keyframes stage-enter {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes pipeline-appear {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  );
}

// ─── Main IntakePipeline component ────────────────────────────────────────────

export function IntakePipeline({
  phase,
  label,
}: {
  phase: "extracting" | "analyzing";
  label: string;
}) {
  const [activeExtractIdx, setActiveExtractIdx] = useState(0);
  const [activeAnalyzeIdx, setActiveAnalyzeIdx] = useState(-1);
  const [extractDone, setExtractDone]           = useState(false);
  const [elapsed, setElapsed]                   = useState(0);

  const allStages     = [...EXTRACT_STAGES, ...ANALYZE_STAGES];
  const totalStages   = allStages.length;
  const doneCount     = phase === "extracting"
    ? activeExtractIdx
    : EXTRACT_STAGES.length + Math.max(0, activeAnalyzeIdx);
  const progress      = Math.round((doneCount / totalStages) * 100);

  // Advance extract stages
  useEffect(() => {
    if (phase !== "extracting") return;
    setActiveExtractIdx(0);
    setExtractDone(false);
    const t = setInterval(() => {
      setActiveExtractIdx((i) => {
        if (i >= EXTRACT_STAGES.length - 1) { setExtractDone(true); clearInterval(t); return i; }
        return i + 1;
      });
    }, 420);
    return () => clearInterval(t);
  }, [phase]);

  // When analysis phase starts, all extract stages are done
  useEffect(() => {
    if (phase !== "analyzing") return;
    setActiveExtractIdx(EXTRACT_STAGES.length - 1);
    setExtractDone(true);
    setActiveAnalyzeIdx(0);
    const t = setInterval(() => {
      setActiveAnalyzeIdx((i) => {
        if (i >= ANALYZE_STAGES.length - 1) { clearInterval(t); return i; }
        return i + 1;
      });
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      marginBottom: 40, borderRadius: "var(--radius-lg)",
      border: "1px solid var(--accent-secondary)",
      overflow: "hidden",
      animation: "pipeline-appear 0.3s ease both",
      position: "relative",
    }}>

      {/* Top bar — file info + mode */}
      <div style={{
        padding: "16px 24px",
        background: "var(--accent-primary)",
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div>
          <div style={{
            fontSize: 9, fontWeight: 700,
            textTransform: "uppercase", fontFamily: "var(--font-mono)",
            color: "var(--accent-secondary)", marginBottom: 4,
          }}>
            {phase === "extracting" ? "Atlas · Extraction Pipeline" : "Atlas · Analysis Engine"}
          </div>
          <div style={{
            fontSize: 14, fontWeight: 500, color: "var(--text-primary)",
            lineHeight: 1.3,
            maxWidth: 480, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {label}
          </div>
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-tertiary)", flexShrink: 0,
        }}>
          {String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: "0 24px", background: "var(--bg-surface)" }}>
        <ProgressBar progress={progress} />
      </div>

      {/* Pipeline stages */}
      <div style={{
        padding: "16px 24px 20px",
        background: "var(--bg-surface)",
        position: "relative", overflow: "hidden",
      }}>
        <ScanOverlay />

        {/* Extract section */}
        <div style={{
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)", marginBottom: 8, opacity: 0.6,
        }}>
          — File Extraction
        </div>
        {EXTRACT_STAGES.map((stage, i) => {
          const stageState = extractDone || i < activeExtractIdx
            ? "done"
            : i === activeExtractIdx && phase === "extracting"
            ? "active"
            : "pending";
          return <StageRow key={stage.id} stage={stage} state={stageState} delay={i * 50} />;
        })}

        {/* Divider */}
        <div style={{
          margin: "12px 0",
          height: 1, background: "var(--border)",
        }} />

        {/* Analyze section */}
        <div style={{
          fontSize: 9, fontWeight: 700,
          textTransform: "uppercase", fontFamily: "var(--font-mono)",
          color: phase === "analyzing" ? "var(--accent-secondary)" : "var(--text-tertiary)",
          marginBottom: 8, opacity: phase === "analyzing" ? 1 : 0.4,
          transition: "color 0.3s, opacity 0.3s",
        }}>
          — Doctrine Analysis
        </div>
        {ANALYZE_STAGES.map((stage, i) => {
          const stageState = phase === "analyzing" && i < activeAnalyzeIdx
            ? "done"
            : phase === "analyzing" && i === activeAnalyzeIdx
            ? "active"
            : "pending";
          return <StageRow key={stage.id} stage={stage} state={stageState} delay={i * 50} />;
        })}
      </div>

      {/* Footer status */}
      <div style={{
        padding: "10px 24px",
        background: "var(--accent-primary)",
        borderTop: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--accent-secondary)",
          animation: "pulse-dot 0.8s ease-in-out infinite",
          flexShrink: 0,
        }} />
        <div style={{
          fontSize: 11, fontFamily: "var(--font-mono)",
          color: "var(--text-tertiary)",
        }}>
          {phase === "extracting"
            ? `Extracting content · ${progress}% complete`
            : `Analyzing through Atlas doctrine · ${progress}% complete`
          }
        </div>
      </div>
    </div>
  );
}

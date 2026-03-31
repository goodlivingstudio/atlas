"use client";

import type { AtlasMode } from "@/lib/types";

interface ModeSelectorProps {
  mode: AtlasMode;
  onChange: (mode: AtlasMode) => void;
}

const MODES: Record<AtlasMode, { label: string; description: string }> = {
  DIAGNOSIS: {
    label: "Diagnosis",
    description: "Read the situation without agenda. Surface evidence, map forces, name unknowns.",
  },
  PRESCRIPTION: {
    label: "Prescription",
    description: "Build the argument. Sharpen a position, find supporting evidence, stress-test it.",
  },
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 8,
        marginBottom: 48,
      }}
    >
      {(Object.entries(MODES) as [AtlasMode, typeof MODES.DIAGNOSIS][]).map(
        ([key, meta]) => {
          const active = mode === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              style={{
                padding: "18px 20px",
                background: active ? "var(--accent-primary)" : "var(--bg-surface)",
                border: `1px solid ${active ? "var(--accent-secondary)" : "var(--border)"}`,
                borderRadius: 4,
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.15s, background 0.15s",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: active ? "var(--accent-secondary)" : "var(--text-tertiary)",
                    transition: "background 0.15s",
                  }}
                />
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: active ? "var(--accent-secondary)" : "var(--text-tertiary)",
                    transition: "color 0.15s",
                  }}
                >
                  {meta.label}
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: active ? "var(--text-secondary)" : "var(--text-tertiary)",
                  lineHeight: 1.55,
                  margin: 0,
                  transition: "color 0.15s",
                }}
              >
                {meta.description}
              </p>
            </button>
          );
        }
      )}
    </div>
  );
}

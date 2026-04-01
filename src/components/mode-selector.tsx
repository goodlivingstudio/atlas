"use client";

import { Microscope, Crosshair, FileText } from "lucide-react";
import type { AtlasMode } from "@/lib/types";

interface ModeSelectorProps {
  mode: AtlasMode;
  onChange: (mode: AtlasMode) => void;
}

const MODES: Record<AtlasMode, { label: string; description: string; icon: typeof Microscope }> = {
  DIAGNOSIS: {
    label: "Diagnosis",
    description: "Read the situation without agenda. Surface evidence, map forces, name unknowns.",
    icon: Microscope,
  },
  PRESCRIPTION: {
    label: "Prescription",
    description: "Build the argument. Sharpen a position, find supporting evidence, stress-test it.",
    icon: Crosshair,
  },
  GENERATE: {
    label: "Generate",
    description: "Produce a structured deliverable — brief, memo, narrative, or analysis document.",
    icon: FileText,
  },
};

export function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Operating mode"
      style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        gap: 8, marginBottom: 48,
      }}
    >
      {(Object.entries(MODES) as [AtlasMode, typeof MODES.DIAGNOSIS][]).map(([key, meta]) => {
        const active = mode === key;
        const Icon = meta.icon;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            style={{
              padding: "22px 22px", minHeight: 108, textAlign: "left", cursor: "pointer",
              background: active ? "var(--accent-primary)" : "var(--bg-surface)",
              border: `1px solid ${active ? "var(--accent-secondary)" : "var(--border)"}`,
              borderRadius: "var(--radius-lg)",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Icon
                size={14}
                aria-hidden="true"
                style={{
                  color: active ? "var(--accent-secondary)" : "var(--text-tertiary)",
                  transition: "color 0.15s", flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: 11, fontWeight: 600,
                textTransform: "uppercase",
                color: active ? "var(--accent-secondary)" : "var(--text-tertiary)",
                transition: "color 0.15s",
              }}>
                {meta.label}
              </span>
            </div>
            <p style={{
              fontSize: 12, margin: 0, lineHeight: 1.55,
              color: active ? "var(--text-secondary)" : "var(--text-tertiary)",
              transition: "color 0.15s",
            }}>
              {meta.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}

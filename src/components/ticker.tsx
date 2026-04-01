"use client";

import { useState, useEffect } from "react";
import { SunMedium, MoonStar } from "lucide-react";
import type { Skin } from "@/lib/types";
import type { TickerItem } from "@/app/api/ticker/route";

// ─── Fixed dot colours (skin identity, not theme-relative) ───────────────────
const SKIN_DOT: Record<Skin, string> = {
  mineral: "#B8956A",
  slate:   "#4A7A9B",
  forest:  "#5C8A6E",
};
const SKIN_LABEL: Record<Skin, string> = {
  mineral: "Mineral",
  slate:   "Slate",
  forest:  "Forest",
};

// ─── Category colours — dark mode ────────────────────────────────────────────
const CAT_DARK: Record<string, { bg: string; color: string }> = {
  STRATEGY: { bg: "rgba(184,149,106,0.14)", color: "#C8A87A" },
  BRAND:    { bg: "rgba(100,170,255,0.10)", color: "#8FBBE8" },
  AI:       { bg: "rgba(100,160,60,0.14)",  color: "#9BC472" },
  MARKET:   { bg: "rgba(190,130,255,0.10)", color: "#CDA0FF" },
  THINKING: { bg: "rgba(180,170,160,0.10)", color: "#B5ADA5" },
  SIGNAL:   { bg: "rgba(74,222,128,0.12)",  color: "#4ade80" },
};

// ─── Category colours — day mode ─────────────────────────────────────────────
const CAT_DAY: Record<string, { bg: string; color: string }> = {
  STRATEGY: { bg: "rgba(122,82,40,0.10)",   color: "#7A5228" },
  BRAND:    { bg: "rgba(30,74,99,0.09)",    color: "#1E4A63" },
  AI:       { bg: "rgba(34,90,12,0.08)",    color: "#2B5A10" },
  MARKET:   { bg: "rgba(110,40,180,0.07)",  color: "#5C2A96" },
  THINKING: { bg: "rgba(70,60,50,0.07)",    color: "#4A4038" },
  SIGNAL:   { bg: "rgba(22,101,52,0.10)",   color: "#166534" },
};

export function Ticker({
  isDay = false,
  onToggle,
  skin = "mineral",
  onSkinChange,
}: {
  isDay?: boolean;
  onToggle?: () => void;
  skin?: Skin;
  onSkinChange?: (s: Skin) => void;
}) {
  const [paused, setPaused]   = useState(false);
  const [items, setItems]     = useState<TickerItem[]>([]);
  const [loaded, setLoaded]   = useState(false);

  const catStyle = isDay ? CAT_DAY : CAT_DARK;

  useEffect(() => {
    fetch("/api/ticker")
      .then((r) => r.json())
      .then((data: TickerItem[]) => {
        setItems(data);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  // Don't render until items are loaded to avoid layout shift
  if (!loaded || items.length === 0) {
    return (
      <div style={{
        height: 42,
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: 0,
      }}>
        {/* Still show controls while loading */}
        <SkinAndToggle
          skin={skin}
          isDay={isDay}
          onSkinChange={onSkinChange}
          onToggle={onToggle}
          catStyle={catStyle}
        />
      </div>
    );
  }

  // Duration scales with item count so speed stays consistent
  const duration = Math.max(60, Math.round(items.length * 3.2));

  return (
    <div
      style={{
        flexShrink: 0,
        height: 42,
        display: "flex",
        alignItems: "center",
        background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* Scrolling track */}
      <div
        style={{ flex: 1, overflow: "hidden", position: "relative", cursor: "default" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        {/* Fade edges */}
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: 40, zIndex: 1,
          background: "linear-gradient(to right, var(--bg-surface), transparent)",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute", right: 0, top: 0, bottom: 0, width: 40, zIndex: 1,
          background: "linear-gradient(to left, var(--bg-surface), transparent)",
          pointerEvents: "none",
        }} />

        {/* Scrolling content — duplicated for seamless loop */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            willChange: "transform",
            animationName: "ticker-scroll",
            animationDuration: `${duration}s`,
            animationTimingFunction: "linear",
            animationIterationCount: "infinite",
            animationPlayState: paused ? "paused" : "running",
          }}
        >
          {[...items, ...items].map((item, i) => {
            const style = catStyle[item.cat] || catStyle.STRATEGY;
            const content = (
              <>
                <span style={{
                  fontSize: 10,
                  
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 3,
                  background: style.bg,
                  color: style.color,
                  userSelect: "none",
                  flexShrink: 0,
                }}>
                  {item.cat}
                </span>
                <span
                  className="ticker-text"
                  style={{ fontSize: 12 }}
                >
                  {item.text}
                </span>
                {item.source === "dynamic" && (
                  <span style={{
                    fontSize: 10, color: style.color, opacity: 0.6,
                    textTransform: "uppercase",
                    fontFamily: "var(--font-mono)",
                  }}>
                    ↗
                  </span>
                )}
              </>
            );

            const sharedStyle: React.CSSProperties = {
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
              marginRight: 40,
              textDecoration: "none",
            };

            return item.url ? (
              <a
                key={i}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ticker-item"
                style={sharedStyle}
              >
                {content}
              </a>
            ) : (
              <span key={i} className="ticker-item" style={sharedStyle}>
                {content}
              </span>
            );
          })}
        </div>
      </div>

      <SkinAndToggle
        skin={skin}
        isDay={isDay}
        onSkinChange={onSkinChange}
        onToggle={onToggle}
        catStyle={catStyle}
      />

      <style>{`
        .ticker-text { color: var(--text-tertiary); transition: color 0.15s; }
        .ticker-item:hover .ticker-text { color: var(--text-primary); }
      `}</style>
    </div>
  );
}

// ─── Skin + day/night controls ────────────────────────────────────────────────
function SkinAndToggle({
  skin,
  isDay,
  onSkinChange,
  onToggle,
}: {
  skin: Skin;
  isDay: boolean;
  onSkinChange?: (s: Skin) => void;
  onToggle?: () => void;
  catStyle: Record<string, { bg: string; color: string }>;
}) {
  return (
    <>
      {onSkinChange && (
        <div style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 10px",
          borderLeft: "1px solid var(--border)",
          height: 42,
        }}>
          {(["mineral", "slate", "forest"] as Skin[]).map((s) => (
            <button
              key={s}
              onClick={() => onSkinChange(s)}
              aria-label={`${SKIN_LABEL[s]} skin${skin === s ? " (active)" : ""}`}
              aria-pressed={skin === s}
              style={{
                width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "transparent", border: "none",
                cursor: "pointer", padding: 0, flexShrink: 0,
                borderRadius: 6, transition: "background 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-elevated)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{
                display: "block",
                width:  skin === s ? 8 : 5,
                height: skin === s ? 8 : 5,
                borderRadius: "50%",
                background: SKIN_DOT[s],
                opacity: skin === s ? 1 : 0.35,
                outline: skin === s ? `1.5px solid ${SKIN_DOT[s]}` : "none",
                outlineOffset: 2,
                transition: "all 0.2s",
                flexShrink: 0,
              }} />
            </button>
          ))}
        </div>
      )}

      {onToggle && (
        <button
          onClick={onToggle}
          aria-label={isDay ? "Switch to night mode" : "Switch to day mode"}
          aria-pressed={isDay}
          style={{
            flexShrink: 0,
            width: 42, height: 42,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", border: "none",
            borderLeft: "1px solid var(--border)",
            cursor: "pointer",
            color: "var(--text-tertiary)",
            transition: "all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--text-secondary)";
            e.currentTarget.style.background = "var(--bg-elevated)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--text-tertiary)";
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isDay
            ? <MoonStar size={16} strokeWidth={1.5} aria-hidden="true" />
            : <SunMedium size={16} strokeWidth={1.5} aria-hidden="true" />
          }
        </button>
      )}
    </>
  );
}

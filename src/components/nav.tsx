"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/loading-dock", label: "Loading Dock" },
  { href: "/",             label: "Operating Room" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 24px",
      height: 44,
      background: "var(--bg-primary)",
      borderBottom: "1px solid var(--border)",
    }}>
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--live)",
          boxShadow: "0 0 6px var(--live)",
        }} />
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--text-primary)",
        }}>
          Atlas
        </span>
      </div>

      {/* Nav links */}
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: "5px 12px",
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                letterSpacing: "0.04em",
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                textDecoration: "none",
                borderRadius: 3,
                background: active ? "var(--bg-elevated)" : "transparent",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Status dot */}
      <div style={{
        fontSize: 10,
        color: "var(--text-tertiary)",
        letterSpacing: "0.06em",
        fontFamily: "var(--font-mono)",
      }}>
        v0.1
      </div>
    </nav>
  );
}

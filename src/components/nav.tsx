"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, FlaskConical } from "lucide-react";

const NAV_ITEMS = [
  { href: "/loading-dock", label: "Loading Dock", icon: Layers },
  { href: "/",             label: "Operating Room", icon: FlaskConical },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main navigation"
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52,
        background: "var(--bg-primary)", borderBottom: "1px solid var(--border)",
      }}
    >
      {/* Wordmark */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div aria-hidden="true" style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--live)", boxShadow: "0 0 6px var(--live)",
        }} />
        <span style={{
          fontSize: 11, fontWeight: 600, letterSpacing: "0.08em",
          textTransform: "uppercase", color: "var(--text-primary)",
        }}>
          Atlas
        </span>
      </div>

      {/* Nav links */}
      <div role="list" style={{ display: "flex", alignItems: "center", gap: 2 }}>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              role="listitem"
              aria-current={active ? "page" : undefined}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "6px 14px", height: 36,
                fontSize: 11, fontWeight: active ? 600 : 400,
                letterSpacing: "0.04em",
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                textDecoration: "none", borderRadius: 6,
                background: active ? "var(--bg-elevated)" : "transparent",
                transition: "color 0.15s, background 0.15s",
              }}
            >
              <Icon size={11} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Version */}
      <div style={{
        fontSize: 10, color: "var(--text-tertiary)",
        letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
      }}>
        v0.1
      </div>
    </nav>
  );
}

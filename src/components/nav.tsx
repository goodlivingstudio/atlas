"use client";

import { useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/",             label: "Home" },
  { href: "/loading-dock", label: "Loading Dock" },
  { href: "/engagements",  label: "Engagements" },
  { href: "/knowledge",    label: "Knowledge" },
  { href: "/ask",          label: "Ask Atlas" },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const links = listRef.current?.querySelectorAll<HTMLAnchorElement>("a");
    if (!links?.length) return;
    const focused = document.activeElement as HTMLElement;
    const idx = Array.from(links).indexOf(focused as HTMLAnchorElement);
    const cur = idx >= 0 ? idx : NAV_ITEMS.findIndex((n) => n.href === pathname);
    const next = e.key === "ArrowRight"
      ? (cur + 1) % links.length
      : (cur - 1 + links.length) % links.length;
    links[next].focus();
    router.push(NAV_ITEMS[next].href);
  }, [pathname, router]);

  return (
    <nav
      aria-label="Main navigation"
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexShrink: 0,
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
          fontSize: 11, fontWeight: 600,
          textTransform: "uppercase", color: "var(--text-primary)",
        }}>
          Atlas
        </span>
      </div>

      {/* Nav links */}
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={handleKeyDown}
        style={{ display: "flex", alignItems: "center", gap: 2 }}
      >
        {NAV_ITEMS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              role="tab"
              tabIndex={active ? 0 : -1}
              aria-selected={active}
              style={{
                display: "flex", alignItems: "center",
                padding: "6px 14px", height: 36,
                fontSize: 12, fontWeight: active ? 600 : 400,
                
                color: active ? "var(--text-primary)" : "var(--text-tertiary)",
                textDecoration: "none", borderRadius: 6,
                background: active ? "var(--bg-elevated)" : "transparent",
                transition: "color 0.15s, background 0.15s",
                outline: "none",
              }}
            >
              {label}
            </Link>
          );
        })}
      </div>

      {/* Version */}
      <div style={{
        fontSize: 10, color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)",
      }}>
        v0.1
      </div>
    </nav>
  );
}

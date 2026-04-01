"use client";

import { Nav } from "@/components/nav";
import { Ticker } from "@/components/ticker";
import { useTheme } from "@/lib/use-theme";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { skin, isDay, toggleMode, setSkin } = useTheme();

  return (
    <div style={{
      display: "flex", flexDirection: "column",
      height: "100vh", overflow: "hidden",
    }}>
      <Nav />
      <Ticker
        isDay={isDay}
        skin={skin}
        onToggle={toggleMode}
        onSkinChange={setSkin}
      />
      <div style={{ flex: 1, overflowY: "auto" }}>
        {children}
      </div>
    </div>
  );
}

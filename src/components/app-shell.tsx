"use client";

import { Nav } from "@/components/nav";
import { Ticker } from "@/components/ticker";
import { useTheme } from "@/lib/use-theme";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { skin, isDay, toggleMode, setSkin } = useTheme();

  return (
    <>
      <Nav />
      <Ticker
        isDay={isDay}
        skin={skin}
        onToggle={toggleMode}
        onSkinChange={setSkin}
      />
      {children}
    </>
  );
}

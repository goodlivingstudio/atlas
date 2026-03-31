"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Skin } from "./types";

function applyThemeClasses(skin: Skin, day: boolean) {
  const el = document.documentElement;
  el.classList.remove("day", "skin-slate", "skin-forest");
  if (day) el.classList.add("day");
  if (skin === "slate")  el.classList.add("skin-slate");
  if (skin === "forest") el.classList.add("skin-forest");
}

export function useTheme() {
  const [skin, setSkinState] = useState<Skin>("mineral");
  const [isDay, setIsDay]    = useState(false);
  const skinRef              = useRef<Skin>("mineral");

  useEffect(() => {
    const storedSkin = (localStorage.getItem("atlas-skin") as Skin) || "mineral";
    const storedMode = localStorage.getItem("atlas-theme");
    const h   = new Date().getHours();
    const day = storedMode === "day" ? true : storedMode === "night" ? false : h >= 6 && h < 20;
    skinRef.current = storedSkin;
    setSkinState(storedSkin);
    setIsDay(day);
    applyThemeClasses(storedSkin, day);
  }, []);

  const toggleMode = useCallback(() => {
    setIsDay((prev) => {
      const next = !prev;
      applyThemeClasses(skinRef.current, next);
      localStorage.setItem("atlas-theme", next ? "day" : "night");
      return next;
    });
  }, []);

  const setSkin = useCallback((newSkin: Skin) => {
    skinRef.current = newSkin;
    setSkinState(newSkin);
    localStorage.setItem("atlas-skin", newSkin);
    setIsDay((prev) => { applyThemeClasses(newSkin, prev); return prev; });
  }, []);

  return { skin, isDay, toggleMode, setSkin };
}

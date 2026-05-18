"use client";

import { useEffect, useState } from "react";

export type EditorTheme = "vs-light" | "vs-dark" | "github-dark" | "dracula";

export const EDITOR_THEME_LABELS: Record<EditorTheme, string> = {
  "vs-light": "Light",
  "vs-dark": "Dark",
  "github-dark": "GitHub",
  dracula: "Dracula",
};

export const MONACO_THEME_ID: Record<EditorTheme, string> = {
  "vs-light": "vs",
  "vs-dark": "vs-dark",
  "github-dark": "reinfo-github-dark",
  dracula: "reinfo-dracula",
};

export const FONT_SIZES = [12, 13, 14, 16, 18] as const;
export const TAB_SIZES = [2, 4] as const;

function readPref<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

export interface EditorPrefs {
  mounted: boolean;
  language: string;
  editorTheme: EditorTheme;
  fontSize: number;
  tabSize: number;
  activeMonacoTheme: string;
  setLanguage: (lang: string) => void;
  setEditorTheme: (theme: EditorTheme) => void;
  setFontSize: (size: number) => void;
  setTabSize: (size: number) => void;
}

export function useEditorPrefs(defaultLanguage = "cpp"): EditorPrefs {
  const [mounted, setMounted] = useState(false);
  const [language, setLanguageState] = useState(defaultLanguage);
  const [editorTheme, setEditorThemeState] = useState<EditorTheme>("vs-dark");
  const [fontSize, setFontSizeState] = useState(13);
  const [tabSize, setTabSizeState] = useState(2);

  useEffect(() => {
    setLanguageState(readPref<string>("editor-language", defaultLanguage));
    setEditorThemeState(readPref<EditorTheme>("editor-theme", "vs-dark"));
    setFontSizeState(readPref<number>("editor-font-size", 13));
    setTabSizeState(readPref<number>("editor-tab-size", 2));
    setMounted(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    writePref("editor-language", lang);
  };

  const setEditorTheme = (theme: EditorTheme) => {
    setEditorThemeState(theme);
    writePref("editor-theme", theme);
  };

  const setFontSize = (size: number) => {
    setFontSizeState(size);
    writePref("editor-font-size", size);
  };

  const setTabSize = (size: number) => {
    setTabSizeState(size);
    writePref("editor-tab-size", size);
  };

  const activeMonacoTheme = mounted ? MONACO_THEME_ID[editorTheme] : "vs";

  return {
    mounted,
    language,
    editorTheme,
    fontSize,
    tabSize,
    activeMonacoTheme,
    setLanguage,
    setEditorTheme,
    setFontSize,
    setTabSize,
  };
}

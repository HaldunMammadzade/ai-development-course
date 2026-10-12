"use client";

import { useEffect, useMemo } from "react";
import Editor, { loader, type BeforeMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { EDITOR_OPTIONS, QUIET_EDITOR_OPTIONS } from "@/components/exercises/editor-options";
import { monacoLanguage } from "@/components/exercises/editor-language";
import { copy } from "@/lib/copy";

loader.config({ monaco });

const quietModes = {
  completionItems: false,
  hovers: false,
  documentSymbols: false,
  documentHighlights: false,
  rename: false,
  colors: false,
  foldingRanges: true,
  selectionRanges: false,
  diagnostics: false,
  documentFormattingEdits: false,
  documentRangeFormattingEdits: false,
} as const;

function color(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

export function applyPlatformTheme(instance: typeof monaco): void {
  if (typeof document === "undefined") return;
  const dark = document.documentElement.classList.contains("dark");
  instance.editor.defineTheme("platform", {
    base: dark ? "vs-dark" : "vs",
    inherit: true,
    rules: [],
    colors: {
      "editor.background": color("--color-bg-code", dark ? "#171714" : "#f0efea"),
      "editor.foreground": color("--color-text-primary", dark ? "#f3f1ea" : "#20201d"),
      "editorLineNumber.foreground": color("--color-text-muted", "#a39e92"),
      "editorLineNumber.activeForeground": color("--color-text-primary", "#f3f1ea"),
      "editor.selectionBackground": color("--color-bg-selected", "#262833"),
      "editor.lineHighlightBackground": color("--color-bg-surface", "#1d1d19"),
      "editorCursor.foreground": color("--color-accent-primary", "#aab1ff"),
      "editorWidget.background": color("--color-bg-elevated", "#24241f"),
      "editorWidget.border": color("--color-border-default", "#3a3a32"),
    },
  });
}

function prepareMonaco(instance: typeof monaco): void {
  applyPlatformTheme(instance);
  instance.html.htmlDefaults.setModeConfiguration({
    ...quietModes,
    links: false,
  });
  instance.css.cssDefaults.setModeConfiguration({
    ...quietModes,
    definitions: false,
    references: false,
  });
  instance.css.cssDefaults.setDiagnosticsOptions({ validate: false });
  instance.typescript.javascriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: true,
    noSyntaxValidation: true,
    noSuggestionDiagnostics: true,
  });
}

prepareMonaco(monaco);

const beforeMount: BeforeMount = (instance) => {
  prepareMonaco(instance);
};

export function MonacoPane({
  language,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}: {
  language: string | null;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const options = useMemo(
    () => ({
      ...EDITOR_OPTIONS,
      readOnly: readOnly || disabled,
      cursorBlinking: reducedMotion ? ("solid" as const) : ("blink" as const),
    }),
    [disabled, readOnly, reducedMotion],
  );

  useEffect(() => {
    const apply = () => {
      applyPlatformTheme(monaco);
      monaco.editor.setTheme("platform");
    };
    window.addEventListener("lindel-theme", apply);
    return () => window.removeEventListener("lindel-theme", apply);
  }, []);

  return (
    <Editor
      height="100%"
      language={monacoLanguage(language)}
      theme="platform"
      value={value}
      loading={<span className="sr-only">{copy.exercise.loadingEditor}</span>}
      options={options}
      beforeMount={beforeMount}
      onMount={(codeEditor) => codeEditor.updateOptions(QUIET_EDITOR_OPTIONS)}
      onChange={(next) => onChange(next ?? "")}
    />
  );
}

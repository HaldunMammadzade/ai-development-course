import type { editor } from "monaco-editor";
import { copy } from "@/lib/copy";

export const EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  wordWrap: "on",
  fontSize: 14,
  lineHeight: 22,
  fontFamily: "var(--font-ibm-plex-mono), ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  padding: { top: 12, bottom: 12 },
  renderLineHighlight: "line",
  overviewRulerLanes: 0,
  hideCursorInOverviewRuler: true,
  scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
  contextmenu: true,
  quickSuggestions: false,
  suggestOnTriggerCharacters: false,
  parameterHints: { enabled: false },
  folding: true,
  renderValidationDecorations: "off",
  ariaLabel: copy.exercise.editorLabel,
};

export const QUIET_EDITOR_OPTIONS = {
  links: false,
  hover: { enabled: false },
} as unknown as editor.IEditorOptions;

"use client";

import { useEffect, useState, type ComponentType } from "react";
import { copy } from "@/lib/copy";

interface PaneProps {
  language: string | null;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export interface CodingEditorProps {
  language: string | null;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  disabled?: boolean;
}

export function CodingEditor({
  language,
  value,
  onChange,
  readOnly = false,
  disabled = false,
}: CodingEditorProps) {
  const [Pane, setPane] = useState<ComponentType<PaneProps> | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    void import("./monaco-pane")
      .then((mod) => {
        if (active) {
          setPane(() => mod.MonacoPane);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      className="h-[min(52dvh,28rem)] min-h-[320px] w-full min-w-0 overflow-hidden bg-card"
      data-coding-editor={Pane === null ? "pending" : "monaco"}
      aria-busy={Pane === null}
    >
      {failed ? (
        <p role="alert" className="p-4 text-sm text-destructive">
          {copy.exercise.editorFailed}
        </p>
      ) : null}
      {Pane === null && !failed ? (
        <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-3 font-mono text-sm leading-6">
          {value}
        </pre>
      ) : null}
      {Pane !== null ? (
        <Pane
          language={language}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

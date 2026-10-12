"use client";

import type { KeyboardEvent } from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { composerIssue, STUDENT_MESSAGE_MAX } from "@/lib/teaching/presentation";

export function TeacherComposer({
  disabled,
  pending,
  onSubmit,
}: {
  disabled: boolean;
  pending: boolean;
  onSubmit: (message: string) => Promise<boolean>;
}) {
  const [value, setValue] = useState("");
  const issue = composerIssue(value);
  const blocked = disabled || pending || issue !== null;
  const count = value.trim().length;

  async function submit() {
    if (composerIssue(value) !== null || disabled || pending) {
      return;
    }
    const accepted = await onSubmit(value.trim());
    if (accepted) {
      setValue("");
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  }

  return (
    <div className="border-t border-border bg-card px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <label className="sr-only" htmlFor="teacher-answer">
        {copy.teacher.placeholder}
      </label>
      <textarea
        id="teacher-answer"
        value={value}
        maxLength={STUDENT_MESSAGE_MAX}
        disabled={disabled || pending}
        placeholder={copy.teacher.placeholder}
        rows={3}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={onKeyDown}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-base leading-7 outline-none transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60"
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs leading-5 text-muted-foreground">
          {copy.teacher.composerHint}
          {count > 1600 ? ` ${count}/${STUDENT_MESSAGE_MAX}` : ""}
        </p>
        <Button disabled={blocked} onClick={submit}>
          {pending ? copy.auth.working : copy.teacher.send}
        </Button>
      </div>
    </div>
  );
}

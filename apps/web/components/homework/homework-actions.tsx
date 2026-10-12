"use client";

import type { TeachingHomeworkView } from "@platform/types";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import { formatWhen } from "@/lib/format";

export function HomeworkActions({
  item,
  timeZone,
  nowIso,
  confirming,
  pending,
  onAsk,
  onCancel,
  onConfirm,
}: {
  item: TeachingHomeworkView;
  timeZone: string;
  nowIso: string;
  confirming: boolean;
  pending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const overdue = new Date(item.dueAt).getTime() < new Date(nowIso).getTime();
  return (
    <div className="mt-4 grid gap-3">
      <p className="text-sm text-muted-foreground">
        {copy.homework.due}: {formatWhen(item.dueAt, timeZone)}
        {overdue ? ` · ${copy.homework.overdue}` : ""}
      </p>
      {confirming ? (
        <div className="grid gap-3">
          <p className="text-sm">{copy.homework.confirm}</p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={pending} onClick={onConfirm}>
              {pending ? copy.homework.completing : copy.homework.confirmYes}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={onCancel}>
              {copy.homework.confirmNo}
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={onAsk}>{copy.homework.complete}</Button>
      )}
    </div>
  );
}

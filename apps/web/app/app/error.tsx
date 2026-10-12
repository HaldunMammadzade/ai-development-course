"use client";

import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export default function StudentError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto grid max-w-lg gap-4 py-16" role="alert">
      <h1 className="font-serif text-3xl">{copy.errors.generic}</h1>
      <Button onClick={reset}>{copy.retry}</Button>
    </div>
  );
}

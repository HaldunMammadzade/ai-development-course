"use client";

import { copy } from "@/lib/copy";

export default function AdminError() {
  return <p className="text-sm text-destructive">{copy.admin.failed}</p>;
}

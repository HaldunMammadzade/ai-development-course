import { copy } from "@/lib/copy";

export default function AdminLoading() {
  return <p className="text-sm text-muted-foreground">{copy.admin.loading}</p>;
}

import { copy } from "@/lib/copy";

export function greeting(timeZone: string, now = new Date()): string {
  let hour = 0;
  try {
    hour = Number(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hourCycle: "h23",
        timeZone,
      }).format(now),
    );
  } catch {
    hour = now.getUTCHours();
  }
  if (!Number.isFinite(hour)) {
    hour = 0;
  }
  if (hour < 12) {
    return copy.greeting.morning;
  }
  if (hour < 18) {
    return copy.greeting.afternoon;
  }
  return copy.greeting.evening;
}

export function formatWhen(iso: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  try {
    return new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium", timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("az-AZ", { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
}

export function displayName(name: string | null): string {
  const trimmed = name?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : "tələbə";
}

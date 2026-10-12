export const MASTERY_WINDOW = 20;

export const MASTERY_DECAY_DAYS = 21;

export const UNLOCK_MASTERY = 60;

export const WEAK_MASTERY_BELOW = 45;

export const MAX_SKILL_UPDATES = 3;

export const TEACHING_SESSION_IDLE_MS = 12 * 60 * 60 * 1000;

export const HOMEWORK_DUE_MS = 24 * 60 * 60 * 1000;

export function studentCalendarDay(instant: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (year === undefined || month === undefined || day === undefined) {
    throw new Error(`Unable to resolve a calendar day in ${timeZone}.`);
  }
  return `${year}-${month}-${day}`;
}

export function studentDayAge(eventAt: Date, now: Date, timeZone: string): number {
  const start = Date.parse(`${studentCalendarDay(eventAt, timeZone)}T00:00:00.000Z`);
  const end = Date.parse(`${studentCalendarDay(now, timeZone)}T00:00:00.000Z`);
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function isDueOnOrBeforeStudentToday(dueAt: Date, now: Date, timeZone: string): boolean {
  return studentCalendarDay(dueAt, timeZone) <= studentCalendarDay(now, timeZone);
}

export function studentDayInterval(instant: Date, timeZone: string): { start: Date; end: Date } {
  const day = studentCalendarDay(instant, timeZone);
  const start = zonedStartOfDay(day, timeZone);
  const end = zonedStartOfDay(addCalendarDay(day), timeZone);
  return { start, end };
}

function addCalendarDay(day: string): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1));
  return next.toISOString().slice(0, 10);
}

function zonedStartOfDay(day: string, timeZone: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, 0, 0, 0);
  let guess = utcMidnight;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const next = utcMidnight - timeZoneOffsetMs(new Date(guess), timeZone);
    if (next === guess) {
      return new Date(next);
    }
    guess = next;
  }
  return new Date(guess);
}

function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? "0";
    return Number(value === "24" ? "0" : value);
  };
  const asUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    read("hour"),
    read("minute"),
    read("second"),
  );
  return asUtc - instant.getTime();
}

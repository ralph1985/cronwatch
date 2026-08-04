export interface ReportWindow {
  start: Date;
  end: Date;
  timezone: string;
}

function partsFor(date: Date, timezone: string): Record<string, number> {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function zonedDate(year: number, month: number, day: number, hour: number, timezone: string): Date {
  const candidate = Date.UTC(year, month - 1, day, hour);
  const local = partsFor(new Date(candidate), timezone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return new Date(candidate - (localAsUtc - candidate));
}

export function reportWindow(now: Date, timezone: string, hour = 8): ReportWindow {
  const local = partsFor(now, timezone);
  const endDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  endDate.setUTCDate(endDate.getUTCDate() + (local.hour >= hour ? 0 : -1));
  const startDate = new Date(endDate);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  return {
    start: zonedDate(startDate.getUTCFullYear(), startDate.getUTCMonth() + 1, startDate.getUTCDate(), hour, timezone),
    end: zonedDate(endDate.getUTCFullYear(), endDate.getUTCMonth() + 1, endDate.getUTCDate(), hour, timezone),
    timezone
  };
}

export function inWindow(date: Date, window: ReportWindow): boolean {
  return date >= window.start && date < window.end;
}

export function formatWindow(window: ReportWindow): string {
  const formatter = new Intl.DateTimeFormat("sv-SE", { timeZone: window.timezone, dateStyle: "short", timeStyle: "short" });
  return `${formatter.format(window.start)} → ${formatter.format(window.end)}`;
}

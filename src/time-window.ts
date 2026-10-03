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

function zonedDate(year: number, month: number, day: number, hour: number, timezone: string, minute = 0): Date {
  const candidate = Date.UTC(year, month - 1, day, hour, minute);
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

export function formatDateTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("es-ES", { timeZone: timezone, dateStyle: "short", timeStyle: "short" }).format(date);
}

export type WeeklySchedule = {
  kind: "weekly";
  daysOfWeek: readonly number[];
  hour: number;
  minute: number;
};

export type MonthlySchedule = {
  kind: "monthly";
  dayOfMonth: number;
  hour: number;
  minute: number;
};

export type DayOfMonthStepSchedule = {
  kind: "day-of-month-step";
  startDay: number;
  dayStep: number;
  hour: number;
  minute: number;
};

export type Schedule = WeeklySchedule | MonthlySchedule | DayOfMonthStepSchedule;

function candidateAt(day: Date, schedule: Schedule, timezone: string): Date {
  return zonedDate(
    day.getUTCFullYear(),
    day.getUTCMonth() + 1,
    day.getUTCDate(),
    schedule.hour,
    timezone,
    schedule.minute,
  );
}

export function nextScheduledRun(after: Date, schedule: Schedule, timezone: string): Date {
  const local = partsFor(after, timezone);
  const firstDay = new Date(Date.UTC(local.year, local.month - 1, local.day));

  if (schedule.kind === "weekly") {
    for (let offset = 0; offset <= 7; offset += 1) {
      const day = new Date(firstDay);
      day.setUTCDate(day.getUTCDate() + offset);
      if (!schedule.daysOfWeek.includes(day.getUTCDay())) continue;
      const candidate = candidateAt(day, schedule, timezone);
      if (candidate > after) return candidate;
    }
  } else if (schedule.kind === "monthly") {
    for (let offset = 0; offset <= 24; offset += 1) {
      const month = new Date(Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth() + offset, 1));
      const daysInMonth = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
      if (schedule.dayOfMonth > daysInMonth) continue;
      const day = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), schedule.dayOfMonth));
      const candidate = candidateAt(day, schedule, timezone);
      if (candidate > after) return candidate;
    }
  } else {
    for (let offset = 0; offset <= 62; offset += 1) {
      const day = new Date(firstDay);
      day.setUTCDate(day.getUTCDate() + offset);
      const dayOfMonth = day.getUTCDate();
      if (dayOfMonth < schedule.startDay || (dayOfMonth - schedule.startDay) % schedule.dayStep !== 0) continue;
      const candidate = candidateAt(day, schedule, timezone);
      if (candidate > after) return candidate;
    }
  }

  throw new Error("No se pudo calcular la próxima ejecución programada");
}

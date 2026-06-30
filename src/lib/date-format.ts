const MATCH_TIME_ZONE = "Asia/Dhaka";

function asDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMatchDateTime(value: string, withWeekday = false): string {
  const date = asDate(value);
  if (!date) return "Time TBA";

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: MATCH_TIME_ZONE,
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatMatchShortDateTime(value: string): string {
  return formatMatchDateTime(value, false);
}

export function isSameMatchDay(value: string, now = new Date()): boolean {
  const date = asDate(value);
  if (!date) return false;

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MATCH_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return parts.format(date) === parts.format(now);
}
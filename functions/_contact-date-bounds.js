export const CONTACT_DATE_MAX_ADVANCE_YEARS = 2;

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isStrictIsoCalendarDate(value) {
  const match = ISO_DATE_PATTERN.exec(String(value || ""));
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

export function addCalendarYearsToIsoDate(value, years) {
  if (!isStrictIsoCalendarDate(value) || !Number.isInteger(years)) {
    throw new TypeError("A valid ISO date and an integer year offset are required.");
  }

  const [year, month, day] = value.split("-").map(Number);
  const targetYear = year + years;
  const targetDay = Math.min(day, daysInMonth(targetYear, month));
  return `${targetYear}-${pad(month)}-${pad(targetDay)}`;
}

export function localIsoDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function zonedIsoDate(date = new Date(), timeZone = "Europe/Berlin") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function contactDateBoundsFromToday(today) {
  if (!isStrictIsoCalendarDate(today)) {
    throw new TypeError("A valid ISO date is required.");
  }

  return {
    minDate: today,
    maxDate: addCalendarYearsToIsoDate(today, CONTACT_DATE_MAX_ADVANCE_YEARS),
  };
}

export function contactDateBoundsAt(date = new Date(), timeZone) {
  const today = timeZone ? zonedIsoDate(date, timeZone) : localIsoDate(date);
  return contactDateBoundsFromToday(today);
}

export function validateContactDate(value, bounds) {
  if (!isStrictIsoCalendarDate(value)) return "invalid";
  if (value < bounds.minDate) return "past";
  if (value > bounds.maxDate) return "too_far";
  return "valid";
}

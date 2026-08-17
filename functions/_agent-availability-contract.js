export const AGENT_AVAILABILITY_MAX_BODY_BYTES = 512;
export const AGENT_AVAILABILITY_MAX_DATES = 3;
export const AGENT_AVAILABILITY_MINIMUM_ADVANCE_MONTHS = 6;
export const AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS = 24;

function datePartsInBerlin(now) {
  const parts = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
}

function dateValue(year, month, day) {
  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

export function agentAvailabilityDateBounds(now = new Date()) {
  const { year, month, day } = datePartsInBerlin(now);
  const targetMonth = month - 1 + AGENT_AVAILABILITY_MAXIMUM_ADVANCE_MONTHS;
  const maximumYear = year + Math.floor(targetMonth / 12);
  const maximumMonthIndex = targetMonth % 12;
  const lastDay = new Date(Date.UTC(maximumYear, maximumMonthIndex + 1, 0)).getUTCDate();

  return {
    minDate: dateValue(year, month, day),
    maxDate: dateValue(maximumYear, maximumMonthIndex + 1, Math.min(day, lastDay)),
  };
}

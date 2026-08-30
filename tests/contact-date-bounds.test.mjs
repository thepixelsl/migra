import assert from "node:assert/strict";
import { test } from "node:test";

import {
  addCalendarYearsToIsoDate,
  contactDateBoundsAt,
  contactDateBoundsFromToday,
  isStrictIsoCalendarDate,
  validateContactDate,
} from "../functions/_contact-date-bounds.js";

test("validates strict calendar dates without normalizing invalid values", () => {
  assert.equal(isStrictIsoCalendarDate("2028-02-29"), true);
  assert.equal(isStrictIsoCalendarDate("2027-02-29"), false);
  assert.equal(isStrictIsoCalendarDate("2026-8-30"), false);
  assert.equal(isStrictIsoCalendarDate("2026-08-30T12:00:00Z"), false);
});

test("adds two calendar years and clamps leap day safely", () => {
  assert.equal(addCalendarYearsToIsoDate("2026-08-30", 2), "2028-08-30");
  assert.equal(addCalendarYearsToIsoDate("2028-02-29", 2), "2030-02-28");
});

test("uses local time in the browser and Europe/Berlin time on the backend", () => {
  const instant = new Date("2026-08-29T22:30:00.000Z");
  assert.deepEqual(contactDateBoundsAt(instant, "Europe/Berlin"), {
    minDate: "2026-08-30",
    maxDate: "2028-08-30",
  });
});

test("accepts only dates from today through the two-year horizon", () => {
  const bounds = contactDateBoundsFromToday("2026-08-30");
  assert.equal(validateContactDate("2026-08-29", bounds), "past");
  assert.equal(validateContactDate("2026-08-30", bounds), "valid");
  assert.equal(validateContactDate("2028-08-30", bounds), "valid");
  assert.equal(validateContactDate("2028-08-31", bounds), "too_far");
  assert.equal(validateContactDate("2028-02-30", bounds), "invalid");
});

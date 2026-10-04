import assert from "node:assert/strict";
import test from "node:test";
import { calculateThankYouDiscount, parseEuroCents } from "../src/lib/thankYouDiscount.mjs";

test("accepts whole euros, German decimal amounts and copied currency labels", () => {
  for (const [input, expected] of [
    ["1992", 199200], ["1.992", 199200], ["1.992,50", 199250],
    ["1992,5", 199250], ["1992.50", 199250], ["1 992,50 €", 199250],
    ["€ 649", 64900], [" 649,99 EUR ", 64999], ["0", 0], ["0,01", 1],
  ]) {
    assert.equal(parseEuroCents(input), expected, input);
  }
});

test("rejects negative, malformed, excessive-precision and unsafe amounts", () => {
  for (const input of ["", " ", "-649", "1e3", "Infinity", "10abc", "1,992.50", "1.99,50", "649,999", "1,2,3", "9007199254740992"]) {
    assert.equal(parseEuroCents(input), null, input);
  }
});

test("discounts actual package prices and keeps cent-rounded saving and price consistent", () => {
  for (const [totalCents, savingCents, discountedCents] of [
    [29900, 2990, 26910], [64900, 6490, 58410],
    [149400, 14940, 134460], [199200, 19920, 179280],
    [199250, 19925, 179325], [199255, 19926, 179329], [0, 0, 0],
  ]) {
    const result = calculateThankYouDiscount(totalCents);
    assert.deepEqual(result, { totalCents, savingCents, discountedCents });
    assert.equal(result.savingCents + result.discountedCents, result.totalCents);
  }
  for (const invalid of [-1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(calculateThankYouDiscount(invalid), null);
  }
});

/** Parse euro amounts entered with German grouping or a decimal point. */
export function parseEuroCents(value) {
  const amount = value.trim().replace(/^(?:€\s*)|(?:\s*(?:€|EUR))$/gi, "").replace(/\s/g, "");
  if (!amount) return null;

  let normalized;
  if (amount.includes(",")) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(amount)) return null;
    normalized = amount.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(amount)) {
    normalized = amount.replaceAll(".", "");
  } else {
    if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null;
    normalized = amount;
  }

  const [euros, decimals = ""] = normalized.split(".");
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

/** Round the 10% saving to cents, then subtract it so the displayed sums agree. */
export function calculateThankYouDiscount(totalCents) {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) return null;
  const savingCents = Math.round(totalCents / 10);
  return { totalCents, savingCents, discountedCents: totalCents - savingCents };
}

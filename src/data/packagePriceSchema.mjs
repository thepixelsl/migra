/** Price facts shared by the visible pricing page and the agent reference. */
export function packagePriceSchema(item) {
  if (!["hour", "package"].includes(item.billingUnit) || !Number.isFinite(item.priceValue)
    || item.priceValue < 0 || !(item.minimumHours > 0) || !(item.maximumHours >= item.minimumHours)) {
    throw new Error("Package schema requires explicit, valid billing and duration facts");
  }
  const range = { "@type": "QuantitativeValue", minValue: item.minimumHours, maxValue: item.maximumHours, unitCode: "HUR", unitText: "Stunde" };
  if (item.billingUnit === "hour") return {
    // Do not emit Offer.price: the hourly amount is not the total offer price.
    priceSpecification: {
      "@type": "UnitPriceSpecification", priceCurrency: "EUR", price: item.priceValue,
      unitCode: "HUR", unitText: "Stunde",
      referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "HUR", unitText: "Stunde" },
      eligibleQuantity: range,
      description: `${item.priceLabel}; buchbar für ${item.duration}.`,
    },
    eligibleQuantity: range,
  };
  return {
    priceCurrency: "EUR", price: item.priceValue,
    priceSpecification: {
      "@type": "PriceSpecification", priceCurrency: "EUR", price: item.priceValue,
      description: `${item.priceNote}. Dauer: ${item.duration}.`,
    },
  };
}

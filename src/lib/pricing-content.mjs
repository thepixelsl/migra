export const pricingPackageIds = ['pure-moments', 'standesamt-paket', 'rundum-sorglos-paket'];
export function formatPricingEuro(value) {
  return new Intl.NumberFormat('de-DE', {style:'currency', currency:'EUR', minimumFractionDigits:Number.isInteger(value)?0:2, maximumFractionDigits:2}).format(value);
}
export function pricingValues(data) {
  const values = {galleryMonths:String(data.galleryMonths), discountPercent:String(data.discount.percent), discountImages:String(data.discount.images)};
  for(const key of ['deliveryTiming','deliveryException','deliveryRetouch'])values[key]=data.texts[key];
  for (const [index, item] of data.packages.entries()) {
    const key = ['pure', 'standesamt', 'reportage'][index];
    Object.assign(values, {[key+'Name']:item.name, [key+'Price']:formatPricingEuro(item.priceValue),
      [key+'Min']:String(item.minimumHours), [key+'Max']:String(item.maximumHours), [key+'Duration']:item.duration});
    for (let hours=1; hours<=10; hours++) values[key+'Total'+hours] = formatPricingEuro(item.billingUnit==='hour'?hours*item.priceValue:item.priceValue);
  }
  return values;
}
export function pricingText(text, data) {
  const values=pricingValues(data);
  for(let depth=0;depth<8;depth++){
    if(!/\{\{([a-zA-Z0-9]+)\}\}/.test(text))return text;
    text=text.replace(/\{\{([a-zA-Z0-9]+)\}\}/g, (_, key) => {
      if (!Object.hasOwn(values,key)) throw new Error('Unbekannter automatischer Preiswert: '+key);
      return values[key];
    });
  }
  throw new Error('Automatische Werte dürfen nicht auf sich selbst verweisen.');
}
export function resolvePricingPackages(data) {
  return data.packages.map(item=>({...item,
    priceLabel:formatPricingEuro(item.priceValue)+(item.priceSuffix?' '+item.priceSuffix:''),
    priceNote:pricingText(item.priceNote,data), intro:pricingText(item.intro,data),
    features:item.features.map(text=>pricingText(text,data))}));
}

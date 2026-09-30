import { test, expect } from '@playwright/test';
const names=['googleAnalytics','googleAds','microsoftClarity','metaPixel','openaiAds'];
test.beforeEach(async({context,baseURL})=>{
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==new URL(baseURL!).origin) return route.abort();
  if(url.pathname==='/api/contact') return route.fulfill({json:{ok:true,message:'Synthetischer Versand bestätigt'}});
  return route.continue();
 });
});
async function observe(context:any,baseURL:string){
 const requests:string[]=[];context.on('request',(r:any)=>{if(new URL(r.url()).origin!==new URL(baseURL).origin)requests.push(r.url());});return requests;
}
test('released build blocks all providers, even with restored consent and every service combination',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);
 await context.addCookies([{name:'artbild_consent',url:baseURL!,value:encodeURIComponent(JSON.stringify({version:'2026-09-30.1',updatedAt:new Date().toISOString(),openaiPersonalizationOptOut:true,services:Object.fromEntries(names.map(n=>[n,true]))}))}]);
 for(const name of ['_ga','_gcl_aw','_fbp','_clck','__oppref','__obref'])await context.addCookies([{name,value:'old-identifier',url:baseURL!}]);
 await page.goto('/kontakt/?email=privacy-canary%40example.test#PRIVATE_FRAGMENT');
 for(let mask=0;mask<32;mask++){
  const wanted=Object.fromEntries(names.map((n,i)=>[n,Boolean(mask&(1<<i))]));
  const state=await page.evaluate(v=>(window as any).artbildConsentApi.setConsent({services:v}),wanted);
  expect(Object.values(state.services)).not.toContain(true);
  await page.evaluate(()=>window.dispatchEvent(new CustomEvent('artbild:form_success',{detail:{eventId:crypto.randomUUID(),formId:'kontakt_anfrage_form',formType:'contact_request'}})));
 }
 await page.waitForTimeout(1200);expect(requests).toEqual([]);
 expect((await context.cookies()).filter(c=>/^(_ga|_gcl_|_fb|_cl|__op|__ob)/.test(c.name))).toEqual([]);
 await expect(page.locator('iframe[data-artbild-provider]')).toHaveCount(0);
});
test('public pages and privacy settings accurately show inactive services without unsolicited consent popup',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);
 for(const path of ['/','/kontakt/','/datenschutz/','/datenschutzerklaerung/','/fuer-agenten/']){
  const response=await page.goto(path);expect(response!.status()).toBeLessThan(400);
  if(path!='/fuer-agenten/')await expect(page.locator('[data-consent-dialog]')).not.toBeVisible();
 }
 await page.goto('/datenschutz/');const content=await page.locator('main').innerText();
 for(const service of ['Google Analytics','Google Ads','Meta Pixel','Microsoft Clarity','OpenAI Ads'])expect(content).toContain(service);
 expect(content).toContain('deaktiviert');expect(content).toContain('30. September 2026');
 await page.locator('[data-consent-settings]').first().click();
 await expect(page.locator('[data-consent-dialog]')).toBeVisible();
 await expect(page.locator('[data-consent-service]')).toHaveCount(5);
 for(const input of await page.locator('[data-consent-service]').all()){await expect(input).toBeDisabled();await expect(input).not.toBeChecked();}
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('released-settings.png')});expect(requests).toEqual([]);
});
test('contact success still works without tracking, with errors prevented from becoming leads',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);await page.goto('/kontakt/');
 await page.locator('#contact-request-type').selectOption('hochzeit');
 await page.locator('#contact-name').fill('Privacy Canaryperson');await page.locator('#contact-email').fill('privacy-canary@example.test');
 await page.locator('#contact-event-date').fill('2027-06-12');await page.locator('#contact-location').fill('Privacy Canaryvenue');
 await page.locator('#contact-security-year').fill(String(new Date().getFullYear()));await page.locator('textarea[name="message"]').fill('PRIVATE_FORM_CANARY');await page.locator('input[name="privacy"]').check();
 await page.locator('form[data-track-form] button[type="submit"]').dblclick();await expect(page.locator('[data-contact-status]')).toContainText('Synthetischer Versand bestätigt');
 await page.waitForTimeout(1200);expect(requests).toEqual([]);expect((await context.cookies()).some(c=>/^(_ga|_gcl_|_fb|_cl|__op|__ob)/.test(c.name))).toBe(false);
});

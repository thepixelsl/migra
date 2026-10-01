import { test, expect } from '@playwright/test';
const names=['googleAnalytics','googleAds','microsoftClarity','metaPixel','openaiAds'];
test.beforeEach(async({context,baseURL})=>{
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(url.origin!==new URL(baseURL!).origin) return route.abort();
  if(url.pathname==='/api/contact') return route.fulfill({json:{ok:true,message:'Synthetischer Versand bestätigt'}});
  if(process.env.PRIVACY_LOCAL_ORIGIN){
    const local=process.env.PRIVACY_LOCAL_ORIGIN;
    const options={maxRedirects:0,headers:{...route.request().headers(),host:new URL(local).host}};
    let response=await route.fetch({url:local+url.pathname+url.search,...options});
    // Redirect follow-ups bypass context routing. Keep preview redirects local.
    for(let i=0;i<3 && response.headers().location;i++){
      const next=new URL(response.headers().location,local);
      response=await route.fetch({url:local+next.pathname+next.search,...options});
    }
    return route.fulfill({response});
  }
  return route.continue();
 });
});
async function observe(context:any,baseURL:string){
 const requests:string[]=[];context.on('request',(r:any)=>{if(new URL(r.url()).origin!==new URL(baseURL).origin)requests.push(r.url());});return requests;
}
test('released build requires fresh consent and enables only the requested released service',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);
 await context.addCookies([{name:'artbild_consent',url:baseURL!,value:encodeURIComponent(JSON.stringify({version:'2026-09-30.1',updatedAt:new Date().toISOString(),openaiPersonalizationOptOut:true,services:Object.fromEntries(names.map(n=>[n,true]))}))}]);
 await page.goto('/kontakt/');await page.waitForTimeout(400);
 expect(requests).toEqual([]);await expect(page.locator('[data-consent-dialog]')).toBeVisible();
 await page.getByRole('button',{name:'NUR NOTWENDIGE',exact:true}).click();
 await page.evaluate(()=>(window as any).artbildConsentApi.setConsent({services:{microsoftClarity:true,metaPixel:true}}));
 await expect.poll(()=>requests.some(u=>u.includes('clarity.ms/tag/m73xkwijzj'))).toBe(true);
 const state=await page.evaluate(()=>(window as any).ArtbildConsent.services);
 expect(state.microsoftClarity).toBe(true);expect(state.metaPixel).toBe(true);
 expect(requests.some(u=>u.includes('/fbevents.js'))).toBe(true);expect(requests.every(u=>u.includes('clarity.ms/tag/') || u.includes('/fbevents.js'))).toBe(true);
 await Promise.all([page.waitForEvent('domcontentloaded'),page.evaluate(()=>(window as any).artbildConsentApi.setConsent({services:{microsoftClarity:false,metaPixel:false}}))]);
 const count=requests.length;await page.waitForTimeout(400);expect(requests).toHaveLength(count);
});
test('public pages and settings show five consent-dependent services and actual retention',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);
 for(const path of ['/','/kontakt/','/datenschutz/','/datenschutzerklaerung/','/fuer-agenten/']){
  const response=await page.goto(path);expect(response!.status()).toBeLessThan(400);
  if(path!='/fuer-agenten/')await expect(page.locator('[data-consent-dialog]'),path+' → '+page.url()).toBeVisible();
 }
 await page.goto('/datenschutz/');const content=await page.locator('main').innerText();
 for(const service of ['Google Analytics','Google Ads','Meta Pixel','Microsoft Clarity','OpenAI Ads'])expect(content).toContain(service);
 expect(content).toContain('deaktiviert');expect(content).toContain('1. Oktober 2026');expect(content).toContain('14 Monate');
 await page.getByRole('button',{name:'EINSTELLUNGEN',exact:true}).click();
 await expect(page.locator('[data-consent-dialog]')).toBeVisible();
 await expect(page.locator('[data-consent-service]')).toHaveCount(5);
 for(const name of names){const input=page.locator(`[data-consent-service="${name}"]`);await expect(input).toBeEnabled();await expect(input).not.toBeChecked();}
 await page.setViewportSize({width:320,height:740});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:test.info().outputPath('released-settings.png')});expect(requests).toEqual([]);
});
test('contact success still works without tracking, with errors prevented from becoming leads',async({page,context,baseURL})=>{
 const requests=await observe(context,baseURL!);await page.goto('/kontakt/');await page.getByRole('button',{name:'NUR NOTWENDIGE',exact:true}).click();
 await page.locator('#contact-request-type').selectOption('hochzeit');
 await page.locator('#contact-name').fill('Privacy Canaryperson');await page.locator('#contact-email').fill('privacy-canary@example.test');
 await page.locator('#contact-event-date').fill('2027-06-12');await page.locator('#contact-location').fill('Privacy Canaryvenue');
 await page.locator('#contact-security-year').fill(String(new Date().getFullYear()));await page.locator('textarea[name="message"]').fill('PRIVATE_FORM_CANARY');await page.locator('input[name="privacy"]').check();
 await page.locator('form[data-track-form] button[type="submit"]').dblclick();await expect(page.locator('[data-contact-status]')).toContainText('Synthetischer Versand bestätigt');
 await page.waitForTimeout(1200);expect(requests).toEqual([]);expect((await context.cookies()).some(c=>/^(_ga|_gcl_|_fb|_cl|__op|__ob)/.test(c.name))).toBe(false);
});

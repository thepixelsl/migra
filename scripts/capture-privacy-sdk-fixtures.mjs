// Public SDK/configuration only. Never sends browser cookies, form data or conversions.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const dir=new URL('../reports/ads-datenschutz-2026-09-30/evidence/',import.meta.url);
await mkdir(dir,{recursive:true});
const sources={
 'openai-sdk.js':'https://bzrcdn.openai.com/sdk/oaiq.min.js',
 'google-current.js':'https://www.googletagmanager.com/gtag/js?id=G-TSWGFD1YKF',
 'google-ads-current.js':'https://www.googletagmanager.com/gtag/js?id=AW-874983678',
 'gtm-current.js':'https://www.googletagmanager.com/gtm.js?id=GTM-5TM37JC',
};
const manifest={capturedAt:new Date().toISOString(),sources:[]};
for(const [name,url] of Object.entries(sources)){
 const response=await fetch(url);if(!response.ok)throw Error(`${name}: HTTP ${response.status}`);
 const body=await response.text();await writeFile(new URL(name,dir),body);
 manifest.sources.push({file:name,url,sha256:createHash('sha256').update(body).digest('hex'),bytes:Buffer.byteLength(body)});
}
await writeFile(new URL('sdk-manifest.json',dir),JSON.stringify(manifest,null,2)+'\n');
console.log(JSON.stringify(manifest,null,2));

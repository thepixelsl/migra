// Endpoint and payload follow BunnyWay/actions container-update-image.
// Await every request and verify the public revision before reporting success.
import {confirmedBunnyState} from './hub-bunny-state.mjs';
const appId='K6hWkF1VHGclfGm', container='web';
const {BUNNYNET_API_KEY:key,HUB_IMAGE_TAG:tag,HUB_IMAGE_DIGEST:digest,HUB_RELEASE_ID:id}=process.env;
if(!key || !/^prod-sha-[a-f0-9]{40}$/.test(tag||'') || !/^sha256:[a-f0-9]{64}$/.test(digest||'') ||
  !/^[a-f0-9-]{36}$/.test(id||'')) throw new Error('Missing or invalid Hub deployment configuration');
const url='https://api.bunny.net/mc/apps/'+appId;
async function request(method,url,body) {
  const r=await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(20000),
    headers:{AccessKey:key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if(!r.ok) throw new Error('Bunny deployment returned HTTP '+r.status);
  const text=await r.text();
  return text?JSON.parse(text):null;
}
const config=await request('GET',url);
const matches=config.containerTemplates.filter(v=>v.name===container);
if(matches.length!==1) throw new Error('Expected exactly one Artbild web container');
const oldPods=(config.containerInstances||[]).filter(v=>v.templateId===matches[0].id).map(v=>v.podId);
await request('PATCH',url+'/containers/'+matches[0].id,{id:matches[0].id,imageTag:tag,imageDigest:digest});
const deadline=Date.now()+20*60*1000;
let complete=false;
while(Date.now()<deadline) {
  const updated=await request('GET',url);
  const overview=await request('GET',url+'/overview');
  const current=await fetch('https://artbild-fotografie.de/hub-release.json',{
    redirect:'error',signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
  const marker=current.ok?await current.json().catch(()=>null):null;
  if(confirmedBunnyState(updated,overview,{tag,digest,oldPods}) && marker?.id===id) {
    complete=true;break;
  }
  await new Promise(resolve=>setTimeout(resolve,5000));
}
if(!complete) throw new Error('Bunny revision is not yet publicly confirmed; do not retry deployment without checking the live state');
console.log('Artbild Hub release publicly confirmed: '+id);

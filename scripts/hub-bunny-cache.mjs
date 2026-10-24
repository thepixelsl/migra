import {setTimeout as delay} from 'node:timers/promises';

const origin='https://artbild-fotografie.de';
const publicPath=path=>typeof path==='string' && path.endsWith('/') && /^\/(?:[a-z0-9-]+\/)*$/.test(path) &&
  !/^\/(?:api|admin[^/]*|hub-preview)(?:\/|$)/.test(path);

export function bunnyCachePaths(plan,releaseId) {
  if(typeof releaseId!=='string' || releaseId.length!==36 ||
    !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(releaseId) ||
    plan?.id!==releaseId || !Array.isArray(plan.paths) || !plan.paths.length ||
    !plan.paths.every(publicPath))
    throw Error('Der Bunny-Cache-Abgleich benötigt die gültige Seitenliste dieser Veröffentlichung.');
  return [...new Set(plan.paths)];
}

export async function refreshBunnyReleaseCache(plan,{
  releaseId,key,fetcher=fetch,wait=delay,now=Date.now,timeoutMs=5*60*1000,onPurged=()=>{},
}={}) {
  const paths=bunnyCachePaths(plan,releaseId);
  if(!key)throw Error('Der geschützte Bunny-Zugang für den Cache-Abgleich fehlt.');
  const deadline=now()+timeoutMs;
  const timeout=()=>{
    if(now()>=deadline)throw Error('Der gezielte Bunny-Cache-Abgleich hat die Wartezeit überschritten.');
    return AbortSignal.timeout(Math.max(1,Math.min(20000,deadline-now())));
  };
  // Confirm the deployed release before touching its CDN entries. The API key
  // is sent only to Bunny's fixed purge endpoint, never to the public website.
  let marker;
  try {
    const response=await fetcher(origin+'/hub-release.json',{
      redirect:'error',signal:timeout(),headers:{'Cache-Control':'no-cache'}});
    if(response.status!==200)throw Error();
    marker=await response.json();
  }catch{throw Error('Die bereitgestellte Bunny-Version konnte vor dem Cache-Abgleich nicht bestätigt werden.');}
  const published=bunnyCachePaths(marker,releaseId);
  if(marker.siteId!=='artbild' || published.length!==paths.length || paths.some(path=>!published.includes(path)))
    throw Error('Die öffentliche Bunny-Version passt nicht zur freigegebenen Seitenliste.');

  for(const path of paths) {
    const endpoint=new URL('https://api.bunny.net/purge');
    endpoint.search=new URLSearchParams({url:origin+path,async:'false',exactPath:'true'}).toString();
    for(let attempt=0;;attempt++) {
      let response;
      const signal=timeout();
      try {
        response=await fetcher(endpoint,{method:'POST',redirect:'error',signal,
          headers:{AccessKey:key,Accept:'application/json'}});
      }catch{
        if(attempt===2)throw Error('Der Bunny-Cache-Abgleich für '+path+' ist nicht erreichbar.');
      }
      if(response?.status===200) {
        await response.arrayBuffer();
        await onPurged(path);break;
      }
      if(response) {
        await response.body?.cancel();
        if(attempt===2 || response.status!==429 && response.status<500)
          throw Error('Der Bunny-Cache-Abgleich für '+path+' meldet HTTP '+response.status+'.');
      }
      await wait(Math.min(2000*(attempt+1),Math.max(0,deadline-now())));
    }
  }
  return paths;
}

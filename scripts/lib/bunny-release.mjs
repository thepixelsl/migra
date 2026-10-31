import {setTimeout as delay} from 'node:timers/promises';
import {confirmedBunnyState} from '../hub-bunny-state.mjs';

const appId='K6hWkF1VHGclfGm',container='web';
const api='https://api.bunny.net/mc/apps/'+appId;
const retryableStatus=status=>status===408||status===429||status>=500;
const unavailable=(message,retryable=true)=>Object.assign(new Error(message),{retryable});

export async function deployBunnyRelease({key,tag,digest,id,fetcher=fetch,wait=delay,now=Date.now,
  timeoutMs=20*60*1000,log=console.log}={}){
  if(!key||!/^prod-sha-[a-f0-9]{40}$/.test(tag||'')||!/^sha256:[a-f0-9]{64}$/.test(digest||'')||
    !/^[a-f0-9-]{36}$/.test(id||''))throw Error('Missing or invalid Hub deployment configuration');
  const deadline=now()+timeoutMs;
  const pause=async ms=>{if(now()>=deadline)throw unavailable('Die Bunny-Prüfung hat die Wartezeit überschritten.',false);await wait(Math.min(ms,deadline-now()));};
  const signal=()=>{
    if(now()>=deadline)throw unavailable('Die Bunny-Prüfung hat die Wartezeit überschritten.',false);
    return AbortSignal.timeout(Math.max(1,Math.min(20000,deadline-now())));
  };
  async function request(method,url,body){
    // Retry read requests only. A disconnected PATCH may already have changed
    // the image, so it must be reconciled by reads instead of sent again.
    for(let attempt=0;;attempt++){
      let error;
      try{
        const response=await fetcher(url,{method,redirect:'error',signal:signal(),
          headers:{AccessKey:key,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
        if(!response.ok){
          await response.body?.cancel();
          throw unavailable('Die Bunny-API meldet HTTP '+response.status+'.',retryableStatus(response.status));
        }
        const text=await response.text(),data=text?JSON.parse(text):null;
        if(method==='GET'&&(!data||typeof data!=='object'||Array.isArray(data)))
          throw unavailable('Die Bunny-API hat keinen lesbaren Status geliefert.');
        return data;
      }catch(cause){
        // Upstream messages and response bodies can contain private data.
        error=cause.retryable===undefined?unavailable('Die Verbindung zur Bunny-API wurde unterbrochen.'):cause;
      }
      if(method!=='GET'||!error.retryable||attempt===2)throw error;
      await pause(2000*(attempt+1));
    }
  }
  const config=await request('GET',api);
  const selected=config?.containerTemplates?.filter(value=>value.name===container);
  if(selected?.length!==1)throw Error('Expected exactly one Artbild web container');
  const target=selected[0],alreadySelected=target.imageTag===tag&&target.imageDigest===digest;
  const oldPods=alreadySelected?[]:(config.containerInstances||[]).filter(value=>value.templateId===target.id).map(value=>value.podId);
  if(alreadySelected)log('Das geprüfte Image ist bereits ausgewählt; der bestehende Stand wird weiter geprüft.');
  else{
    log('Das geprüfte Image wird einmalig an Bunny übergeben.');
    try{await request('PATCH',api+'/containers/'+target.id,{id:target.id,imageTag:tag,imageDigest:digest});}
    catch(error){
      if(!error.retryable)throw error;
      log('Die Antwort auf den Bildwechsel ist unklar; der tatsächliche Stand wird lesend geprüft.');
    }
  }
  while(now()<deadline){
    let updated,overview;
    try{
      updated=await request('GET',api);
      overview=await request('GET',api+'/overview');
    }catch(error){
      if(!error.retryable)throw error;
      log('Der Bunny-Status ist vorübergehend nicht erreichbar; die Prüfung wird fortgesetzt.');
      await pause(5000);continue;
    }
    let marker=null;
    try{
      const current=await fetcher('https://artbild-fotografie.de/hub-release.json',{
        redirect:'error',signal:signal(),headers:{'Cache-Control':'no-cache'}});
      if(current.ok)marker=await current.json();else await current.body?.cancel();
    }catch{/* A temporary public read failure does not repeat the image change. */}
    if(confirmedBunnyState(updated,overview,{tag,digest,oldPods})&&marker?.id===id){
      log('Bunny container and release marker confirmed: '+id);
      return {appId,container,tag,digest,status:updated.status,alreadySelected};
    }
    await pause(5000);
  }
  throw Error('Bunny revision is not yet publicly confirmed; do not retry deployment without checking the live state');
}

import {confirmedBunnyState} from './hub-bunny-state.mjs';
const owner='thepixelsl',repository='thepixelsl/migra',packageName='migra-bunny-dev';
const github='https://api.github.com',app='https://api.bunny.net/mc/apps/K6hWkF1VHGclfGm';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(value);
const tags=v=>v.metadata?.container?.tags;
export function registryRetentionPlan(versions,{currentTag,rollbackTag}){
  const current=versions.filter(v=>tags(v)?.includes(currentTag)),rollback=versions.filter(v=>tags(v)?.includes(rollbackTag));
  if(current.length!==1||rollback.length!==1||current[0].id===rollback[0].id)throw Error('Current image and distinct rollback image must both exist.');
  const retained=new Set([current[0].id,rollback[0].id]),cutoff=Date.parse(current[0].created_at);
  const managed=v=>Array.isArray(tags(v))&&tags(v).every(t=>/^(?:prod-sha-[a-f0-9]{7,40}|sha-[a-f0-9]{7,40}|production|dev|\d{4}-\d{2}-\d{2}-[a-f0-9]{12}(?:-[a-z0-9]+)?)$/.test(t));
  const remove=versions.filter(v=>!retained.has(v.id)&&managed(v)&&Number.isFinite(Date.parse(v.created_at))&&Date.parse(v.created_at)<=cutoff);
  return {current:current[0],rollback:rollback[0],remove,protected:versions.filter(v=>!retained.has(v.id)&&!remove.includes(v))};
}
export async function retainRegistry({token,key,currentRelease,rollbackRelease,apply=false,fetcher=fetch}){
  if(!token||!key||!uuid(currentRelease)||!uuid(rollbackRelease)||currentRelease===rollbackRelease)throw Error('Valid current and rollback release IDs and service credentials are required.');
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
  async function request(url,{method='GET',bunny=false}={}){
    const response=await fetcher(url,{method,headers:bunny?{AccessKey:key}:headers,redirect:'error',signal:AbortSignal.timeout(30000)});
    if(!response.ok)throw Error('Provider retention request failed (HTTP '+response.status+').');
    return response.status===204?null:response.json();
  }
  const versionUrl=github+'/users/'+owner+'/packages/container/'+packageName+'/versions';
  async function versions(){
    const result=[];
    for(let page=1;page<=100;page++){
      const values=await request(versionUrl+'?per_page=100&page='+page);
      if(!Array.isArray(values))throw Error('Invalid package inventory.');result.push(...values);
      if(values.length<100)return result;
    }throw Error('Package inventory is incomplete.');
  }
  const metadata=await request(github+'/users/'+owner+'/packages/container/'+packageName);
  if(metadata.repository?.full_name!==repository||metadata.name!==packageName)throw Error('Unexpected package owner or repository.');
  async function branch(id){
    const ref=await request(github+'/repos/'+repository+'/git/ref/heads/hub-release/'+id);
    if(!/^[a-f0-9]{40}$/.test(ref.object?.sha||''))throw Error('Invalid release branch.');return 'prod-sha-'+ref.object.sha;
  }
  const currentTag=await branch(currentRelease),rollbackTag=await branch(rollbackRelease);
  for(const status of ['in_progress','queued','waiting','pending']){
    const runs=await request(github+'/repos/'+repository+'/actions/workflows/bunny-dev-image.yml/runs?status='+status+'&per_page=100');
    if(runs.workflow_runs?.length)throw Error('A Bunny image build is still active or pending.');
  }
  const initial=await versions(),plan=registryRetentionPlan(initial,{currentTag,rollbackTag});
  async function confirm(){
    const config=await request(app,{bunny:true}),overview=await request(app+'/overview',{bunny:true});
    const marker=await fetcher('https://artbild-fotografie.de/hub-release.json',{redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!confirmedBunnyState(config,overview,{tag:currentTag,digest:plan.current.name})||!marker.ok||(await marker.json()).id!==currentRelease)throw Error('The running Bunny image and public release are not confirmed. Nothing further was deleted.');
  }
  await confirm();
  const deleted=[];
  if(apply)for(let offset=0;offset<plan.remove.length;offset+=3){
    await confirm();
    // Compare each immutable version and its tags again immediately before deletion.
    await Promise.all(plan.remove.slice(offset,offset+3).map(async version=>{
      const actual=await request(versionUrl+'/'+version.id);
      if(actual.name!==version.name||JSON.stringify(tags(actual))!==JSON.stringify(tags(version)))throw Error('A package version changed during retention.');
      await request(versionUrl+'/'+version.id,{method:'DELETE'});deleted.push(version.id);
    }));
  }
  const remaining=apply?await versions():initial;
  for(const kept of [plan.current,plan.rollback])if(!remaining.some(v=>v.id===kept.id&&v.name===kept.name))throw Error('A retained image is missing.');
  await confirm();
  return {provider:'github-container-registry',appId:'K6hWkF1VHGclfGm',package:owner+'/'+packageName,currentRelease,rollbackRelease,
    current:{id:plan.current.id,digest:plan.current.name,tag:currentTag},rollback:{id:plan.rollback.id,digest:plan.rollback.name,tag:rollbackTag},
    before:initial.length,after:remaining.length,planned:plan.remove.map(v=>v.id),deleted,protected:plan.protected.map(v=>v.id),applied:apply,checkedAt:new Date().toISOString()};
}

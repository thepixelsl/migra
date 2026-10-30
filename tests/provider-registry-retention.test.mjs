import test from 'node:test';
import assert from 'node:assert/strict';
import {registryRetentionPlan,retainRegistry} from '../scripts/provider-registry-retention.mjs';
const version=(id,tags,date='2026-10-01')=>({id,name:'sha256:'+String(id).repeat(64),created_at:date+'T00:00:00Z',metadata:{container:{tags}}});
test('registry retention protects current, confirmed rollback, custom tags and images newer than the live release',()=>{
 const values=[version(1,['prod-sha-'+'a'.repeat(40)],'2026-10-05'),version(2,['prod-sha-'+'b'.repeat(40)]),version(3,[]),version(4,['custom-protected']),version(5,['prod-sha-'+'c'.repeat(40)],'2026-10-06'),version(6,['dev','sha-1234567'])];
 const result=registryRetentionPlan(values,{currentTag:values[0].metadata.container.tags[0],rollbackTag:values[1].metadata.container.tags[0]});
 assert.deepEqual(result.remove.map(v=>v.id),[3,6]);assert.deepEqual(result.protected.map(v=>v.id),[4,5]);
});
test('registry pruning fails closed if either immutable retained image cannot be resolved uniquely',()=>{
 assert.throws(()=>registryRetentionPlan([version(1,['production'])],{currentTag:'missing',rollbackTag:'missing'}));
 assert.throws(()=>registryRetentionPlan([version(1,['a','b'])],{currentTag:'a',rollbackTag:'b'}));
});
function service({wrongMarker=false,apply=false}={}){
 const currentRelease='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',rollbackRelease='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',currentTag='prod-sha-'+'a'.repeat(40),rollbackTag='prod-sha-'+'b'.repeat(40);
 let rows=[version(1,[currentTag],'2026-10-05'),version(2,[rollbackTag]),version(3,[])],deletes=[];
 const fetcher=async(url,options={})=>{
  if(url==='https://artbild-fotografie.de/hub-release.json')return Response.json({id:wrongMarker?'unexpected':currentRelease});
  if(url.startsWith('https://api.bunny.net/mc/')){
   return Response.json(url.endsWith('/overview')?{status:'active',regions:[{pods:[{status:'ready',containers:[{status:'ready',image:rows[0].name}]}]}]}:{status:'active',containerTemplates:[{id:1,name:'web',imageTag:currentTag,imageDigest:rows[0].name}],containerInstances:[{templateId:1,podId:'running'}]});
  }
  const path=new URL(url).pathname;
  if(path.includes('/git/ref/'))return Response.json({object:{sha:path.endsWith(currentRelease)?'a'.repeat(40):'b'.repeat(40)}});
  if(path.includes('/actions/workflows/'))return Response.json({workflow_runs:[]});
  if(path.endsWith('/container/migra-bunny-dev'))return Response.json({name:'migra-bunny-dev',repository:{full_name:'thepixelsl/migra'}});
  if(path.endsWith('/versions'))return Response.json(rows);
  const id=Number(path.split('/').at(-1)),row=rows.find(v=>v.id===id);
  if(options.method==='DELETE'){assert.equal(id,3);deletes.push(id);rows=rows.filter(v=>v.id!==id);return new Response(null,{status:204});}
  return Response.json(row);
 };
 return {run:()=>retainRegistry({token:'fake',key:'fake',currentRelease,rollbackRelease,apply,fetcher}),deletes};
}
test('registry cleanup preserves live image and rollback after validating provider readiness and the public release',async()=>{
 const fixture=service({apply:true});const result=await fixture.run();assert.equal(result.after,2);assert.deepEqual(fixture.deletes,[3]);
});
test('registry dry-run and wrong public markers never delete images',async()=>{
 const preview=service();assert.equal((await preview.run()).planned.length,1);assert.equal(preview.deletes.length,0);
 const invalid=service({wrongMarker:true,apply:true});await assert.rejects(invalid.run,/not confirmed/);assert.equal(invalid.deletes.length,0);
});

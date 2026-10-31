import test from 'node:test';
import assert from 'node:assert/strict';
import {deployBunnyRelease} from '../scripts/lib/bunny-release.mjs';

const id='9b4bd004-304e-4fb6-9cbf-a8b51acfa5f9',tag='prod-sha-'+'a'.repeat(40),digest='sha256:'+'b'.repeat(64),key='test-secret-never-log';
const api='https://api.bunny.net/mc/apps/K6hWkF1VHGclfGm';
const config=selected=>({status:'active',containerTemplates:[{id:'web-id',name:'web',imageTag:selected?tag:'previous',imageDigest:selected?digest:'previous'}],containerInstances:[{templateId:'web-id',podId:selected?'new':'old'}]});
const overview={status:'active',regions:[{pods:[{status:'ready',containers:[{status:'ready',image:'site@'+digest}]}]}]};
function fixture({selected=false,disconnectPatch=false,failReads=0,failPublic=0,authError=false}={}){
  const calls=[],logs=[],waits=[];let time=0,patched=false,reads=0;
  const options={key,id,tag,digest,timeoutMs:60000,log:value=>logs.push(value),now:()=>time,wait:async ms=>{waits.push(ms);time+=ms;},
    fetcher:async(url,request={})=>{
      calls.push({url,method:request.method||'GET'});
      if(url.startsWith(api)){
        assert.equal(request.headers.AccessKey,key);
        if(authError)return new Response('private body '+key,{status:403});
        if(request.method==='PATCH'){
          patched=true;selected=true;
          if(disconnectPatch)throw Error(key);
          return Response.json({});
        }
        if(patched&&++reads<=failReads)throw Error(key);
        return Response.json(url.endsWith('/overview')?overview:config(selected));
      }
      assert.equal(request.headers.AccessKey,undefined);
      if(failPublic-->0)throw Error(key);
      return Response.json({id});
    }};
  return {options,calls,logs,waits};
}
test('an accepted image switch survives a disconnected PATCH response without sending a second PATCH',async()=>{
  const f=fixture({disconnectPatch:true,failReads:4,failPublic:1});
  assert.equal((await deployBunnyRelease(f.options)).status,'active');
  assert.equal(f.calls.filter(v=>v.method==='PATCH').length,1);assert.ok(f.waits.length>0);
  assert.ok(f.logs.every(value=>!value.includes(key)));
});
test('an already selected exact image is verified without another image change or requiring the current pods to be removed',async()=>{
  const f=fixture({selected:true});assert.equal((await deployBunnyRelease(f.options)).alreadySelected,true);
  assert.equal(f.calls.filter(v=>v.method==='PATCH').length,0);
});
test('authorization errors stop immediately without exposing a response body or retrying a write',async()=>{
  const f=fixture({authError:true});
  await assert.rejects(deployBunnyRelease(f.options),error=>{assert.match(error.message,/HTTP 403/);assert.ok(!error.message.includes(key));return true;});
  assert.equal(f.calls.length,1);assert.equal(f.waits.length,0);
});
test('stale public markers remain bounded and never cause a second image change',async()=>{
  const f=fixture();const fetcher=f.options.fetcher;
  await assert.rejects(deployBunnyRelease({...f.options,timeoutMs:12000,fetcher:async(url,request)=>url.startsWith(api)?fetcher(url,request):Response.json({id:'previous'})}),/Wartezeit|not yet publicly confirmed/);
  assert.equal(f.calls.filter(v=>v.method==='PATCH').length,1);
});
test('invalid configuration never makes an external request',async()=>{
  for(const change of [{key:''},{tag:'other'},{digest:'other'},{id:'other'}]){
    const f=fixture();await assert.rejects(deployBunnyRelease({...f.options,...change}),/configuration/);assert.equal(f.calls.length,0);
  }
});

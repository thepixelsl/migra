import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {bunnyCachePaths,refreshBunnyReleaseCache} from '../scripts/hub-bunny-cache.mjs';

const id='9b4bd004-304e-4fb6-9cbf-a8b51acfa5f9',key='fixture-secret-never-print';
const paths=['/gallery/brautpaar-le-meridien-hamburg/','/web-stories/eppendorf/'];
const plan={id,paths},marker={...plan,siteId:'artbild'};
const options={releaseId:id,key};

test('only approved exact URLs are refreshed after confirming the deployed release, including a safe homepage purge',async()=>{
  const selected={...plan,paths:[...paths,'/',paths[0]]},calls=[],purged=[];
  const cached=new Map([...paths,'/','/unrelated/'].map(path=>[path,'previous']));
  const result=await refreshBunnyReleaseCache(selected,{...options,onPurged:path=>purged.push(path),
    fetcher:async(url,request)=>{
      url=new URL(url);calls.push({url,request});assert.equal(request.redirect,'error');
      if(url.pathname==='/hub-release.json') {
        assert.equal(request.headers.AccessKey,undefined);
        assert.equal(request.headers['Cache-Control'],'no-cache');
        return Response.json({...selected,siteId:'artbild'});
      }
      assert.equal(url.origin+url.pathname,'https://api.bunny.net/purge');
      assert.equal(request.method,'POST');assert.equal(request.headers.AccessKey,key);
      assert.equal(url.searchParams.get('async'),'false');assert.equal(url.searchParams.get('exactPath'),'true');
      assert.equal([...url.searchParams.keys()].length,3);
      const target=new URL(url.searchParams.get('url'));
      assert.equal(target.origin,'https://artbild-fotografie.de');
      cached.set(target.pathname,id);return new Response('',{status:200});
    },
  });
  assert.deepEqual(result,[...paths,'/']);assert.deepEqual(purged,result);assert.equal(calls.length,4);
  for(const path of result)assert.equal(cached.get(path),id);
  assert.equal(cached.get('/unrelated/'),'previous');
});

test('invalid or foreign destinations and mismatched release plans never trigger authenticated requests',async()=>{
  let calls=0;
  const fetcher=async()=>{calls++;throw Error('Unexpected request');};
  for(const path of ['https://example.com/','//example.com/','/*','/gallery/*','/gallery/?x=1','/gallery/#anchor',
    '/gallery/%2a/','/gallery/../','/api/','/admin-termine/','/hub-preview/','/gallery\\foreign/','/gallery/\n']) {
    await assert.rejects(refreshBunnyReleaseCache({...plan,paths:[paths[0],path]},{...options,fetcher}));
  }
  for(const invalid of [{...plan,id:'other'},{...plan,paths:[]},{...plan,paths:'/'},null])
    await assert.rejects(refreshBunnyReleaseCache(invalid,{...options,fetcher}));
  await assert.rejects(refreshBunnyReleaseCache(plan,{...options,key:'',fetcher}),/Zugang/);
  assert.equal(calls,0);assert.deepEqual(bunnyCachePaths(plan,id),paths);
});
test('reviewed publication refreshes only the fixed sitemap files and the public IndexNow key alongside its pages',async()=>{
 const seoPaths=['/sitemap.xml','/image-sitemap.xml','/web-story-sitemap.xml','/1234567890abcdef1234567890abcdef.txt'],purged=[];
 const result=await refreshBunnyReleaseCache(plan,{...options,seoPaths,onPurged:path=>purged.push(path),fetcher:async url=>new URL(url).pathname==='/hub-release.json'?Response.json(marker):new Response('',{status:200})});
 assert.deepEqual(result,[...paths,...seoPaths]);assert.deepEqual(purged,result);
 for(const path of ['/robots.txt','/*','https://example.org/sitemap.xml','/sitemap.xml?q=1','/api/private/'])await assert.rejects(refreshBunnyReleaseCache(plan,{...options,seoPaths:[path],fetcher:()=>assert.fail('Must validate before network')}),/unzulässige/);
});

test('a stale public release or changed page list prevents all purges',async()=>{
  for(const value of [{...marker,id:'00000000-0000-4000-8000-000000000000'},
    {...marker,paths:[paths[0]]},{...marker,paths:[...paths,'/another/']},{...marker,siteId:'tfp'}]) {
    let calls=0;
    await assert.rejects(refreshBunnyReleaseCache(plan,{...options,fetcher:async(url,request)=>{
      calls++;assert.equal(request.headers.AccessKey,undefined);return Response.json(value);
    }}));assert.equal(calls,1);
  }
});

test('a rejected purge stops the release confirmation and never processes another page',async()=>{
  const processed=[];let posts=0;
  await assert.rejects(refreshBunnyReleaseCache(plan,{...options,onPurged:path=>processed.push(path),
    fetcher:async url=>new URL(url).pathname==='/hub-release.json'?Response.json(marker):(++posts,new Response('',{status:401})),
  }),error=>{assert.match(error.message,/HTTP 401/);assert.doesNotMatch(error.message,/fixture-secret/);return true;});
  assert.equal(posts,1);assert.deepEqual(processed,[]);
});

test('temporary rate limiting is retried with a bounded delay, persistent errors stop after three attempts',async()=>{
  for(const recover of [true,false]) {
    let posts=0;const waits=[];
    const operation=refreshBunnyReleaseCache({...plan,paths:[paths[0]]},{...options,
      wait:async ms=>waits.push(ms),fetcher:async url=>new URL(url).pathname==='/hub-release.json'
        ?Response.json({...marker,paths:[paths[0]]}):new Response('',{status:++posts===2&&recover?200:429}),
    });
    if(recover){assert.deepEqual(await operation,[paths[0]]);assert.equal(posts,2);assert.deepEqual(waits,[2000]);}
    else{await assert.rejects(operation,/HTTP 429/);assert.equal(posts,3);assert.deepEqual(waits,[2000,4000]);}
  }
});

test('timeouts are bounded and transport errors do not expose credentials',async()=>{
  let now=0,posts=0;
  await assert.rejects(refreshBunnyReleaseCache(plan,{...options,timeoutMs:2000,now:()=>now,wait:async ms=>{now+=ms;},
    fetcher:async url=>new URL(url).pathname==='/hub-release.json'?Response.json(marker):(++posts,new Response('',{status:503})),
  }),/Wartezeit/);assert.equal(posts,1);
  await assert.rejects(refreshBunnyReleaseCache(plan,{...options,wait:async()=>{},
    fetcher:async url=>{if(new URL(url).pathname==='/hub-release.json')return Response.json(marker);throw Error(key);},
  }),error=>{assert.match(error.message,/nicht erreichbar/);assert.doesNotMatch(error.message,/fixture-secret/);return true;});
});

test('the GitHub cache step requires a successful explicit production Hub deployment',async()=>{
  const workflow=await readFile(new URL('../.github/workflows/bunny-dev-image.yml',import.meta.url),'utf8');
  const cache=workflow.slice(workflow.indexOf('      - name: Refresh reviewed Hub pages in Bunny CDN'));
  assert.match(cache,/if: success\(\) && inputs\.deploy && inputs\.target == 'production' && startsWith\(github\.ref_name, 'hub-release\/'\)/);
  assert.match(cache,/run: node scripts\/refresh-hub-bunny-cache\.mjs/);
  assert.ok(workflow.indexOf('run: node scripts/deploy-hub-bunny.mjs')<workflow.indexOf(cache));
  assert.doesNotMatch(workflow,/^  (?:push|pull_request):/m);
});

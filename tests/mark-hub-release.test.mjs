import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {markHubRelease} from '../scripts/mark-hub-release.mjs';

test('Prepared website releases mark the homepage and reviewed routes as well as Hub content',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'hub-release-test-'));
  const id='00000000-0000-4000-8000-000000000123';
  try{
    await mkdir(join(dir,'src/data'),{recursive:true});
    for(const path of ['/','/portfolio/','/web-stories/test/']){
      await mkdir(join(dir,'dist',path),{recursive:true});
      await writeFile(join(dir,'dist',path,'index.html'),'<head><meta name="hub-release" content="old"></head><body>Website</body>');
    }
    await writeFile(join(dir,'src/data/hub-publications.json'),JSON.stringify([{path:'/web-stories/test/'}]));
    await writeFile(join(dir,'src/data/hub-deploy.json'),JSON.stringify({id,paths:['/','/portfolio/']}));
    await markHubRelease(id,dir);
    const marker=JSON.parse(await readFile(join(dir,'dist/hub-release.json'),'utf8'));
    assert.deepEqual(marker.paths,['/web-stories/test/','/','/portfolio/']);
    for(const path of marker.paths){
      const html=await readFile(join(dir,'dist',path,'index.html'),'utf8');
      assert.equal(html.match(/name="hub-release"/g).length,1);assert.ok(html.includes(id));
    }
    await writeFile(join(dir,'src/data/hub-deploy.json'),JSON.stringify({id:'other',paths:['/']}));
    await assert.rejects(markHubRelease(id,dir),/does not match/);
    await writeFile(join(dir,'src/data/hub-deploy.json'),JSON.stringify({id,paths:['/../private/']}));
    await assert.rejects(markHubRelease(id,dir),/Invalid Hub page/);
  }finally{await rm(dir,{recursive:true,force:true});}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,access,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import sharp from 'sharp';

const run=promisify(execFile);
const converter=new URL('../scripts/convert-delivered-jpegs-to-webp.mjs',import.meta.url).pathname;

test('WebP build preserves exact Google post JPEGs and still converts or removes normal JPEGs',async()=>{
  const root=await mkdtemp(join(tmpdir(),'artbild-google-media-'));
  try{
    const dist=join(root,'dist'),folder='hub-assets/12345678-1234-4234-8234-123456789abc';
    await mkdir(join(dist,folder),{recursive:true});
    const photo=await sharp({create:{width:320,height:320,channels:3,background:'#c4a57a'}}).jpeg().toBuffer();
    const google=folder+'/fotogeschichte-0123456789abcdef-google.jpg';
    for(const name of [google,'portrait.jpg','unused.jpg',folder+'/unrelated-google.jpg'])await writeFile(join(dist,name),photo);
    await writeFile(join(dist,'index.html'),'<img src="/portrait.jpg"><a href="/'+google+'">Google-Foto</a>');
    await run(process.execPath,[converter],{cwd:root});
    assert.deepEqual(await readFile(join(dist,google)),photo);
    const html=await readFile(join(dist,'index.html'),'utf8');
    assert.ok(html.includes('/portrait.webp'));assert.ok(html.includes('/'+google));
    assert.equal((await sharp(join(dist,'portrait.webp')).metadata()).format,'webp');
    for(const name of ['portrait.jpg','unused.jpg',folder+'/unrelated-google.jpg'])await assert.rejects(access(join(dist,name)));
    // The export is fetched by Google even when no website page links to it.
    await writeFile(join(dist,'index.html'),'<img src="/portrait.webp">');
    await run(process.execPath,[converter],{cwd:root});
    assert.deepEqual(await readFile(join(dist,google)),photo);
  }finally{await rm(root,{recursive:true,force:true});}
});

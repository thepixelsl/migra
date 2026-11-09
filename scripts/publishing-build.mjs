import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {publishingBuildEnvironment} from './lib/publishing-seo.mjs';
const config=JSON.parse(await readFile(new URL('../src/data/publishing-config.json',import.meta.url),'utf8'));
const env=publishingBuildEnvironment(config,process.env);
const child=spawn('npm',['run','build:site'],{env,stdio:'inherit',shell:false});
child.on('error',()=>{console.error('Der Website-Build konnte nicht gestartet werden.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});

/* hub-content-removals */
child.on('exit',async code=>{if(code!==0)return;try{const {finalizeContentRemovals}=await import('./hub-content-output.mjs');await finalizeContentRemovals(new URL('..',import.meta.url).pathname);await new Promise((resolve,reject)=>{const seo=spawn('npm',['run','publishing:seo'],{env,stdio:'inherit',shell:false});seo.on('error',reject);seo.on('exit',code=>code===0?resolve():reject(Error('SEO-Löschprüfung fehlgeschlagen')));});}catch(e){console.error(e);process.exitCode=1;}});

import {createHash} from 'node:crypto';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {join,relative} from 'node:path';

export const publishingOrigins={artbild:'https://artbild-fotografie.de',tfp:'https://tfp.hamburg'};
const digest=value=>createHash('sha256').update(value).digest('hex');
const decode=value=>value.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi,m=>{
 const key=m.slice(1,-1).toLowerCase(),named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
 if(key in named)return named[key];const n=Number.parseInt(key.startsWith('#x')?key.slice(2):key.slice(1),key.startsWith('#x')?16:10);
 return n>0&&n<=0x10ffff?String.fromCodePoint(n):m;
});
function elements(html,names='a|link|meta|img|amp-img|source'){
 const clean=html.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 return [...clean.matchAll(new RegExp('<('+names+')\\b((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>','gi'))].map(m=>{
  const a={};for(const v of m[2].matchAll(/([^\s=\/<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g))a[v[1].toLowerCase()]=decode(v[2]??v[3]??v[4]??'');
  return {tag:m[1].toLowerCase(),a};
 });
}
export function validModified(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))return null;
 const time=Date.parse(value);return Number.isFinite(time)&&time<=Date.now()?new Date(time).toISOString():null;
}
const latest=values=>values.map(validModified).filter(Boolean).sort().at(-1)||null;
function structured(html){
 const values=[];
 for(const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  try{values.push(JSON.parse(m[1]));}catch{}
 }
 return values;
}
function withoutDates(value){
 if(Array.isArray(value))return value.map(withoutDates);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(k=>!['dateModified','datePublished'].includes(k)).map(k=>[k,withoutDates(value[k])]));
 return value;
}
export function inspectSeoPage(html,url){
 const tags=elements(html),head=elements(html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]||'');
 const canonical=head.filter(v=>v.tag==='link'&&(v.a.rel||'').toLowerCase().split(/\s+/).includes('canonical'));
 if(canonical.length!==1)return null;
 let target;try{target=new URL(canonical[0].a.href,url);}catch{return null;}
 if(target.origin!==new URL(url).origin||target.href!==url)return null;
 if(head.some(v=>v.tag==='meta'&&['robots','googlebot','bingbot'].includes(v.a.name?.toLowerCase())&&/\b(noindex|none)\b/i.test(v.a.content||'')))return null;
 const schema=structured(html),dates=[];
 function visit(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='dateModified')dates.push(x);else if(typeof x==='object')visit(x);}}
 schema.forEach(visit);
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]||html;
 const text=decode(main.replace(/<!--[\s\S]*?-->|<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
 const contentMedia=elements(main).filter(v=>['img','amp-img','source'].includes(v.tag)).map(({a})=>({src:a.src,srcset:a.srcset,alt:a.alt}));
 const links=tags.filter(v=>v.tag==='a'&&v.a.href&&!/\b(nofollow|ugc|sponsored)\b/i.test(v.a.rel||'')).map(v=>v.a.href);
 const mainLinks=elements(main,'a').map(v=>v.a.href).filter(Boolean);
 const title=decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'').trim();
 const description=head.find(v=>v.a.name?.toLowerCase()==='description')?.a.content||'';
 return {url,path:new URL(url).pathname,title,hash:digest(JSON.stringify({text,title,description,contentMedia,mainLinks,schema:withoutDates(schema)})),modified:latest(dates),links};
}
async function htmlFiles(folder){
 const files=[];
 for(const entry of await readdir(folder,{withFileTypes:true})){
  const file=join(folder,entry.name);
  if(entry.isDirectory())files.push(...await htmlFiles(file));else if(entry.isFile()&&entry.name.endsWith('.html'))files.push(file);
 }
 return files;
}
async function json(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
export function auditInternalLinks(pages,{existingPaths=[],redirects={}}={}){
 const byPath=new Map(pages.map(p=>[p.path,p])),incoming=new Map(pages.map(p=>[p.path,new Set()])),broken=new Map();
 const known=new Set([...existingPaths,...byPath.keys()]);
 for(const page of pages)for(const href of page.links){
  let url;try{url=new URL(href,page.url);}catch{continue;}
  if(url.origin!==new URL(page.url).origin||!['http:','https:'].includes(url.protocol))continue;
  let path=url.pathname;
  if(/\.[a-z0-9]+$/i.test(path)&&!path.endsWith('.html'))continue;
  if(/^\/(api|admin[^/]*|go)(\/|$)/.test(path))continue;
  const visited=new Set();while(redirects[path]&&!visited.has(path)){visited.add(path);path=redirects[path];}
  if(!known.has(path)&&!path.endsWith('/')&&known.has(path+'/'))path+='/';
  if(byPath.has(path)&&path!==page.path)incoming.get(path).add(page.path);
  if(!known.has(path)){const key=page.path+'\0'+path;broken.set(key,{from:page.path,to:path});}
 }
 const orphaned=pages.filter(p=>p.path!=='/'&&!incoming.get(p.path).size).map(p=>({path:p.path,title:p.title}));
 return {checkedPages:pages.length,orphaned,broken:[...broken.values()],incoming:Object.fromEntries([...incoming].map(([p,s])=>[p,[...s].sort()]))};
}
export async function buildPublishingSeo(project,site,{previous,revisionDates={},sourceDate=null}={}){
 const origin=publishingOrigins[site];if(!origin)throw Error('Unbekannte Website.');
 const config=await json(join(project,'src/data/publishing-config.json'),null);
 if(!config||!/^[a-f0-9]{32}$/.test(config.key))throw Error('Der IndexNow-Schlüssel der Website fehlt.');
 const runtimePaths=config.runtimePaths||[];
 if(!Array.isArray(runtimePaths)||runtimePaths.some(path=>typeof path!=='string'||!/^\/(?:[a-z0-9-]+\/)*$/.test(path)))throw Error('Die bestätigten Laufzeitrouten der Website sind ungültig.');
 previous=previous||await json(join(project,'src/data/publishing-baseline.json'),{pages:{}});
 const dateFile=await json(join(project,'src/data/publishing-revisions.json'),{});
 sourceDate=sourceDate||dateFile._sourceDate||null;
 const pages=[],existingPaths=[...runtimePaths],redirects={};
 for(const file of await htmlFiles(join(project,'dist'))){
  const name=relative(join(project,'dist'),file).split('\\').join('/'),path='/'+name.replace(/index\.html$/,'');
  if(path==='/404.html'||/^\/(api|admin[^/]*)(\/|$)/.test(path))continue;
  existingPaths.push(path);const html=await readFile(file,'utf8');
  const page=inspectSeoPage(html,origin+path);
  if(page)pages.push(page);else{
   const target=elements(html,'link').find(v=>(v.a.rel||'').toLowerCase()==='canonical')?.a.href;
   try{const url=new URL(target);if(url.origin===origin)redirects[path]=url.pathname;}catch{}
  }
 }
 try{for(const line of (await readFile(join(project,'public/_redirects'),'utf8')).split('\n')){
  const parts=line.trim().split(/\s+/);if(parts.length>=2&&parts[0].startsWith('/')&&parts[1].startsWith('/')&&!parts[0].includes('*')&&!parts[1].includes(':'))redirects[parts[0]]=parts[1];
 }}catch(e){if(e.code!=='ENOENT')throw e;}
 const manifest={version:1,site,pages:{},changed:[],removed:[],links:auditInternalLinks(pages,{existingPaths,redirects})};
 for(const page of pages){
  const old=previous.pages?.[page.path],same=old?.hash===page.hash;
  let modified=same?(validModified(old.lastmod)||null):latest([revisionDates[page.path],dateFile[page.path],sourceDate,page.modified]);
  if(old&&!same&&old.lastmod&&modified<=old.lastmod)modified=null;
  manifest.pages[page.path]={hash:page.hash,lastmod:modified,title:page.title};
  if(!same)manifest.changed.push(page.path);
 }
 manifest.removed=Object.keys(previous.pages||{}).filter(path=>!manifest.pages[path]);
 // Keep image sitemap contents intact. Only annotate existing canonical URL entries.
 for(const name of ['sitemap.xml','image-sitemap.xml','web-story-sitemap.xml']){
  const file=join(project,'dist',name);let xml;
  try{xml=await readFile(file,'utf8');}catch(e){if(e.code==='ENOENT')continue;throw e;}
  const seen=new Set();
  xml=xml.replace(/<url>\s*<loc>([^<]+)<\/loc>([\s\S]*?)<\/url>/g,(_,loc,rest)=>{
   let path;try{const u=new URL(decode(loc));if(u.origin!==origin)return '';path=u.pathname;}catch{return '';}
   const entry=manifest.pages[path];if(!entry||seen.has(path))return '';seen.add(path);
   return '<url><loc>'+escape(origin+path)+'</loc>'+(entry.lastmod?'<lastmod>'+entry.lastmod+'</lastmod>':'')+rest.replace(/\s*<lastmod>[^<]*<\/lastmod>/g,'')+'</url>';
  });
  await writeFile(file,xml);
 }
 await mkdir(join(project,'dist'),{recursive:true});
 await writeFile(join(project,'dist',config.key+'.txt'),config.key+'\n');
 await writeFile(join(project,'dist/publishing-manifest.json'),JSON.stringify(manifest,null,2));
 return manifest;
}

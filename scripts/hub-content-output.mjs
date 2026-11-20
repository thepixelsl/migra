import {readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
const read=async file=>{try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}};
export async function finalizeContentRemovals(project){
 const manifest=await read(join(project,'public/hub-content-removals.json'));if(!manifest?.routes?.length)return;
 const paths=new Set(manifest.routes.map(r=>r.path));
 if([...paths].some(p=>p==='/'||!/^\/(?:[a-z0-9-]+\/)+$/.test(p)||/^\/(?:api|admin[^/]*|hub[^/]*)(?:\/|$)/.test(p)))throw Error('Ungültige gelöschte Adresse.');
 for(const path of paths)await rm(join(project,'dist',path),{recursive:true,force:true});
 const retired=value=>{try{const u=new URL(value,manifest.origin);return u.origin===manifest.origin&&paths.has(u.pathname.replace(/\/+$/,'')+'/');}catch{return false;}};
 const moved=value=>{
  try{
   const url=new URL(value,manifest.origin),row=manifest.routes.find(r=>r.path===url.pathname.replace(/\/+$/,'')+'/');
   if(url.origin!==manifest.origin||row?.kind!=='address-change'||!row.target)return null;
   const target=new URL(row.target,manifest.origin);target.search=url.search;target.hash=url.hash;
   return /^https?:\/\//i.test(value)?target.href:target.pathname+target.search+target.hash;
  }catch{return null;}
 };
 const cleanJson=value=>{
  if(Array.isArray(value))return value.filter(v=>!(v&&typeof v==='object'&&[v.url,v['@id'],typeof v.item==='string'?v.item:v.item?.url].some(x=>typeof x==='string'&&retired(x)&&!moved(x)))).map(cleanJson);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,cleanJson(v)]));
  return typeof value==='string'?moved(value)||value:value;
 };
 async function visit(folder){for(const entry of await readdir(folder,{withFileTypes:true})){
  if(entry.isSymbolicLink())throw Error('Link im Website-Build ist nicht erlaubt.');
  const file=join(folder,entry.name);
  if(entry.isDirectory())await visit(file);
  else if(entry.name.endsWith('.html')){
   let html=await readFile(file,'utf8');
   html=html.replace(/<a\b([^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*)>[\s\S]*?<\/a\s*>/gi,(m,_attrs,double,single)=>{
    const href=(double??single).replace(/&amp;/g,'&'),target=moved(href);
    if(target)return m.replace(/\bhref\s*=\s*(?:"[^"]*"|'[^']*')/i,'href="'+target.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;')+'"');
    return retired(href)?'':m;
   });
   html=html.replace(/<script\b([^>]*type=["']application\/ld\+json["'][^>]*)>([\s\S]*?)<\/script>/gi,(m,attrs,json)=>{try{return '<script'+attrs+'>'+JSON.stringify(cleanJson(JSON.parse(json)))+'</script>';}catch{return m;}});
   await writeFile(file,html);
  }else if(entry.name.endsWith('.xml')){
   let xml=await readFile(file,'utf8');xml=xml.replace(/<url\b[^>]*>[\s\S]*?<\/url>/gi,m=>{const loc=m.match(/<loc>\s*([^<]+)\s*<\/loc>/i)?.[1];return loc&&retired(loc.replace(/&amp;/g,'&'))?'':m;});await writeFile(file,xml);
  }
 }}
 await visit(join(project,'dist'));
}

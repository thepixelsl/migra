import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
export async function markHubRelease(id,project=process.cwd()) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid Hub release ID');
  const entries = JSON.parse(await readFile(join(project,'src/data/hub-publications.json'),'utf8'));
  let plan;
  try {plan=JSON.parse(await readFile(join(project,'src/data/hub-deploy.json'),'utf8'));}
  catch(e){if(e.code!=='ENOENT')throw e;}
  if(plan && (plan.id!==id || !Array.isArray(plan.paths) || !plan.paths.length))throw new Error('Hub deployment plan does not match this release');
  const paths=[...new Set([...entries.map(entry=>entry.path),...(plan?.paths||[])])];
  if(!paths.length || !paths.every(path=>typeof path==='string' && /^\/(?:[a-z0-9-]+\/)*$/.test(path) && !/^\/(?:api|admin[^/]*)(?:\/|$)/.test(path)))throw new Error('Invalid Hub page path');
  const root = resolve(project,'dist');
  for(const path of paths) {
    const file=join(root,path,'index.html');
    const html=await readFile(file,'utf8');
    if(!html.includes('</head>'))throw new Error('Hub page has no head');
    await writeFile(file,html.replace(/<meta name="hub-release" content="[^"]*">/g,'').replace('</head>','<meta name="hub-release" content="'+id+'"></head>'));
  }
  await writeFile(join(root,'hub-release.json'),JSON.stringify({id,siteId:'artbild',paths}));
}
if(process.env.HUB_RELEASE_ID)await markHubRelease(process.env.HUB_RELEASE_ID);

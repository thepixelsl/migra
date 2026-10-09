import { readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const id = process.env.HUB_RELEASE_ID;
if (id) {
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error('Invalid Hub release ID');
  const entries = JSON.parse(await readFile('src/data/hub-publications.json','utf8'));
  const root = resolve('dist');
  for(const entry of entries) {
    if(!/^\/(?:gallery\/|web-stories\/)?[a-z0-9-]+\/$/.test(entry.path)) throw new Error('Invalid Hub page path');
    const file=join(root,entry.path,'index.html');
    const html=await readFile(file,'utf8');
    await writeFile(file,html.replace('</head>','<meta name="hub-release" content="'+id+'"></head>'));
  }
  await writeFile(join(root,'hub-release.json'),JSON.stringify({id,siteId:'artbild',paths:entries.map(v=>v.path)}));
}

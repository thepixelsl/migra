import {readFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {buildPublishingSeo} from './lib/publishing-seo.mjs';
const project=process.cwd();
let previous,revisionDates={},sourceDate=null;
if(process.env.HUB_SEO_PREVIOUS)previous=JSON.parse(await readFile(process.env.HUB_SEO_PREVIOUS,'utf8'));
if(process.env.HUB_SEO_REVISIONS)revisionDates=JSON.parse(await readFile(process.env.HUB_SEO_REVISIONS,'utf8'));
const result=await buildPublishingSeo(project,'artbild',{previous,revisionDates,sourceDate});
console.log(JSON.stringify({publishingSeo:{pages:Object.keys(result.pages).length,lastmodPages:Object.values(result.pages).filter(p=>p.lastmod).length,changed:result.changed.length,orphans:result.links.orphaned.length,brokenLinks:result.links.broken.length}}));

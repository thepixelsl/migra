import {readFile} from 'node:fs/promises';
import {refreshBunnyReleaseCache} from './hub-bunny-cache.mjs';

const plan=JSON.parse(await readFile(new URL('../src/data/hub-deploy.json',import.meta.url),'utf8'));
const paths=await refreshBunnyReleaseCache(plan,{
  releaseId:process.env.HUB_RELEASE_ID,key:process.env.BUNNYNET_API_KEY,
  onPurged:path=>console.log('Bunny-Cache aktualisiert: '+path),
});
console.log('Gezielter Bunny-Cache-Abgleich abgeschlossen: '+paths.length+' Seiten.');

import { churchDirectoryData } from '../../data/kirchen';
export const prerender=true;
export function GET(){
  const siteUrl=(import.meta.env.SITE||'https://artbild-fotografie.de').replace(/\/$/,'');
  return new Response(JSON.stringify(churchDirectoryData(siteUrl),null,2),{headers:{'Content-Type':'application/json; charset=utf-8'}});
}

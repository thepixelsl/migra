import {writeFile} from 'node:fs/promises';
import {retainRegistry} from './provider-registry-retention.mjs';
const result=await retainRegistry({token:process.env.GITHUB_TOKEN,key:process.env.BUNNYNET_API_KEY,currentRelease:process.env.CURRENT_RELEASE,rollbackRelease:process.env.ROLLBACK_RELEASE,apply:process.env.APPLY_RETENTION==='true'});
await writeFile('provider-retention.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({before:result.before,after:result.after,planned:result.planned.length,deleted:result.deleted.length,protected:result.protected.length,applied:result.applied}));

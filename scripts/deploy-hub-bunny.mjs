import {deployBunnyRelease} from './lib/bunny-release.mjs';
const {BUNNYNET_API_KEY:key,HUB_IMAGE_TAG:tag,HUB_IMAGE_DIGEST:digest,HUB_RELEASE_ID:id}=process.env;
await deployBunnyRelease({key,tag,digest,id});

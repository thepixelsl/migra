import {finalizeContentRemovals} from './hub-content-output.mjs';
await finalizeContentRemovals(new URL('..',import.meta.url).pathname);

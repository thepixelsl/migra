import test from 'node:test';
import assert from 'node:assert/strict';
import {confirmedBunnyState} from '../scripts/hub-bunny-state.mjs';
test('Hub release requires active new pods, immutable image and removal of previous pods',()=>{
  const expected={tag:'prod-sha-test',digest:'sha256:test',oldPods:['old']};
  const config={status:'active',containerTemplates:[{id:'web',name:'web',imageTag:expected.tag,imageDigest:expected.digest}],
    containerInstances:[{templateId:'web',podId:'new'}]};
  const overview={status:'active',regions:[{pods:[{status:'ready',containers:[{status:'ready',image:'ghcr.io/site@sha256:test'}]}]}]};
  assert.equal(confirmedBunnyState(config,overview,expected),true);
  assert.equal(confirmedBunnyState({...config,status:'progressing'},overview,expected),false);
  assert.equal(confirmedBunnyState({...config,containerInstances:[{templateId:'web',podId:'old'}]},overview,expected),false);
  assert.equal(confirmedBunnyState(config,{...overview,regions:[{pods:[{status:'deleting',containers:[]}]}]},expected),false);
  assert.equal(confirmedBunnyState(config,overview,{...expected,digest:'sha256:other'}),false);
});

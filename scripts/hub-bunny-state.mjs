export function confirmedBunnyState(config,overview,{tag,digest,oldPods=[]}) {
  const selected=config.containerTemplates?.filter(v=>v.name==='web');
  if(config.status!=='active' || overview.status!=='active' || selected?.length!==1 ||
    selected[0].imageTag!==tag || selected[0].imageDigest!==digest)return false;
  const instances=config.containerInstances?.filter(v=>v.templateId===selected[0].id);
  if(!instances?.length || instances.some(v=>oldPods.includes(v.podId)))return false;
  const pods=(overview.regions||[]).flatMap(v=>v.pods||[]);
  return pods.length>0 && pods.every(p=>p.status==='ready' && p.containers?.length>0 &&
    p.containers.every(c=>c.status==='ready') && p.containers.some(c=>
      [c.image,c.imageDisplay].some(image=>typeof image==='string' && (image.includes(digest)||image.includes(tag)))));
}

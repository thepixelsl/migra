// Shared by the private preview, Bunny and the generated Pages Worker.
export function contentRemovalResponse(request,manifest,{previewPrefix=''}={}) {
 if(!['GET','HEAD'].includes(request.method)||!manifest?.routes?.length)return null;
 const url=new URL(request.url),path=url.pathname.replace(/\/+$/,'')+'/';
 const row=manifest.routes.find(r=>r.path===path);
 if(!row)return null;
 const headers={'Cache-Control':'no-store','X-Hub-Release':manifest.id,'X-Content-Type-Options':'nosniff'};
 if(row.target){
  const target=new URL(row.target,manifest.origin);
  if(row.kind==='address-change')target.search=url.search;
  return new Response(null,{status:301,headers:{...headers,Location:previewPrefix?previewPrefix+target.pathname+target.search:target.href}});
 }
 const home=previewPrefix?previewPrefix+'/':manifest.origin+'/';
 const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><meta name="hub-release" content="${manifest.id}"><title>Dieser Beitrag wurde entfernt</title><style>body{margin:0;background:#f4f1ea;color:#171815;font:18px/1.6 system-ui,sans-serif}main{max-width:680px;margin:12vh auto;padding:32px}small{letter-spacing:.12em}h1{font:clamp(36px,7vw,64px)/1.1 Georgia,serif;margin:24px 0}a{display:inline-block;background:#20231c;color:white;padding:14px 22px;margin-top:20px;text-decoration:none}</style></head><body><main><small>BEITRAG ENTFERNT · 410</small><h1>Dieser Beitrag ist nicht mehr verfügbar.</h1><p>Der Inhalt wurde dauerhaft entfernt. Auf unserer Homepage findest du aktuelle Informationen und weitere Beiträge.</p><a href="${home}">Zur Homepage</a></main></body></html>`;
 return new Response(request.method==='HEAD'?null:html,{status:410,headers:{...headers,'Content-Type':'text/html; charset=utf-8'}});
}

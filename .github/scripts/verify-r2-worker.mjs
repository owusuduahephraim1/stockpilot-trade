import fs from 'node:fs';
const {CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,WORKER_NAME:name}=process.env;
if(!token||!account||!name)throw Error('Worker verification variables missing');
const base='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers';
async function cf(endpoint){
 const r=await fetch(base+endpoint,{headers:{Authorization:'Bearer '+token}});
 const body=await r.json();
 if(!r.ok||!body.success)throw Error('Cloudflare Worker lookup failed: '+JSON.stringify(body.errors||[]));
 return body.result;
}
const [{subdomain},script]=await Promise.all([cf('/subdomain'),cf('/scripts/'+encodeURIComponent(name)+'/subdomain')]);
if(!subdomain)throw Error('Cloudflare workers.dev account subdomain is not enabled');
if(!script.enabled)throw Error('The deployed Worker is not enabled on workers.dev');
const endpoint='https://'+name+'.'+subdomain+'.workers.dev';
let healthy=false;
for(let attempt=0;attempt<4;attempt++){
 try {
  const r=await fetch(endpoint+'/health',{signal:AbortSignal.timeout(12000)});
  const j=await r.json();
  if(r.ok&&j.status==='ok'&&j.storage==='r2'){healthy=true;break;}
 }catch(e){console.log('Health check attempt '+(attempt+1)+' was not successful.');}
 await new Promise(r=>setTimeout(r,1500));
}
if(!healthy)throw Error('Worker /health check did not pass');
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Cloudflare R2 Worker deployed\n\nWorker URL: '+endpoint+'\n\nPrivate R2 bucket is bound to the Worker. GitHub Pages rebuild will be requested.\n');
console.log('Cloudflare Worker verified:',endpoint);

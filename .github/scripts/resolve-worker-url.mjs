import fs from 'node:fs';
const token=process.env.CLOUDFLARE_API_TOKEN;
const account=process.env.CLOUDFLARE_ACCOUNT_ID;
let base=(process.env.OVERRIDE_API_BASE_URL||'').replace(/\/$/,'');
if(token&&account){
 try{
  const url='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/workers';
  const heads={Authorization:'Bearer '+token};
  const [a,b]=await Promise.all([
   fetch(url+'/subdomain',{headers:heads}),
   fetch(url+'/scripts/stockpilot-trade-api/subdomain',{headers:heads})
  ]);
  const [sub,script]=await Promise.all([a.json(),b.json()]);
  if(a.ok&&b.ok&&sub.success&&script.success&&script.result.enabled&&sub.result.subdomain){
   base='https://stockpilot-trade-api.'+sub.result.subdomain+'.workers.dev';
  } else console.log('Cloudflare Worker URL not yet available; retaining configured API base if any.');
 }catch(e){console.log('Cloudflare Worker could not be discovered; retaining configured API base if any.');}
}
if(base&&!/^https:\/\/[a-z0-9.-]+(?:\/[a-z0-9/_-]*)?$/i.test(base))throw Error('Invalid API base URL format');
fs.appendFileSync(process.env.GITHUB_ENV,'VITE_API_BASE_URL='+base+'\n');
console.log(base?'Frontend API origin configured: '+base:'Frontend API origin not yet configured. R2 operations remain unavailable.');

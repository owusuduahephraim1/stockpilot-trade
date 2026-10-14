// Create-only, idempotent R2 provisioning. The bucket must stay private.
const {CLOUDFLARE_API_TOKEN:token,CLOUDFLARE_ACCOUNT_ID:account,BUCKET_NAME:bucket}=process.env;
if(!token||!account||!bucket)throw Error("Cloudflare CI credentials or bucket name missing");
const api='https://api.cloudflare.com/client/v4/accounts/'+encodeURIComponent(account)+'/r2/buckets';
async function request(url,opts={}) {
 const res=await fetch(url,{...opts,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...(opts.headers||{})}});
 let j; try{j=await res.json()}catch{j={};}
 return {res,j};
}
const result=await request(api+'/'+encodeURIComponent(bucket));
if(result.res.ok&&result.j.success){
 console.log("R2 bucket already exists:",bucket);
}else if(result.res.status===404) {
 console.log("Provisioning private R2 bucket:",bucket);
 const cr=await request(api,{method:'POST',body:JSON.stringify({name:bucket})});
 if(!cr.res.ok||!cr.j.success)throw Error("R2 create failed: "+JSON.stringify(cr.j.errors||cr.j.messages||[]));
 console.log("R2 bucket created:",bucket);
}else{
 throw Error("Cannot verify existing R2 bucket; check Workers R2 Storage Edit permission: "+JSON.stringify(result.j.errors||[]));
}

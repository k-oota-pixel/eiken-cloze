import test from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';process.env.ADMIN_EMAIL='admin@example.test';
const nativeFetch=globalThis.fetch;let googleCalls=0,geminiCalls=0;
globalThis.fetch=async(url,options)=>{
  if(String(url).includes('identitytoolkit.googleapis.com')){
    googleCalls++;const idToken=JSON.parse(options.body).idToken;
    if(idToken.endsWith('.rejected'))return new Response('{}',{status:400});
    return new Response(JSON.stringify({users:[{localId:'student',email:'admin@example.test',emailVerified:!idToken.endsWith('.unverified')}]}));
  }
  if(String(url).includes('generativelanguage.googleapis.com')){geminiCalls++;throw Error('Unexpected AI request');}
  return nativeFetch(url,options);
};
const claims=Buffer.from(JSON.stringify({aud:'eiken-retry',iss:'https://securetoken.google.com/eiken-retry',sub:'student'})).toString('base64url');
const headers={'Content-Type':'application/json',Authorization:`Bearer header.${claims}.accepted`,Origin:'https://k-oota-pixel.github.io'};
for(const [repo,file,routes] of [["eiken-cloze","server.js",["/api/grade"]]]){
 test(repo+' authenticates every AI route before validation, quota or upstream calls',async()=>{
  const {server}=await import(`./${file}`);await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const base='http://127.0.0.1:'+server.address().port;
  try{
   for(const route of routes){
    for(const auth of ['', 'Bearer fake', `Bearer header.${claims}.rejected`]){
     const response=await nativeFetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:auth}:{})},body:'{}'});
     assert.equal(response.status,401,route);await response.text();
    }
    const valid=await nativeFetch(base+route,{method:'POST',headers,body:'{}'});assert.notEqual(valid.status,401,route);assert.notEqual(valid.status,403,route);await valid.text();
    const preflight=await nativeFetch(base+route,{method:'OPTIONS',headers:{Origin:headers.Origin,'Access-Control-Request-Headers':'authorization,x-firebase-appcheck'}});
    assert.equal(preflight.status,204);assert.match(preflight.headers.get('access-control-allow-headers'),/Authorization/);assert.match(preflight.headers.get('access-control-allow-headers'),/X-Firebase-AppCheck/);
   }
   const helper=await nativeFetch(base+'/firebase-security.js');assert.equal(helper.status,200);assert.match(helper.headers.get('content-type'),/javascript/);await helper.text();
   if(repo==='task-quest'){
    const denied=await nativeFetch(base+'/api/admin/session',{headers:{Authorization:`Bearer header.${claims}.unverified`}});assert.equal(denied.status,403);await denied.text();
    const allowed=await nativeFetch(base+'/api/admin/session',{headers});assert.equal(allowed.status,200);await allowed.text();
   }
   assert.equal(geminiCalls,0);
  }finally{await new Promise(r=>server.close(r));}
 });
}

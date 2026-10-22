import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('./firebase-security.js',import.meta.url),'utf8').replace(/^import .*\n/gm,'').replace(/export /g,'');
function setup({signedIn=true,siteKey='',appCheckFails=false}={}){
 let ready=false,initialized=0;const app={};
 const context=vm.createContext({APP_CHECK_SITE_KEY:siteKey,getApps:()=>[app],getApp:()=>app,initializeApp:()=>app,getAuth:()=>({authStateReady:async()=>{ready=true;},currentUser:signedIn?{getIdToken:async()=>{assert.ok(ready);return 'firebase-id-token';}}:null}),initializeAppCheck:()=>{initialized++;return {};},ReCaptchaEnterpriseProvider:class{},getToken:async()=>{if(appCheckFails)throw Error('unavailable');return {token:'app-check-token'};},console:{warn(){}},setTimeout,clearTimeout});
 vm.runInContext(source+'\nthis.getHeaders=apiHeaders;',context);
 return {getHeaders:context.getHeaders,count:()=>initialized};
}
test('existing login is restored before token acquisition; no sign-in popup is triggered',async()=>{const s=setup();const headers=await s.getHeaders();assert.equal(headers.Authorization,'Bearer firebase-id-token');assert.equal(headers['X-Firebase-AppCheck'],undefined);});
test('guest sees login guidance before any AI request',async()=>{await assert.rejects(setup({signedIn:false}).getHeaders(),/ログイン/);});
test('registered App Check is initialized once and sends its token',async()=>{const s=setup({siteKey:'public-site-key'});assert.equal((await s.getHeaders())['X-Firebase-AppCheck'],'app-check-token');await s.getHeaders();assert.equal(s.count(),1);});
test('attestation failure leaves authenticated requests usable in monitoring rollout',async()=>{const headers=await setup({siteKey:'key',appCheckFails:true}).getHeaders();assert.equal(headers.Authorization,'Bearer firebase-id-token');assert.equal(headers['X-Firebase-AppCheck'],undefined);});

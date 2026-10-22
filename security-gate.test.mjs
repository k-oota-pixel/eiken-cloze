import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSecurityGate} from './security-gate.mjs';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key-1'};
const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
const seconds=Math.floor(Date.now()/1000);
const appClaims={iss:'https://firebaseappcheck.googleapis.com/231308672297',aud:['projects/231308672297'],sub:'1:231308672297:web:5e8b8ede3a0246c2318b38',iat:seconds,exp:seconds+3600};
function jwt(claims,header={alg:'RS256',typ:'JWT',kid:'key-1'}){const unsigned=encode(header)+'.'+encode(claims);return unsigned+'.'+sign('RSA-SHA256',Buffer.from(unsigned),privateKey).toString('base64url');}
const idToken=jwt({aud:'eiken-retry',iss:'https://securetoken.google.com/eiken-retry',sub:'student',exp:seconds+3600});
const req=(headers={})=>({headers,url:'/api/grade'});
function setup({mode='monitor',user={localId:'student',email:'student@example.test',emailVerified:true},status=200,offline=false}={}){
 let calls=0;const logs=[];
 const gate=createSecurityGate({env:{APP_CHECK_MODE:mode},log:s=>logs.push(JSON.parse(s)),fetchImpl:async url=>{calls++;if(offline)throw Error('offline');return String(url).includes('/jwks')?new Response(JSON.stringify({keys:[jwk]}),{headers:{'cache-control':'max-age=3600'}}):new Response(JSON.stringify({users:[user]}),{status});}});
 return {...gate,logs,calls:()=>calls};
}
test('missing/malformed credentials fail without a Google request',async()=>{const g=setup();for(const h of [{},{authorization:'Basic no'},{authorization:'Bearer nonsense'}])await assert.rejects(g.verifyUser(req(h)),{status:401});assert.equal(g.calls(),0);});
test('valid ID token uses authoritative Google user and request-local cache',async()=>{const g=setup(),r=req({authorization:'Bearer '+idToken});assert.deepEqual(await g.verifyUser(r),{uid:'student',email:'student@example.test',displayName:'',emailVerified:true});await g.verifyUser(r);assert.equal(g.calls(),1);});
test('foreign project, disabled, mismatched UID and rejected tokens fail closed',async()=>{for(const opts of [{user:{localId:'other',email:'x@y.test'}},{user:{localId:'student',email:'x@y.test',disabled:true}},{status:400}])await assert.rejects(setup(opts).verifyUser(req({authorization:'Bearer '+idToken})),{status:401});await assert.rejects(setup().verifyUser(req({authorization:'Bearer '+jwt({aud:'other',sub:'student'})})),{status:401});});
test('verification outage is retryable, never bypasses authentication',async()=>{await assert.rejects(setup({offline:true}).verifyUser(req({authorization:'Bearer '+idToken})),{status:503});});
test('monitor records missing/invalid/valid attestations and permits use',async()=>{const g=setup();assert.equal(await g.checkApp(req()),'missing');assert.equal(await g.checkApp(req({'x-firebase-appcheck':'invalid'})),'invalid');assert.equal(await g.checkApp(req({'x-firebase-appcheck':jwt(appClaims)})),'valid');assert.deepEqual(g.logs.map(l=>l.state),['missing','invalid','valid']);assert.ok(!JSON.stringify(g.logs).includes(idToken));});
test('enforcement rejects forged/expired/wrong-project/wrong-app/wrong-algorithm tokens',async()=>{const g=setup({mode:'enforce'});await assert.rejects(g.checkApp(req()),{status:401});for(const c of [{...appClaims,exp:seconds-1},{...appClaims,iss:'wrong'},{...appClaims,aud:['projects/other']},{...appClaims,sub:'another-app'}])await assert.rejects(g.checkApp(req({'x-firebase-appcheck':jwt(c)})),{status:401});const good=jwt(appClaims);await assert.rejects(g.checkApp(req({'x-firebase-appcheck':good.slice(0,-8)+'forged00'})),{status:401});await assert.rejects(g.checkApp(req({'x-firebase-appcheck':jwt(appClaims,{alg:'HS256',typ:'JWT',kid:'key-1'})})),{status:401});assert.equal(await g.checkApp(req({'x-firebase-appcheck':good})),'valid');});
test('App Check key outage does not interrupt monitor; enforcement returns 503',async()=>{assert.equal(await setup({offline:true}).checkApp(req({'x-firebase-appcheck':jwt(appClaims)})),'unavailable');await assert.rejects(setup({mode:'enforce',offline:true}).checkApp(req({'x-firebase-appcheck':jwt(appClaims)})),{status:503});});
test('unknown enforcement configuration is rejected',()=>{assert.throws(()=>createSecurityGate({env:{APP_CHECK_MODE:'typo'}}));});

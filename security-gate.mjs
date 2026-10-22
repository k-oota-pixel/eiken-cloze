import {createPublicKey,verify} from 'node:crypto';

const error=(message,status)=>Object.assign(new Error(message),{status});
// No service-account credential is needed: Google validates the Firebase ID token.
export function createSecurityGate({env=process.env,fetchImpl=fetch,log=console.info,now=Date.now}={}){
  const project=env.FIREBASE_PROJECT_ID||'eiken-retry';
  const apiKey=env.FIREBASE_WEB_API_KEY||'AIzaSyAllLjPcGhygMSEIORXhKZOaDjYvpSJ4EQ';
  const number=env.FIREBASE_PROJECT_NUMBER||'231308672297';
  const apps=(env.FIREBASE_APP_IDS||'1:231308672297:web:5e8b8ede3a0246c2318b38').split(',').map(s=>s.trim());
  const mode=env.APP_CHECK_MODE||'monitor';
  if(!['monitor','enforce'].includes(mode))throw Error('APP_CHECK_MODE must be monitor or enforce');
  const users=new WeakMap();let keys=[],until=0,pending,lastFetch=-Infinity;
  async function verifyUser(req){
    if(users.has(req))return users.get(req);
    const match=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_.-]+)$/i);
    if(!match||match[1].length>16384)throw error('ログインが必要です。もんすたでぃでログインしてから再試行してください。',401);
    let claims;
    try{claims=JSON.parse(Buffer.from(match[1].split('.')[1],'base64url'));}catch{throw error('ログイン情報を確認できませんでした。',401);}
    if(claims.aud!==project||claims.iss!==`https://securetoken.google.com/${project}`)throw error('ログイン情報を確認できませんでした。',401);
    let response,data;
    try{
      response=await fetchImpl(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idToken:match[1]}),signal:AbortSignal.timeout(8000)});
      data=await response.json();
    }catch{throw error('ログイン確認に接続できません。少し待って再試行してください。',503);}
    const user=data.users?.[0];
    if(response.status>=500||response.status===429)throw error('ログイン確認が混み合っています。再試行してください。',503);
    if(!response.ok||!user?.localId||!user?.email||user.disabled||user.localId!==claims.sub)throw error('ログイン情報を確認できませんでした。',401);
    const result={uid:user.localId,email:user.email,displayName:user.displayName||'',emailVerified:user.emailVerified===true};
    users.set(req,result);return result;
  }
  async function getKeys(){
    if(now()<until)return keys;
    if(!pending)pending=(async()=>{
      const response=await fetchImpl('https://firebaseappcheck.googleapis.com/v1/jwks',{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('key fetch failed');
      const body=await response.json();if(!Array.isArray(body.keys)||!body.keys.length)throw Error('missing keys');
      keys=body.keys;until=now()+Math.min(21600,Number(response.headers.get('cache-control')?.match(/max-age=(\d+)/)?.[1]||3600))*1000;
      lastFetch=now();
      return keys;
    })().finally(()=>{pending=undefined;});
    return pending;
  }
  async function checkApp(req){
    const token=req.headers['x-firebase-appcheck'];let state='missing';
    if(token){
      state='invalid';
      try{
        if(typeof token!=='string'||token.length>16384)throw Error('bad token');
        const parts=token.split('.');if(parts.length!==3)throw Error('bad token');
        const header=JSON.parse(Buffer.from(parts[0],'base64url')),claims=JSON.parse(Buffer.from(parts[1],'base64url'));
        const seconds=now()/1000;
        if(header.alg!=='RS256'||header.typ!=='JWT'||typeof header.kid!=='string'||
          claims.iss!==`https://firebaseappcheck.googleapis.com/${number}`||
          !Array.isArray(claims.aud)||!claims.aud.includes(`projects/${number}`)||
          !Number.isFinite(claims.exp)||claims.exp<=seconds||!Number.isFinite(claims.iat)||claims.iat>seconds+60||!apps.includes(claims.sub))throw Error('bad claims');
        let available;
        try{available=await getKeys();}catch{state='unavailable';throw Error('keys unavailable');}
        let jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA');
        // Refresh for a rotated signing key, while bounding attacker-triggered refreshes.
        if(!jwk&&now()-lastFetch>=60000){
          until=0;
          try{available=await getKeys();}catch{state='unavailable';throw Error('keys unavailable');}
          jwk=available.find(k=>k.kid===header.kid&&k.kty==='RSA');
        }
        if(!jwk)throw Error('unknown key');
        if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),createPublicKey({key:jwk,format:'jwk'}),Buffer.from(parts[2],'base64url')))throw Error('bad signature');
        state='valid';
      }catch{}
    }
    // Deliberately omit tokens, user identifiers, and request bodies.
    log(JSON.stringify({event:'app_check',mode,state,path:new URL(req.url,'http://localhost').pathname}));
    if(mode==='enforce'&&state!=='valid')throw error('アプリの確認に失敗しました。ページを更新して再試行してください。',state==='unavailable'?503:401);
    return state;
  }
  return {verifyUser,checkApp};
}

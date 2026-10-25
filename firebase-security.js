import {getApp,getApps,initializeApp} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js';
import {getAuth} from 'https://k-oota-pixel.github.io/english-playroom/auth-session.js?v=2.1.2';
import {initializeAppCheck,ReCaptchaEnterpriseProvider,getToken} from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-app-check.js';
import {APP_CHECK_SITE_KEY} from './app-check-config.js';

const checks=new WeakMap();
export function enableAppCheck(app){
  if(checks.has(app))return checks.get(app);
  if(!APP_CHECK_SITE_KEY)return null;
  try{
    const check=initializeAppCheck(app,{provider:new ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),isTokenAutoRefreshEnabled:true});
    checks.set(app,check);return check;
  }catch(error){console.warn('App Check initialization deferred',error.code);return null;}
}
const config={apiKey:'AIzaSyAllLjPcGhygMSEIORXhKZOaDjYvpSJ4EQ',authDomain:'eiken-retry.firebaseapp.com',projectId:'eiken-retry',storageBucket:'eiken-retry.firebasestorage.app',messagingSenderId:'231308672297',appId:'1:231308672297:web:5e8b8ede3a0246c2318b38'};
export async function apiHeaders(){
  const app=getApps().length?getApp():initializeApp(config);
  const check=enableAppCheck(app),auth=getAuth(app);
  await auth.authStateReady();
  if(!auth.currentUser)throw Error('AI判定にはログインが必要です。もんすたでぃでログインしてから、もう一度お試しください。');
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+await auth.currentUser.getIdToken()};
  if(check){
    let timer;
    try{
      const result=await Promise.race([getToken(check,false),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('App Check timeout')),4000);})]);
      headers['X-Firebase-AppCheck']=result.token;
    }catch(error){console.warn('App Check token deferred',error.code||'unavailable');}
    finally{clearTimeout(timer);}
  }
  return headers;
}

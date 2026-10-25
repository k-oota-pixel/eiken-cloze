const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),key='readinglab-eiken-cloze-last-answers-v1';
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://www.gstatic.com/firebasejs/**',route=>{
   const url=route.request().url();const body=url.includes('firebase-app')?'export const initializeApp=()=>({});':url.includes('firebase-auth')?'export const getAuth=()=>({}),GoogleAuthProvider=class{},signInWithPopup=async()=>{},signOut=async()=>{},onAuthStateChanged=(a,cb)=>cb(null),setPersistence=async()=>{},browserLocalPersistence={};':'export const getFirestore=()=>({}),doc=()=>({}),getDoc=async()=>({exists:()=>false}),setDoc=async()=>{},serverTimestamp=()=>({});';
   return route.fulfill({contentType:'text/javascript',body});
  });
  await page.route('https://k-oota-pixel.github.io/english-playroom/coin-reward.js',route=>route.fulfill({contentType:'text/javascript',body:''}));
  await page.route('http://127.0.0.1:8765/**',route=>{const file=path.join(root,new URL(route.request().url()).pathname==='/'?'index.html':new URL(route.request().url()).pathname);return route.fulfill({contentType:file.endsWith('.js')?'text/javascript':'text/html',body:fs.readFileSync(file)});});
  let failGrade=false;
  await page.route('https://eiken-cloze.onrender.com/api/grade',route=>route.fulfill({status:failGrade?503:200,contentType:'application/json',body:JSON.stringify(failGrade?{error:'判定できませんでした。'}:{results:route.request().postDataJSON().answers.map(a=>({number:a.number,verdict:'acceptable',feedback:'手入力のフィードバック',suggestion:'表現例'}))})}));
  await page.route('**/auth-session.js*',r=>r.fulfill({contentType:'text/javascript',body:"export * from 'https://www.gstatic.com/firebasejs/13.0.0/firebase-auth.js';"}));
await page.goto('http://127.0.0.1:8765');await page.waitForFunction(()=>window.readingLabCloud);
  const passage=await page.evaluate(()=>DATA[0]);
  async function typeAndGrade(prefix){await page.locator('#free').click();for(const q of passage.questions)await page.locator('#answer'+q.number).fill(prefix+q.number);await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#result').textContent==='判定が完了しました。');await page.waitForTimeout(50);}
  async function solveChoices(){await page.locator('#choice').click();for(const q of passage.questions)await page.locator(`.choice[data-q="${q.number}"][data-c="${q.answer_number}"]`).click();await page.locator('#check').click();await page.waitForTimeout(80);}
  await typeAndGrade('My own answer ');
  const saved=await page.evaluate(key=>localStorage.getItem(key),key);assert.ok(saved.includes('My own answer'));
  const old=JSON.parse(saved)[passage.id];assert.equal(old.mode,'free');assert.ok(old.answers.every(a=>a.feedback.includes('手入力')));
  await solveChoices();assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),saved,'choice cannot change answers, feedback or timestamps');
  assert.ok((await page.locator('#previousAttemptBody').textContent()).includes('My own answer'));
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('readinglab-eiken-cloze-progress-v1')).submissions),2,'both modes still count as learning');
  await page.reload();await page.locator('#previousAttempt').waitFor({state:'visible'});assert.ok((await page.locator('#previousAttemptBody').textContent()).includes('My own answer'));
  await page.locator('#next').click();await solveChoices();assert.equal(await page.locator('#previousAttempt').isVisible(),false,'choice-only passage has no writing history');
  await page.locator('#previous').click();await typeAndGrade('My revised answer ');
  const revised=await page.evaluate(key=>localStorage.getItem(key),key);assert.ok(revised.includes('My revised answer'));assert.ok(!revised.includes('My own answer'));
  failGrade=true;await page.locator('#answer'+passage.questions[0].number).fill('Failed submission');await page.locator('#check').click();await page.waitForFunction(()=>document.querySelector('#result').textContent==='判定できませんでした。');assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),revised);
  await page.evaluate(({key,id})=>localStorage.setItem(key,JSON.stringify({[id]:{mode:'choice',answers:[{number:26,answer:'old choice'}]}})),{key,id:passage.id});await page.reload();await page.waitForTimeout(100);assert.equal(await page.locator('#previousAttempt').isVisible(),false,'legacy choice history is never shown as writing');
  assert.deepEqual(errors,[]);console.log('Writing history survives choice answers, reload and theme changes; writing updates only after successful grading; learning totals preserved.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

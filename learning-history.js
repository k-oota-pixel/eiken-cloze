(()=>{
  'use strict';

  const PROGRESS_KEY='readinglab-eiken-cloze-progress-v1';
  const HISTORY_KEY='readinglab-eiken-cloze-last-answers-v1';
  const $=id=>document.getElementById(id);

  function readJson(key){
    try{
      const value=JSON.parse(localStorage.getItem(key)||'{}');
      return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
    }catch{return {};}
  }
  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }
  function passageAt(i){
    try{return Array.isArray(DATA)?DATA[i]:null;}catch{return null;}
  }
  function currentPassage(){
    const select=$('passageSelect');
    return select?passageAt(Number(select.value)):null;
  }

  function installStyle(){
    if($('clozeHistoryStyle'))return;
    const style=document.createElement('style');
    style.id='clozeHistoryStyle';
    style.textContent=`
      .cloze-history{margin:-8px 0 22px;background:#fff;border:1px solid #dce5f1;border-radius:12px;padding:0 16px;box-shadow:0 3px 12px #20345106}
      .cloze-history summary{cursor:pointer;padding:12px 2px;font-weight:750;color:var(--accent);user-select:none}
      .cloze-history[open] summary{border-bottom:1px solid #e7edf5}
      .cloze-history-body{padding:11px 2px 4px}
      .cloze-history-meta{font-size:12px;color:#6b7a90;margin-bottom:6px}
      .cloze-history-row{padding:10px 0;border-bottom:1px solid #edf1f6}
      .cloze-history-row:last-child{border-bottom:0}
      .cloze-history-answer{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
      .cloze-history-answer strong{font-size:13px;color:#52647d}
      .cloze-history-answer span{font-weight:750;color:var(--ink)}
      .cloze-history-feedback{font-size:13px;color:#52647d;margin-top:5px;white-space:pre-wrap}
    `;
    document.head.appendChild(style);
  }

  function installPanel(){
    if($('previousAttempt'))return;
    const toolbar=document.querySelector('.toolbar');
    if(!toolbar)return;
    const details=document.createElement('details');
    details.id='previousAttempt';
    details.className='cloze-history hidden';
    details.innerHTML='<summary>前回のあなたの解答（1件）</summary><div id="previousAttemptBody" class="cloze-history-body"></div>';
    toolbar.insertAdjacentElement('afterend',details);
  }

  let lastProgressSignature='';
  function refreshChecks(force=false){
    const select=$('passageSelect');
    if(!select)return;
    const progress=readJson(PROGRESS_KEY);
    const attempted=Array.isArray(progress.attemptedIds)?progress.attemptedIds.filter(x=>typeof x==='string'):[];
    const signature=attempted.slice().sort().join('|');
    if(!force&&signature===lastProgressSignature)return;
    lastProgressSignature=signature;
    const done=new Set(attempted);
    [...select.options].forEach((option,i)=>{
      const passage=passageAt(i);
      if(!passage)return;
      const label=`${String(i+1).padStart(2,'0')} ${passage.title}`;
      option.textContent=done.has(passage.id)?`✓ ${label}`:label;
    });
  }

  let lastPanelPassage='';
  function renderHistory(force=false){
    const panel=$('previousAttempt');
    const body=$('previousAttemptBody');
    const passage=currentPassage();
    if(!panel||!body||!passage)return;
    if(!force&&passage.id===lastPanelPassage)return;
    lastPanelPassage=passage.id;
    const attempt=readJson(HISTORY_KEY)[passage.id];
    if(!attempt||!Array.isArray(attempt.answers)||!attempt.answers.length){
      panel.classList.add('hidden');
      panel.open=false;
      body.innerHTML='';
      return;
    }
    panel.classList.remove('hidden');
    let when='';
    if(Number(attempt.savedAt)){
      try{when=new Date(Number(attempt.savedAt)).toLocaleString('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch{}
    }
    const modeLabel=attempt.mode==='choice'?'4択':'自分で入力';
    const rows=attempt.answers.map(item=>{
      const feedback=item.feedback?`<div class="cloze-history-feedback">${escapeHtml(item.feedback)}</div>`:'';
      return `<div class="cloze-history-row"><div class="cloze-history-answer"><strong>空所 (${escapeHtml(item.number)})</strong><span>${escapeHtml(item.answer)}</span></div>${feedback}</div>`;
    }).join('');
    body.innerHTML=`<div class="cloze-history-meta">${escapeHtml(modeLabel)}${when?' · '+escapeHtml(when):''}</div>${rows}`;
  }

  function choiceText(button){
    if(!button)return '';
    return [...button.childNodes].filter(node=>node.nodeType===Node.TEXT_NODE).map(node=>node.textContent||'').join('').trim();
  }

  function captureLatestAttempt(){
    const passage=currentPassage();
    if(!passage||!Array.isArray(passage.questions))return;
    const isChoice=$('choice')?.classList.contains('active');
    const answers=[];
    for(const q of passage.questions){
      let answer='';
      if(isChoice){
        answer=choiceText(document.querySelector(`.choice.selected[data-q="${q.number}"]`));
      }else{
        answer=$('answer'+q.number)?.value?.trim()||'';
      }
      if(!answer)return;
      const feedback=$('feedback'+q.number)?.innerText?.trim()||'';
      answers.push({number:q.number,answer,feedback});
    }
    const history=readJson(HISTORY_KEY);
    history[passage.id]={savedAt:Date.now(),mode:isChoice?'choice':'free',answers};
    localStorage.setItem(HISTORY_KEY,JSON.stringify(history));
    lastPanelPassage='';
    refreshChecks(true);
    renderHistory(true);
  }

  function maybeCaptureFromResult(){
    const text=$('result')?.textContent?.trim()||'';
    if(text==='判定が完了しました。'||/^\d+問中\d+問正解$/.test(text))captureLatestAttempt();
  }

  function boot(){
    if(!$('passageSelect'))return;
    installStyle();
    installPanel();
    refreshChecks(true);
    renderHistory(true);

    const result=$('result');
    if(result){
      new MutationObserver(()=>queueMicrotask(maybeCaptureFromResult)).observe(result,{childList:true,subtree:true,characterData:true});
    }

    $('passageSelect')?.addEventListener('change',()=>setTimeout(()=>{lastPanelPassage='';renderHistory(true);},0));
    ['previous','next','free','choice'].forEach(id=>$(id)?.addEventListener('click',()=>setTimeout(()=>{lastPanelPassage='';renderHistory(true);},0)));

    // Existing Firebase sync writes attemptedIds to the same localStorage entry.
    // Polling only that tiny local value keeps the checkmarks current without any extra Firestore reads.
    setInterval(()=>{
      refreshChecks(false);
      const passage=currentPassage();
      if(passage&&passage.id!==lastPanelPassage)renderHistory(true);
    },800);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

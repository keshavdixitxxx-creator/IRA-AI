const $ = (s, p=document) => p.querySelector(s); const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
const state={mode:'orb',listening:false,speaking:false,lastReply:'Welcome back. My systems are online and ready when you are.',pendingAction:null,bridge:false,userTitle:localStorage.getItem('iraUserTitle')||'Commander',quickAnswers:[],history:[]};
fetch('./data/quick-answers.json',{cache:'no-store'}).then(r=>r.json()).then(data=>state.quickAnswers=Array.isArray(data.answers)?data.answers:[]).catch(error=>console.warn('Quick answers unavailable:',error));
const scenes={orb:$('#orbScene'),persona:$('#personaScene'),vrm:$('#vrmScene'),edex:$('#edexScene'),office:$('#officeScene'),argus:$('#argusScene')};
function modeCopy(){return {orb:[`Good evening, <em>${escapeHTML(state.userTitle)}.</em>`,'IRA is listening. Ask anything, explore knowledge, or take control.'],persona:['Meet your <em>digital companion.</em>','A warm, expressive interface for every conversation.'],vrm:['Bring your <em>own identity.</em>','Load a VRM avatar locally and make IRA uniquely yours.'],edex:['IRA <em>Command Deck.</em>','Talk to IRA, monitor diagnostics, explore the globe, and manage live news.'],office:['Your AI <em>Office.</em>','Lead ten specialists through one connected brain and deliver real work.'],argus:['IRA // <em>Argus.</em>','The all-seeing HUD: live wire with photos, an OSINT tracking globe, YouTube video, and IRA’s persistent memory.']}}
const modeLabels={vrm:'VRM Studio',edex:'EDEX Command Deck',office:'IRA Office',argus:'IRA Argus'};
function escapeHTML(value){return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function setMode(mode){if(!scenes[mode])mode='orb';const previous=state.mode;if(previous==='edex'&&mode!=='edex'&&window.iraEdexLeave)window.iraEdexLeave();if(previous==='office'&&mode!=='office'&&window.IRAOffice?.leave)window.IRAOffice.leave();if(previous==='argus'&&mode!=='argus'&&window.iraArgusLeave)window.iraArgusLeave();state.mode=mode;const copy=modeCopy();document.body.classList.remove(...Object.keys(scenes).map(name=>'mode-'+name));document.body.classList.add('mode-'+mode);localStorage.setItem('iraMode',mode);$$('.scene').forEach(x=>x.classList.remove('active'));scenes[mode].classList.add('active');$$('.mode-switch button').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode));$('#heroTitle').innerHTML=copy[mode][0];$('#heroSub').textContent=copy[mode][1];if(mode==='vrm'&&window.iraVRMResize)requestAnimationFrame(window.iraVRMResize);if(mode==='edex'&&window.iraEdexEnter)window.iraEdexEnter();if(mode==='office'&&window.IRAOffice?.enter)window.IRAOffice.enter();if(mode==='argus'&&window.iraArgusEnter)window.iraArgusEnter()}
$$('.mode-switch button').forEach(b=>b.onclick=()=>{setMode(b.dataset.mode);toast(`${modeLabels[b.dataset.mode]||(b.dataset.mode[0].toUpperCase()+b.dataset.mode.slice(1))} interface selected.`);setTimeout(closeLayers,180)});

// Cinematic five-second automatic welcome entry
let entryComplete=false;const entryStarted=performance.now();
function enterIRA(){if(entryComplete)return;entryComplete=true;const screen=$('#welcomeScreen');screen.classList.add('exit');document.body.classList.remove('welcome-active');sessionStorage.setItem('iraEntered','true');setTimeout(()=>screen.setAttribute('aria-hidden','true'),850)}
function updateEntryTimer(now){const remaining=Math.max(0,5000-(now-entryStarted));$('#welcomeTimer').textContent=(remaining/1000).toFixed(1);if(remaining>0)requestAnimationFrame(updateEntryTimer)}
requestAnimationFrame(updateEntryTimer);setTimeout(enterIRA,5000);

// Ambient particle field
const canvas=$('#starfield'),ctx=canvas.getContext('2d');let dots=[];
function resize(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio);dots=Array.from({length:Math.min(120,innerWidth/9)},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.1+.15,a:Math.random()*.5+.1,s:Math.random()*.06+.015}))}addEventListener('resize',resize);resize();
(function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);dots.forEach(d=>{d.y-=d.s;if(d.y<0)d.y=innerHeight;ctx.beginPath();ctx.fillStyle=`rgba(120,210,230,${d.a})`;ctx.arc(d.x,d.y,d.r,0,7);ctx.fill()});requestAnimationFrame(draw)})();

// High-fidelity animated neural orb. It reacts to IRA's listening state.
const orbCanvas=$('#orbVisual'),orbCtx=orbCanvas.getContext('2d');
const orbParticles=Array.from({length:110},(_,i)=>({a:Math.random()*Math.PI*2,b:Math.acos(2*Math.random()-1),r:78+Math.random()*28,size:Math.random()*1.4+.35,speed:.00012+Math.random()*.00018,phase:Math.random()*8}));
function accentRGB(){const raw=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#38e8ff',hex=raw.startsWith('#')?raw:'#38e8ff',n=parseInt(hex.slice(1),16);return[(n>>16)&255,(n>>8)&255,n&255]}
(function drawNeuralOrb(now=0){
 const c=220,voiceMotion=state.speaking?(Math.sin(now*.022)*.045+Math.sin(now*.011)*.025):0,pulse=1+Math.sin(now*.0018)*.018+(state.listening?Math.sin(now*.009)*.055:0)+voiceMotion,radius=105*pulse,[r,g,b]=accentRGB();orbCtx.clearRect(0,0,440,440);
 // atmospheric bloom
 const bloom=orbCtx.createRadialGradient(c,c,35,c,c,190);bloom.addColorStop(0,`rgba(${r},${g},${b},.24)`);bloom.addColorStop(.52,`rgba(${r},${g},${b},.08)`);bloom.addColorStop(1,'rgba(0,0,0,0)');orbCtx.fillStyle=bloom;orbCtx.fillRect(0,0,440,440);
 // orbital ellipses
 orbCtx.save();orbCtx.translate(c,c);[0,.82,-.75].forEach((rot,i)=>{orbCtx.save();orbCtx.rotate(rot+now*(i%2?-.000035:.000028));orbCtx.scale(1,i?0.34:0.18);orbCtx.beginPath();orbCtx.arc(0,0,150-i*9,0,Math.PI*2);orbCtx.strokeStyle=`rgba(${r},${g},${b},${.22-i*.035})`;orbCtx.lineWidth=1.1;orbCtx.stroke();orbCtx.restore()});orbCtx.restore();
 // glass sphere
 orbCtx.save();orbCtx.beginPath();orbCtx.arc(c,c,radius,0,Math.PI*2);orbCtx.clip();const sphere=orbCtx.createRadialGradient(c-38,c-45,5,c,c,radius*1.12);sphere.addColorStop(0,'rgba(235,255,255,.96)');sphere.addColorStop(.055,`rgba(${r},${g},${b},.72)`);sphere.addColorStop(.28,`rgba(${Math.round(r*.38)},${Math.round(g*.55)},${Math.round(b*.7)},.88)`);sphere.addColorStop(.72,'rgba(4,13,29,.98)');sphere.addColorStop(1,'rgba(1,3,10,1)');orbCtx.fillStyle=sphere;orbCtx.fillRect(c-radius,c-radius,radius*2,radius*2);
 // moving liquid contours
 orbCtx.globalCompositeOperation='screen';for(let line=-75;line<=75;line+=11){orbCtx.beginPath();let started=false;for(let x=-115;x<=115;x+=3){const edge=Math.sqrt(Math.max(0,radius*radius-x*x)),energy=state.speaking?1.8:state.listening?1.35:1,y=line+Math.sin(x*.035+now*(state.speaking?.0032:.0014)+line*.04)*9*energy+Math.sin(x*.072-now*.001)*4*energy;if(Math.abs(y)<edge){const px=c+x,py=c+y;if(!started){orbCtx.moveTo(px,py);started=true}else orbCtx.lineTo(px,py)}}orbCtx.strokeStyle=`rgba(${r},${g},${b},${.08+(line+80)/1100})`;orbCtx.lineWidth=.8;orbCtx.stroke()}
 // rotating particles on sphere
 orbParticles.forEach(p=>{const a=p.a+now*p.speed,x=Math.cos(a)*Math.sin(p.b)*p.r,y=Math.cos(p.b)*p.r,z=Math.sin(a)*Math.sin(p.b),depth=(z+1)/2,drift=Math.sin(now*.001+p.phase)*(state.listening?4:1.4);orbCtx.beginPath();orbCtx.arc(c+x,c+y+drift,p.size*(.55+depth),0,7);orbCtx.fillStyle=`rgba(${r},${g},${b},${.18+depth*.72})`;orbCtx.fill()});orbCtx.restore();
 // glass edge and highlight
 orbCtx.beginPath();orbCtx.arc(c,c,radius,0,Math.PI*2);orbCtx.strokeStyle=`rgba(${r},${g},${b},.7)`;orbCtx.lineWidth=1.2;orbCtx.shadowColor=`rgb(${r},${g},${b})`;orbCtx.shadowBlur=18;orbCtx.stroke();orbCtx.shadowBlur=0;orbCtx.beginPath();orbCtx.ellipse(c-35,c-50,27,10,-.65,0,Math.PI*2);orbCtx.fillStyle='rgba(255,255,255,.2)';orbCtx.fill();
 // Voice-energy halo: animated radial bars appear while IRA is speaking.
 if(state.speaking){orbCtx.save();orbCtx.translate(c,c);orbCtx.lineCap='round';for(let i=0;i<56;i++){const angle=i/56*Math.PI*2,level=.35+.65*Math.abs(Math.sin(now*.012+i*.71)+Math.sin(now*.019-i*.37))*.5,inner=radius+13,outer=inner+4+level*13;orbCtx.beginPath();orbCtx.moveTo(Math.cos(angle)*inner,Math.sin(angle)*inner);orbCtx.lineTo(Math.cos(angle)*outer,Math.sin(angle)*outer);orbCtx.strokeStyle=`rgba(${r},${g},${b},${.2+level*.55})`;orbCtx.lineWidth=1.2;orbCtx.stroke()}orbCtx.restore()}
 requestAnimationFrame(drawNeuralOrb)
})();

function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
const languageText={en:{thinking:'Thinking…',tap:'TAP TO SPEAK',listening:'LISTENING',hint:'Tap the voice core and speak naturally',hello:n=>`Hello, ${n}. It's good to hear from you. What would you like to explore?`},hi:{thinking:'सोच रही हूँ…',tap:'बोलने के लिए टैप करें',listening:'सुन रही हूँ',hint:'वॉइस कोर पर टैप करें और बोलें',hello:n=>`नमस्ते ${n}। आपसे बात करके अच्छा लगा। आप क्या जानना चाहेंगे?`},bn:{thinking:'ভাবছি…',tap:'কথা বলতে ট্যাপ করুন',listening:'শুনছি',hint:'ভয়েস কোরে ট্যাপ করে বলুন',hello:n=>`নমস্কার ${n}। আপনার কথা শুনে ভালো লাগছে।`},ta:{thinking:'யோசிக்கிறேன்…',tap:'பேச தட்டவும்',listening:'கேட்கிறேன்',hint:'குரல் பொத்தானைத் தட்டி பேசுங்கள்',hello:n=>`வணக்கம் ${n}. உங்களுடன் பேசுவதில் மகிழ்ச்சி.`},te:{thinking:'ఆలోచిస్తున్నాను…',tap:'మాట్లాడటానికి నొక్కండి',listening:'వింటున్నాను',hint:'వాయిస్ కోర్‌ను నొక్కి మాట్లాడండి',hello:n=>`నమస్కారం ${n}. మీతో మాట్లాడటం ఆనందంగా ఉంది.`},es:{thinking:'Pensando…',tap:'TOCA PARA HABLAR',listening:'ESCUCHANDO',hint:'Toca el núcleo de voz y habla',hello:n=>`Hola, ${n}. Me alegra escucharte. ¿Qué quieres explorar?`},fr:{thinking:'Réflexion…',tap:'APPUYEZ POUR PARLER',listening:'ÉCOUTE',hint:'Touchez le noyau vocal et parlez',hello:n=>`Bonjour, ${n}. Je suis ravie de vous entendre.`},de:{thinking:'Ich denke nach…',tap:'ZUM SPRECHEN TIPPEN',listening:'ICH HÖRE ZU',hint:'Tippe auf den Sprachkern und sprich',hello:n=>`Hallo, ${n}. Schön, von dir zu hören.`},ar:{thinking:'جارٍ التفكير…',tap:'اضغط للتحدث',listening:'أستمع',hint:'اضغط على زر الصوت وتحدث',hello:n=>`مرحباً ${n}. يسعدني سماعك.`},ja:{thinking:'考えています…',tap:'タップして話す',listening:'聞いています',hint:'音声コアをタップして話してください',hello:n=>`こんにちは、${n}。お話しできてうれしいです。`}};
function uiText(){const base=$('#language').value.split('-')[0];return languageText[base]||languageText.en}
function detectSpokenLanguage(text){const current=$('#language').value.split('-')[0];if(/[\u0900-\u097F]/.test(text))return['hi','mr'].includes(current)?current:'hi';if(/[\u0600-\u06FF]/.test(text))return['ar','ur'].includes(current)?current:'ar';const tests=[['bn',/[\u0980-\u09FF]/],['pa',/[\u0A00-\u0A7F]/],['gu',/[\u0A80-\u0AFF]/],['ta',/[\u0B80-\u0BFF]/],['te',/[\u0C00-\u0C7F]/],['ar',/[\u0600-\u06FF]/],['ru',/[\u0400-\u04FF]/],['ja',/[\u3040-\u30FF]/],['ko',/[\uAC00-\uD7AF]/],['zh',/[\u4E00-\u9FFF]/]];for(const [lang,re] of tests)if(re.test(text))return lang;const s=` ${text.toLowerCase()} `;if(/\b(hola|gracias|qué|cómo|por favor|quién)\b/.test(s))return'es';if(/\b(bonjour|merci|comment|pourquoi|avec|quel)\b/.test(s))return'fr';if(/\b(hallo|danke|warum|wie|bitte|was)\b/.test(s))return'de';if(/\b(olá|obrigad[oa]|como|por que|você)\b/.test(s))return'pt';if(/[a-z]{2,}/i.test(text))return'en';return null}
function adoptDetectedLanguage(text){if(!$('#autoLanguageToggle').checked)return;const base=detectSpokenLanguage(text);if(!base)return;const option=$$(`#language option`).find(o=>o.value.toLowerCase().startsWith(base));if(!option||option.value===$('#language').value)return;$('#language').value=option.value;if(rec)rec.lang=option.value;localStorage.setItem('iraLanguage',option.value);$('#inlineLanguage').textContent=option.textContent;document.documentElement.lang=option.value;$('#responseText').dir=/^(ar|ur)/.test(option.value)?'rtl':'auto';toast(`Language detected: ${option.textContent}`)}
function setReply(text,source){state.lastReply=text;$('#responseText').textContent=text;const a=$('#sourceLink');if(source){a.textContent='View source ↗';a.href=source}else{a.textContent='';a.removeAttribute('href')}if($('#voiceToggle').checked)speak(text)}
let speechGeneration=0;
function setSpeaking(on){state.speaking=on;if(window.iraArgusSetSpeaking)window.iraArgusSetSpeaking(on);$('#orb').classList.toggle('speaking',on);if(!state.listening)$('#orbState').textContent=on?'SPEAKING':'READY';const button=$('#speakAgain');button.classList.toggle('speaking',on);button.setAttribute('aria-pressed',String(on));$('#speakAgainText').textContent=on?'SPEAKING':'SPEAK'}
function speak(text){
 const content=String(text||'').trim();if(!content)return;
 if(!('speechSynthesis' in window)||typeof SpeechSynthesisUtterance==='undefined'){toast('Voice playback is not available in this browser. Try Chrome or Edge.');return}
 const generation=++speechGeneration;
 try{
  if(typeof rec!=='undefined'&&state.listening)rec.stop();speechSynthesis.cancel();setSpeaking(false);const u=new SpeechSynthesisUtterance(content);u.lang=$('#language').value;const voices=speechSynthesis.getVoices(),base=u.lang.split('-')[0].toLowerCase(),matching=voices.filter(v=>v.lang.toLowerCase().startsWith(base));
  const score=v=>(/natural|neural|premium|enhanced|online/i.test(v.name)?8:0)+(/female|zira|samantha|heera|lekha|veena|susan|aria|google/i.test(v.name)?5:0)+(v.localService?1:2)-(/compact|espeak/i.test(v.name)?5:0);
  u.voice=(matching.length?[...matching].sort((a,b)=>score(b)-score(a))[0]:voices[0])||null;u.rate=1.08;u.pitch=1.02;u.volume=1;
  u.onstart=()=>{if(generation===speechGeneration)setSpeaking(true)};u.onend=()=>{if(generation===speechGeneration)setSpeaking(false)};
  u.onerror=event=>{if(generation!==speechGeneration)return;setSpeaking(false);if(!['canceled','interrupted'].includes(event.error))toast(`Voice playback failed${event.error?`: ${event.error}`:''}. Check browser sound and speech voices.`)};
  speechSynthesis.resume();speechSynthesis.speak(u);setTimeout(()=>{if(generation===speechGeneration&&speechSynthesis.paused)speechSynthesis.resume()},100);
 }catch(error){setSpeaking(false);toast('Could not start voice playback: '+(error?.message||error))}
}
$('#speakAgain').onclick=()=>speak(state.lastReply);

function updateBrainStatus(kind,reason=''){
 const pill=$('#brainStatus'),label=$('#brainStatusText');if(!pill||!label)return;
 const labels={checking:'BRAIN · STARTING',ready:'CLOUD BRAIN · READY',online:'CLOUD BRAIN · ONLINE',ollama:'OLLAMA · LOCAL',gateway:'AI GATEWAY · ONLINE',fallback:'KNOWLEDGE · ACTIVE',duckduckgo:'DUCKDUCKGO · ACTIVE',offline:'BRAIN · OFFLINE'};
 pill.classList.remove('checking','ready','online','ollama','gateway','fallback','duckduckgo','offline');pill.classList.add(kind);label.textContent=labels[kind]||labels.ready;
 pill.title=reason||'IRA answer status';
 document.dispatchEvent(new CustomEvent('ira:brain-status',{detail:{kind,reason}}));
}
async function refreshBrainStatus(){
 updateBrainStatus('checking');
 try{
  const response=await fetch('/api/health',{cache:'no-store',signal:AbortSignal.timeout(5000)}),data=await response.json();if(!response.ok)throw Error('Health check failed');
  if(data.ollama?.ready)updateBrainStatus('ollama',`Local Ollama ready with ${data.ollama.model}. No API key is required.`);
  else updateBrainStatus(data.cloudBrain?'ready':'offline',data.cloudBrain?'Ollama is offline. Hosted cloud, Wikipedia, and DuckDuckGo fallbacks are available.':'Start ollama_brain.py for local answers, or use Wikipedia and DuckDuckGo fallbacks.');
 }catch{updateBrainStatus('offline','Start ira_server.py to connect IRA to the hosted cloud brain.')}
}
function recordExchange(question,answer){state.history.push({role:'user',content:question},{role:'assistant',content:answer});state.history=state.history.slice(-12)}
function deliverAnswer(question,answer,source,engine){
 recordExchange(question,answer);setReply(answer,source||null);
 const status={'cloud-brain':'online',ollama:'ollama',gateway:'gateway','live-intel':'fallback',wikipedia:'fallback',duckduckgo:'duckduckgo',offline:'offline'}[engine];if(status)updateBrainStatus(status);
 return answer;
}
async function askIRA(q){
 q=String(q||'').trim();if(!q)return;
 $('#responseText').textContent=uiText().thinking;$('#sourceLink').textContent='';$('#voiceTranscript').textContent=q;
 const simple=localAnswer(q);if(simple)return deliverAnswer(q,simple,null,'local');
 const history=state.history.slice(-12);
 try{
  const response=await fetch('/api/brain',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history,language:$('#language').value,title:state.userTitle,mode:'auto'}),signal:AbortSignal.timeout(45000)});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.answer||data.engine==='offline')throw Error(data.error||'The hosted brain did not answer.');
  deliverAnswer(q,data.answer,data.source,data.engine||'cloud-brain');return data;
 }catch(error){console.info('Cloud brain unavailable; trying the optional AI gateway and knowledge fallback.',error.message)}
 // Preserve support for a user-configured OpenAI-compatible server gateway.
 try{
  const response=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,history,language:$('#language').value,title:state.userTitle}),signal:AbortSignal.timeout(25000)}),data=await response.json().catch(()=>({}));
  if(response.ok&&data.answer){deliverAnswer(q,data.answer,null,'gateway');return data}
 }catch(error){console.info('Optional AI gateway unavailable.',error.message)}
 if($('#wikiToggle').checked){try{
  const option=$('#language').selectedOptions[0],wiki=option.dataset.wiki||'en';
  const search=await fetch(`https://${wiki}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=1`).then(r=>r.json()),hit=search.query?.search?.[0];
  if(hit){const page=await fetch(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`).then(r=>r.json());if(page.extract){const answer=page.extract.length>520?page.extract.slice(0,517)+'…':page.extract,source=page.content_urls?.desktop?.page;deliverAnswer(q,answer,source,'wikipedia');return{answer,source,engine:'wikipedia'}}}
 }catch(error){console.warn('Wikipedia fallback unavailable.',error.message)}}
 const answer="I couldn't reach my cloud brain or find a reliable knowledge result just now. Please check the connection and ask me again.";
 deliverAnswer(q,answer,null,'offline');return{answer,engine:'offline'};
}
function calculateQuestion(question){
 let text=question.toLowerCase().replaceAll(',','').trim();const requested=/\b(calculate|compute|add|plus|subtract|minus|multiply|times|divide|divided|what is|answer)\b/.test(text)||/^[\d\s().+\-*/x÷]+$/.test(text);if(!requested||!/[0-9]/.test(text))return null;
 text=text.replace(/subtract\s+(-?\d+(?:\.\d+)?)\s+from\s+(-?\d+(?:\.\d+)?)/g,'$2 - $1').replace(/add\s+(-?\d+(?:\.\d+)?)\s+(?:and|to)\s+(-?\d+(?:\.\d+)?)/g,'$1 + $2').replace(/multiply\s+(-?\d+(?:\.\d+)?)\s+by\s+(-?\d+(?:\.\d+)?)/g,'$1 * $2').replace(/divide\s+(-?\d+(?:\.\d+)?)\s+by\s+(-?\d+(?:\.\d+)?)/g,'$1 / $2');
 text=text.replace(/multiplied\s+by|multiply\s+by|times|[x×]/g,'*').replace(/divided\s+by|divide\s+by|over|÷/g,'/').replace(/plus|add(?:ed)?\s+to/g,'+').replace(/minus|subtract(?:ed)?\s+by/g,'-').replace(/what\s+is|please|calculate|compute|solve|answer|equals?|\?/g,' ').replace(/\s+/g,' ').trim();
 if(/[^\d\s().+\-*/]/.test(text))return null;const compact=text.replace(/\s/g,''),tokens=compact.match(/\d*\.\d+|\d+|[()+\-*/]/g);if(!tokens||tokens.join('')!==compact)return null;let i=0;
 const primary=()=>{const token=tokens[i++];if(token==='('){const value=expression();if(tokens[i++]!==')')throw Error('Missing closing parenthesis');return value}if(token==='+'||token==='-')return(token==='-'?-1:1)*primary();const value=Number(token);if(!Number.isFinite(value))throw Error('Invalid number');return value};
 const term=()=>{let value=primary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],right=primary();if(op==='/'&&right===0)throw Error('Division by zero is undefined');value=op==='*'?value*right:value/right}return value};
 const expression=()=>{let value=term();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],right=term();value=op==='+'?value+right:value-right}return value};
 try{const result=expression();if(i!==tokens.length||!Number.isFinite(result))return null;const rounded=Math.abs(result)<1e15?Number(result.toPrecision(12)):result;return `The answer is ${rounded.toLocaleString('en-IN',{maximumFractionDigits:10})}.`}catch(error){return error.message==='Division by zero is undefined'?'Division by zero is undefined.':null}
}
function localAnswer(q){const s=q.toLowerCase().trim(),calculation=calculateQuestion(q);if(calculation)return calculation;const stored=state.quickAnswers.find(item=>item.keywords?.some(keyword=>s.includes(String(keyword).toLowerCase())));if(stored?.answer)return stored.answer.replaceAll('{{title}}',state.userTitle);if(/^(hi|hello|hey|good morning|good evening|नमस्ते|नमस्कार|হ্যালো|নমস্কার|வணக்கம்|నమస్కారం|hola|bonjour|hallo|مرحبا|こんにちは)/u.test(s))return uiText().hello(state.userTitle);if(s.includes('who are you')||s.includes('your name'))return "I'm IRA — your Immersive Responsive Assistant. I combine conversation, live knowledge, voice, visual personas, and permission-based automation.";if(s.includes('time'))return `It is ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`;if(s.includes('date')||s.includes('day is'))return `Today is ${new Date().toLocaleDateString([], {weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`;if(/open (browser|calculator|whatsapp)|close (window|app)/.test(s)){openAutomation();return 'I opened the automation deck. Choose an action and confirm it when you are ready.'}return null}
$$('[data-prompt]').forEach(b=>b.onclick=()=>askIRA(b.dataset.prompt));

function routeAsk(q){if(state.mode==='edex'&&window.askEdex)return window.askEdex(q);if(state.mode==='office'&&window.askOffice)return window.askOffice(q);if(state.mode==='argus'&&window.askArgus)return window.askArgus(q);return askIRA(q)}
$('#textChatForm').onsubmit=e=>{e.preventDefault();const q=$('#textPrompt').value.trim();if(!q)return;$('#textPrompt').value='';routeAsk(q)};
$('#textMicBtn').onclick=()=>$('#micBtn').click();

// Human-like listening: continuous recognition plus local voice-activity detection.
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let rec,startingMic=false,heardSpeech=false,lastVoiceText='',voiceSilenceTimer=null,voiceSubmitted=false,micStream=null,audioContext=null,analyser=null,vadFrame=null,lastSoundAt=0,voiceBegan=false,noiseFloor=.012,listenStartedAt=0;
function closeAudioMonitor(){if(vadFrame)cancelAnimationFrame(vadFrame);vadFrame=null;micStream?.getTracks().forEach(track=>track.stop());micStream=null;if(audioContext&&audioContext.state!=='closed')audioContext.close().catch(()=>{});audioContext=null;analyser=null;$('#textMicBtn').style.transform='';$('#textMicBtn').style.boxShadow='';$('#textMicBtn').classList.remove('hearing')}
function beginAudioMonitor(stream){micStream=stream;audioContext=new(window.AudioContext||window.webkitAudioContext)();const source=audioContext.createMediaStreamSource(stream);analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.72;source.connect(analyser);const samples=new Float32Array(analyser.fftSize);listenStartedAt=performance.now();lastSoundAt=listenStartedAt;voiceBegan=false;noiseFloor=.012;
 const frame=()=>{if(!analyser)return;analyser.getFloatTimeDomainData(samples);let sum=0;for(const sample of samples)sum+=sample*sample;const rms=Math.sqrt(sum/samples.length),now=performance.now();if(!voiceBegan&&now-listenStartedAt<650)noiseFloor=noiseFloor*.9+rms*.1;const threshold=Math.max(.018,noiseFloor*2.35),level=Math.min(1,Math.max(0,(rms-threshold)/(threshold*4)));const micButton=$('#textMicBtn');micButton.style.transform=`scale(${(1+level*.12).toFixed(3)})`;micButton.style.boxShadow=`0 0 ${Math.round(5+level*24)}px color-mix(in srgb, var(--accent) 32%, transparent)`;const speaking=rms>threshold;if(speaking){voiceBegan=true;lastSoundAt=now;$('#textMicBtn').classList.add('hearing');$('#textPrompt').placeholder='I’m listening…'}else $('#textMicBtn').classList.remove('hearing');if(voiceBegan&&lastVoiceText&&!voiceSubmitted&&now-lastSoundAt>1350)submitVoiceText();vadFrame=requestAnimationFrame(frame)};frame()
}
function submitVoiceText(){clearTimeout(voiceSilenceTimer);voiceSilenceTimer=null;const text=lastVoiceText.trim();if(!text){if(state.listening)rec.stop();return}if(voiceSubmitted)return;voiceSubmitted=true;if(state.listening)rec.stop();$('#textPrompt').value='';adoptDetectedLanguage(text);routeAsk(text)}
if(SR){
 rec=new SR();rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=5;rec.lang='en-IN';
 rec.onstart=()=>{startingMic=false;heardSpeech=false;voiceSubmitted=false;lastVoiceText='';listening(true);$('#textPrompt').placeholder='Listening naturally… take your time'};
 rec.onend=()=>{startingMic=false;listening(false);closeAudioMonitor();$('#textPrompt').placeholder='Ask IRA anything…';if(heardSpeech&&lastVoiceText&&!voiceSubmitted)submitVoiceText();else if(!heardSpeech&&!voiceSubmitted)toast('I did not hear speech. Move closer to the microphone and try again.')};
 rec.onerror=e=>{startingMic=false;clearTimeout(voiceSilenceTimer);closeAudioMonitor();listening(false);const messages={'not-allowed':'Microphone access was denied. Allow it in the browser site settings.','audio-capture':'No working microphone was found.','network':'Speech recognition network service is unavailable.','no-speech':'No speech was detected. Please try again.','aborted':'Listening stopped.'},message=messages[e.error]||('Voice input error: '+e.error);if(e.error!=='aborted'){$('#responseText').textContent=message;toast(message)}};
 rec.onresult=e=>{heardSpeech=true;const phrases=[];for(const result of e.results){const alternatives=[...result],best=alternatives.sort((a,b)=>(b.confidence||0)-(a.confidence||0))[0];if(best?.transcript)phrases.push(best.transcript)}lastVoiceText=phrases.join(' ').replace(/\s+/g,' ').trim();$('#voiceTranscript').textContent=lastVoiceText;$('#textPrompt').value=lastVoiceText;clearTimeout(voiceSilenceTimer);if(e.results[e.results.length-1].isFinal)voiceSilenceTimer=setTimeout(submitVoiceText,1350)}
}
function listening(on){state.listening=on;const copy=uiText();$('#micBtn').classList.toggle('active',on);$('#textMicBtn').classList.toggle('active',on);$('.voice-console').classList.toggle('listening',on);$('#orb').classList.toggle('listening',on);$('#orbState').textContent=on?copy.listening:(state.speaking?'SPEAKING':'READY');$('#voiceStateText').textContent=on?copy.listening:copy.tap;if(!on&&!$('#voiceTranscript').textContent.trim())$('#voiceTranscript').textContent=copy.hint}
async function startListening(){if(!rec){const message='Speech recognition requires Chrome or Edge.';$('#responseText').textContent=message;return toast(message)}if(state.listening){submitVoiceText();return}if(startingMic)return;startingMic=true;speechSynthesis.cancel();try{const stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});beginAudioMonitor(stream);rec.lang=$('#language').value||'en-IN';rec.start()}catch(error){startingMic=false;closeAudioMonitor();const message=error?.name==='NotAllowedError'?'Allow microphone access in your browser, then press the microphone again.':'Could not start the microphone: '+(error?.message||error);$('#responseText').textContent=message;toast(message)}}
$('#micBtn').onclick=startListening;
let spaceDown=false;addEventListener('keydown',e=>{if(e.code==='Space'&&document.activeElement.tagName!=='INPUT'&&!spaceDown&&rec){e.preventDefault();spaceDown=true;startListening()}});addEventListener('keyup',e=>{if(e.code==='Space'&&spaceDown&&rec){spaceDown=false;if(state.listening)submitVoiceText()}});

// Drawers and appearance
const backdrop=$('#backdrop');function drawer(id){$$('.drawer').forEach(d=>d.classList.remove('open'));$(id).classList.add('open');backdrop.classList.add('show')}
function closeLayers(){$$('.drawer').forEach(d=>d.classList.remove('open'));backdrop.classList.remove('show');$('#confirmModal').classList.remove('show')}
$('#settingsBtn').onclick=()=>drawer('#settingsDrawer');$$('.close-drawer').forEach(b=>b.onclick=closeLayers);backdrop.onclick=closeLayers;
function applyLanguage(){const select=$('#language'),copy=uiText();if(rec)rec.lang=select.value;localStorage.setItem('iraLanguage',select.value);$('#inlineLanguage').textContent=select.selectedOptions[0].textContent;$('#voiceTranscript').textContent=copy.hint;$('#voiceStateText').textContent=copy.tap;document.documentElement.lang=select.value;const rtl=/^(ar|ur)/.test(select.value);$('#responseText').dir=rtl?'rtl':'auto';toast(`${select.selectedOptions[0].textContent} voice enabled.`)}
const savedLanguage=localStorage.getItem('iraLanguage');if(savedLanguage&&$(`#language option[value="${savedLanguage}"]`))$('#language').value=savedLanguage;$('#language').onchange=applyLanguage;$('#inlineLanguage').onclick=()=>drawer('#settingsDrawer');applyLanguage();
$('#userTitle').value=state.userTitle;$('#saveTitle').onclick=()=>{const value=$('#userTitle').value.trim();if(!value)return toast('Please enter a name or title.');state.userTitle=value;localStorage.setItem('iraUserTitle',value);setMode(state.mode);setReply(`Understood. I'll address you as ${value} from now on.`);toast('Your preferred title was saved.')};
const savedBg=localStorage.getItem('iraBackground')||'nebula';$('#backgroundStyle').value=savedBg;applyBackground(savedBg);function applyBackground(style){document.body.classList.remove('bg-midnight','bg-solar');if(style!=='nebula')document.body.classList.add('bg-'+style)}$('#backgroundStyle').onchange=e=>{applyBackground(e.target.value);localStorage.setItem('iraBackground',e.target.value);toast('Background updated.')};
$$('.accent-picker button').forEach(b=>b.onclick=()=>{document.documentElement.style.setProperty('--accent',b.dataset.color);localStorage.setItem('iraAccent',b.dataset.color);$$('.accent-picker button').forEach(x=>x.classList.toggle('active',x===b))});
const savedAccent=localStorage.getItem('iraAccent');if(savedAccent){document.documentElement.style.setProperty('--accent',savedAccent);$$('.accent-picker button').forEach(x=>x.classList.toggle('active',x.dataset.color===savedAccent))}
$('#homeBtn').onclick=()=>{setMode('orb');scrollTo({top:0,behavior:'smooth'});toast('Welcome home, '+state.userTitle+'.')};

// Local VRM renderer. The complete engine is bundled with the project—no CDN dependency.
const input=$('#vrmInput'),drop=$('#dropZone');let vrmEngine=null,currentVRM=null;
async function initVRMEngine(){
 if(vrmEngine)return vrmEngine;
 const {THREE,GLTFLoader,VRMLoaderPlugin,VRMUtils}=await import('./vendor/vrm-engine.js');
 const canvas=$('#vrmCanvas'),renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(28,1,.05,100);camera.position.set(0,0,4);
 scene.add(new THREE.HemisphereLight(0xcfe7ff,0x171423,2.8));
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(2,3,3);scene.add(key);
 const rim=new THREE.DirectionalLight(0x688cff,2.8);rim.position.set(-3,2,-2);scene.add(rim);
 const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const clock=new THREE.Clock();
 let dragging=false,lastX=0,lastY=0,orbitAngle=0,orbitElevation=0,orbitDistance=4,defaultDistance=4,autoOrbit=true;
 canvas.addEventListener('pointerdown',e=>{dragging=true;autoOrbit=false;lastX=e.clientX;lastY=e.clientY;canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!dragging)return;orbitAngle-=(e.clientX-lastX)*.009;orbitElevation=Math.max(-.5,Math.min(.5,orbitElevation+(e.clientY-lastY)*.004));lastX=e.clientX;lastY=e.clientY});
 canvas.addEventListener('pointerup',()=>dragging=false);canvas.addEventListener('pointercancel',()=>dragging=false);
 canvas.addEventListener('wheel',e=>{e.preventDefault();orbitDistance=Math.max(1.2,Math.min(12,orbitDistance+e.deltaY*.0025))},{passive:false});
 function resizeVRM(){const w=Math.max(1,drop.clientWidth),h=Math.max(1,drop.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
 function setFraming(distance){orbitDistance=defaultDistance=distance;orbitAngle=0;orbitElevation=0;autoOrbit=true}
 window.iraVRMResize=resizeVRM;addEventListener('resize',resizeVRM);resizeVRM();
 (function render(){requestAnimationFrame(render);const dt=Math.min(clock.getDelta(),.05);if(currentVRM){currentVRM.update(dt);if(autoOrbit&&!dragging)orbitAngle+=dt*.38;if(currentVRM.iraArmPose){currentVRM.iraArmPose.forEach(({bone,quaternion})=>bone.quaternion.copy(quaternion));currentVRM.scene.updateMatrixWorld(true)}}camera.position.set(Math.sin(orbitAngle)*orbitDistance,Math.sin(orbitElevation)*orbitDistance*.35,Math.cos(orbitAngle)*orbitDistance);camera.lookAt(0,0,0);renderer.render(scene,camera)})();
 vrmEngine={THREE,VRMUtils,loader,scene,camera,setFraming};return vrmEngine;
}
async function loadVRM(file){
 if(!file||!file.name.toLowerCase().endsWith('.vrm'))return toast('Please choose a valid .vrm file.');
 drop.classList.add('loaded');$('#vrmLoading').classList.add('show');$('#vrmLoading b').textContent='LOADING '+file.name.toUpperCase();
 $('#modelName').textContent=file.name;$('#modelSize').textContent=`${(file.size/1048576).toFixed(2)} MB · local file`;
 let url;
 try{
  const engine=await initVRMEngine();url=URL.createObjectURL(file);const gltf=await engine.loader.loadAsync(url);currentVRM&&engine.scene.remove(currentVRM.scene);
  currentVRM=gltf.userData.vrm;if(!currentVRM)throw new Error('No VRM extension was found in this file.');
  engine.VRMUtils.removeUnnecessaryVertices(gltf.scene);engine.VRMUtils.combineSkeletons(gltf.scene);engine.VRMUtils.rotateVRM0(currentVRM);engine.scene.add(currentVRM.scene);
  // Pose the rendered/raw arm bones after VRM normalization. Some exporters invert
  // normalized axes, so this raw-bone override is reapplied after every VRM update.
  currentVRM.update(0);currentVRM.scene.updateMatrixWorld(true);currentVRM.iraArmPose=[];
  const captureDownArmPose=(upperName,lowerName)=>{
   const bone=currentVRM.humanoid?.getRawBoneNode(upperName),child=currentVRM.humanoid?.getRawBoneNode(lowerName);if(!bone||!child||!bone.parent)return;
   const shoulder=bone.getWorldPosition(new engine.THREE.Vector3()),elbow=child.getWorldPosition(new engine.THREE.Vector3()),direction=elbow.sub(shoulder);if(direction.lengthSq()<1e-6)return;direction.normalize();
   const boneWorld=bone.getWorldQuaternion(new engine.THREE.Quaternion()),parentWorld=bone.parent.getWorldQuaternion(new engine.THREE.Quaternion());
   // Keep the arms slightly outward and forward so the hands stay visible
   // beside wide sleeves instead of being hidden inside the coat or torso.
   const side=Math.sign(shoulder.x)||1,target=new engine.THREE.Vector3(side*.24,-1,.12).normalize();
   const correction=new engine.THREE.Quaternion().setFromUnitVectors(direction,target);
   const local=parentWorld.invert().multiply(correction.multiply(boneWorld));currentVRM.iraArmPose.push({bone,quaternion:local.clone()});
  };
  captureDownArmPose('leftUpperArm','leftLowerArm');captureDownArmPose('rightUpperArm','rightLowerArm');currentVRM.iraArmPose.forEach(({bone,quaternion})=>bone.quaternion.copy(quaternion));currentVRM.scene.updateMatrixWorld(true);const box=new engine.THREE.Box3().setFromObject(currentVRM.scene),center=box.getCenter(new engine.THREE.Vector3()),size=box.getSize(new engine.THREE.Vector3());
  currentVRM.scene.position.sub(center);const distance=Math.max(1.8,(size.y*.56)/Math.tan(engine.THREE.MathUtils.degToRad(engine.camera.fov*.5)));
  engine.setFraming(distance);engine.camera.near=Math.max(.01,distance-size.z*2);engine.camera.far=distance+size.z*4+20;engine.camera.updateProjectionMatrix();
  drop.classList.add('rendered');$('#vrmLoading').classList.remove('show');toast(`${file.name} loaded successfully.`);
 }catch(error){console.error('VRM load failed:',error);$('#vrmLoading').classList.remove('show');drop.classList.remove('rendered');toast(error.message||'The VRM file could not be loaded.')}finally{if(url)URL.revokeObjectURL(url)}
}
input.onchange=()=>loadVRM(input.files[0]);['dragenter','dragover'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.add('dragging')}));['dragleave','drop'].forEach(n=>drop.addEventListener(n,e=>{e.preventDefault();drop.classList.remove('dragging')}));drop.addEventListener('drop',e=>loadVRM(e.dataTransfer.files[0]));

// Automation bridge; explicit confirmation is required for every action.
function openAutomation(){drawer('#automationDrawer');checkBridge()}$('#automationBtn').onclick=openAutomation;
async function checkBridge(){const box=$('.bridge-status'),text=$('#bridgeText');text.textContent='Checking local connection…';try{const r=await fetch('http://127.0.0.1:8765/health',{signal:AbortSignal.timeout(1200)});if(!r.ok)throw 0;state.bridge=true;box.classList.add('connected');text.textContent='Connected · confirmation required'}catch{state.bridge=false;box.classList.remove('connected');text.textContent='Offline · run automation_bridge.py'}}$('#retryBridge').onclick=checkBridge;
function requestAutomation(action,label){state.pendingAction=action;$('#confirmTitle').textContent=label+'?';$('#confirmCopy').textContent=`IRA will ask the local desktop bridge to “${label}”. This affects your computer and will happen only once.`;$('#confirmModal').classList.add('show');backdrop.classList.add('show')}
$$('.command-grid button').forEach(b=>b.onclick=()=>requestAutomation(b.dataset.action,b.dataset.label));
$('#cancelAction').onclick=()=>{$('#confirmModal').classList.remove('show')};$('#confirmAction').onclick=async()=>{const action=state.pendingAction;$('#confirmModal').classList.remove('show');if(!state.bridge)return toast('Desktop bridge is offline. Start automation_bridge.py first.');try{const r=await fetch('http://127.0.0.1:8765/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirmed:true})});const d=await r.json();toast(d.message||'Action completed.')}catch{toast('Could not reach the desktop bridge.')}};
$('#voiceToggle').checked=localStorage.getItem('iraVoice')!=='off';$('#wikiToggle').checked=localStorage.getItem('iraWiki')!=='off';$('#autoLanguageToggle').checked=localStorage.getItem('iraAutoLanguage')!=='off';$('#voiceToggle').onchange=e=>{localStorage.setItem('iraVoice',e.target.checked?'on':'off');if(!e.target.checked){speechGeneration++;if('speechSynthesis' in window)speechSynthesis.cancel();setSpeaking(false)}toast(e.target.checked?'Voice responses enabled.':'Voice responses disabled.')};$('#wikiToggle').onchange=e=>{localStorage.setItem('iraWiki',e.target.checked?'on':'off');toast(e.target.checked?'Live knowledge enabled.':'Live knowledge disabled.')};$('#autoLanguageToggle').onchange=e=>{localStorage.setItem('iraAutoLanguage',e.target.checked?'on':'off');toast(e.target.checked?'Automatic language detection enabled.':'Automatic language detection disabled.')};
// Restore the saved scene after all interface scripts have registered their lifecycle hooks.
setTimeout(()=>{(function(){var saved=localStorage.getItem('iraMode')||'orb';if(saved==='jarvis'){saved='argus';localStorage.setItem('iraMode','argus')}setMode(saved)})();refreshBrainStatus()},0);setTimeout(()=>{if('speechSynthesis' in window)speechSynthesis.getVoices()},200);
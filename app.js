const $ = (s, p=document) => p.querySelector(s); const $$ = (s,p=document)=>[...p.querySelectorAll(s)];
const state={mode:'orb',listening:false,speaking:false,lastReply:'Welcome back. My systems are online and ready when you are.',pendingAction:null,bridge:false,userTitle:localStorage.getItem('iraUserTitle')||'Commander',quickAnswers:[]};
fetch('./data/quick-answers.json',{cache:'no-store'}).then(r=>r.json()).then(data=>state.quickAnswers=Array.isArray(data.answers)?data.answers:[]).catch(error=>console.warn('Quick answers unavailable:',error));
const scenes={orb:$('#orbScene'),persona:$('#personaScene'),vrm:$('#vrmScene'),monitor:$('#monitorScene'),cockpit:$('#cockpitScene')};
function modeCopy(){return {orb:[`Good evening, <em>${escapeHTML(state.userTitle)}.</em>`,'IRA is listening. Ask anything, explore knowledge, or take control.'],persona:['Meet your <em>digital companion.</em>','A warm, expressive interface for every conversation.'],vrm:['Bring your <em>own identity.</em>','Load a VRM avatar locally and make IRA uniquely yours.'],monitor:['IRA <em>Global Monitor.</em>','Real-time intelligence, live signals, and AI analysis.'],cockpit:['IRA <em>Starship Cockpit.</em>','Flight telemetry, ship systems, and a direct comms link to IRA.']}}
const modeLabels={vrm:'VRM Studio',monitor:'Global Monitor',cockpit:'Starship Cockpit'};
function escapeHTML(value){return value.replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function setMode(mode){state.mode=mode;const copy=modeCopy();document.body.classList.remove('mode-orb','mode-persona','mode-vrm','mode-monitor','mode-cockpit');document.body.classList.add('mode-'+mode);localStorage.setItem('iraMode',mode); $$('.scene').forEach(x=>x.classList.remove('active')); scenes[mode].classList.add('active'); $$('.mode-switch button').forEach(x=>x.classList.toggle('active',x.dataset.mode===mode)); $('#heroTitle').innerHTML=copy[mode][0];$('#heroSub').textContent=copy[mode][1];if(mode==='vrm'&&window.iraVRMResize)requestAnimationFrame(window.iraVRMResize);if(mode==='cockpit'){const t=$('#cockpitTitle');if(t)t.textContent=state.userTitle}}
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
function setSpeaking(on){state.speaking=on;$('#orb').classList.toggle('speaking',on);if(!state.listening)$('#orbState').textContent=on?'SPEAKING':'READY'}
function speak(text){
 if(typeof rec!=='undefined'&&state.listening)rec.stop();speechSynthesis.cancel();setSpeaking(false);const u=new SpeechSynthesisUtterance(text);u.lang=$('#language').value;const voices=speechSynthesis.getVoices(),base=u.lang.split('-')[0].toLowerCase(),matching=voices.filter(v=>v.lang.toLowerCase().startsWith(base));
 const score=v=>(/natural|neural|premium|enhanced|online/i.test(v.name)?8:0)+(/female|zira|samantha|heera|lekha|veena|susan|aria|google/i.test(v.name)?5:0)+(v.localService?1:2)-(/compact|espeak/i.test(v.name)?5:0);
 u.voice=(matching.length?[...matching].sort((a,b)=>score(b)-score(a))[0]:voices[0])||null;u.rate=1.18;u.pitch=1.02;u.volume=1;u.onstart=()=>setSpeaking(true);u.onend=()=>setSpeaking(false);u.onerror=()=>setSpeaking(false);speechSynthesis.speak(u)
}
$('#speakAgain').onclick=()=>speak(state.lastReply);

async function askIRA(q){$('#responseText').textContent=uiText().thinking;$('#sourceLink').textContent='';$('#voiceTranscript').textContent=q;
 const simple=localAnswer(q); if(simple){setReply(simple);return simple}
 try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:q,language:$('#language').value,title:state.userTitle}),signal:AbortSignal.timeout(25000)});if(r.ok){const data=await r.json();if(data.answer){setReply(data.answer);return}}}catch(e){console.info('AI backend unavailable; using knowledge fallback.')}
 if($('#wikiToggle').checked){try{const option=$('#language').selectedOptions[0],wiki=option.dataset.wiki||'en';const search=await fetch(`https://${wiki}.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json&origin=*&srlimit=1`).then(r=>r.json());const hit=search.query?.search?.[0];if(hit){const page=await fetch(`https://${wiki}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`).then(r=>r.json());if(page.extract){setReply(page.extract.length>520?page.extract.slice(0,517)+'…':page.extract,page.content_urls?.desktop?.page);return}}}catch(e){console.warn(e)}}
 setReply("I couldn't find a reliable live result for that yet. Connect IRA to a server-side LLM endpoint for full generative answers; I can still help with Wikipedia topics and local commands.")}
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

// Global Monitor — real-time dashboard and dedicated IRA analysis chat.
function updateMonitorClock(){const now=new Date();$('#monitorDate').textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();$('#monitorTime').textContent=now.toUTCString().slice(17,25)+' UTC'}updateMonitorClock();setInterval(updateMonitorClock,1000);

// JARVIS telemetry dials + cloud-brain core pulse (Monitor scene)
function setDial(valueId,arcId,percent){const b=$('#'+valueId),arc=$('#'+arcId);if(!b||!arc)return;const clamped=Math.max(2,Math.min(100,percent));b.textContent=Math.round(clamped)+'%';const c=2*Math.PI*27;arc.style.strokeDasharray=c.toFixed(1);arc.style.strokeDashoffset=(c*(1-clamped/100)).toFixed(1)}
(function jarvisDials(){
  let reactor=93,signal=88,sync=100;
  function tick(){setDial('dialReactor','dialReactorArc',reactor);setDial('dialSignal','dialSignalArc',signal);setDial('dialSync','dialSyncArc',sync)}
  tick();
  setInterval(()=>{if(state.mode!=='monitor')return;reactor=Math.max(70,Math.min(100,reactor+(Math.random()*6-3)));signal=Math.max(60,Math.min(100,signal+(Math.random()*8-4)));sync=Math.max(90,Math.min(100,sync+(Math.random()*3-1)));tick()},2200);
})();
// Keep the IRA cloud-brain core (and cockpit HUD brain) pulsing in sync with speech/listening state.
setInterval(()=>{const core=$('#jarvisCore');if(core)core.classList.toggle('speaking',!!state.speaking||!!state.listening);const cockpitBrain=$('.hud-brain');if(cockpitBrain)cockpitBrain.style.animationDuration=(state.speaking||state.listening)?'1s':'3.6s'},280);

function addInsight(role,text){const box=document.createElement('div');box.className='insight-card '+(role==='user'?'user':'');const tag=document.createElement('small');tag.textContent=role==='user'?'YOU':'IRA ANALYSIS';const p=document.createElement('p');p.textContent=text;box.append(tag,p);$('#insightMessages').appendChild(box);box.scrollIntoView({behavior:'smooth',block:'end'})}
async function askMonitor(question){addInsight('user',question);$('#monitorPrompt').value='';const pending=document.createElement('div');pending.className='insight-card thinking';pending.innerHTML='<small>IRA ANALYSIS</small><p>Analyzing live context…</p>';$('#insightMessages').appendChild(pending);await askIRA(question);pending.remove();addInsight('ira',state.lastReply)}
$('#monitorChatForm').onsubmit=e=>{e.preventDefault();const q=$('#monitorPrompt').value.trim();if(q)askMonitor(q)};$('#monitorMic').onclick=()=>$('#micBtn').click();
function plotEvent(event,type='earthquake'){const dot=document.createElement('button');dot.className='map-event '+type;dot.style.left=`${(event.lon+180)/3.6}%`;dot.style.top=`${(90-event.lat)/1.8}%`;dot.title=event.title||'Live event';dot.onclick=()=>askMonitor(`Tell me about ${event.title}`);$('#mapEvents').appendChild(dot)}
async function loadRealtime(){try{const data=await fetch('/api/realtime',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('feed unavailable');return r.json()});$('#mapEvents').textContent='';(data.earthquakes||[]).slice(0,100).forEach(e=>plotEvent(e,'earthquake'));(data.naturalEvents||[]).slice(0,100).forEach(e=>plotEvent({...e,title:`${e.category}: ${e.title}`},'natural'));if(data.weather)plotEvent({lat:28.6692,lon:77.4538,title:`Ghaziabad weather: ${Math.round(data.weather.temperature)}°C`},'weather');[{lat:51.5,lon:-.1,title:'London network node'},{lat:40.7,lon:-74,title:'New York network node'},{lat:35.7,lon:139.7,title:'Tokyo network node'},{lat:28.6,lon:77.2,title:'New Delhi network node'}].forEach(e=>plotEvent(e,'system'));const total=(data.earthquakes?.length||0)+(data.naturalEvents?.length||0);$('#eventCount').textContent=`${total} LIVE EVENTS`;$('#quakeValue').textContent=data.earthquakes?.length??'--';if(data.weather){$('#weatherValue').textContent=`${Math.round(data.weather.temperature)}°`;$('#weatherDetail').textContent=`Ghaziabad · Wind ${Math.round(data.weather.wind)} km/h`}const list=$('#headlineList');list.textContent='';(data.headlines||[]).slice(0,8).forEach((item,i)=>{const a=document.createElement('a');a.className='headline-item';a.href=item.url;a.target='_blank';a.rel='noreferrer';const src=(item.source||'LIVE').trim();const hue=[...src].reduce((h,c)=>h+c.charCodeAt(0),0)%360;a.innerHTML=`<i class="thumb" style="--hue:${hue}">${escapeHTML(src.slice(0,2).toUpperCase()||'IR')}</i><span><small>${escapeHTML(src||'LIVE')} · ${String(i+1).padStart(2,'0')}</small><b>${escapeHTML(item.title)}</b></span>`;list.appendChild(a)});$('#newsStatus').textContent='LIVE';const top=data.headlines?.[0]?.title,quakes=data.earthquakes?.length||0,natural=data.naturalEvents?.length||0;$('#worldBrief').textContent=top?`Top signal: ${top} Monitoring ${quakes} seismic events and ${natural} active NASA-tracked natural events.`:`Monitoring ${quakes} seismic events and ${natural} natural events. Live headline feed is reconnecting.`;$('#networkValue').textContent='LIVE'}catch(error){console.warn(error);$('#eventCount').textContent='RECONNECTING';$('#newsStatus').textContent='OFFLINE';$('#networkValue').textContent='RETRY'}}
loadRealtime();setInterval(loadRealtime,180000);$$('.map-layers input').forEach(input=>input.onchange=()=>$('#worldMap').classList.toggle('hide-'+input.dataset.layer,!input.checked));
const mapView={scale:1,x:0,y:0};function applyMapView(){const transform=`translate(${mapView.x}px,${mapView.y}px) scale(${mapView.scale})`;$('#worldMap>img').style.transform=transform;$('#mapEvents').style.transform=transform}
$$('.map-zoom button').forEach(button=>button.onclick=e=>{e.stopPropagation();const action=button.dataset.zoom;if(action==='reset'){mapView.scale=1;mapView.x=mapView.y=0}else mapView.scale=Math.max(1,Math.min(4,mapView.scale*(action==='in'?1.25:.8)));applyMapView()});let mapDragging=false,mapLastX=0,mapLastY=0;$('#worldMap').addEventListener('wheel',e=>{e.preventDefault();mapView.scale=Math.max(1,Math.min(4,mapView.scale*(e.deltaY<0?1.12:.9)));applyMapView()},{passive:false});$('#worldMap').addEventListener('pointerdown',e=>{if(e.target.closest('button'))return;mapDragging=true;mapLastX=e.clientX;mapLastY=e.clientY;$('#worldMap').setPointerCapture(e.pointerId)});$('#worldMap').addEventListener('pointermove',e=>{if(!mapDragging||mapView.scale===1)return;mapView.x+=e.clientX-mapLastX;mapView.y+=e.clientY-mapLastY;mapLastX=e.clientX;mapLastY=e.clientY;applyMapView()});$('#worldMap').addEventListener('pointerup',()=>mapDragging=false);$('#worldMap').addEventListener('pointercancel',()=>mapDragging=false);

// Starship Cockpit — sci-fi flight HUD, ship telemetry, and a dedicated comms link to IRA.
function updateCockpitClock(){const now=new Date();const d=$('#cockpitDate'),t=$('#cockpitTime');if(!d||!t)return;d.textContent=now.toLocaleDateString('en-GB',{weekday:'short',day:'2-digit',month:'short',year:'numeric'}).toUpperCase();t.textContent=now.toUTCString().slice(17,25)+' UTC'}
updateCockpitClock();setInterval(updateCockpitClock,1000);
function addCockpitLog(role,text){const box=$('#cockpitLog');if(!box)return;const line=document.createElement('div');line.className='comms-line '+(role==='user'?'user':role==='sys'?'sys':'ira');const tag=document.createElement('small');tag.textContent=role==='user'?'YOU':role==='sys'?'SYS':'IRA';const p=document.createElement('p');p.textContent=text;line.append(tag,p);box.appendChild(line);box.scrollTo({top:box.scrollHeight,behavior:'smooth'})}
async function askCockpit(question){addCockpitLog('user',question);const prompt=$('#cockpitPrompt');if(prompt)prompt.value='';const pending=document.createElement('div');pending.className='comms-line ira thinking';pending.innerHTML='<small>IRA</small><p>Processing telemetry…</p>';$('#cockpitLog')?.appendChild(pending);const state0=$('#cockpitState');if(state0)state0.textContent='PROCESSING';await askIRA(question);pending.remove();addCockpitLog('ira',state.lastReply);if(state0)state0.textContent='NAV LOCKED'}
$('#cockpitChatForm')?.addEventListener('submit',e=>{e.preventDefault();const q=$('#cockpitPrompt').value.trim();if(q)askCockpit(q)});
$('#cockpitMic')?.addEventListener('click',()=>$('#micBtn').click());
$$('[data-cockpit-prompt]').forEach(b=>b.addEventListener('click',()=>askCockpit(b.dataset.cockpitPrompt)));

// Simulated flight telemetry: gentle live jitter so the console always feels alive.
(function cockpitTelemetry(){
  const gauges=[['gaugeReactor',93],['gaugeShield',81],['gaugeLife',100],['gaugeThrust',66]];
  let heading=47,velocity=21400,altitude=308;
  setInterval(()=>{
    if(state.mode!=='cockpit')return;
    gauges.forEach(([id,base])=>{const el=$('#'+id);if(!el)return;const jitter=Math.max(2,Math.min(100,base+(Math.random()*6-3)));el.style.width=jitter.toFixed(0)+'%';const label=el.closest('.gauge')?.querySelector('b');if(label)label.textContent=jitter.toFixed(0)+'%'});
    heading=(heading+(Math.random()*4-2)+360)%360;velocity+=Math.random()*120-60;altitude+=Math.random()*1.4-.7;
    const h=$('#cockpitHeading'),v=$('#cockpitVelocity'),a=$('#cockpitAltitude');
    if(h)h.textContent=String(Math.round(heading)).padStart(3,'0')+'°';
    if(v)v.innerHTML=Math.round(velocity).toLocaleString()+'<i>km/h</i>';
    if(a)a.innerHTML=Math.round(altitude)+'<i>km</i>';
    if(Math.random()<.08)$('#hullValue') && ($('#hullValue').textContent=(96+Math.random()*4).toFixed(0)+'%');
  },1600);
})();

// Cockpit HUD canvas: rotating attitude rings, sweeping radar arc, and starlight parallax.
(function cockpitHUD(){
  const canvas=$('#cockpitCanvas');if(!canvas)return;const ctx=canvas.getContext('2d');
  const blips=Array.from({length:14},()=>({a:Math.random()*Math.PI*2,r:Math.random()*150+40,speed:(Math.random()*.0006+.0002)*(Math.random()<.5?1:-1)}));
  function resizeCockpit(){const stage=canvas.parentElement;if(!stage)return;const w=stage.clientWidth,h=stage.clientHeight;canvas.width=w*devicePixelRatio;canvas.height=h*devicePixelRatio;canvas.style.width=w+'px';canvas.style.height=h+'px';ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0)}
  addEventListener('resize',resizeCockpit);resizeCockpit();
  function accent(){const raw=getComputedStyle(document.documentElement).getPropertyValue('--accent').trim()||'#38e8ff';const n=parseInt(raw.replace('#',''),16);return[(n>>16)&255,(n>>8)&255,n&255]}
  (function draw(now=0){
    requestAnimationFrame(draw);
    if(state.mode!=='cockpit')return;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;
    const cx=w/2,cy=h/2,[r,g,b]=accent();
    ctx.clearRect(0,0,w,h);
    // radar sweep
    const sweep=(now*.00022)%(Math.PI*2);
    const grad=ctx.createConicGradient?ctx.createConicGradient(sweep,cx,cy):null;
    if(grad){grad.addColorStop(0,`rgba(${r},${g},${b},.26)`);grad.addColorStop(.06,`rgba(${r},${g},${b},0)`);grad.addColorStop(1,`rgba(${r},${g},${b},0)`);ctx.fillStyle=grad;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,Math.min(w,h)*.46,0,Math.PI*2);ctx.fill()}
    // concentric range rings
    for(let i=1;i<=3;i++){ctx.beginPath();ctx.arc(cx,cy,i*Math.min(w,h)*.14,0,Math.PI*2);ctx.strokeStyle=`rgba(${r},${g},${b},${.14-i*.02})`;ctx.lineWidth=1;ctx.stroke()}
    // rotating blips
    blips.forEach(p=>{const a=p.a+now*p.speed,x=cx+Math.cos(a)*p.r*(Math.min(w,h)/380),y=cy+Math.sin(a)*p.r*.55*(Math.min(w,h)/380);ctx.beginPath();ctx.arc(x,y,2,0,7);ctx.fillStyle=`rgba(${r},${g},${b},.75)`;ctx.fill()});
    // faint drifting starfield
    ctx.save();ctx.globalAlpha=.5;for(let i=0;i<40;i++){const sx=(i*97+now*.01)%w,sy=(i*53)%h;ctx.fillStyle='rgba(255,255,255,.35)';ctx.fillRect(sx,sy,1,1)}ctx.restore();
  })();
})();

function routeAsk(q){if(state.mode==='monitor')return askMonitor(q);if(state.mode==='cockpit')return askCockpit(q);return askIRA(q)}
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
$$('.command-grid button').forEach(b=>b.onclick=()=>{state.pendingAction=b.dataset.action;$('#confirmTitle').textContent=b.dataset.label+'?';$('#confirmCopy').textContent=`IRA will ask the local desktop bridge to “${b.dataset.label}”. This affects your computer and will happen only once.`;$('#confirmModal').classList.add('show');backdrop.classList.add('show')});
$('#cancelAction').onclick=()=>{$('#confirmModal').classList.remove('show')};$('#confirmAction').onclick=async()=>{const action=state.pendingAction;$('#confirmModal').classList.remove('show');if(!state.bridge)return toast('Desktop bridge is offline. Start automation_bridge.py first.');try{const r=await fetch('http://127.0.0.1:8765/action',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,confirmed:true})});const d=await r.json();toast(d.message||'Action completed.')}catch{toast('Could not reach the desktop bridge.')}};
$('#voiceToggle').checked=localStorage.getItem('iraVoice')!=='off';$('#wikiToggle').checked=localStorage.getItem('iraWiki')!=='off';$('#autoLanguageToggle').checked=localStorage.getItem('iraAutoLanguage')!=='off';$('#voiceToggle').onchange=e=>{localStorage.setItem('iraVoice',e.target.checked?'on':'off');toast(e.target.checked?'Voice responses enabled.':'Voice responses disabled.')};$('#wikiToggle').onchange=e=>{localStorage.setItem('iraWiki',e.target.checked?'on':'off');toast(e.target.checked?'Live knowledge enabled.':'Live knowledge disabled.')};$('#autoLanguageToggle').onchange=e=>{localStorage.setItem('iraAutoLanguage',e.target.checked?'on':'off');toast(e.target.checked?'Automatic language detection enabled.':'Automatic language detection disabled.')};
setMode(localStorage.getItem('iraMode')||'orb');setTimeout(()=>speechSynthesis.getVoices(),200);
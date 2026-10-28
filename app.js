/* Pulso HIIT web: sin dependencias ni cuentas. iOS puede suspender el audio web. */
(function () {
'use strict';
const E = PulsoEngine, $ = id => document.getElementById(id);
const fields = {
 prepare: ['Prepárate','Cuenta atrás antes de empezar','prepare'],
 work: ['Entrenar','Da lo mejor de ti durante este tiempo','work'],
 rest: ['Descansar','Recupera entre rondas','rest'],
 rounds: ['Rondas','Una ronda es ejercicio y descanso','rounds'],
 cycles: ['Ciclos','Repite el bloque completo de rondas','cycles'],
 cycleRest: ['Descanso entre ciclos','Una pausa antes del siguiente bloque','cycleRest'],
 cooldown: ['Enfriamiento','Baja las pulsaciones al terminar','cooldown'],
 lap: ['Aviso periódico','Suena cada intervalo; 00:00 lo desactiva','lap']
};
const defaults = {
 tabata:{id:null,name:'Mi Tabata',mode:'tabata',prepare:5,work:40,rest:20,rounds:8,cycles:4,cycleRest:60,cooldown:60,lap:20},
 rounds:{id:null,name:'Mis rondas',mode:'rounds',prepare:5,work:60,rest:0,rounds:3,cycles:1,cycleRest:0,cooldown:0,lap:20},
 stopwatch:{id:null,name:'Mi cronómetro',mode:'stopwatch',prepare:0,work:20,rest:0,rounds:1,cycles:1,cycleRest:0,cooldown:0,lap:20}
};
const defaultPrefs = {sound:true,voice:true,flash:false,keepAwake:true};
let drafts = structuredClone(defaults), profiles = [], history = [], prefs = {...defaultPrefs}, currentMode='tabata', session=null, lastWorkout=null, editKey=null, frame=null, audio=null, wakeLock=null, toastTimer=null;
function uid(){return globalThis.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);}
function node(tag,className,text){const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=text;return n;}
function icon(name){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('aria-hidden','true');const u=document.createElementNS(s.namespaceURI,'use');u.setAttribute('href','#i-'+name);s.append(u);return s;}
function button(className,text,iconName,handler){const b=node('button',className);b.type='button';if(iconName)b.append(icon(iconName));if(text)b.append(document.createTextNode(text));if(handler)b.addEventListener('click',handler);return b;}
function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),4000);}
function persist(){try{localStorage.setItem('pulso-hiit-v1',JSON.stringify({version:1,drafts,profiles,history,prefs}));return true;}catch{toast('No se pudieron guardar los datos. Exporta una copia para conservarlos.');return false;}}
function cleanWorkout(w){const c={...E.validate(w)};c.id=typeof w.id==='string'?w.id:null;return c;}
try{
 const raw=localStorage.getItem('pulso-hiit-v1');
 if(raw){const s=JSON.parse(raw);if(s.version===1){for(const mode of Object.keys(defaults)){try{drafts[mode]=cleanWorkout(s.drafts[mode]);}catch{}}
 if(Array.isArray(s.profiles))profiles=s.profiles.flatMap(p=>{try{return [cleanWorkout(p)];}catch{return [];}});
 if(Array.isArray(s.history))history=s.history.filter(h=>h && typeof h.id==='string' && typeof h.name==='string' && h.name.length<=60 && Number.isFinite(h.duration) && h.duration>=0 && typeof h.date==='string' && !Number.isNaN(Date.parse(h.date))).map(h=>({...h,name:h.name.slice(0,60)}));
 for(const k of Object.keys(defaultPrefs))if(typeof s.prefs?.[k]==='boolean')prefs[k]=s.prefs[k];
 }} else {
 profiles=[{...defaults.tabata,id:uid(),name:'Tabata esencial',cycles:1,cycleRest:0,cooldown:0},{...defaults.rounds,id:uid(),name:'Tres rondas · box'}];
 persist();
 }
}catch{toast('El almacenamiento local no está disponible. Puedes usar el timer y exportar tus datos.');}
function showScreen(name){for(const key of ['config','more','timer','completion'])$(key+'Screen').hidden=key!==name;document.querySelector('.app').classList.toggle('training',['timer','completion'].includes(name));}
function renderConfig(){
 const w=drafts[currentMode];
 $('headerTitle').textContent='Tu entrenamiento';$('routineName').value=w.name;
 $('modeEyebrow').textContent=currentMode==='stopwatch'?'TIEMPO LIBRE · CRONÓMETRO':'INTERVALOS · '+(currentMode==='tabata'?'TABATA':'RONDAS');
 $('totalTime').textContent=currentMode==='stopwatch'?'∞':E.format(E.totalDuration(w));
 $('summaryRounds').textContent=currentMode==='stopwatch'?'Tú decides cuándo parar':w.rounds+' rondas'+(currentMode==='tabata'?' × '+w.cycles+' ciclos':'');
 $('summaryPattern').textContent=currentMode==='stopwatch'?(w.lap?'Aviso cada '+E.format(w.lap):'Sin aviso periódico'):w.work+' s de trabajo / '+w.rest+' s de descanso';
 document.querySelector('.summary-label').textContent=currentMode==='stopwatch'?'SIN LÍMITE':'DURACIÓN TOTAL';
 const keys=currentMode==='tabata'?['prepare','work','rest','rounds','cycles','cycleRest','cooldown']:currentMode==='rounds'?['prepare','work','rest','rounds','cooldown']:['prepare','lap'];
 $('intervalRows').replaceChildren();
 for(const key of keys){const [title,hint,color]=fields[key],b=button('interval-row','',null,()=>openEdit(key));const label=node('span','row-text');label.append(node('strong','',title),node('small','',hint));b.append(node('span','row-dot '+color),label,node('span','row-value',['rounds','cycles'].includes(key)?String(w[key]):E.format(w[key])),icon('chevron'));b.setAttribute('aria-label',title+', '+(['rounds','cycles'].includes(key)?w[key]:E.format(w[key]))+'. Cambiar');$('intervalRows').append(b);}
 $('startButton').replaceChildren(icon('play'),document.createTextNode(currentMode==='stopwatch'?'Iniciar cronómetro':'Empezar entrenamiento'));
 $('saveButton').replaceChildren(icon('save'),document.createTextNode(w.id?'Actualizar rutina':'Guardar rutina'));
 renderProfiles();
}
function renderProfiles(){
 $('routineCount').textContent=profiles.length+' guardadas';$('profiles').replaceChildren();
 if(!profiles.length){const empty=node('div','empty-card');empty.append(icon('save'),node('p','','Guarda tu primera rutina y tenla lista para la próxima sesión.'));$('profiles').append(empty);return;}
 for(const p of profiles){const card=node('div','profile-card'),load=button('profile-load','',null,()=>loadProfile(p.id));load.append(node('strong','',p.name),node('span','',(p.mode==='tabata'?'TABATA':p.mode==='rounds'?'RONDAS':'CRONÓMETRO')+' · '+(p.mode==='stopwatch'?'Tiempo libre':p.rounds+' rondas'+(p.mode==='tabata'?' × '+p.cycles+' ciclos':''))));load.setAttribute('aria-label','Cargar '+p.name);const del=button('icon-button','', 'trash',()=>deleteProfile(p.id));del.setAttribute('aria-label','Eliminar '+p.name);card.append(load,node('span','profile-time',p.mode==='stopwatch'?'∞':E.format(E.totalDuration(p))),del);$('profiles').append(card);}
}
function selectMode(mode){
 if(session)return;
 document.querySelectorAll('[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===mode);b.setAttribute('aria-current',b.dataset.mode===mode?'page':'false');});
 if(mode==='more'){showScreen('more');$('headerTitle').textContent='Preferencias e historial';renderMore();}
 else {currentMode=mode;showScreen('config');renderConfig();}
}
function loadProfile(id){const p=profiles.find(p=>p.id===id);if(!p)return;drafts[p.mode]={...p};selectMode(p.mode);persist();toast('Rutina cargada: '+p.name);}
async function confirmAction(title,text,action){
 const d=$('confirmDialog');$('confirmTitle').textContent=title;$('confirmText').textContent=text;$('confirmOK').textContent=action;d.returnValue='';
 return new Promise(resolve=>{d.addEventListener('close',()=>resolve(d.returnValue==='ok'),{once:true});d.showModal();});
}
async function deleteProfile(id){const p=profiles.find(p=>p.id===id);if(!p)return;if(await confirmAction('¿Eliminar rutina?',p.name+' se quitará de tus rutinas guardadas.','Eliminar')){profiles=profiles.filter(p=>p.id!==id);for(const w of Object.values(drafts))if(w.id===id)w.id=null;persist();renderConfig();toast('Rutina eliminada');}}
function openEdit(key){
 editKey=key;const count=['rounds','cycles'].includes(key),value=drafts[currentMode][key];
 $('editTitle').textContent=fields[key][0];$('editHint').textContent=fields[key][1];$('editError').textContent='';$('durationFields').hidden=count;$('countFields').hidden=!count;
 $('minutesInput').disabled=count;$('secondsInput').disabled=count;$('countInput').disabled=!count;
 $('minutesInput').value=Math.floor(value/60);$('secondsInput').value=value%60;$('countInput').value=value;
 $('editDialog').showModal();(count?$('countInput'):$('minutesInput')).focus();
}
$('editForm').addEventListener('submit',ev=>{
 ev.preventDefault();const count=['rounds','cycles'].includes(editKey),m=Number($('minutesInput').value),s=Number($('secondsInput').value),c=Number($('countInput').value);
 if(count?(!Number.isInteger(c)||c<1||c>100):(!Number.isInteger(m)||!Number.isInteger(s)||m<0||s<0||s>59||m*60+s>3600)){ $('editError').textContent=count?'Elige un número entero entre 1 y 100.':'Elige un tiempo válido de hasta 60 minutos.';return; }
 const value=count?c:m*60+s,updated={...drafts[currentMode],[editKey]:value};
 try{E.validate(updated);drafts[currentMode]=updated;persist();$('editDialog').close();renderConfig();}catch(e){$('editError').textContent=e.message;}
});
$('cancelEdit').addEventListener('click',()=>$('editDialog').close());
$('minusCount').addEventListener('click',()=>$('countInput').value=Math.max(1,Number($('countInput').value)-1));
$('plusCount').addEventListener('click',()=>$('countInput').value=Math.min(100,Number($('countInput').value)+1));
$('routineName').addEventListener('change',()=>{const name=$('routineName').value.trim();if(!name){$('routineName').value=drafts[currentMode].name;toast('Ponle un nombre a tu rutina.');return;}drafts[currentMode].name=name;persist();});
$('saveButton').addEventListener('click',()=>{
 const w=drafts[currentMode];w.name=$('routineName').value.trim();
 try{E.validate(w);}catch(e){toast(e.message);return;}
 if(!w.id)w.id=uid();const i=profiles.findIndex(p=>p.id===w.id);if(i>=0)profiles[i]={...w};else profiles.push({...w});const saved=persist();renderConfig();if(saved)toast(i>=0?'Rutina actualizada':'Rutina guardada');
});
function renderMore(){
 $('preferences').replaceChildren();
 const definitions={sound:['Señales de sonido','Cambios de fase y cuenta atrás de 3 segundos.'],voice:['Guía por voz','Escucha la fase y la ronda en español.'],flash:['Destello de pantalla','Un destello suave al cambiar de intervalo.'],keepAwake:['Mantener pantalla activa','Mientras entrenas, si el navegador lo permite.']};
 for(const [key,[title,detail]]of Object.entries(definitions)){const label=node('label','preference'),copy=node('span');copy.append(node('strong','',title),node('small','',detail));const input=node('input','toggle');input.type='checkbox';input.checked=prefs[key];input.addEventListener('change',()=>{prefs[key]=input.checked;persist();});label.append(copy,input);$('preferences').append(label);}
 $('historyCount').textContent=history.length+' sesiones';$('history').replaceChildren();
 if(!history.length){const empty=node('div','empty-card');empty.append(icon('clock'),node('p','','Tu próxima sesión empieza aquí. Al terminar, la encontrarás en tu historial.'));$('history').append(empty);}
 for(const h of [...history].reverse()){const item=node('div','history-item'),mark=node('div','history-mark');mark.append(icon(h.completed?'check':'clock'));const copy=node('div');copy.append(node('strong','',h.name),node('small','',new Date(h.date).toLocaleString('es-MX',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})+' · '+(h.completed?'Completada':'Finalizada antes de tiempo')+(h.skipped?' · '+h.skipped+' saltos':'')));const time=node('time','',E.format(h.duration));time.dateTime='PT'+Math.round(h.duration)+'S';item.append(mark,copy,time);$('history').append(item);}
}
function initAudio(){try{const A=window.AudioContext||window.webkitAudioContext;if(A&&!audio)audio=new A();if(audio?.state==='suspended')audio.resume().catch(()=>{});}catch{}}
function beep(freq=880,length=.18){if(!prefs.sound||document.hidden||!audio)return;try{const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.frequency.value=freq;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+length);o.connect(g);g.connect(audio.destination);o.start(t);o.stop(t+length+.02);}catch{}}
let lastVoiceError = -Infinity;
function speak(text,force=false){
 if((!prefs.voice&&!force)||document.hidden)return false;
 if(!('speechSynthesis'in window)||!('SpeechSynthesisUtterance'in window)){if(force)toast('Este navegador no ofrece guía por voz. Abre Pulso en Safari.');return false;}
 speechSynthesis.cancel();
 const utterance=new SpeechSynthesisUtterance(text);utterance.lang='es-MX';utterance.rate=1.02;
 const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase()==='es-mx')||voices.find(v=>v.lang.toLowerCase().startsWith('es'));
 if(voice)utterance.voice=voice;
 utterance.onerror=event=>{
  if(['interrupted','canceled'].includes(event.error))return;
  if(force||Date.now()-lastVoiceError>60000){lastVoiceError=Date.now();toast('No se pudo reproducir la voz. Comprueba el volumen y prueba desde Safari con una voz en español disponible.');}
 };
 if(speechSynthesis.paused)speechSynthesis.resume();
 speechSynthesis.speak(utterance);return true;
}
$('testVoiceButton').addEventListener('click',()=>{
 initAudio();
 speak('Hola. Soy la guía de Pulso. Prepárate, entrena y descansa. Así escucharás los cambios de intervalo.',true);
});
function flash(){if(!prefs.flash||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;const n=$('screenFlash');n.classList.remove('flash');void n.offsetWidth;n.classList.add('flash');}
async function requestWake(){if(!prefs.keepAwake||!('wakeLock'in navigator)||document.hidden||!session?.clock.running)return;try{wakeLock=await navigator.wakeLock.request('screen');}catch{}}
function releaseWake(){if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}}
const colors={prepare:'#efcf69',work:'#c0ef58',rest:'#f59379',cycleRest:'#efcf69',cooldown:'#88b9dd'};
function setStat(id,value,total){const n=$(id);n.replaceChildren(document.createTextNode(String(value)));if(total)n.append(node('span','', ' / '+total));}
function startWorkout(w){
 try{w=cleanWorkout({...w});}catch(e){toast(e.message);return;}
 if(frame)cancelAnimationFrame(frame);initAudio();
 const now=Date.now(),phases=E.buildPhases(w),clock=new E.Clock(phases),actualClock=new E.Clock([]);
 clock.resume(now);actualClock.resume(now);session={workout:{...w},clock,actualClock,phases,started:now,lastPhase:null,lastSecond:null,lastPeriodic:0,laps:[],skipped:0,skippedSeconds:0,lastTick:now};
 lastWorkout={...w};$('activeRoutine').textContent=w.name;$('laps').replaceChildren();$('skipButton').disabled=false;showScreen('timer');$('pauseButton').replaceChildren(icon('pause'),document.createTextNode('Pausar'));
 $('skipButton').replaceChildren(icon(w.mode==='stopwatch'?'plus':'skip'),node('span','',w.mode==='stopwatch'?'Vuelta':'Saltar'));$('skipButton').setAttribute('aria-label',w.mode==='stopwatch'?'Registrar vuelta':'Saltar intervalo');
 tick();requestWake();$('pauseButton').focus();
}
function tick(){
 if(!session)return;const now=Date.now(),w=session.workout,clock=session.clock,isStopwatch=w.mode==='stopwatch';
 const elapsed=clock.elapsed(now);
 let snap=isStopwatch?null:clock.snapshot(now);
 if(snap?.done){finish(true);return;}
 let phase,remaining,fraction,phaseKey,seconds;
 if(isStopwatch){const preparing=elapsed<w.prepare;remaining=preparing?w.prepare-elapsed:Math.max(0,elapsed-w.prepare);phase={kind:preparing?'prepare':'work',title:preparing?'Prepárate':'Cronómetro',round:1,cycle:1};fraction=preparing?remaining/w.prepare:w.lap?1-(remaining%w.lap)/w.lap:1;phaseKey=preparing?'prepare':'stopwatch';seconds=preparing?Math.ceil(remaining):Math.floor(remaining);
 }else{phase=snap.phase;remaining=snap.remaining;fraction=snap.fraction;phaseKey=snap.index;seconds=Math.ceil(remaining);}
 document.querySelector('.app').style.setProperty('--phase',colors[phase.kind]);$('screenFlash').style.setProperty('--phase',colors[phase.kind]);
 $('phaseLabel').textContent=clock.running?phase.title:'En pausa';
 $('phaseSubtitle').textContent=!clock.running?'Toma aire. Continúa cuando estés listo.':phase.kind==='prepare'?'Un momento para ti.':phase.kind==='work'?(isStopwatch?'Tu ritmo, tu tiempo.':'Este intervalo es tuyo.'):'Recupera. Lo estás haciendo bien.';
 $('timerDigits').textContent=E.format(isStopwatch&&phase.kind!=='prepare'?Math.floor(remaining):remaining);
 $('timerDigits').setAttribute('aria-label',(isStopwatch&&phase.kind!=='prepare'?'Tiempo transcurrido: ':'Tiempo restante: ')+$('timerDigits').textContent);
 $('timerCaption').textContent=isStopwatch&&phase.kind!=='prepare'?'TIEMPO TRANSCURRIDO':'TIEMPO RESTANTE';
 $('progressCircle').style.strokeDashoffset=String(911.062*(1-Math.max(0,Math.min(1,fraction))));
 setStat('roundNumber',isStopwatch?session.laps.length:phase.round,isStopwatch?null:w.rounds);
 setStat('cycleNumber',isStopwatch?(w.lap?E.format(w.lap):'—'):phase.cycle,isStopwatch?null:(w.mode==='rounds'?1:w.cycles));
 $('roundNumber').nextElementSibling.textContent=isStopwatch?'VUELTAS':'RONDA';$('cycleNumber').nextElementSibling.textContent=isStopwatch?'AVISO CADA':'CICLO';
 $('remainingTotal').textContent=E.format(isStopwatch?Math.floor(Math.max(0,elapsed-w.prepare)):Math.max(0,snap.total-snap.elapsed));
 $('remainingTotal').nextElementSibling.textContent=isStopwatch?'ACUMULADO':'POR TERMINAR';
 if(isStopwatch){$('nextPhase').textContent=phase.kind==='prepare'?'Cronómetro libre':w.lap?'Aviso en '+E.format(w.lap-(remaining%w.lap)):'Sin aviso periódico';}
 else{const next=session.phases[snap.index+1];$('nextPhase').textContent=next?next.title+' · '+E.format(next.duration):'¡Entrenamiento completado!';}
 if(session.lastPhase!==phaseKey){if(clock.running){beep(phase.kind==='work'?1000:660,.28);speak(isStopwatch?phase.title:phase.title+(phase.kind==='work'?'. Ronda '+phase.round+' de '+w.rounds+'.':''));flash();}session.lastPhase=phaseKey;session.lastSecond=null;}
 else if(clock.running&&session.lastSecond!==seconds&&seconds>0&&seconds<=3&&(!isStopwatch||phase.kind==='prepare'))beep(600,.1);
 if(isStopwatch&&phase.kind!=='prepare'&&w.lap>0){const periodic=Math.floor(remaining/w.lap);if(periodic>session.lastPeriodic){if(clock.running)beep(950,.3);session.lastPeriodic=periodic;}}
 session.lastSecond=seconds;session.lastTick=now;
 frame=requestAnimationFrame(tick);
}
function togglePause(){
 if(!session)return;const now=Date.now();
 if(session.clock.running){session.clock.pause(now);session.actualClock.pause(now);$('skipButton').disabled=true;if('speechSynthesis'in window)speechSynthesis.cancel();releaseWake();$('pauseButton').replaceChildren(icon('play'),document.createTextNode('Continuar'));}
 else{initAudio();session.clock.resume(now);session.actualClock.resume(now);session.lastPhase=null;$('skipButton').disabled=false;$('pauseButton').replaceChildren(icon('pause'),document.createTextNode('Pausar'));requestWake();}
}
function addLap(){
 if(!session||!session.clock.running||session.workout.mode!=='stopwatch')return;
 const value=Math.max(0,session.clock.elapsed(Date.now())-session.workout.prepare);
 if(session.clock.elapsed(Date.now())<session.workout.prepare){toast('Espera a que termine la preparación.');return;}
 const previous=session.laps.at(-1)||0;session.laps.push(value);const row=node('div','lap-item');row.append(node('span','','Vuelta '+session.laps.length),node('span','',E.format(value-previous)+' / '+E.format(value)));$('laps').prepend(row);beep(950,.12);
}
function skip(){
 if(!session||!session.clock.running)return;if(session.workout.mode==='stopwatch'){addLap();return;}
 const now=Date.now(),before=session.clock.snapshot(now);if(before.done){finish(true);return;}session.skipped++;session.skippedSeconds+=before.remaining;session.clock.skip(now);session.lastPhase=null;
}
async function endSession(){
 const endingSession=session;if(!endingSession)return;
 const confirmed=await confirmAction('¿Terminar sesión?','Se guardará el tiempo que llevas en tu historial.','Terminar');
 if(confirmed&&session===endingSession)finish(endingSession.workout.mode==='stopwatch');
}
function finish(completed){
 if(!session)return;const s=session;session=null;if($('confirmDialog').open)$('confirmDialog').close('cancel');if(frame)cancelAnimationFrame(frame);frame=null;
 const now=Date.now();s.actualClock.pause(now);s.clock.pause(now);releaseWake();if('speechSynthesis'in window)speechSynthesis.cancel();
 const duration=s.workout.mode==='stopwatch'?Math.max(0,s.actualClock.elapsed(now)-s.workout.prepare):E.recordedDuration(s.actualClock.elapsed(now),s.clock.total,s.skippedSeconds);
 const h={id:uid(),name:s.workout.name,mode:s.workout.mode,duration,date:new Date(s.started).toISOString(),completed,skipped:s.skipped,laps:s.laps};history.push(h);persist();
 $('completionTitle').textContent=completed?'¡Lo hiciste!':'Buen trabajo.';
 $('completionMessage').textContent=completed?(s.skipped?'Sesión finalizada · '+s.skipped+' intervalos saltados.':'Entrenamiento completado. Tiempo para recuperar.'):'Tu esfuerzo de hoy ya está en el historial.';
 $('completionTime').textContent=E.format(duration);showScreen('completion');
 if(completed){beep(1100,.45);speak('Entrenamiento completado. Buen trabajo.');flash();}
 $('backButton').focus();
}
$('startButton').addEventListener('click',()=>startWorkout(drafts[currentMode]));
$('pauseButton').addEventListener('click',togglePause);$('skipButton').addEventListener('click',skip);
$('closeTimer').addEventListener('click',endSession);$('endButton').addEventListener('click',endSession);
$('backButton').addEventListener('click',()=>selectMode(currentMode));
$('againButton').addEventListener('click',()=>{if(lastWorkout)startWorkout(lastWorkout);});
$('settingsButton').addEventListener('click',()=>selectMode('more'));
document.querySelector('.mobile-brand').addEventListener('click',ev=>{ev.preventDefault();selectMode('tabata');});
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>selectMode(b.dataset.mode)));
document.addEventListener('visibilitychange',()=>{if(document.hidden){if('speechSynthesis'in window)speechSynthesis.cancel();releaseWake();}else if(session){requestWake();}});
document.addEventListener('keydown',ev=>{if(session&&ev.code==='Space'&&!document.querySelector('dialog[open]')&&!['INPUT','TEXTAREA','BUTTON'].includes(document.activeElement.tagName)){ev.preventDefault();togglePause();}});
$('exportButton').addEventListener('click',()=>{
 const blob=new Blob([JSON.stringify({version:1,profiles,history,prefs},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='pulso-copia-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Copia de seguridad exportada');
});
$('importFile').addEventListener('change',async ev=>{
 const file=ev.target.files[0];if(!file)return;
 try{
 if(file.size>10*1024*1024)throw new Error('La copia debe pesar menos de 10 MB.');
 const data=JSON.parse(await file.text());if(data.version!==1||!Array.isArray(data.profiles)||!Array.isArray(data.history))throw new Error('Esta copia no tiene un formato válido.');
 const imported=data.profiles.map(cleanWorkout);if(imported.some(w=>!w.id))throw new Error('La copia contiene una rutina sin identificador.');
 if(!data.history.every(h=>h&&typeof h.name==='string'&&h.name.length<=60&&typeof h.id==='string'&&Number.isFinite(h.duration)&&h.duration>=0&&typeof h.date==='string'&&!Number.isNaN(Date.parse(h.date))))throw new Error('El historial de la copia no es válido.');
 for(const p of imported)if(!profiles.some(x=>x.id===p.id))profiles.push(p);
 for(const h of data.history)if(!history.some(x=>x.id===h.id))history.push(h);
 history.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));const saved=persist();renderMore();if(saved)toast('Rutinas e historial importados');
 }catch(e){toast(e.message||'No se pudo importar la copia.');}finally{ev.target.value='';}
});
selectMode('tabata');
})();






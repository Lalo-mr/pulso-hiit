const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Engine = require('./engine.js');

// Exercise real app event handlers with a deterministic clock and minimal DOM.
// This checks integration behavior; it does not replace a Safari/device test.
function harness(options = {}) {
  let now = 0, sequence = 0;
  const frames = new Map(), elements = new Map(), spoken = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag.toUpperCase(); this.children = []; this.listeners = new Map();
      this.attributes = {}; this.dataset = {}; this.style = {setProperty(){}};
      this.value = ''; this.hidden = false; this.disabled = false; this.open = false;
      const classes = new Set();
      this.classList = {add: x => classes.add(x), remove: x => classes.delete(x), toggle(x, force) { const enabled = force === undefined ? !classes.has(x) : force; if(enabled) classes.add(x); else classes.delete(x); return enabled; }};
    }
    set textContent(value) { this.children = []; this.text = String(value); }
    get textContent() { return this.text || this.children.map(c => typeof c === 'string' ? c : c.textContent).join(''); }
    append(...items) { this.children.push(...items); }
    prepend(...items) { this.children.unshift(...items); }
    replaceChildren(...items) { this.text = ''; this.children = [...items]; }
    setAttribute(key, value) { this.attributes[key] = String(value); }
    addEventListener(type, handler, options) { const list = this.listeners.get(type) || []; list.push({handler, once: !!options?.once}); this.listeners.set(type,list); }
    fire(type, extra = {}) {
      const list = [...(this.listeners.get(type) || [])];
      const event = {preventDefault(){}, target: this, ...extra};
      const results = list.map(record => { if(record.once) this.listeners.set(type,(this.listeners.get(type) || []).filter(r => r !== record)); return record.handler(event); });
      return Promise.all(results);
    }
    focus() { document.activeElement = this; }
    showModal() { this.open = true; }
    close(value) { if(value !== undefined) this.returnValue = value; this.open = false; this.fire('close'); }
    get nextElementSibling() { if(!this.sibling) this.sibling = new Element('span'); return this.sibling; }
  }
  const get = id => { if(!elements.has(id)) elements.set(id,new Element(id.includes('Button') ? 'button' : 'div')); return elements.get(id); };
  const nav = Object.fromEntries(['tabata','rounds','stopwatch','more'].map(mode => { const e = new Element('button'); e.dataset.mode = mode; return [mode,e]; }));
  const query = new Map([['.app',new Element()],['.summary-label',new Element()],['.mobile-brand',new Element('a')]]);
  const document = new Element();
  Object.assign(document, {
    hidden: false, activeElement: new Element(),
    getElementById: get,
    createElement: tag => new Element(tag),
    createElementNS: (namespace,tag) => { const e = new Element(tag); e.namespaceURI = namespace; return e; },
    createTextNode: text => { const e = new Element(); e.textContent = text; return e; },
    querySelector: selector => selector === 'dialog[open]' ? [...elements.values()].find(e => e.open) || null : query.get(selector) || null,
    querySelectorAll: selector => selector === '[data-mode]' ? Object.values(nav) : []
  });
  const base = {id:null,name:'Prueba',mode:'tabata',prepare:0,work:3,rest:0,rounds:1,cycles:1,cycleRest:0,cooldown:0,lap:20};
  const initial = {version:1,drafts:{tabata:{...base,...options.workout},rounds:{...base,mode:'rounds'},stopwatch:{...base,mode:'stopwatch',prepare:5,...options.stopwatch}},profiles:[],history:[],prefs:{sound:false,voice:true,flash:false,keepAwake:false,...options.prefs}};
  let saved = JSON.stringify(initial);
  const localStorage = {getItem(){return saved;},setItem(key,value){if(options.storageFails) throw new Error('storage unavailable'); saved = value;}};
  class FakeDate extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now(){return now;} }
  const context = {
    console, document, PulsoEngine:Engine, localStorage, structuredClone,
    Date:FakeDate, crypto:{randomUUID:()=>`test-${++sequence}`},
    navigator:{}, matchMedia:()=>({matches:false}),
    requestAnimationFrame:callback => { const id = ++sequence; frames.set(id,callback); return id; },
    cancelAnimationFrame:id => frames.delete(id),
    setTimeout:()=>++sequence, clearTimeout(){}, Blob, URL,
  };
  if(!options.noVoice) {
    context.SpeechSynthesisUtterance = class { constructor(text){this.text=text;} };
    context.speechSynthesis = {paused:false,cancel(){},resume(){},getVoices:()=>[{lang:'es-MX'}],speak:utterance=>spoken.push(utterance)};
  }
  context.window = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'app.js'),'utf8'),context,{filename:'app.js'});
  return {
    get, nav, spoken,
    click: id => get(id).fire('click'),
    advance(ms) { now += ms; const next = frames.entries().next().value; if(next){frames.delete(next[0]); next[1]();} },
    data:()=>JSON.parse(saved)
  };
}

test('voice test starts speech synchronously even with workout voice disabled', async () => {
  const h = harness({prefs:{voice:false}});
  const click = h.click('testVoiceButton');
  assert.equal(h.spoken.length,1);
  assert.match(h.spoken[0].text,/guía de Pulso/);
  assert.equal(h.spoken[0].lang,'es-MX');
  assert.equal(h.data().prefs.voice,false);
  await click;
});

test('unsupported voice reports a useful Safari message without stopping the app', async () => {
  const h = harness({noVoice:true});
  await h.click('testVoiceButton');
  assert.match(h.get('toast').textContent,/Safari/);
  await h.click('startButton');
  assert.equal(h.get('timerScreen').hidden,false);
});

test('finishing naturally while stop confirmation is open closes it and records once', async () => {
  const h = harness();
  await h.click('startButton');
  const stopClick = h.click('endButton');
  assert.equal(h.get('confirmDialog').open,true);
  h.advance(4000);
  await stopClick;
  assert.equal(h.get('confirmDialog').open,false);
  assert.equal(h.get('completionScreen').hidden,false);
  assert.equal(h.data().history.length,1);
  assert.equal(h.data().history[0].duration,3);
});

test('pause blocks skipping and resume announces the preserved phase', async () => {
  const h = harness({workout:{work:20}});
  await h.click('startButton'); h.advance(1000);
  await h.click('pauseButton');
  assert.equal(h.get('skipButton').disabled,true);
  await h.click('skipButton'); // Simulate programmatic click too; handler must guard.
  h.advance(5000);
  assert.equal(h.get('timerDigits').textContent,'00:19');
  const previousVoices = h.spoken.length;
  await h.click('pauseButton'); h.advance(0);
  assert.equal(h.get('skipButton').disabled,false);
  assert.equal(h.get('timerDigits').textContent,'00:19');
  assert.equal(h.spoken.length,previousVoices + 1);
  assert.match(h.spoken.at(-1).text,/Entrena/);
});

test('failed persistence keeps the storage error instead of claiming save success', async () => {
  const h = harness({storageFails:true});
  await h.click('saveButton');
  assert.match(h.get('toast').textContent,/No se pudieron guardar/);
  assert.equal(h.data().profiles.length,0);
});

test('stopwatch history excludes preparation and paused time', async () => {
  const h = harness();
  await h.nav.stopwatch.fire('click');
  await h.click('startButton'); h.advance(8000);
  await h.click('pauseButton'); h.advance(10000);
  const ending = h.click('endButton');
  h.get('confirmDialog').close('ok');
  await ending;
  assert.equal(h.data().history.length,1);
  assert.equal(h.data().history[0].duration,3);
  assert.equal(h.data().history[0].completed,true);
});
